/**
 * Dado fictício de demonstração, dito em um lugar só.
 *
 * A base de demonstração existe para mostrar o produto a médicos com telas
 * cheias — painéis, gráficos, relatórios e discussão de Heart Team. O risco
 * dela é o oposto do risco de uma base vazia: alguém confundir paciente
 * inventado com paciente real, dentro de um sistema de prontuário.
 *
 * Por isso a marca é uma coluna no banco (`clinical_cases.is_demo`), e não uma
 * convenção de nome, e ela acompanha o caso **até fora do sistema** — o PDF do
 * prontuário e as planilhas exportadas carregam o aviso, porque é justamente
 * o papel impresso que sobrevive à conversa em que ficou claro que era demo.
 */

export const ROTULO_DEMO = "Demonstração";

export const AVISO_DEMO =
  "Caso de demonstração — paciente, medidas e histórico são fictícios, criados " +
  "para apresentar o produto. Não é registro clínico de pessoa real.";

/** Versão curta, para cabeçalho de documento e célula de planilha. */
export const AVISO_DEMO_CURTO = "DEMONSTRAÇÃO — dados fictícios, não é registro clínico real";

export function ehDemo(caso: { is_demo?: boolean | null } | null | undefined): boolean {
  return caso?.is_demo === true;
}
