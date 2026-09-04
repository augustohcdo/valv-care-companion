/**
 * Tutoriais de técnica cirúrgica do MMCTS, conferidos um a um.
 *
 * O **Multimedia Manual of Cardio-Thoracic Surgery** é a publicação de vídeo da
 * EACTS (ISSN 1813-9175), de acesso aberto e gratuito. São demonstrações de
 * técnica operatória — o que fazer com as mãos depois que a indicação já foi
 * decidida.
 *
 * ## O que este arquivo é, e o que ele não é
 *
 * São **links**. Nada do conteúdo do MMCTS é copiado para cá: o vídeo, o texto e
 * as ilustrações continuam sendo deles, no site deles. O que guardamos é o
 * endereço, o título e a data em que a página foi aberta.
 *
 * ## Por que o título fica gravado
 *
 * Porque link não conferido é a mesma armadilha das fotos de prótese que
 * mostravam outro produto, e dos links mortos da Corcym. Cada endereço abaixo
 * foi **aberto**, e o título gravado é o que a página devolveu — não o que um
 * resultado de busca afirmou que ela tinha.
 *
 * A diferença não é teórica. Ao montar esta lista, quatro tutoriais que a busca
 * apresentou com título e tudo — os de id 23, 37, 60 e 703 — devolveram página
 * sem título nenhum. Se eu tivesse confiado no resultado da busca, quatro links
 * quebrados entrariam parecendo conferidos.
 *
 * `scripts/conferir-mmcts.mjs` refaz essa conferência a qualquer momento e
 * reprova se um título mudar ou uma página sumir.
 *
 * ## Um tópico sem tutorial, e isso fica escrito
 *
 * `anticoagulacao-protese` não tem entrada aqui. Não é esquecimento: o MMCTS é
 * manual de técnica operatória, e o manejo do anticoagulante não é um gesto
 * cirúrgico. Lacuna declarada vale mais que link forçado.
 */

/**
 * O gesto cirúrgico que o tutorial demonstra.
 *
 * Existe porque `topico` (o slug da biblioteca) responde "em que doença isso
 * entra", e há três telas que precisam da outra pergunta: "que operação é
 * esta". O catálogo de próteses não conhece doença nenhuma — conhece tipo e
 * posição do dispositivo; a seção de técnica se organiza por operação; e o
 * detalhe do caso precisa ligar a conduta sugerida ao gesto correspondente.
 */
export type ChaveDeProcedimento =
  | "troca-aortica"
  | "preservacao-aortica"
  | "plastica-mitral"
  | "troca-mitral"
  | "plastica-tricuspide"
  | "cirurgia-combinada";

export interface TutorialMmcts {
  /** Id do tutorial no MMCTS — é ele que forma a URL. */
  id: number;
  /** Título como a página devolveu, com espaços normalizados. */
  titulo: string;
  /** O slug do tópico da biblioteca clínica a que ele pertence. */
  topico: string;
  /** Uma linha dizendo por que este tutorial está neste tópico. */
  porque: string;
  /**
   * Os gestos que o vídeo demonstra. É lista porque uma operação combinada é
   * mesmo mais de um gesto — o 525 faz plástica mitral E troca aórtica no
   * mesmo tempo, e esconder um dos dois seria empobrecer o que ele ensina.
   */
  procedimentos: ChaveDeProcedimento[];
}

export const MMCTS = {
  fonte: "Multimedia Manual of Cardio-Thoracic Surgery (MMCTS) — EACTS",
  issn: "1813-9175",
  url: "https://mmcts.org/",
  acesso: "aberto e gratuito",
  conferidoEm: "2026-09-03",
} as const;

export const urlDoTutorial = (id: number) => `https://mmcts.org/tutorial/${id}`;

