import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { semComentariosDeCodigo } from "./semComentariosDeCodigo";

/**
 * Guarda: toda function alcançável sem sessão tem porteiro próprio.
 *
 * `verify_jwt = false` no `config.toml` desliga a checagem da plataforma. Quem
 * autoriza, a partir daí, é a própria function — e cinco delas não tinham teste
 * nenhum quando isto foi escrito. Uma porta pública cujo porteiro quebrou não
 * dá erro em lugar nenhum: ela **responde**, que é o pior formato de defeito
 * deste projeto.
 *
 * Medido em produção, chamando cada uma sem credencial:
 * `admin-digest`, `weekly-digest`, `job-watchdog`, `weekly-export`,
 * `offsite-copy` e `welcome-email` devolvem 401; `fhir-ingest` 401;
 * `fhir-read` 400; `access-request` 403 (captcha). As duas que respondem 200
 * são as que devem: `turnstile-config`, que devolve a chave que já viaja na
 * página, e `report-error`, que é o canal de erro do navegador.
 *
 * Esta guarda não substitui aquela medição — ela impede que o porteiro seja
 * removido do código sem ninguém ver.
 *
 * ## O que a primeira versão desta guarda realmente conferia
 *
 * Ela aceitava quatro "porteiros" casando texto em qualquer lugar do arquivo,
 * comentário incluído, e um dos padrões era `/api[-_]?key/i`. Toda function
 * deste projeto tem a linha
 *
 *     "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, …"
 *
 * — então aquele padrão casava com o **cabeçalho CORS**, que não autoriza
 * ninguém. Medido em 2026-10-15: apagando as 26 linhas do porteiro do
 * `fhir-read` (leitura da `x-api-key`, comparação do hash, revogação, validade
 * e escopo), as três guardas deste arquivo seguiram VERDES. O endpoint de
 * leitura de dados clínicos por hospital podia ficar aberto com a CI verde.
 *
 * `fhir-ingest` passava por um comentário na linha 2 (`// Auth: Header
 * X-Api-Key: …`) — uma guarda que lê comentário não confere código, e o
 * comentário é justamente a parte que sobrevive quando alguém apaga a
 * verificação.
 *
 * Nenhuma das duas tinha buraco: o porteiro das duas é completo. O buraco era
 * na guarda, que é o lugar onde ele não aparece em teste nenhum.
 *
 * ## Como a regra passou a medir
 *
 * Em cima do código SEM COMENTÁRIO, e por FORMA, não por vocabulário:
 *
 *   1. a credencial é lida na forma exata que a lê (`req.headers.get(
 *      "x-api-key")`, e não a palavra `apikey` solta — um cabeçalho CORS não
 *      satisfaz isso);
 *   2. existe recusa — resposta 401 ou 403 — depois da leitura;
 *   3. a recusa vem ANTES da primeira escrita.
 *
 * E cada function declara aqui QUAL porteiro tem. Trocar o porteiro por outro
 * qualquer deixa de passar: a regra de ordem sozinha ficaria contente com um
 * 401 que fala de outra coisa.
 *
 * O que esta guarda NÃO prova, escrito para ninguém ler mais do que está aqui:
 * que o 401 encontrado é *sobre aquela* credencial. Isso quem prova é a
 * medição em produção do cabeçalho — as duas juntas é que cobrem.
 */

const raiz = resolve(__dirname, "../..");
const ler = (p: string) => readFileSync(resolve(raiz, p), "utf8");
const CONFIG = ler("supabase/config.toml");

