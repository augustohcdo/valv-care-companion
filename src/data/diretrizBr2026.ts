/**
 * A Diretriz Brasileira de Valvopatias – 2026, citada.
 *
 * ## Por que ela entra, e ao lado da ESC em vez de no lugar dela
 *
 * O motor de conduta deste projeto cita a ESC/EACTS 2025. Ela é europeia. Quem
 * usa este site opera no Brasil, com disponibilidade, perfil etário e
 * epidemiologia diferentes — a febre reumática, que a ESC trata em um
 * parágrafo, tem três capítulos aqui. A diretriz nacional é a referência local,
 * e a europeia continua valendo como referência internacional.
 *
 * As duas ficam lado a lado, sempre, e onde divergirem o site mostra as duas.
 * Escolher uma em silêncio seria decidir pelo médico sem dizer que decidiu.
 *
 * ## Procedência
 *
 * PDF oficial da Arquivos Brasileiros de Cardiologia, baixado do site da SBC em
 * 2026-10-15: 108 páginas, 2,3 MB. Não é cópia re-hospedada — é o arquivo que o
 * periódico serve, com o DOI no rodapé de cada página.
 *
 * ## Como cada linha foi lida, e a armadilha que o `diretriz2025.ts` registrou
 *
 * O cabeçalho do `diretriz2025.ts` conta que extração de texto de PDF de DUAS
 * COLUNAS intercala as colunas, e que isso quase fez gravar a redação de 2021
 * como se fosse de 2025. Este documento também é de duas colunas.
 *
 * Então nada aqui veio da extração de texto. Cada linha abaixo foi lida da
 * PÁGINA RENDERIZADA, uma por uma — a extração serviu só para achar em que
 * página está cada tabela. As tabelas deste documento são de coluna única
 * dentro de si (uma linha por recomendação), o que torna a leitura direta.
 *
 * ## O que as colunas `aha` e `esc` são — e o que elas NÃO são
 *
 * O Quadro 27 traz três colunas: SBC, AHA e ESC. **São a leitura que os autores
 * brasileiros fizeram** das outras duas diretrizes, impressa no documento
 * deles. Não é a nossa leitura da ESC, e não substitui o `diretriz2025.ts`, que
 * cita a ESC no original.
 *
 * Ter as duas transcrições independentes do mesmo fato é vantagem, não
 * redundância: o `diretrizBr2026.test.ts` confronta a coluna ESC daqui com o
 * que o nosso arquivo da ESC diz, e reprova se divergirem. Uma transcrição
 * errada de um lado ou do outro aparece.
 *
 * ## O que ESTÁ transcrito aqui, e o que ainda não está
 *
 * Transcrito: a **Tabela 1** (as principais novas recomendações) e o **Quadro
 * 27** inteiro (estenose aórtica, nos três blocos).
 *
 * Lido e citado em prosa — nos trechos da base da IA e na biblioteca clínica —,
 * mas ainda NÃO transcrito linha a linha aqui: Quadro 6 (estenose mitral, p.
 * 22), Quadro 14 (insuficiência mitral primária, p. 28), Quadro 34
 * (insuficiência aórtica, p. 50), Quadro 41 (insuficiência tricúspide, p. 56) e
 * Quadro 71 (anticoagulação oral, p. 75).
 *
 * Está escrito porque a falta de um aviso desses é como se conclui que o
 * arquivo é a diretriz inteira. Ele não é: é a parte que o motor de conduta
 * usa com guarda de limiar.
 *
 * Dois achados da leitura desses quadros que mudam o modelo e ficam registrados
 * para quem for transcrevê-los:
 *
 * · a diretriz separa **reumático de não reumático** na insuficiência mitral
 *   (Quadro 14) e na insuficiência aórtica (Quadro 34) — divisão que a ESC não
 *   faz, e que é a razão de existir uma diretriz brasileira: valva reumática
 *   repara mal, e a plástica cai para Fraca/Baixa no reumático enquanto a troca
 *   é Forte/Moderada;
 * · o Quadro 71 usa, na coluna de força, um terceiro valor além de
 *   Forte/Fraca: **"Não indicada"** (varfarina e DOAC em ritmo sinusal após
 *   TAVI). Transcrever aquele quadro exige estender `ForcaSbc`.
 */

/** A diretriz brasileira usa GRADE, e não Classe I–III / Nível A–C. */
export type ForcaSbc = "Forte" | "Fraca";

