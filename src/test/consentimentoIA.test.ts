import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * Guarda: o consentimento de IA é cobrado no servidor, e todo chamador avisa.
 *
 * Ele existia só no navegador. `ClinicalAIPanel` mostrava a parede de
 * consentimento, `DocumentGenerator` chamava `hasActiveConsent` — e a edge
 * function aceitava qualquer requisição autenticada e mandava o caso ao
 * provedor. Medido na auditoria dos dez modos: um médico descartável, criado
 * **sem nenhum consentimento registrado**, rodou todos eles sem ser barrado.
 * `extract_echo`, que envia o laudo inteiro, não tinha nem a checagem do
 * navegador.
 *
 * A Política de Privacidade publicada afirma, duas vezes, que o envio "só
 * ocorre mediante o consentimento específico". Com a checagem no cliente, isso
 * era uma afirmação sobre a interface, não sobre o sistema — mesma família do
 * captcha que rodava só no navegador e do backup que estava agendado e nunca
 * gravou arquivo.
 */

const raiz = resolve(__dirname, "../..");
const consentimento = readFileSync(resolve(raiz, "src/lib/consent.ts"), "utf8");
const politica = readFileSync(resolve(raiz, "src/pages/public/Privacidade.tsx"), "utf8");
const funcao = readFileSync(
  resolve(raiz, "supabase/functions/clinical-ai/index.ts"), "utf8",
);

function arquivosDe(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivosDe(caminho);
    return /\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

describe("consentimento de IA no servidor", () => {
  it("a função consulta user_consents para ai_processing", () => {
    expect(funcao).toContain('.eq("consent_type", "ai_processing")');
    expect(funcao).toContain('.from("user_consents")');
  });

  it("recusa quando não há consentimento, e com código próprio", () => {
    expect(funcao).toContain('error: "consent_required"');
  });

  it("a checagem vem antes de qualquer chamada ao provedor de IA", () => {
    // Se ela ficasse depois, o dado já teria saído — a recusa seria decorativa.
    const consentimento = funcao.indexOf('"consent_required"');
    const primeiraChamada = Math.min(
      ...["callGemini(", "embedQuery("]
        .map((t) => funcao.indexOf(t, funcao.indexOf("Deno.serve")))
        .filter((i) => i > 0),
    );
    expect(consentimento).toBeGreaterThan(0);
    expect(consentimento).toBeLessThan(primeiraChamada);
  });

  it("a recusa não consome a cota horária de quem depois consentir", () => {
    expect(funcao.indexOf('"consent_required"'))
      .toBeLessThan(funcao.indexOf('action: "clinical_ai_call"'));
  });
});

describe("consentimento de IA no cliente", () => {
  const chamadores = arquivosDe(resolve(raiz, "src"))
    .filter((f) => readFileSync(f, "utf8").includes('invoke("clinical-ai"'));

  it("existem chamadores para varrer", () => {
    // Sem esta asserção, renomear a função faria a varredura devolver lista
    // vazia e o teste passar sem conferir nada.
    expect(chamadores.length).toBeGreaterThanOrEqual(3);
  });

  it("todo chamador confere o consentimento antes de invocar", () => {
    const sem = chamadores.filter(
      (f) => !readFileSync(f, "utf8").includes("hasActiveConsent(\"ai_processing\")"),
    );
    expect(sem.map((f) => f.replace(raiz + "/", "")),
      "chamadores da IA sem checagem de consentimento").toEqual([]);
  });

  it("todo chamador traduz a recusa 403 em explicação", () => {
    const sem = chamadores.filter((f) => {
      const t = readFileSync(f, "utf8");
      return !(t.includes("status === 403") && t.includes("AVISO_CONSENTIMENTO_IA"));
    });
    expect(sem.map((f) => f.replace(raiz + "/", "")),
      "chamadores que mostrariam erro cru em vez do motivo").toEqual([]);
  });
});

/**
 * Guarda: o que o código envia e o que o consentimento promete não podem
 * divergir.
 *
 * Divergiam. O texto dizia que os dados iam ao Google "— sem meu nome",
 * enquanto `extract_echo` aceitava `fileBase64` e mandava o laudo inteiro, com
 * nome, data de nascimento e número de registro impressos nele. O campo do caso
 * sempre foi minimizado; o documento nunca esteve. Um consentimento que
 * descreve metade do envio não é informado.
 */
describe("o consentimento descreve o envio de verdade", () => {
  it("a função de fato aceita arquivo — é o que torna a guarda necessária", () => {
    // Se este caminho for removido um dia, a exigência abaixo pode cair junto.
    // Enquanto ele existir, o texto tem que falar dele.
    expect(funcao).toContain("fileBase64");
    expect(funcao).toContain("inlineData");
  });

  it("o texto do consentimento avisa que o arquivo anexado vai como está", () => {
    const bloco = consentimento.slice(
      consentimento.indexOf('type: "ai_processing"'),
      consentimento.indexOf('type: "cookies_functional"'),
    );
    expect(bloco).toMatch(/laudo é anexado/);
    expect(bloco).toMatch(/enviado como está/);
  });

  it("o texto não volta a prometer que o nome nunca é enviado", () => {
    const bloco = consentimento.slice(
      consentimento.indexOf('description:', consentimento.indexOf('type: "ai_processing"')),
      consentimento.indexOf('required: false', consentimento.indexOf('type: "ai_processing"')),
    );
    expect(bloco).not.toMatch(/sem meu nome/);
  });

  it("a Política de Privacidade descreve os dois caminhos", () => {
    expect(politica).toMatch(/anexa o laudo/);
    expect(politica).toMatch(/enviado como está/);
    // A frase antiga hedgeava com "sempre que tecnicamente possível", o que
    // sugeria minimização onde não há nenhuma.
    expect(politica).not.toMatch(/minimizado\/omitido nessas chamadas sempre que tecnicamente possível/);
  });

  it("o consentimento de IA anda em versão própria, por ter mudado de sentido", () => {
    // Subir a versão global re-versionaria Termos e Política que não mudaram,
    // e o registro diria que a pessoa aceitou uma revisão que nunca existiu.
    expect(consentimento).toMatch(/version: "2\.3"/);
    expect(consentimento).toContain("export function versaoDoConsentimento");
  });
});
