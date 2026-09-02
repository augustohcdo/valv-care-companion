/**
 * As recomendações da ESC/EACTS 2025 que o motor de conduta usa — citadas.
 *
 * ## Por que os limiares moram aqui, e não soltos no `guidelines.ts`
 *
 * Nesta sessão eu já inventei dois PMIDs e um número de registro ANVISA. Os três
 * tinham cara de conferidos: formato certo, precisão convincente, nenhuma fonte
 * atrás. Limiar clínico escrito de memória é a mesma classe de erro, com
 * consequência maior — um "FE < 55%" trocado por "FE < 50%" muda a conduta de
 * um paciente e não parece defeito nenhum na revisão.
 *
 * Então cada número que o motor usa fica ao lado do texto **verbatim** da
 * diretriz de onde ele saiu, e um teste (`diretriz2025.test.ts`) reprova se o
 * número não aparecer na citação. Não é possível escrever 55 no código sem que a
 * frase citada também diga 55 — e a frase é conferível por um cardiologista sem
 * ler uma linha de TypeScript.
 *
 * ## Procedência do texto
 *
 * O texto integral não está acessível pelo editor (as tabelas do Oxford Academic
 * são imagens). Foi lido de duas cópias em PDF hospedadas por sociedades de
 * cardiologia distintas — a Indonesian Heart Association e a Slovak Society of
 * Cardiology. As duas têm 102 páginas e o mesmo DOI interno, e **as dez frases
 * de limiar usadas aqui aparecem idênticas nas duas**. Duas cópias não provam
 * autenticidade contra a ESC, mas pegam corrupção de arquivo e adulteração de um
 * host — que era o risco real de usar cópia re-hospedada.
 *
 * Cada valor foi ainda conferido dentro do próprio documento em mais de um
 * lugar: a tabela de recomendação da seção e o resumo de Classe I/III das
 * páginas 73–74.
 *
 * ## A armadilha que quase me pegou, registrada para quem vier depois
 *
 * A página 12 traz a "Table 4 Revised recommendations", com a redação de **2021
 * e a de 2025 lado a lado, em duas colunas**. Extração de texto de PDF
 * intercala colunas: é perfeitamente possível ler a frase de 2021 e gravá-la
 * como se fosse de 2025. Foi o que quase aconteceu com o corte de idade —
 * a coluna de 2021 diz "<75 years and STS-PROM/EuroSCORE II <4%" e a de 2025
 * diz "<70 years of age, if the surgical risk is low".
 *
 * **Nada aqui vem daquela tabela.** Todo texto abaixo veio das tabelas de
 * recomendação definitivas, que são de coluna única. O corte de 70 anos foi
 * confirmado em três lugares independentes do documento (Tabela 4 na p. 36, o
 * resumo da p. 74, e a ausência dos "75 anos" em qualquer tabela definitiva).
 */

export type Classe = "I" | "IIa" | "IIb" | "III";
export type Nivel = "A" | "B" | "C";

export interface RecomendacaoCitada {
  /** Onde na diretriz. */
  tabela: string;
  secao?: string;
  classe: Classe;
  nivel: Nivel;
  /**
   * O texto como impresso, em inglês.
   *
   * Em inglês de propósito: tradução é interpretação, e o que precisa ser
   * auditável é o original. A redação em português fica no motor, como texto de
   * tela, e a citação continua aqui para conferência.
   */
  verbatim: string;
  /**
   * Os números que o motor usa desta recomendação.
   *
   * O teste cobra que cada um apareça no `verbatim`. É isto que impede o
   * código de afirmar um limiar que a diretriz não diz.
   */
  limiares?: number[];
}

export const FONTE_2025 = {
  citacao:
    "2025 ESC/EACTS Guidelines for the management of valvular heart disease. " +
    "Eur Heart J. 2025;46(44):4635–4736.",
  doi: "10.1093/eurheartj/ehaf194",
  url: "https://doi.org/10.1093/eurheartj/ehaf194",
  /** As duas cópias em que cada frase abaixo foi conferida. */
  copiasConferidas: [
    "https://inavalverhd.inaheart.org/wp-content/uploads/2025/09/2025-ESC-EACTS-Guidelines-for-the-Management-of-Valvular-Heart-Disease.pdf",
    "https://www.sks.sk/system/files/documents/chlopnove_chyby_srdca_2025_gl.pdf",
  ],
  conferidoEm: "2026-09-02",
} as const;

