/**
 * Os motivos de uma resposta da IA clínica sair sem fonte — num lugar só, e
 * conferidos contra a edge function.
 *
 * ## Por que não mais uma união escrita à mão na tela
 *
 * `ClinicalAIPanel` declarava a união da camada externa de literatura por
 * conta própria:
 *
 *     type MotivoPesquisa =
 *       | "sem_fonte_automatica" | "sem_termo" | "sem_resultado"
 *       | "servico_indisponivel" | "fontes_ilegiveis";
 *
 * e a função declara a dela em `_shared/pesquisaExterna.ts`. Duas cópias, nada
 * ligando uma à outra — e a tela usa a sua como chave de um
 * `Record<MotivoPesquisa, string>`. Quer dizer: um estado novo na função, e a
 * tela faz `MOTIVO_TEXTO[novoEstado]`, que é `undefined`. O parágrafo renderiza
 * **vazio** — a explicação simplesmente desaparece, sem erro, sem aviso.
 *
 * É o mesmo desencontro de `aiModes.ts`, que nasceu do botão de orientação de
 * alta mandando `mode: "alta"` para uma função que implementa
 * `patient_discharge`: duas bases que não compilam juntas, um contrato só em
 * tempo de execução. O remédio é o mesmo: a lista mora aqui e
 * `src/test/motivosDaIA.test.ts` compara cada nome com a união declarada na
 * função.
 */

/**
 * Por que não veio trecho da BASE ValvePath — a camada primária, a das
 * diretrizes, a que sustenta a recomendação.
 *
 * Declarada em `supabase/functions/_shared/motivoDaBase.ts`, que tem o defeito
 * por extenso: até esta rodada a função devolvia só `rag_hit: false`, e os
 * quatro caminhos abaixo chegavam à tela como um aviso único afirmando que "a
 * base ValvePath não retornou referência para este tópico". Em dois deles a
 * base nunca foi consultada.
 */
export const MOTIVOS_DA_BASE = [
  "sem_resultado",
  "consulta_falhou",
  "sem_credencial",
  "nao_pedida",
] as const;

/**
 * Os motivos em que a base NÃO foi consultada.
 *
 * O texto desses três não pode afirmar nada sobre o CONTEÚDO da base: ninguém
 * olhou. A distinção é a razão de este arquivo existir.
 */
export const BASE_NAO_CONSULTADA = [
  "consulta_falhou",
  "sem_credencial",
  "nao_pedida",
] as const;

/**
 * Por que não veio artigo da camada EXTERNA de literatura.
 *
 * Declarada como `MotivoSemLiteratura` em
 * `supabase/functions/_shared/pesquisaExterna.ts`.
 */
export const MOTIVOS_DA_LITERATURA = [
  "sem_fonte_automatica",
  "sem_termo",
  "sem_resultado",
  "servico_indisponivel",
  "fontes_ilegiveis",
] as const;

export type MotivoDaBase = (typeof MOTIVOS_DA_BASE)[number];
export type MotivoDaLiteratura = (typeof MOTIVOS_DA_LITERATURA)[number];
