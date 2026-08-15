/**
 * Os modos da IA clínica, num lugar só — e conferidos contra o servidor.
 *
 * O motivo é um defeito real, encontrado exercitando os dez modos de ponta a
 * ponta: o botão "Gerar Orientação de Alta (Paciente)" mandava `mode: "alta"`,
 * e a edge function não conhece esse nome — ela implementa
 * `patient_discharge`. Resultado: o único documento do sistema destinado ao
 * paciente respondia **"modo inválido"**, e a rotina que de fato existia no
 * servidor não tinha nenhum chamador. Dois lados do mesmo desencontro, cada um
 * parecendo íntegro sozinho.
 *
 * Nome de modo é contrato entre duas bases de código que não compilam juntas.
 * Enquanto viver escrito em dois lugares, ele volta a divergir — foi assim que
 * a lista de tabelas do backup ficou quinze tabelas atrasada. Aqui a lista é
 * uma só, e `src/test/iaModos.test.ts` compara cada nome com a união de tipos
 * declarada em `supabase/functions/clinical-ai/index.ts`.
 */

/** Modos do painel de IA do caso (aba Resumo/Conduta/Tendências/Chat). */
export const MODOS_PAINEL = ["summary", "suggest", "trends", "chat"] as const;

/**
 * Modos que geram documento a partir do caso.
 *
 * `patient_discharge` é o único cujo leitor é o **paciente**; os demais são
 * documento técnico de prontuário. Essa distinção não é cosmética: ela decide
 * qual instrução de sistema a função aplica.
 */
export const MODOS_DOCUMENTO = [
  "patient_discharge",
  "note_consultation",
  "preop_summary",
  "postop_note",
  "discharge_summary",
] as const;

/** Leitura do laudo de eco — o único que não precisa de caso. */
export const MODO_EXTRACAO = "extract_echo" as const;

export const MODOS_IA = [...MODOS_PAINEL, ...MODOS_DOCUMENTO, MODO_EXTRACAO] as const;

export type ModoPainel = (typeof MODOS_PAINEL)[number];
export type ModoDocumento = (typeof MODOS_DOCUMENTO)[number];
export type ModoIA = (typeof MODOS_IA)[number];
