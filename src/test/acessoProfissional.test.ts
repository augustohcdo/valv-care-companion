import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * Guarda: médico não cria conta sozinho, e a porta pública é de fato fechada.
 *
 * Até esta rodada, qualquer pessoa com um e-mail criava conta de médico e
 * digitava um CRM que ninguém conferia — num sistema que organiza prontuário e
 * sugere conduta. O caminho novo é solicitação → conferência → aprovação, e ele
 * tem três formas conhecidas de voltar a vazar:
 *
 * 1. **Um link esquecido.** Bastava um `/auth/cadastro?type=medico` sobrando em
 *    alguma tela para o caminho antigo continuar acessível.
 * 2. **Uma porta pública sem porteiro.** A function que recebe o formulário roda
 *    com `verify_jwt = false`, por definição: quem preenche ainda não tem conta.
 *    Se o captcha deixar de ser exigido *antes* da gravação, é convite para
 *    inundar a fila de aprovação.
 * 3. **Uma policy de INSERT.** `access_requests` não tem nenhuma de propósito —
 *    quem grava é o service_role, pela function. Uma policy para `anon`
 *    devolveria o problema em outra forma.
 */

const raiz = resolve(__dirname, "../..");
const ler = (p: string) => readFileSync(resolve(raiz, p), "utf8");

function arquivosDe(dir: string): string[] {
  return readdirSync(resolve(raiz, dir)).flatMap((nome) => {
    const rel = join(dir, nome);
    try {
      const filhos = readdirSync(resolve(raiz, rel));
      return filhos.length ? arquivosDe(rel) : [];
    } catch {
      return /\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [rel] : [];
    }
  });
}

describe("o autocadastro de médico não existe mais", () => {
  const telas = arquivosDe("src");

  it("nenhum arquivo oferece o cadastro de médico pela query string", () => {
    const vazando = telas.filter((f) => ler(f).includes("cadastro?type=medico"));
    expect(vazando, "links que ainda levam ao cadastro médico").toEqual([]);
  });

  it("o formulário de médico saiu da tela de cadastro", () => {
    const cadastro = ler("src/pages/auth/Cadastro.tsx");
    expect(cadastro).not.toContain("DoctorForm");
    expect(cadastro).not.toMatch(/doctorSignupSchema/);
    // E o passo correspondente saiu da máquina de estados, senão sobraria um
    // caminho morto que alguém religa sem perceber.
    expect(cadastro).not.toMatch(/step === "medico"/);
  });

  it("a tela de cadastro aponta para a solicitação, e a de entrada também", () => {
    expect(ler("src/pages/auth/Cadastro.tsx")).toContain("/acesso-profissional");
    expect(ler("src/pages/auth/Login.tsx")).toContain("/acesso-profissional");
  });

  it("a rota da solicitação existe e é pública", () => {
    const app = ler("src/App.tsx");
    expect(app).toContain('path="/acesso-profissional"');
    // Dentro do grupo público: se caísse atrás de ProtectedRoute, só quem já
    // tem conta conseguiria pedir uma.
    const bloco = app.slice(app.indexOf("{/* Público com layout */}"));
    expect(bloco).toContain('path="/acesso-profissional"');
  });
});

describe("a porta pública da solicitação", () => {
  const funcao = ler("supabase/functions/access-request/index.ts");

  it("verifica o captcha antes de qualquer gravação", () => {
    const captcha = funcao.indexOf("verificarCaptcha(");
    const insert = funcao.indexOf('.from("access_requests")');
    expect(captcha).toBeGreaterThan(0);
    expect(insert).toBeGreaterThan(0);
    expect(captcha, "captcha conferido depois de gravar").toBeLessThan(insert);
  });

  it("sem segredo de captcha configurado, recusa em vez de deixar passar", () => {
    const helper = ler("supabase/functions/_shared/captcha.ts");
    const bloco = helper.slice(helper.indexOf('Deno.env.get("TURNSTILE_SECRET_KEY")'));
    expect(bloco.slice(0, 600)).toMatch(/captcha_indisponivel/);
    expect(bloco).not.toMatch(/return \{ ok: true \};[\s\S]{0,40}\/\/ sem segredo/);
  });

  it("exige o consentimento do diretório para aceitar o pedido", () => {
    // É a condição combinada: o médico aparece na vitrine, e a anuência é
    // colhida no ato do pedido — não presumida depois.
    expect(funcao).toContain("consent_diretorio !== true");
    expect(ler("src/pages/public/AcessoProfissional.tsx")).toContain("consentDiretorio");
  });

  it("a function está declarada como pública no config", () => {
    const cfg = ler("supabase/config.toml");
    const bloco = cfg.slice(cfg.indexOf("[functions.access-request]"));
    expect(bloco.slice(0, 60)).toContain("verify_jwt = false");
  });
});

describe("a tabela da fila", () => {
  /** A migration mais recente que cria/mexe na tabela é a que vale. */
  function migrationDaTabela(): string {
    const dir = resolve(raiz, "supabase/migrations");
    const arquivos = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    const comTabela = arquivos.filter((f) =>
      /create table if not exists public\.access_requests/i.test(readFileSync(resolve(dir, f), "utf8")));
    expect(comTabela.length, "nenhuma migration cria access_requests").toBeGreaterThan(0);
    return readFileSync(resolve(dir, comTabela[comTabela.length - 1]), "utf8");
  }

  it("tem RLS ligada e nenhuma policy de INSERT", () => {
    const sql = migrationDaTabela();
    expect(sql).toMatch(/alter table public\.access_requests enable row level security/i);
    const inserts = sql.match(/create policy[\s\S]{0,200}?on public\.access_requests[\s\S]{0,80}?for insert/gi);
    expect(inserts, "policy de INSERT em access_requests").toBeNull();
  });

  it("guarda quem conferiu o CRM e quando, não só que conferiu", () => {
    const sql = migrationDaTabela();
    expect(sql).toContain("crm_conferido_por");
    expect(sql).toContain("crm_conferido_em");
  });
});

describe("aprovar cria a conta, não muda um status", () => {
  const funcao = ler("supabase/functions/access-decide/index.ts");

  it("cria usuário, registro de médico e papel", () => {
    expect(funcao).toContain("auth.admin.createUser");
    expect(funcao).toContain('.from("doctors")');
    expect(funcao).toContain('.from("user_roles")');
  });

  it("o selo de verificado depende da conferência do CRM", () => {
    // Ligar `verified` por aprovação administrativa esvaziaria o selo, que é o
    // que autoriza um médico a aprovar conteúdo clínico.
    expect(funcao).toMatch(/verified: !!pedido\.crm_conferido_em/);
  });

  it("nunca manda senha por e-mail — manda link para a pessoa definir a dela", () => {
    expect(funcao).toContain("generateLink");
    expect(funcao).not.toMatch(/password:\s*['"`]/);
  });

  it("recusa exige motivo, e o motivo vai ao profissional", () => {
    expect(funcao).toContain('return json({ error: "recusa exige motivo" }, 400)');
    const bloco = funcao.slice(funcao.indexOf("// ------------------------------------------------------------- recusa"));
    expect(bloco.slice(0, 1800)).toContain("sendEmail");
  });

  it("é admin-only", () => {
    const antesDaAcao = funcao.slice(0, funcao.indexOf("auth.admin.createUser"));
    expect(antesDaAcao).toContain('json({ error: "unauthorized" }, 401)');
    expect(antesDaAcao).toContain('json({ error: "forbidden" }, 403)');
  });
});