/**
 * Quatro níveis, e não três.
 *
 * "Muito baixa" existe e é usada: no Quadro 14 (p. 28), no prolapso de valva
 * mitral arritmogênico e/ou disjunção do anel mitral, e no Quadro 71 (p. 75),
 * na anticoagulação de longo prazo de prótese biológica em ritmo sinusal.
 *
 * Está aqui mesmo sem linha transcrita que a use. Um tipo que exclui um valor
 * que o documento imprime força, na próxima transcrição, a escolha entre
 * arredondar para "Baixa" — afirmando mais certeza do que a diretriz tem — e
 * mexer no tipo com pressa. Ambas erram para o mesmo lado.
 */
export type CertezaSbc = "Alta" | "Moderada" | "Baixa" | "Muito baixa";

export interface RecomendacaoBr {
  /** Onde na diretriz: "Tabela 1", "Quadro 27". */
  quadro: string;
  /** Página do PDF publicado, para conferência direta. */
  pagina: number;
  /** A condição clínica, como impressa. */
  condicao: string;
  /** A intervenção, como impressa. */
  intervencao: string;
  forca: ForcaSbc;
  certeza: CertezaSbc;
  /**
   * A linha inteira como impressa, para conferência por quem não lê TypeScript.
   *
   * É sobre ESTE texto que o teste cobra cada número usado — mesma regra do
   * `diretriz2025.ts`: não dá para escrever 70 no código sem que a frase citada
   * também diga 70.
   */
  verbatim: string;
  /** Os números que o motor usa desta recomendação. */
  limiares?: number[];
  /** A posição da AHA, COMO A DIRETRIZ BRASILEIRA a imprime. */
  aha?: string;
  /** A posição da ESC, COMO A DIRETRIZ BRASILEIRA a imprime. */
  esc?: string;
  /** Nota de rodapé da tabela, quando a linha depende de uma. */
  nota?: string;
}

export const FONTE_BR_2026 = {
  citacao:
    "Tarasoutchi F, Fernandes JRC, Rosa VEE, Sampaio RO, Sepulveda DPL, Ramos AIO, " +
    "Campos CAHM, et al. Diretriz Brasileira de Valvopatias – 2026. " +
    "Arq Bras Cardiol. 2026;123(10):e20260796.",
  doi: "10.36660/abc.20260796",
  url: "https://doi.org/10.36660/abc.20260796",
  /** O PDF oficial do periódico, que é de onde cada linha abaixo foi lida. */
  pdf:
    "https://abccardiol.org/wp-content/uploads/articles_xml/" +
    "0066-782x-abc-123-10-e20260796/0066-782x-abc-123-10-e20260796.x69353.pdf",
  /** Quem assina a realização — não é só a SBC. */
  realizacao: [
    "Sociedade Brasileira de Cardiologia (SBC)",
    "Sociedade Brasileira de Hemodinâmica e Cardiologia Intervencionista (SBHCI)",
    "Sociedade Brasileira de Cirurgia Cardiovascular (SBCCV)",
  ],
  conferidoEm: "2026-10-15",
  paginas: 108,
} as const;

/**
 * Tabela 1 — as principais novas recomendações, como a própria diretriz as
 * resume.
 *
 * São **oito situações clínicas** em doze linhas: três das situações têm mais de
 * uma intervenção (a escolha por faixa etária na estenose aórtica e os três
 * tipos de intervenção na insuficiência tricúspide). O texto da seção 1.4 diz
 * "as oito principais novas recomendações", e o teste cobra as oito situações
 * distintas — transcrição que perca uma linha muda essa conta.
 */