export const TUTORIAIS: TutorialMmcts[] = [
  // ---- Estenose aórtica: as vias de acesso para a troca valvar ----
  {
    id: 1466,
    titulo: "Minimally invasive surgical aortic valve replacement through a right anterolateral thoracotomy",
    topico: "estenose-aortica",
    porque: "A via minimamente invasiva de troca valvar aórtica, passo a passo.",
    procedimentos: ["troca-aortica"],
  },
  {
    id: 2023,
    titulo: "Scarless aortic valve replacement (periareolar approach) with a limited suture technique",
    topico: "estenose-aortica",
    porque: "Acesso periareolar — alternativa quando o resultado estético pesa na decisão.",
    procedimentos: ["troca-aortica"],
  },
  {
    id: 907,
    titulo: "Minimally invasive redo-aortic valve replacement",
    topico: "estenose-aortica",
    porque: "Reoperação de prótese aórtica, que é o cenário do valve-in-valve cirúrgico.",
    procedimentos: ["troca-aortica"],
  },

  // ---- Insuficiência aórtica: preservar a valva em vez de trocá-la ----
  // A diretriz de 2025 recomenda o reparo valvar em centro experiente (IIa B) e a
  // troca da raiz com preservação em jovens (I B). Estes três são a técnica.
  {
    id: 76,
    titulo: "Valve-sparing aortic root replacement with the reimplantation technique",
    topico: "insuficiencia-aortica",
    porque: "A técnica de reimplante (David) — a operação que a diretriz recomenda em jovens.",
    procedimentos: ["preservacao-aortica"],
  },
  {
    id: 1206,
    titulo: "Valve-sparing aortic replacement: Root remodeling",
    topico: "insuficiencia-aortica",
    porque: "O remodelamento da raiz (Yacoub), a outra família de preservação valvar.",
    procedimentos: ["preservacao-aortica"],
  },
  {
    id: 1823,
    titulo: "Valve-sparing root reimplantation with a Valsalva graft for a trileaflet aortic valve",
    topico: "insuficiencia-aortica",
    porque: "Reimplante com enxerto de Valsalva em valva tricúspide nativa.",
    procedimentos: ["preservacao-aortica"],
  },

  // ---- Estenose mitral ----
  {
    id: 971,
    titulo: "Repair of rheumatic mitral stenosis with bicommissural release, anterior leaflet augmentation, and oversized annuloplasty",
    topico: "estenose-mitral",
    porque: "Reparo da estenose mitral reumática — a etiologia que predomina no Brasil.",
    procedimentos: ["plastica-mitral"],
  },

  // ---- Insuficiência mitral: a plástica, que é a técnica recomendada ----
  {
    id: 821,
    titulo: "Mitral valve annuloplasty",
    topico: "insuficiencia-mitral",
    porque: "A anuloplastia mitral, base de quase toda plástica.",
    procedimentos: ["plastica-mitral"],
  },
  {
    id: 763,
    titulo: "Mitral annuloplasty",
    topico: "insuficiencia-mitral",
    porque: "Segunda demonstração de anuloplastia, com abordagem distinta.",
    procedimentos: ["plastica-mitral"],
  },
  {
    id: 1644,
    titulo: "Robotic transareolar mitral valve repair",
    topico: "insuficiencia-mitral",
    porque: "Plástica mitral robótica por via transareolar.",
    procedimentos: ["plastica-mitral"],
  },
  {
    id: 1742,
    titulo: "Suture map for endoscopic mitral valve replacement",
    topico: "insuficiencia-mitral",
    porque: "Quando a plástica não é viável: mapa de sutura para troca endoscópica.",
    procedimentos: ["troca-mitral"],
  },

  // ---- Insuficiência tricúspide ----
  {
    id: 663,
    titulo: "Tricuspid valve annuloplasty for functional regurgitation",
    topico: "insuficiencia-tricuspide",
    porque: "Anuloplastia tricúspide na IT funcional, que é a apresentação mais comum.",
    procedimentos: ["plastica-tricuspide"],
  },

  // ---- Endocardite infecciosa ----
  {
    id: 70,
    titulo: "Complex tricuspid valve repair for infective endocarditis: leaflet augmentation, chordae and annular reconstruction",
    topico: "endocardite-infecciosa",
    porque: "Reconstrução tricúspide na endocardite com destruição extensa.",
    procedimentos: ["plastica-tricuspide"],
  },
  {
    id: 2138,
    titulo: "Infective endocarditis with aortic root abscess and septic coronary occlusion: Aortic allograft implantation and DOR ventriculoplasty in a redo-operation",
    topico: "endocardite-infecciosa",
    porque: "Abscesso de raiz aórtica com homoenxerto — a complicação que muda a operação inteira.",
    procedimentos: ["troca-aortica"],
  },

  // ---- Doença multivalvar ----
  {
    id: 525,
    titulo: "Mitral valve repair and aortic valve replacement with sutureless prosthesis implantation through a right minithoracotomy",
    topico: "doenca-multivalvar",
    porque: "Plástica mitral e troca aórtica no mesmo tempo, por minitoracotomia.",
    procedimentos: ["plastica-mitral", "troca-aortica", "cirurgia-combinada"],
  },
  {
    id: 727,
    titulo: "Surgical treatment of double and triple heart valve disease through a limited single-access right minithoracotomy",
    topico: "doenca-multivalvar",
    porque: "Dupla e tripla lesão valvar por acesso único.",
    procedimentos: ["cirurgia-combinada"],
  },
  {
    id: 1768,
    titulo: "Coronary artery bypass grafting and mitral valve replacement via a left anterior minithoracotomy",
    topico: "doenca-multivalvar",
    porque: "Revascularização associada à troca mitral — a combinação mais frequente na prática.",
    procedimentos: ["troca-mitral", "cirurgia-combinada"],
  },
];

