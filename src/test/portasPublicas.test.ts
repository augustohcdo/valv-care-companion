import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

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
 */

const raiz = resolve(__dirname, "../..");
const ler = (p: string) => readFileSync(resolve(raiz, p), "utf8");
const CONFIG = ler("supabase/config.toml");

/** As functions declaradas como públicas no config. */
function publicas(): string[] {
  return [...CONFIG.matchAll(/\[functions\.([a-z-]+)\]\s*\nverify_jwt = false/g)].map((m) => m[1]);
}

/**
 * As duas que devem mesmo responder a qualquer um, e por quê. Qualquer outra
 * function pública precisa de porteiro — e se uma nova entrar aqui, tem que
 * vir com a justificativa escrita.
 */
const ABERTAS_DE_PROPOSITO: Record<string, string> = {
  "turnstile-config": "devolve a site key do captcha, que já viaja no HTML da página",
  "report-error": "canal de erro do navegador; quem falha ainda não tem sessão utilizável",
};

describe("as portas públicas", () => {
  it("o config declara as que eu medi, e nenhuma a mais sem porteiro", () => {
    const lista = publicas();
    expect(lista.length, "nenhuma function pública encontrada no config").toBeGreaterThan(0);
    for (const f of lista) {
      if (f in ABERTAS_DE_PROPOSITO) continue;
      const fonte = ler(`supabase/functions/${f}/index.ts`);
      // Porteiro é: segredo de cron, chave de API, ou sessão conferida na mão.
      const temPorteiro =
        /x-cron-secret/.test(fonte) ||
        /api[-_]?key/i.test(fonte) ||
        /getUser\(/.test(fonte) ||
        /verificarCaptcha/.test(fonte);
      expect(temPorteiro, `${f} é pública e não tem porteiro próprio`).toBe(true);
    }
  });

  it("report-error nunca aceita user_id vindo do corpo", () => {
    // Medido: um anônimo mandou `user_id` de outra conta e a linha foi gravada
    // com `user_id: null`. Se isso mudar, qualquer pessoa passa a poder
    // atribuir erros forjados a um médico — e o painel de erros do
    // administrador vira testemunho falso.
    const fonte = ler("supabase/functions/report-error/index.ts");
    const semComentario = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(semComentario, "report-error lê user_id do corpo").not.toMatch(/body\.user_id|body\["user_id"\]/);
  });

  it("as funções de tarefa exigem o segredo do cron antes de agir", () => {
    for (const f of ["weekly-export", "offsite-copy", "admin-digest", "weekly-digest", "job-watchdog", "welcome-email"]) {
      const fonte = ler(`supabase/functions/${f}/index.ts`);
      const conferencia = fonte.indexOf("x-cron-secret");
      expect(conferencia, `${f} não confere o segredo do cron`).toBeGreaterThan(0);
      // E a conferência vem antes de qualquer escrita relevante.
      const primeiraEscrita = Math.min(
        ...[".insert(", ".upsert(", ".update("].map((t) => {
          const i = fonte.indexOf(t);
          return i === -1 ? Number.MAX_SAFE_INTEGER : i;
        }),
      );
      if (primeiraEscrita !== Number.MAX_SAFE_INTEGER) {
        expect(conferencia, `${f} escreve antes de conferir o segredo`).toBeLessThan(primeiraEscrita);
      }
    }
  });
});
