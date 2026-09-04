// Este teste lê o disco; tsconfig.app.json restringe `types`, daí a referência.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  TRECHOS_ESPERADOS_NO_SEED,
  lerResultadoDoSeed,
} from "@/data/baseDaIA";

/**
 * O detector de função desatualizada, e o número que o sustenta.
 *
 * ## O defeito que ele existe para pegar
 *
 * O front e as edge functions sobem por caminhos diferentes: a Vercel publica a
 * cada push na `main`, as functions não. O usuário clicou em "Popular base" e
 * recebeu `{ ok: true, inserted: 0, skipped: 11, total: 11 }` — o repositório
 * tinha 18 trechos. A função em produção era código velho, e nada na resposta
 * dizia isso. Durante esse tempo o painel de conduta afirmava "ESC/EACTS 2025"
 * enquanto a IA respondia pela edição de 2021, porque o prompt dela também não
 * tinha subido.
 *
 * ## Por que o número não pode ser digitado à mão e esquecido
 *
 * Um valor fixo que ninguém atualiza vira ruído: acusa desatualização em toda
 * rodada que mexe no seed, e aí alguém o ignora — ou pior, o apaga. Então este
 * teste CONTA os trechos no `knowledge-seed/index.ts` e cobra a igualdade.
 * Mexeu no seed sem atualizar o número? Reprova aqui, não em produção.
 */

const SEED = "supabase/functions/knowledge-seed/index.ts";

/**
 * Quantos trechos o arquivo do seed declara hoje.
 *
 * A âncora `^\s+` é o que separa a declaração de cada trecho — indentada dentro
 * do array — da linha do `type SeedChunk`, onde `source_slug` vem depois de
 * `{ `. Minha primeira versão descontava o tipo ALÉM da âncora, e contava 17
 * onde havia 18: o teste reprovou por causa do próprio contador, não do número.
 */
function trechosNoSeed(): number {
  return (readFileSync(SEED, "utf8").match(/^\s+source_slug:/gm) ?? []).length;
}

describe("o número de trechos que o site espera do seed", () => {
  it("bate com o que o arquivo do seed declara", () => {
    const contados = trechosNoSeed();
    expect(contados, "a contagem falhou — o formato do SEED mudou").toBeGreaterThan(5);
    expect(
      TRECHOS_ESPERADOS_NO_SEED,
      `O seed tem ${contados} trechos e src/data/baseDaIA.ts espera ` +
        `${TRECHOS_ESPERADOS_NO_SEED}. Atualize a constante: é ela que faz a tela ` +
        "perceber quando a função publicada está atrasada.",
    ).toBe(contados);
  });
});

describe("a leitura do resultado do seed", () => {
  const completo = TRECHOS_ESPERADOS_NO_SEED;

  it("acusa a função desatualizada pelo total, mesmo com ok: true", () => {
    // Exatamente a resposta que veio da produção.
    const r = lerResultadoDoSeed({ inserted: 0, skipped: 11, total: 11 });
    expect(r.nivel).toBe("erro");
    expect(r.titulo).toMatch(/desatualizada/i);
    expect(r.detalhe).toContain("11");
    expect(r.detalhe).toContain(String(completo));
  });

  it("acusa também quando a resposta nem traz o total", () => {
    // A versão MAIS antiga da função não devolvia `total`. Tratar `undefined`
    // como "não sei, então está ok" seria o buraco que este detector existe
    // para fechar.
    const r = lerResultadoDoSeed({ inserted: 0, skipped: 11 });
    expect(r.nivel).toBe("erro");
  });

  it("com a função em dia, aponta a fonte que falta cadastrar", () => {
    const r = lerResultadoDoSeed({
      inserted: 0, skipped: 11, total: completo,
      fontes_nao_cadastradas: ["esc-eacts-2025-vhd"],
    });
    expect(r.nivel).toBe("erro");
    expect(r.detalhe).toContain("esc-eacts-2025-vhd");
    expect(r.detalhe).toMatch(/SQL/);
  });

  it("distingue 'nada novo' de sucesso", () => {
    // O toast antigo dizia "Base RAG populada" com `inserted: 0`. Verde, para o
    // desfecho em que nada entrou.
    const nada = lerResultadoDoSeed({ inserted: 0, skipped: completo, total: completo });
    expect(nada.nivel).toBe("aviso");
    expect(nada.titulo).not.toMatch(/populada/i);

    const ok = lerResultadoDoSeed({ inserted: 7, skipped: 11, total: completo });
    expect(ok.nivel).toBe("ok");
    expect(ok.titulo).toContain("7");
    expect(ok.detalhe, "sumiu o aviso de que os trechos são preliminares")
      .toMatch(/preliminares|revisão médica/i);
  });

  it("nenhum desfecho chama de sucesso o que não inseriu nada", () => {
    // Contraprova do conjunto: varre as combinações e exige que "ok" implique
    // trecho inserido. Sem isto, afrouxar um ramo passaria despercebido.
    for (const inserted of [0, 1, 7]) {
      for (const total of [11, completo]) {
        const r = lerResultadoDoSeed({ inserted, skipped: 3, total });
        if (r.nivel === "ok") {
          expect(inserted, `nível "ok" com inserted=${inserted}`).toBeGreaterThan(0);
          expect(total, `nível "ok" com função desatualizada (total=${total})`).toBe(completo);
        }
      }
    }
  });
});