/** Os tutoriais de um tópico da biblioteca, na ordem em que foram cadastrados. */
export function tutoriaisDoTopico(slug: string): TutorialMmcts[] {
  return TUTORIAIS.filter((t) => t.topico === slug);
}

// ---------------------------------------------------------------------------
// Por procedimento
// ---------------------------------------------------------------------------

export interface Procedimento {
  rotulo: string;
  /** O que o conjunto de vídeos cobre — em uma frase, sem promessa a mais. */
  descricao: string;
}

export const PROCEDIMENTOS: Record<ChaveDeProcedimento, Procedimento> = {
  "troca-aortica": {
    rotulo: "Troca valvar aórtica",
    descricao:
      "Vias de acesso para o implante de prótese em posição aórtica, incluindo reoperação e homoenxerto na endocardite.",
  },
  "preservacao-aortica": {
    rotulo: "Preservação da valva aórtica",
    descricao:
      "Reimplante e remodelamento da raiz — as operações que evitam a prótese no paciente jovem com insuficiência aórtica.",
  },
  "plastica-mitral": {
    rotulo: "Plástica mitral",
    descricao:
      "Anuloplastia e reparo, por esternotomia, por via robótica e na estenose reumática.",
  },
  "troca-mitral": {
    rotulo: "Troca valvar mitral",
    descricao: "Implante de prótese em posição mitral quando o reparo não é viável.",
  },
  "plastica-tricuspide": {
    rotulo: "Plástica tricúspide",
    descricao: "Anuloplastia na regurgitação funcional e reconstrução na endocardite.",
  },
  "cirurgia-combinada": {
    rotulo: "Cirurgia combinada e multivalvar",
    descricao: "Duas ou mais valvas no mesmo tempo, e a associação com revascularização.",
  },
};

/** A ordem em que os procedimentos aparecem na tela. */
export const ORDEM_DOS_PROCEDIMENTOS: ChaveDeProcedimento[] = [
  "troca-aortica",
  "preservacao-aortica",
  "plastica-mitral",
  "troca-mitral",
  "plastica-tricuspide",
  "cirurgia-combinada",
];

export function tutoriaisDoProcedimento(chave: ChaveDeProcedimento): TutorialMmcts[] {
  return TUTORIAIS.filter((t) => t.procedimentos.includes(chave));
}

/**
 * Os gestos cirúrgicos que cabem numa valvopatia.
 *
 * Não é indicação: é o mapa "se operar, a operação é desta família". Quem
 * decide se opera é o motor de conduta, e a tela do caso só oferece o link
 * quando ele já indicou intervenção.
 */
export function procedimentosDaValvopatia(
  valveType: string,
  valveDisease: string,
): ChaveDeProcedimento[] {
  const mapa: Record<string, ChaveDeProcedimento[]> = {
    "aortica:estenose": ["troca-aortica"],
    "aortica:insuficiencia": ["preservacao-aortica", "troca-aortica"],
    "mitral:estenose": ["plastica-mitral", "troca-mitral"],
    "mitral:insuficiencia": ["plastica-mitral", "troca-mitral"],
    "mitral:prolapso": ["plastica-mitral", "troca-mitral"],
    "tricuspide:insuficiencia": ["plastica-tricuspide"],
    "multipla:mista": ["cirurgia-combinada"],
  };
  return mapa[`${valveType}:${valveDisease}`] ?? [];
}

/**
 * O gesto de implante de uma família do catálogo, a partir do TIPO e da
 * POSIÇÃO do dispositivo — que é tudo o que o catálogo sabe.
 *
 * ## A cobertura é parcial, e isso é a resposta certa
 *
 * Nenhum dos 17 tutoriais é sobre um modelo de prótese. O MMCTS ensina o
 * gesto — abrir, ressecar, passar os pontos, assentar o anel —, e o gesto é o
 * mesmo para a Inspiris e para a Perimount. Ligar um vídeo a um MODELO daria
 * ao médico a impressão de que aquele vídeo é sobre aquele produto, o que
 * seria falso.
 *
 * Então a ligação é por posição e tipo, e as combinações sem tutorial
 * devolvem lista vazia em vez de qualquer coisa parecida. Prótese mecânica em
 * posição tricúspide, por exemplo, não tem vídeo nesta lista — e a tela diz
 * isso, em vez de oferecer o vídeo da mitral.
 */