/** Como cada credencial ENTRA — a forma, não a palavra. */
const LEITURA: Record<string, RegExp> = {
  cron: /req\.headers\.get\(\s*["']x-cron-secret["']\s*\)/,
  apiKey: /req\.headers\.get\(\s*["']x-api-key["']\s*\)/,
  sessao: /\.auth\.getUser\(/,
  captcha: /\bverificarCaptcha\(/,
};

/**
 * A recusa, e o que conta como escrita.
 *
 * `.rpc(` ficou FORA, e isso foi medido: a primeira versão desta regra o
 * contava como escrita e acusou o `knowledge-seed` de "escrever antes de
 * recusar" na linha 257 — que é `admin.rpc("has_role", …)`, o próprio porteiro.
 * Todos os `rpc` das dez portas públicas são leitura (`has_role`,
 * `admin_site_metrics`, `admin_recipients`, `recent_confirmed_users`,
 * `doctor_weekly_digest`), então incluí-lo dava um falso vermelho e nenhum
 * acerto. Falso vermelho custa o mesmo que falso verde.
 *
 * O limite que isso deixa, escrito para ninguém supor o contrário: a regra vê
 * escrita DIRETA em tabela. Escrita feita dentro de um `rpc` ou de um auxiliar
 * compartilhado — como o `registrarEventoDeIntegracao` do `fhir-read` — não é
 * vista por ela.
 */
const RECUSA = /\b(?:401|403)\b/;
const ESCRITAS = [".insert(", ".upsert(", ".update(", ".delete("];

/**
 * Qual porteiro cada porta pública tem.
 *
 * Nominal de propósito. A regra de ordem (ler → recusar → escrever) ficaria
 * satisfeita com qualquer 401 no arquivo; declarar o porteiro é o que faz
 * "trocaram o porteiro por outro" reprovar.
 */
const PORTEIRO_DE: Record<string, string[]> = {
  "fhir-read": ["apiKey"],
  "fhir-ingest": ["apiKey"],
  "knowledge-seed": ["cron", "sessao"],
  "weekly-export": ["cron", "sessao"],
  "weekly-digest": ["cron", "sessao"],
  "job-watchdog": ["cron"],
  "welcome-email": ["cron"],
  "admin-digest": ["cron"],
  "offsite-copy": ["cron"],
  "access-request": ["captcha"],
};

/**
 * As duas que devem mesmo responder a qualquer um, e por quê. Qualquer outra
 * function pública precisa de porteiro — e se uma nova entrar aqui, tem que
 * vir com a justificativa escrita.
 */
const ABERTAS_DE_PROPOSITO: Record<string, string> = {
  "turnstile-config": "devolve a site key do captcha, que já viaja no HTML da página",
  "report-error": "canal de erro do navegador; quem falha ainda não tem sessão utilizável",
};

/**
 * Os blocos `[functions.X]` do config, com o corpo de cada um.
 *
 * Por bloco, e não por regex de adjacência: a versão anterior exigia
 * `verify_jwt = false` na linha IMEDIATAMENTE seguinte ao cabeçalho, de modo
 * que um comentário no meio tornaria a function invisível para a guarda. Filtro
 * que deixa de casar devolve lista curta, e lista curta passa por piso de
 * "> 0" — é o defeito que esta sessão já consertou em três guardas.
 */
function blocosDeFuncao(toml: string): Map<string, string> {
  const blocos = new Map<string, string>();
  const partes = toml.split(/^\[functions\.([a-z0-9-]+)\]$/m);
  for (let i = 1; i < partes.length; i += 2) blocos.set(partes[i], partes[i + 1] ?? "");
  return blocos;
}

const BLOCOS = blocosDeFuncao(CONFIG);

/** As functions declaradas como públicas no config. */
function publicas(): string[] {
  return [...BLOCOS].filter(([, corpo]) => /verify_jwt\s*=\s*false/.test(corpo)).map(([n]) => n);
}

/** As pastas de function no disco (as que o CLI publica). */
function noDisco(): string[] {
  const dir = resolve(raiz, "supabase/functions");
  return readdirSync(dir).filter(
    (n) => !n.startsWith("_") && n !== "node_modules"
      && statSync(resolve(dir, n)).isDirectory(),
  );
}

/** Índice da primeira linha que casa, ou `Infinity`. */
function linhaDe(linhas: string[], alvo: RegExp | string): number {
  const i = linhas.findIndex((l) => (typeof alvo === "string" ? l.includes(alvo) : alvo.test(l)));
  return i < 0 ? Infinity : i + 1;
}

describe("as portas públicas", () => {
  it("o parser do config não pula bloco nenhum", () => {
    /**
     * O piso que faltava. `publicas().length > 0` passaria com UMA function
     * classificada de doze — e um filtro que degrada é exatamente assim que
     * chega a uma. Aqui as duas contagens têm de bater: cabeçalhos no texto
     * contra blocos lidos.
     */
    const cabecalhos = [...CONFIG.matchAll(/^\[functions\.([a-z0-9-]+)\]$/gm)].map((m) => m[1]);
    expect(cabecalhos.length, "o config não declara function nenhuma").toBeGreaterThan(5);
    expect([...BLOCOS.keys()].sort(), "o parser perdeu blocos do config")
      .toEqual(cabecalhos.sort());
    // E todo bloco tem um `verify_jwt` explícito: deixar no padrão é deixar o
    // alcance da function por conta de um default que ninguém escreveu.
    for (const [nome, corpo] of BLOCOS) {
      expect(corpo, `o bloco de ${nome} não declara verify_jwt`).toMatch(/verify_jwt\s*=\s*(?:true|false)/);
    }
  });

  it("toda function do disco tem verify_jwt escrito no config", () => {
    /**
     * Seis functions não estavam no config — `clinical-ai`, `account-close`,
     * `dpo-export`, `access-decide`, `hospital-api-key-create` e
     * `knowledge-ingest` — e exigiam JWT pelo PADRÃO do CLI, não por decisão
     * escrita. Medido em produção em 2026-10-15: as seis devolvem 401 sem
     * credencial, então o padrão estava a favor. Mas o comentário do workflow de
     * deploy dizia que o `verify_jwt` "de cada função vem do config.toml, e o
     * CLI o respeita — é o que mantém a `clinical-ai` exigindo JWT", e isso era
     * falso para justamente aquela: ela não estava lá. Alcance de function
     * sensível não deve depender de default de ferramenta de terceiro.
     */
    const faltando = noDisco().filter((f) => !BLOCOS.has(f));
    expect(faltando, `functions sem verify_jwt no config: ${faltando.join(", ")}`).toEqual([]);
  });

  it("toda porta pública está classificada — e nenhuma classificação sobra", () => {
    const lista = publicas();
    expect(lista.length, "nenhuma function pública encontrada no config").toBeGreaterThan(0);

    const classificadas = new Set([...Object.keys(PORTEIRO_DE), ...Object.keys(ABERTAS_DE_PROPOSITO)]);
    const semClasse = lista.filter((f) => !classificadas.has(f));
    expect(semClasse, `porta pública sem porteiro declarado: ${semClasse.join(", ")}`).toEqual([]);

    // O outro lado: entrada aqui para function que não é mais pública (ou nem
    // existe) faz a guarda cobrar sobre o vazio e parecer que cobriu.
    const sobrando = [...classificadas].filter((f) => !lista.includes(f));
    expect(sobrando, `classificação sem porta pública correspondente: ${sobrando.join(", ")}`).toEqual([]);
  });

  it("cada porteiro declarado está no código, na forma que o faz porteiro", () => {
    let conferidos = 0;
    for (const [f, chaves] of Object.entries(PORTEIRO_DE)) {
      const caminho = `supabase/functions/${f}/index.ts`;
      const codigo = semComentariosDeCodigo(ler(caminho), caminho);
      for (const chave of chaves) {
        expect(
          LEITURA[chave].test(codigo),
          `${f} declara porteiro \`${chave}\` e o código não lê a credencial na forma que a lê`,
        ).toBe(true);
        conferidos++;
      }
    }
    // Piso sobre o que o LAÇO conferiu, não sobre os arquivos lidos: um
    // `PORTEIRO_DE` vazio deixaria tudo verde sem olhar nada.
    expect(conferidos, "nenhum porteiro foi conferido").toBeGreaterThanOrEqual(12);
  });

  it("a recusa vem antes de qualquer escrita", () => {
    /**
     * Ordem, não presença. O porteiro que confere depois de gravar já gravou —
     * e esta base tem a cicatriz: o `&& ip &&` do `fhir-ingest` pulava a lista
     * de permissão quando não havia IP determinável.
     */
    let comEscrita = 0;
    for (const [f, chaves] of Object.entries(PORTEIRO_DE)) {
      const caminho = `supabase/functions/${f}/index.ts`;
      const linhas = semComentariosDeCodigo(ler(caminho), caminho).split("\n");

      const leitura = Math.min(...chaves.map((c) => linhaDe(linhas, LEITURA[c])));
      const recusa = linhaDe(linhas.slice(leitura - 1), RECUSA) + leitura - 1;
      const escrita = Math.min(...ESCRITAS.map((t) => linhaDe(linhas, t)));

      expect(recusa, `${f} lê a credencial e não recusa em lugar nenhum`).toBeLessThan(Infinity);
      if (escrita !== Infinity) {
        comEscrita++;
        expect(recusa, `${f} escreve (linha ${escrita}) antes de recusar (linha ${recusa})`)
          .toBeLessThan(escrita);
      }
    }
    // Sem isto, a regra de ordem passaria sobre um conjunto em que ninguém
    // escreve — verdade vazia. São 7 de 10 hoje, medido: `weekly-export`,
    // `job-watchdog` e `offsite-copy` só leem e mandam para fora.
    expect(comEscrita, "nenhuma das portas públicas escreve: a ordem não foi exercida")
      .toBeGreaterThanOrEqual(6);
  });

  it("report-error nunca aceita user_id vindo do corpo", () => {
    // Medido: um anônimo mandou `user_id` de outra conta e a linha foi gravada
    // com `user_id: null`. Se isso mudar, qualquer pessoa passa a poder
    // atribuir erros forjados a um médico — e o painel de erros do
    // administrador vira testemunho falso.
    const caminho = "supabase/functions/report-error/index.ts";
    const semComentario = semComentariosDeCodigo(ler(caminho), caminho);
    expect(semComentario, "report-error lê user_id do corpo").not.toMatch(/body\.user_id|body\["user_id"\]/);
  });

  it("as funções de tarefa exigem o segredo do cron antes de agir", () => {
    for (const f of ["weekly-export", "offsite-copy", "admin-digest", "weekly-digest", "job-watchdog", "welcome-email"]) {
      const caminho = `supabase/functions/${f}/index.ts`;
      const codigo = semComentariosDeCodigo(ler(caminho), caminho);
      const conferencia = codigo.search(LEITURA.cron);
      expect(conferencia, `${f} não confere o segredo do cron`).toBeGreaterThan(0);
      // E a conferência vem antes de qualquer escrita relevante.
      const primeiraEscrita = Math.min(
        ...[".insert(", ".upsert(", ".update("].map((t) => {
          const i = codigo.indexOf(t);
          return i === -1 ? Number.MAX_SAFE_INTEGER : i;
        }),
      );
      if (primeiraEscrita !== Number.MAX_SAFE_INTEGER) {
        expect(conferencia, `${f} escreve antes de conferir o segredo`).toBeLessThan(primeiraEscrita);
      }
    }
  });
});