export const TABELA_1_NOVIDADES = {
  eaAssintomaticaPrecoce: {
    quadro: "Tabela 1",
    pagina: 15,
    condicao:
      "Estenose aórtica importante, de alto gradiente assintomática, sem complicadores e de baixo risco cirúrgico",
    intervencao: "Intervenção precoce (early intervention)",
    forca: "Fraca",
    certeza: "Alta",
    verbatim:
      "Estenose aórtica importante, de alto gradiente assintomática, sem complicadores e de baixo " +
      "risco cirúrgico — Intervenção precoce (early intervention)* — Fraca/Alta",
    nota:
      "As evidências atuais sobre a intervenção precoce vêm ganhando maior respaldo, porém ainda " +
      "sem benefício prognóstico em relação a mortalidade, como nos outros cenários de indicação de " +
      "intervenção valvar. Assim, ela pode ser indicada em pacientes selecionados com marcadores " +
      "prognósticos adversos (realce tardio na ressonância magnética, strain reduzido, BNP ou " +
      "NT-proBNP elevado, escore de cálcio valvar elevado) após discussão do Heart Team.",
  },

  eaSintomaticaBaixoRiscoAte70: {
    quadro: "Tabela 1",
    pagina: 15,
    condicao: "Estenose aórtica importante, sintomática ou com complicadores",
    intervencao: "Baixo risco < 70 anos",
    forca: "Forte",
    certeza: "Alta",
    verbatim:
      "Estenose aórtica importante, sintomática ou com complicadores — Baixo risco < 70 anos — " +
      "Preferência para cirurgia — Forte/Alta",
    limiares: [70],
  },

  eaSintomaticaBaixoRisco70a80: {
    quadro: "Tabela 1",
    pagina: 15,
    condicao: "Estenose aórtica importante, sintomática ou com complicadores",
    intervencao: "Baixo risco entre 70 e 80 anos",
    forca: "Forte",
    certeza: "Alta",
    verbatim:
      "Estenose aórtica importante, sintomática ou com complicadores — Baixo risco entre 70 e 80 " +
      "anos — TAVI = Cirurgia — Forte/Alta",
    limiares: [70, 80],
  },

  eaSintomaticaBaixoRiscoAcima80: {
    quadro: "Tabela 1",
    pagina: 15,
    condicao: "Estenose aórtica importante, sintomática ou com complicadores",
    intervencao: "Baixo risco > 80 anos",
    forca: "Forte",
    certeza: "Moderada",
    verbatim:
      "Estenose aórtica importante, sintomática ou com complicadores — Baixo risco > 80 anos — " +
      "Preferência para TAVI — Forte/Moderada",
    limiares: [80],
  },

  iaTaviRiscoProibitivo: {
    quadro: "Tabela 1",
    pagina: 15,
    condicao:
      "Insuficiência aórtica importante sintomática com expectativa de vida > 1 ano, com " +
      "contraindicação/risco proibitivo à cirurgia, anatomia favorável, após avaliação do Heart Team",
    intervencao: "TAVI",
    forca: "Fraca",
    certeza: "Baixa",
    verbatim:
      "Insuficiência aórtica importante sintomática com expectativa de vida > 1 ano, com " +
      "contraindicação/risco proibitivo à cirurgia, anatomia favorável, após avaliação do Heart " +
      "Team — TAVI — Fraca/Baixa",
    limiares: [1],
  },

  itReparoBordaABorda: {
    quadro: "Tabela 1",
    pagina: 15,
    condicao:
      "Insuficiência tricúspide importante, refratária ao tratamento clínico, com contraindicação " +
      "ou alto risco ao tratamento cirúrgico e anatomia favorável",
    intervencao: "Reparo transcateter borda a borda",
    forca: "Forte",
    certeza: "Alta",
    verbatim:
      "Insuficiência tricúspide importante, refratária ao tratamento clínico, com contraindicação " +
      "ou alto risco ao tratamento cirúrgico e anatomia favorável — Reparo transcateter borda a " +
      "borda — Forte/Alta",
  },

  itImplanteOrtotopico: {
    quadro: "Tabela 1",
    pagina: 15,
    condicao:
      "Insuficiência tricúspide importante, refratária ao tratamento clínico, com contraindicação " +
      "ou alto risco ao tratamento cirúrgico e anatomia favorável",
    intervencao: "Implante ortotópico",
    forca: "Forte",
    certeza: "Alta",
    verbatim:
      "Insuficiência tricúspide importante, refratária ao tratamento clínico, com contraindicação " +
      "ou alto risco ao tratamento cirúrgico e anatomia favorável — Implante ortotópico — Forte/Alta",
  },

  itImplanteHeterotopico: {
    quadro: "Tabela 1",
    pagina: 15,
    condicao:
      "Insuficiência tricúspide importante, refratária ao tratamento clínico, com contraindicação " +
      "ou alto risco ao tratamento cirúrgico e anatomia favorável",
    intervencao: "Implante heterotópico",
    forca: "Forte",
    certeza: "Baixa",
    verbatim:
      "Insuficiência tricúspide importante, refratária ao tratamento clínico, com contraindicação " +
      "ou alto risco ao tratamento cirúrgico e anatomia favorável — Implante heterotópico — Forte/Baixa",
  },

  imPrimariaReparoPercutaneo: {
    quadro: "Tabela 1",
    pagina: 15,
    condicao:
      "Insuficiência mitral primária não reumática, sintomática, com anatomia favorável, com alto " +
      "risco cirúrgico baseado no Heart Team",
    intervencao: "Reparo percutâneo borda a borda da valva mitral",
    forca: "Forte",
    certeza: "Moderada",
    verbatim:
      "Insuficiência mitral primária não reumática, sintomática, com anatomia favorável, com alto " +
      "risco cirúrgico baseado no Heart Team — Reparo percutâneo borda a borda da valva mitral — " +
      "Forte/Moderada",
  },

  imSecundariaReparoPercutaneo: {
    quadro: "Tabela 1",
    pagina: 15,
    condicao:
      "Insuficiência mitral secundária ventricular sintomática a despeito de otimização de " +
      "tratamento medicamentoso e com anatomia apropriada",
    intervencao: "Reparo percutâneo borda a borda",
    forca: "Forte",
    certeza: "Moderada",
    verbatim:
      "Insuficiência mitral secundária ventricular sintomática a despeito de otimização de " +
      "tratamento medicamentoso e com anatomia apropriada — Reparo percutâneo borda a borda — " +
      "Forte/Moderada",
  },

  bioproteseValveInValve: {
    quadro: "Tabela 1",
    pagina: 15,
    condicao:
      "Disfunção estrutural importante de bioprótese mitral ou aórtica, em pacientes sintomáticos, " +
      "com alto risco para cirurgia ou inoperáveis, após avaliação do Heart Team",
    intervencao: "Valve-in-valve",
    forca: "Forte",
    certeza: "Alta",
    verbatim:
      "Disfunção estrutural importante de bioprótese mitral ou aórtica, em pacientes sintomáticos, " +
      "com alto risco para cirurgia ou inoperáveis, após avaliação do Heart Team — Valve-in-valve — " +
      "Forte/Alta",
  },

  antibioticoprofilaxiaDentaria: {
    quadro: "Tabela 1",
    pagina: 15,
    condicao:
      "Extração dentária, cirurgia oral ou outros procedimentos que requerem manipulação da gengiva " +
      "ou região periapical do dente, em pacientes com risco elevado de endocardite infecciosa",
    intervencao: "Antibioticoprofilaxia",
    forca: "Forte",
    certeza: "Moderada",
    verbatim:
      "Extração dentária, cirurgia oral ou outros procedimentos que requerem manipulação da gengiva " +
      "ou região periapical do dente, em pacientes com risco elevado de endocardite infecciosa — " +
      "Antibioticoprofilaxia — Forte/Moderada",
  },
} satisfies Record<string, RecomendacaoBr>;

