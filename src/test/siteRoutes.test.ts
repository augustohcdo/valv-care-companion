// Este teste lê o roteador e a lista do vigia do disco.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Guarda contra o vigia diário sondar rotas que não existem mais.
 *
 * `supabase/functions/_shared/siteRoutes.ts` traz a lista curta de rotas que o
 * `job-watchdog` pede ao site todo dia. Ela existe porque o site ficou uma
 * semana devolvendo o 404 da Vercel em toda rota que não fosse `/`, e nada no
 * sistema notou — toda verificação olhava o banco, nunca a entrega.
 *
 * O risco dessa lista é o de sempre: envelhecer longe daquilo que descreve.
 * Renomear uma rota no `App.tsx` deixaria o vigia cobrando um caminho extinto,
 * e o alerta diário passaria a gritar sobre nada — até alguém aprender a
 * ignorá-lo, que é como um alarme morre.
 */

const APP = "src/App.tsx";
const LISTA = "supabase/functions/_shared/siteRoutes.ts";

function rotasDoApp(): string[] {
  const fonte = readFileSync(APP, "utf8");
  return [...fonte.matchAll(/<Route\s+path="([^"]+)"/g)]
    .map((m) => m[1]!)
    .filter((p) => p.startsWith("/"));
}

function rotasVigiadas(): string[] {
  const fonte = readFileSync(LISTA, "utf8");
  const bloco = fonte.slice(
    fonte.indexOf("ROTAS_CRITICAS"),
    fonte.indexOf("] as const"),
  );
  return [...bloco.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
}

describe("rotas vigiadas pelo job-watchdog", () => {
  it("a lista não está vazia — vigia sem rota é vigia que nunca acusa nada", () => {
    expect(rotasVigiadas().length).toBeGreaterThan(0);
  });

  it("toda rota vigiada existe de verdade no App.tsx", () => {
    const reais = new Set(rotasDoApp());
    const inexistentes = rotasVigiadas().filter((r) => !reais.has(r));
    expect(inexistentes).toEqual([]);
  });

  /**
   * As quatro que o defeito de produção quebrou de fato: o link do e-mail de
   * redefinição, o retorno do login com Google, e a confirmação de cadastro,
   * que aponta para as áreas clínicas. Se alguém encurtar a lista, que seja
   * uma decisão, não um descuido.
   */
  it("cobre os caminhos que o 404 quebrou em produção", () => {
    const vigiadas = rotasVigiadas();
    for (const rota of ["/", "/auth/redefinir", "/auth/callback", "/app/medico", "/app/paciente"]) {
      expect(vigiadas).toContain(rota);
    }
  });
});
