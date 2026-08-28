/**
 * As referências que as ferramentas clínicas citam — num lugar só.
 *
 * Cada calculadora deste projeto mostra de onde veio o modelo que ela executa.
 * A citação viver junto do cálculo é o que separa "ferramenta de apoio" de
 * "número que apareceu na tela": quem discorda do resultado precisa poder ir
 * conferir a fonte, e quem for revisar o código daqui a dois anos precisa saber
 * o que exatamente foi implementado.
 *
 * Os PMIDs foram conferidos na API do PubMed, não copiados de memória.
 */

export interface Fonte {
  /** Como a citação aparece na tela. */
  citacao: string;
  /** Link que resolve para qualquer pessoa, sem assinatura. */
  url: string;
  /** O que exatamente foi tirado dali. */
  usadoPara: string;
}

export const FONTE_EUROSCORE2: Fonte = {
  citacao:
    "Nashef SAM, Roques F, Sharples LD, et al. EuroSCORE II. " +
    "Eur J Cardiothorac Surg 2012;41(4):734-745.",
  url: "https://pubmed.ncbi.nlm.nih.gov/22378855/",
  usadoPara: "os 18 coeficientes e a constante do modelo logístico (Tabela 6) e as definições de cada variável",
};

export const FONTE_EACVI_PROTESES: Fonte = {
  citacao:
    "Lancellotti P, Pibarot P, Chambers J, et al. Recommendations for the imaging " +
    "assessment of prosthetic heart valves — European Association of Cardiovascular " +
    "Imaging, com endosso do Departamento de Imagem Cardiovascular da SBC. " +
    "Eur Heart J Cardiovasc Imaging 2016;17(6):589-590.",
  url: "https://pubmed.ncbi.nlm.nih.gov/27143783/",
  usadoPara:
    "os valores normais de referência de EOA (Tabelas 7 e 8), os limiares de mismatch " +
    "prótese-paciente (Tabela 12) e as faixas de obstrução aórtica e mitral (Tabelas 13 e 15)",
};

export const FONTE_DUBOIS: Fonte = {
  citacao:
    "Du Bois D, Du Bois EF. A formula to estimate the approximate surface area if " +
    "height and weight be known. Arch Intern Med 1916;17:863-871 " +
    "(reimpressão indexada: Nutrition 1989;5:303-311).",
  url: "https://pubmed.ncbi.nlm.nih.gov/2520314/",
  usadoPara: "o cálculo da superfície corporal usada para indexar a EOA",
};

/**
 * A crítica publicada ao uso da EOA **projetada** por tabela de referência.
 *
 * Está aqui de propósito, e aparece na tela junto do resultado projetado: a
 * ferramenta que só cita o que a sustenta é propaganda, não apoio à decisão.
 */
export const FONTE_LIMITE_PROJECAO: Fonte = {
  citacao:
    "Vriesendorp MD, de Lind van Wijngaarden RAF, Head SJ, Kappetein AP, et al. " +
    "The fallacy of indexed effective orifice area charts to predict " +
    "prosthesis-patient mismatch after prosthesis implantation. " +
    "Eur Heart J Cardiovasc Imaging 2020;21(10):1116-1122.",
  url: "https://pubmed.ncbi.nlm.nih.gov/32243493/",
  usadoPara: "o limite conhecido da projeção por tabela, mostrado junto do resultado projetado",
};