/**
 * Quadro 27 — Estenose aórtica importante: recomendações (p. 41–42).
 *
 * É o quadro que mais toca o motor de conduta, e o que traz as três colunas
 * (SBC, AHA, ESC). As notas de rodapé do quadro valem para o bloco inteiro e
 * estão em `NOTAS_QUADRO_27`.
 */
export const QUADRO_27_ESTENOSE_AORTICA = {
  sintomas: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao: "Sintomas (classe funcional ≥ 2, síncope e angina)",
    intervencao: "Tratamento cirúrgico convencional ou TAVI",
    forca: "Forte",
    certeza: "Alta",
    aha: "I A",
    esc: "I B",
    verbatim:
      "Tratamento cirúrgico convencional ou TAVI — Sintomas (classe funcional ≥ 2, síncope e " +
      "angina) — SBC Forte/Alta — AHA I A — ESC I B",
    limiares: [2],
  },

  assintomaticoFeReduzida: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao: "Assintomático, com complicadores: – FE < 50%",
    intervencao: "Tratamento cirúrgico convencional ou TAVI",
    forca: "Forte",
    certeza: "Moderada",
    aha: "I B",
    esc: "I B",
    verbatim:
      "Tratamento cirúrgico convencional ou TAVI — Assintomático, com complicadores: – FE < 50% — " +
      "SBC Forte/Moderada — AHA I B — ESC I B",
    limiares: [50],
  },

  assintomaticoTesteErgometrico: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao: "Assintomático, com complicadores: – Teste ergométrico +",
    intervencao: "Tratamento cirúrgico convencional ou TAVI",
    forca: "Forte",
    certeza: "Moderada",
    aha: "IIa B",
    esc: "IIa C",
    verbatim:
      "Tratamento cirúrgico convencional ou TAVI — Assintomático, com complicadores: – Teste " +
      "ergométrico + — SBC Forte/Moderada — AHA IIa B — ESC IIa C",
  },

  assintomaticoValvopatiaCritica: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao:
      "Assintomático com valvopatia crítica: área valvar aórtica < 0,7 cm²; velocidade máxima do " +
      "jato ≥ 5,0 m/s; gradiente médio ventrículo esquerdo/Ao ≥ 60 mmHg",
    intervencao: "Tratamento cirúrgico convencional ou TAVI",
    forca: "Forte",
    certeza: "Moderada",
    aha: "IIa B (Se baixo risco cirúrgico e BNP > 3x VR ou aumento de velocidade ≥ 0,3 m/s/ano)",
    esc: "IIa B (BNP elevado para idade; PSAP > 60 mmHg; velocidade máxima do jato > 5 m/s)",
    verbatim:
      "Tratamento cirúrgico convencional ou TAVI — Assintomático com valvopatia crítica: área " +
      "valvar aórtica < 0,7 cm²; velocidade máxima do jato ≥ 5,0 m/s; gradiente médio ventrículo " +
      "esquerdo/Ao ≥ 60 mmHg — SBC Forte/Moderada",
    limiares: [0.7, 5.0, 60],
  },

  quedaProgressivaFe: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao: "Queda progressiva de FE < 60%",
    intervencao: "Tratamento cirúrgico convencional ou TAVI",
    forca: "Fraca",
    certeza: "Baixa",
    aha: "IIb B",
    esc: "IIa B (FEVE < 55%)",
    verbatim:
      "Tratamento cirúrgico convencional ou TAVI — Queda progressiva de FE < 60% — SBC Fraca/Baixa " +
      "— AHA IIb B — ESC IIa B (FEVE < 55%)",
    limiares: [60],
  },

  baixoFluxoComReservaContratil: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao:
      "SITUAÇÕES ESPECIAIS — Estenose Ao importante de baixo-fluxo e baixo-gradiente com FE " +
      "reduzida: – Com reserva contrátil",
    intervencao: "Tratamento cirúrgico convencional ou TAVI",
    forca: "Forte",
    certeza: "Moderada",
    aha: "I B",
    esc: "I B",
    verbatim:
      "SITUAÇÕES ESPECIAIS — Estenose Ao importante de baixo-fluxo e baixo-gradiente com FE " +
      "reduzida: – Com reserva contrátil — SBC Forte/Moderada — AHA I B — ESC I B",
  },

  baixoFluxoSemReservaContratil: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao:
      "SITUAÇÕES ESPECIAIS — Estenose Ao importante de baixo-fluxo e baixo-gradiente com FE " +
      "reduzida: – Sem reserva contrátil + escore de cálcio elevado",
    intervencao: "Tratamento cirúrgico convencional ou TAVI",
    forca: "Forte",
    certeza: "Moderada",
    aha: "I B",
    esc: "I B",
    verbatim:
      "SITUAÇÕES ESPECIAIS — Estenose Ao importante de baixo-fluxo e baixo-gradiente com FE " +
      "reduzida: – Sem reserva contrátil + escore de cálcio elevado — SBC Forte/Moderada — AHA I B " +
      "— ESC I B",
  },

  paradoxalSintomatica: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao: "SITUAÇÕES ESPECIAIS — Estenose Ao importante paradoxal sintomática",
    intervencao: "Tratamento cirúrgico convencional ou TAVI",
    forca: "Forte",
    certeza: "Moderada",
    aha: "I B",
    esc: "IIa B",
    verbatim:
      "SITUAÇÕES ESPECIAIS — Estenose Ao importante paradoxal sintomática — SBC Forte/Moderada — " +
      "AHA I B — ESC IIa B",
  },

  sindromeDeHeyde: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao: "SITUAÇÕES ESPECIAIS — Síndrome de Heyde",
    intervencao: "Tratamento cirúrgico convencional ou TAVI",
    forca: "Forte",
    certeza: "Baixa",
    aha: "–",
    esc: "–",
    verbatim:
      "SITUAÇÕES ESPECIAIS — Síndrome de Heyde — SBC Forte/Baixa — AHA – — ESC – " +
      "(nem a AHA nem a ESC registram posição nesta situação)",
  },
} satisfies Record<string, RecomendacaoBr>;