export function tutoriaisParaProtese(
  tipo: string,
  posicao: string,
): { procedimento: ChaveDeProcedimento; tutoriais: TutorialMmcts[] } | null {
  const anel = tipo === "anel_anuloplastia";
  const chave: ChaveDeProcedimento | null =
    posicao === "aortica" && !anel ? "troca-aortica"
    : posicao === "mitral" && !anel ? "troca-mitral"
    : posicao === "mitral" && anel ? "plastica-mitral"
    : posicao === "tricuspide" && anel ? "plastica-tricuspide"
    : null;
  if (!chave) return null;
  const tutoriais = tutoriaisDoProcedimento(chave);
  return tutoriais.length > 0 ? { procedimento: chave, tutoriais } : null;
}

/**
 * O gesto cirúrgico de cada recomendação da diretriz — quando existe um.
 *
 * ## Por que uma tabela, e não uma busca no título
 *
 * A tela do caso precisa saber se a conduta sugerida é uma OPERAÇÃO, para só
 * então oferecer o vídeo da técnica. Procurar "cirurgia" ou "troca" no título
 * da recomendação funcionaria hoje e quebraria em silêncio na primeira vez que
 * alguém melhorasse uma redação — o link sumiria sem nenhum teste reprovar.
 * Aqui a ligação é por chave, e `mmcts.test.ts` reprova se uma chave desta
 * tabela deixar de existir na diretriz.
 *
 * ## As ausências são deliberadas
 *
 * Não estão aqui, e não por esquecimento:
 *   · `eaModoTavi`, `emPmcSintomatica`, `emPmcAssintomatica`, `itTranscateter`
 *     — procedimentos por cateter. O MMCTS é manual de cirurgia aberta, e não
 *     há tutorial conferido de TAVI, valvoplastia mitral ou reparo tricúspide
 *     transcateter nesta lista.
 *   · `eaHeartTeam`, `itAvaliacao` — pedem avaliação, não um gesto.
 *   · as recomendações de anticoagulação — não são ato cirúrgico.
 */
export const GESTO_DA_RECOMENDACAO: Record<string, ChaveDeProcedimento[]> = {
  eaSintomaticaAltoGradiente: ["troca-aortica"],
  eaSintomaticaBaixoFluxoFeReduzida: ["troca-aortica"],
  eaSintomaticaBaixoFluxoFeNormal: ["troca-aortica"],
  eaAssintomaticaFeBaixa: ["troca-aortica"],
  eaAssintomaticaAlternativaVigilancia: ["troca-aortica"],
  eaAssintomaticaCriterioAdicional: ["troca-aortica"],
  eaAssintomaticaQuedaPa: ["troca-aortica"],
  eaModoCirurgia: ["troca-aortica"],

  // Na insuficiência aórtica a operação pode ser preservação ou troca, e a
  // recomendação não escolhe entre as duas. Os dois conjuntos aparecem.
  iaSintomatica: ["preservacao-aortica", "troca-aortica"],
  iaAssintomatica: ["preservacao-aortica", "troca-aortica"],
  iaAssintomaticaLimiteMenor: ["preservacao-aortica", "troca-aortica"],

  imReparoPreferencial: ["plastica-mitral"],
  imSintomatica: ["plastica-mitral", "troca-mitral"],
  imAssintomaticaDisfuncao: ["plastica-mitral", "troca-mitral"],
  imAssintomaticaBaixoRisco: ["plastica-mitral"],
  emCirurgiaSemPmc: ["plastica-mitral", "troca-mitral"],

  itCirurgiaPrimariaSintomatica: ["plastica-tricuspide"],
  itAssintomaticaVd: ["plastica-tricuspide"],
};

/**
 * Os tutoriais que servem a um conjunto de recomendações já emitidas pelo
 * motor. Devolve lista vazia quando nenhuma delas é um gesto cirúrgico — que é
 * o caso de todo paciente em vigilância.
 */
export function tutoriaisDaConduta(chaves: (string | undefined)[]): TutorialMmcts[] {
  const gestos = new Set<ChaveDeProcedimento>();
  for (const chave of chaves) {
    if (!chave) continue;
    for (const g of GESTO_DA_RECOMENDACAO[chave] ?? []) gestos.add(g);
  }
  return TUTORIAIS.filter((t) => t.procedimentos.some((p) => gestos.has(p)));
}

/**
 * Tópicos que deliberadamente NÃO têm tutorial, e o motivo.
 *
 * Existe pelo mesmo princípio do resto do projeto: ausência sem motivo escrito é
 * indistinguível de esquecimento.
 */
export const SEM_TUTORIAL: Record<string, string> = {
  "anticoagulacao-protese":
    "O MMCTS é manual de técnica operatória. O manejo do anticoagulante não é gesto cirúrgico, e forçar um link aqui seria enfeite.",
};