/**
 * "Risco cirúrgico baixo" não é opinião: a diretriz define em nota de rodapé.
 *
 * Vale registrar porque várias recomendações IIa dependem dele, e porque o
 * projeto **já tem** a calculadora: `src/lib/euroscore2.ts`. O campo do caso
 * clínico existe para o médico registrar a conclusão, não para adivinhar.
 */
export const RISCO_BAIXO: RecomendacaoCitada = {
  tabela: "Recommendation Table 4, nota de rodapé e",
  classe: "I",
  nivel: "B",
  verbatim:
    "Surgical risk based on STS-PROM (http://riskcalc.sts.org/stswebriskcalc/#/calculate) " +
    "and EuroSCORE II (http://www.euroscore.org/calc.html) <4% and Heart Team assessment.",
  limiares: [4],
};

export const DIRETRIZ_2025 = {
  // =========================================================================
  // ESTENOSE AÓRTICA — Recommendation Table 4, Seção 8.5
  // =========================================================================

  eaSintomaticaAltoGradiente: {
    tabela: "Recommendation Table 4",
    secao: "8.5",
    classe: "I",
    nivel: "B",
    verbatim:
      "Intervention is recommended in symptomatic patients with severe, high-gradient AS " +
      "[mean gradient ≥40 mmHg, Vmax ≥4.0 m/s, AVA ≤1.0 cm2 (or ≤0.6 cm2/m2 BSA)].",
    limiares: [40, 4.0, 1.0, 0.6],
  },

  eaSintomaticaBaixoFluxoFeReduzida: {
    tabela: "Recommendation Table 4",
    secao: "8.5",
    classe: "I",
    nivel: "B",
    verbatim:
      "Intervention is recommended in symptomatic patients with low-flow (SVi ≤35 mL/m2), " +
      "low-gradient (<40 mmHg) AS with reduced LVEF (<50%) after careful confirmation that AS is severe.",
    limiares: [35, 40, 50],
  },

  eaSintomaticaBaixoFluxoFeNormal: {
    tabela: "Recommendation Table 4",
    secao: "8.5",
    classe: "IIa",
    nivel: "B",
    verbatim:
      "Intervention should be considered in symptomatic patients with low-flow (SVi ≤35 mL/m2), " +
      "low-gradient (<40 mmHg) AS with normal LVEF (≥50%) after careful confirmation that AS is severe.",
    limiares: [35, 40, 50],
  },

  eaAssintomaticaFeBaixa: {
    tabela: "Recommendation Table 4",
    secao: "8.5",
    classe: "I",
    nivel: "B",
    verbatim:
      "Intervention is recommended in asymptomatic patients with severe AS and LVEF <50% without another cause.",
    limiares: [50],
  },

  /** A mudança de 2025 que mais altera a conduta desta ferramenta. */
  eaAssintomaticaAlternativaVigilancia: {
    tabela: "Recommendation Table 4",
    secao: "8.5",
    classe: "IIa",
    nivel: "A",
    verbatim:
      "Intervention should be considered in asymptomatic patients (confirmed by a normal exercise test, " +
      "if feasible) with severe, high-gradient AS and LVEF ≥50% as an alternative to close active " +
      "surveillance, if the procedural risk is low.",
    limiares: [50],
  },

  eaAssintomaticaCriterioAdicional: {
    tabela: "Recommendation Table 4",
    secao: "8.5",
    classe: "IIa",
    nivel: "B",
    verbatim:
      "Intervention should be considered in asymptomatic patients with severe AS and LVEF ≥50% if the " +
      "procedural risk is low and one of the following parameters is present: " +
      "• Very severe AS (mean gradient ≥60 mmHg or Vmax >5.0 m/s). " +
      "• Severe valve calcification (ideally assessed by CCT) and Vmax progression ≥0.3 m/s/year. " +
      "• Markedly elevated BNP/NT-proBNP levels (more than three times age- and sex-corrected normal " +
      "range, confirmed on repeated measurement without other explanation). " +
      "• LVEF <55% without another cause.",
    limiares: [50, 60, 5.0, 0.3, 55],
  },

  eaAssintomaticaQuedaPa: {
    tabela: "Recommendation Table 4",
    secao: "8.5",
    classe: "IIa",
    nivel: "C",
    verbatim:
      "Intervention should be considered in asymptomatic patients with severe AS and a sustained fall " +
      "in BP (>20 mmHg) during exercise testing.",
    limiares: [20],
  },

  eaModoTavi: {
    tabela: "Recommendation Table 4",
    secao: "8.5",
    classe: "I",
    nivel: "A",
    verbatim:
      "TAVI is recommended in patients ≥70 years of age with tricuspid AV stenosis, if the anatomy is suitable.",
    limiares: [70],
  },

  eaModoCirurgia: {
    tabela: "Recommendation Table 4",
    secao: "8.5",
    classe: "I",
    nivel: "B",
    verbatim: "SAVR is recommended in patients <70 years of age, if the surgical risk is low.",
    limiares: [70],
  },

  eaHeartTeam: {
    tabela: "Recommendation Table 4",
    secao: "8.5",
    classe: "I",
    nivel: "C",
    verbatim:
      "It is recommended that the mode of intervention is based on Heart Team assessment of individual " +
      "clinical, anatomical, and procedural characteristics, incorporating lifetime management " +
      "considerations and estimated life expectancy.",
  },

  // =========================================================================
  // INSUFICIÊNCIA AÓRTICA — Recommendation Table 3, Seção 7.4
  // =========================================================================

  iaSintomatica: {
    tabela: "Recommendation Table 3",
    secao: "7.4",
    classe: "I",
    nivel: "B",
    verbatim: "AV surgery is recommended in symptomatic patients with severe AR regardless of LV function.",
  },

  iaAssintomatica: {
    tabela: "Recommendation Table 3",
    secao: "7.4",
    classe: "I",
    nivel: "B",
    verbatim:
      "AV surgery is recommended in asymptomatic patients with severe AR and LVESD >50 mm or " +
      "LVESDi >25 mm/m2 [especially in patients with small body size (BSA <1.68 m2)] or resting LVEF ≤50%.",
    limiares: [50, 25, 1.68],
  },

  iaAssintomaticaLimiteMenor: {
    tabela: "Recommendation Table 3",
    secao: "7.4",
    classe: "IIb",
    nivel: "B",
    verbatim:
      "AV surgery may be considered in asymptomatic patients with severe AR and LVESDi >22 mm/m2, " +
      "or LVESVi >45 mL/m2 [especially in patients with small body size (BSA <1.68 m2)], or resting " +
      "LVEF ≤55%, if the surgical risk is low.",
    limiares: [22, 45, 1.68, 55],
  },

  // =========================================================================
  // INSUFICIÊNCIA MITRAL PRIMÁRIA — Recommendation Table 6, Seção 9.1
  // =========================================================================

  imReparoPreferencial: {
    tabela: "Recommendation Table 6",
    secao: "9.1",
    classe: "I",
    nivel: "B",
    verbatim:
      "MV repair is the recommended surgical technique to treat patients with severe PMR when the " +
      "result is expected to be durable.",
  },

  imSintomatica: {
    tabela: "Recommendation Table 6",
    secao: "9.1",
    classe: "I",
    nivel: "B",
    verbatim:
      "MV surgery is recommended in symptomatic patients with severe PMR considered operable by the Heart Team.",
  },

  imAssintomaticaDisfuncao: {
    tabela: "Recommendation Table 6",
    secao: "9.1",
    classe: "I",
    nivel: "B",
    verbatim:
      "MV surgery is recommended in asymptomatic patients with severe PMR with LV dysfunction " +
      "(LVESD ≥40 mm or LVESDi ≥20 mm/m2 or LVEF ≤60%).",
    limiares: [40, 20, 60],
  },

  imAssintomaticaBaixoRisco: {
    tabela: "Recommendation Table 6",
    secao: "9.1",
    classe: "I",
    nivel: "B",
    verbatim:
      "Surgical MV repair is recommended in low-risk asymptomatic patients with severe PMR without " +
      "LV dysfunction (LVESD <40 mm, LVESDi <20 mm/m2, and LVEF >60%) when a durable result is likely, " +
      "if at least three of the following criteria are fulfilled: • AF • SPAP at rest >50 mmHg " +
      "• LA dilatation (LAVI ≥60 mL/m2 or LA diameter ≥55 mm) • concomitant TR ≥ moderate.",
    limiares: [40, 20, 60, 50, 55],
  },

  // =========================================================================
  // ESTENOSE MITRAL — Recommendation Table 8
  // =========================================================================

  emPmcSintomatica: {
    tabela: "Recommendation Table 8",
    classe: "I",
    nivel: "B",
    verbatim:
      "PMC is recommended in symptomatic patients in the absence of unfavourable characteristics for PMC.",
  },

  emCirurgiaSemPmc: {
    tabela: "Recommendation Table 8",
    classe: "I",
    nivel: "C",
    verbatim: "MV surgery is recommended in symptomatic patients who are not suitable for PMC.",
  },

  emPmcAssintomatica: {
    tabela: "Recommendation Table 8",
    classe: "IIa",
    nivel: "C",
    verbatim:
      "PMC should be considered in asymptomatic patients without unfavourable clinical and anatomical " +
      "characteristics for PMC, and: • High thromboembolic risk (history of systemic embolism, dense " +
      "spontaneous contrast in the LA, new-onset or paroxysmal AF), and/or • High risk of haemodynamic " +
      "decompensation (SPAP >50 mmHg at rest, need for major NCS, pregnant or desire for pregnancy).",
    limiares: [50],
  },

  // =========================================================================
  // INSUFICIÊNCIA TRICÚSPIDE — Recommendation Table 9
  // =========================================================================

  itAvaliacao: {
    tabela: "Recommendation Table 9",
    classe: "I",
    nivel: "C",
    verbatim:
      "Careful evaluation of TR aetiology, stage of the disease (i.e. degree of TR severity, RV and LV " +
      "dysfunction, and PH), patient operative risk, and likelihood of recovery by a multidisciplinary " +
      "Heart Team is recommended in patients with severe TR prior to intervention.",
  },

  itCirurgiaPrimariaSintomatica: {
    tabela: "Recommendation Table 9",
    classe: "I",
    nivel: "C",
    verbatim:
      "TV surgery is recommended in symptomatic patients with severe primary TR without severe RV " +
      "dysfunction or severe PH.",
  },

  itTranscateter: {
    tabela: "Recommendation Table 9",
    classe: "IIa",
    nivel: "A",
    verbatim:
      "Transcatheter TV treatment should be considered to improve quality of life and RV remodelling in " +
      "high-risk patients with symptomatic severe TR despite optimal medical therapy in the absence of " +
      "severe RV dysfunction or pre-capillary PH.",
  },

  itAssintomaticaVd: {
    tabela: "Recommendation Table 9",
    classe: "IIa",
    nivel: "C",
    verbatim:
      "TV surgery should be considered in asymptomatic patients with severe primary TR who have RV " +
      "dilatation/RV function deterioration, but without severe LV/RV dysfunction or severe PH.",
  },

  // =========================================================================
  // ANTICOAGULAÇÃO NA FIBRILAÇÃO ATRIAL
  // =========================================================================
  //
  // Estas três são a correção mais importante do motor antigo, que mandava
  // "anticoagulação obrigatória se FA (Classe I)" sem dizer COM QUÊ. Na estenose
  // mitral o DOAC é contraindicado — Classe III — e a recomendação genérica
  // levava direto ao erro de prescrição.

  faDoacPreferencial: {
    tabela: "Recommendation Table 2",
    classe: "I",
    nivel: "A",
    verbatim:
      "DOACs are recommended for stroke prevention in preference to VKAs in patients with AF and AS, " +
      "AR, or MR who are eligible for OAC.",
  },

  faDoacContraindicadoEmReumatica: {
    tabela: "Recommendation Table 2",
    classe: "III",
    nivel: "B",
    verbatim:
      "The use of DOACs is not recommended in patients with AF and rheumatic MS with an MVA ≤2.0 cm2.",
    limiares: [2.0],
  },

  faDoacContraindicadoEmModeradaGrave: {
    tabela: "Recommendation Table 2",
    classe: "III",
    nivel: "C",
    verbatim: "The use of DOACs is not recommended in patients with AF and moderate-to-severe MS.",
  },
} satisfies Record<string, RecomendacaoCitada>;

export type ChaveDaDiretriz = keyof typeof DIRETRIZ_2025;