/**
 * Quadro 27, segundo bloco — a escolha ENTRE cirurgia e TAVI, por risco e idade.
 *
 * Separado do bloco acima porque responde outra pergunta. O primeiro diz SE
 * intervir; este diz COM O QUÊ. Misturá-los foi o que produziu, em outras
 * ferramentas, a conduta que recomenda TAVI a quem ainda não tem indicação de
 * intervenção nenhuma.
 */
export const QUADRO_27_ESCOLHA_DA_INTERVENCAO = {
  inoperavelTavi: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao: "Inoperável, risco proibitivo e/ou fragilidade – TAVI",
    intervencao: "TAVI",
    forca: "Forte",
    certeza: "Alta",
    aha: "I A",
    esc: "I A",
    verbatim: "Escolha da intervenção entre cirurgia e TAVI — Inoperável, risco proibitivo e/ou fragilidade – TAVI — SBC Forte/Alta — AHA I A — ESC I A",
  },
  inoperavelCirurgia: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao: "Inoperável, risco proibitivo e/ou fragilidade – Cirurgia",
    intervencao: "Cirurgia",
    forca: "Fraca",
    certeza: "Alta",
    aha: "–",
    esc: "–",
    verbatim: "Escolha da intervenção entre cirurgia e TAVI — Inoperável, risco proibitivo e/ou fragilidade – Cirurgia — SBC Fraca/Alta — AHA – — ESC –",
  },
  altoRiscoTavi: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao: "Alto risco cirúrgico – TAVI",
    intervencao: "TAVI",
    forca: "Forte",
    certeza: "Alta",
    aha: "I A",
    esc: "I A",
    verbatim: "Escolha da intervenção entre cirurgia e TAVI — Alto risco cirúrgico – TAVI — SBC Forte/Alta — AHA I A — ESC I A",
  },
  altoRiscoCirurgia: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao: "Alto risco cirúrgico – Cirurgia",
    intervencao: "Cirurgia",
    forca: "Fraca",
    certeza: "Alta",
    aha: "–",
    esc: "–",
    verbatim: "Escolha da intervenção entre cirurgia e TAVI — Alto risco cirúrgico – Cirurgia — SBC Fraca/Alta — AHA – — ESC –",
  },
  intermediarioTavi: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao: "Risco cirúrgico intermediário – TAVI",
    intervencao: "TAVI",
    forca: "Forte",
    certeza: "Alta",
    aha: "I A",
    esc: "I A",
    verbatim: "Escolha da intervenção entre cirurgia e TAVI — Risco cirúrgico intermediário – TAVI — SBC Forte/Alta — AHA I A — ESC I A",
  },
  intermediarioCirurgia: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao: "Risco cirúrgico intermediário – Cirurgia",
    intervencao: "Cirurgia",
    forca: "Fraca",
    certeza: "Alta",
    aha: "I A",
    esc: "–",
    verbatim: "Escolha da intervenção entre cirurgia e TAVI — Risco cirúrgico intermediário – Cirurgia — SBC Fraca/Alta — AHA I A — ESC –",
  },
  baixoRisco70a80Tavi: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao: "Baixo risco 70 a 80 anos – TAVI",
    intervencao: "TAVI",
    forca: "Forte",
    certeza: "Alta",
    aha: "I A",
    esc: "I A",
    verbatim: "Escolha da intervenção entre cirurgia e TAVI — Baixo risco 70 a 80 anos – TAVI — SBC Forte/Alta — AHA I A — ESC I A",
    limiares: [70, 80],
  },
  baixoRisco70a80Cirurgia: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao: "Baixo risco 70 a 80 anos – Cirurgia",
    intervencao: "Cirurgia",
    forca: "Forte",
    certeza: "Alta",
    aha: "I A",
    esc: "–",
    verbatim: "Escolha da intervenção entre cirurgia e TAVI — Baixo risco 70 a 80 anos – Cirurgia — SBC Forte/Alta — AHA I A — ESC –",
    limiares: [70, 80],
  },
  baixoRiscoAcima80Tavi: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao: "Baixo risco > 80 anos – TAVI",
    intervencao: "TAVI",
    forca: "Forte",
    certeza: "Moderada",
    aha: "I A",
    esc: "I A",
    verbatim: "Escolha da intervenção entre cirurgia e TAVI — Baixo risco > 80 anos – TAVI — SBC Forte/Moderada — AHA I A — ESC I A",
    limiares: [80],
  },
  baixoRiscoAcima80Cirurgia: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao: "Baixo risco > 80 anos – Cirurgia",
    intervencao: "Cirurgia",
    forca: "Fraca",
    certeza: "Moderada",
    aha: "–",
    esc: "–",
    verbatim: "Escolha da intervenção entre cirurgia e TAVI — Baixo risco > 80 anos – Cirurgia — SBC Fraca/Moderada — AHA – — ESC –",
    limiares: [80],
  },
  baixoRiscoAbaixo70Tavi: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao: "Baixo risco < 70 anos – TAVI",
    intervencao: "TAVI",
    forca: "Fraca",
    certeza: "Moderada",
    aha: "–",
    esc: "–",
    verbatim: "Escolha da intervenção entre cirurgia e TAVI — Baixo risco < 70 anos – TAVI — SBC Fraca/Moderada — AHA – — ESC –",
    limiares: [70],
  },
  baixoRiscoAbaixo70Cirurgia: {
    quadro: "Quadro 27",
    pagina: 41,
    condicao: "Baixo risco < 70 anos – Cirurgia",
    intervencao: "Cirurgia",
    forca: "Forte",
    certeza: "Alta",
    aha: "I A (< 65 anos)",
    esc: "I B",
    verbatim: "Escolha da intervenção entre cirurgia e TAVI — Baixo risco < 70 anos – Cirurgia — SBC Forte/Alta — AHA I A (< 65 anos) — ESC I B",
    limiares: [70],
  },
} satisfies Record<string, RecomendacaoBr>;

