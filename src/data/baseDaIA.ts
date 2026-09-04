/**
 * O que a versão PUBLICADA da `knowledge-seed` deveria estar semeando.
 *
 * ## Por que este arquivo existe
 *
 * O front (Vercel) e as edge functions (Supabase) são publicados por caminhos
 * DIFERENTES. O Vercel sobe a cada push na `main`; as functions, não — e
 * descobrimos isso do pior jeito: o repositório tinha 18 trechos e a função em
 * produção rodou com 11, respondendo `ok: true` sem nenhum sinal de que era
 * código velho. Durante esse tempo o painel de conduta dizia "ESC/EACTS 2025" e
 * a IA respondia pela edição de 2021, porque o prompt dela também não tinha
 * subido.
 *
 * ## Como este número detecta isso sozinho
 *
 * As duas metades sabem contar a mesma coisa, e sobem separadas. O front leva
 * este número; a função devolve o `total` dela. Se divergirem, a metade
 * publicada por último está atrasada — e a tela diz isso, em vez de mostrar
 * "populada" e deixar todo mundo achar que está em dia.
 *
 * É o mesmo princípio da conferência do SQL: "rodou sem erro" não é "fez o que
 * devia". Aqui, "respondeu ok" não é "está com o código de hoje".
 *
 * `src/test/baseDaIA.test.ts` mantém o número honesto: ele conta os trechos no
 * `knowledge-seed/index.ts` e reprova se este valor divergir. Assim ninguém
 * precisa lembrar de atualizá-lo à mão — esquecer quebra o teste, não a
 * detecção.
 */
export const TRECHOS_ESPERADOS_NO_SEED = 18;

/**
 * A leitura do resultado do seed, em uma frase, para a tela não ter de decidir
 * sozinha o que é sucesso.
 *
 * `total` ausente conta como desatualizado de propósito: a versão antiga da
 * função não devolvia `fontes_nao_cadastradas`, e é justamente a que precisa
 * ser detectada.
 */
export type ResultadoDoSeed = {
  inserted?: number;
  skipped?: number;
  total?: number;
  fontes_nao_cadastradas?: string[];
};

export type LeituraDoSeed = {
  nivel: "erro" | "aviso" | "ok";
  titulo: string;
  detalhe: string;
};

export function lerResultadoDoSeed(r: ResultadoDoSeed): LeituraDoSeed {
  const inseridos = r.inserted ?? 0;
  const pulados = r.skipped ?? 0;
  const faltando = r.fontes_nao_cadastradas ?? [];

  if (r.total !== TRECHOS_ESPERADOS_NO_SEED) {
    return {
      nivel: "erro",
      titulo: "A função publicada está desatualizada",
      detalhe:
        `Ela semeou ${r.total ?? "?"} trechos; esta versão do site espera ` +
        `${TRECHOS_ESPERADOS_NO_SEED}. O código no repositório não chegou ao Supabase — ` +
        "publique as edge functions (veja o README) e rode de novo. Enquanto isso, a " +
        "IA pode estar respondendo por uma diretriz anterior.",
    };
  }
  if (faltando.length > 0) {
    return {
      nivel: "erro",
      titulo: "Base NÃO atualizada por completo",
      detalhe:
        `Fontes ausentes em knowledge_sources: ${faltando.join(", ")}. ` +
        "Rode o SQL da rodada (scripts/catalogo/aplicar-no-supabase.sql) e tente de novo.",
    };
  }
  if (inseridos === 0) {
    return {
      nivel: "aviso",
      titulo: "Nada novo entrou",
      detalhe: `Os ${pulados} trechos já existiam na base. Não há o que semear.`,
    };
  }
  return {
    nivel: "ok",
    titulo: `${inseridos} trecho(s) novo(s) na base`,
    detalhe:
      `${pulados} já existiam. Todos entram como preliminares (ai_generated), ` +
      "aguardando revisão médica.",
  };
}