/** Valvoplastia aórtica por cateter-balão — Quadro 27, p. 42. */
export const QUADRO_27_VALVOPLASTIA = {
  ponteTerapeutica: {
    quadro: "Quadro 27",
    pagina: 42,
    condicao:
      "Sintomática com instabilidade hemodinâmica importante, impossibilidade ou indisponibilidade " +
      "de intervenção definitiva (TAVI ou cirurgia convencional) como “ponte terapêutica”",
    intervencao: "Valvoplastia aórtica por cateter-balão",
    forca: "Forte",
    certeza: "Baixa",
    aha: "IIb C",
    esc: "IIb C",
    verbatim:
      "Valvoplastia aórtica por cateter-balão — Sintomática com instabilidade hemodinâmica " +
      "importante, impossibilidade ou indisponibilidade de intervenção definitiva (TAVI ou cirurgia " +
      "convencional) como “ponte terapêutica” — SBC Forte/Baixa — AHA IIb C — ESC IIb C",
  },
  paliativo: {
    quadro: "Quadro 27",
    pagina: 42,
    condicao:
      "Tratamento paliativo em pacientes sintomáticos e com contraindicações à cirurgia " +
      "convencional e/ou TAVI",
    intervencao: "Valvoplastia aórtica por cateter-balão",
    forca: "Fraca",
    certeza: "Baixa",
    aha: "–",
    esc: "–",
    verbatim:
      "Valvoplastia aórtica por cateter-balão — Tratamento paliativo em pacientes sintomáticos e " +
      "com contraindicações à cirurgia convencional e/ou TAVI — SBC Fraca/Baixa — AHA – — ESC –",
  },
} satisfies Record<string, RecomendacaoBr>;

/** As duas notas de rodapé do Quadro 27 — valem para o quadro inteiro. */
export const NOTAS_QUADRO_27 = {
  intervencao:
    "Pré-requisito obrigatório: avaliação por Heart Team institucional, contemplando risco " +
    "cirúrgico, grau de fragilidade, condições anatômicas e comorbidades.",
  escolhaDaTecnica:
    "Outros aspectos como factibilidade técnica, riscos e benefícios de cada procedimento, escolha " +
    "do paciente, experiência local e disponibilidade dos procedimentos também devem ser levados em " +
    "consideração para a escolha da técnica.",
} as const;

/** Tudo que esta diretriz traz, para quem precisa varrer o conjunto. */
export const DIRETRIZ_BR_2026 = {
  ...TABELA_1_NOVIDADES,
  ...QUADRO_27_ESTENOSE_AORTICA,
  ...QUADRO_27_ESCOLHA_DA_INTERVENCAO,
  ...QUADRO_27_VALVOPLASTIA,
};
