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

export interface TutorialMmcts {
  /** Id do tutorial no MMCTS — é ele que forma a URL. */
  id: number;
  /** Título como a página devolveu, com espaços normalizados. */
  titulo: string;
  /** O slug do tópico da biblioteca clínica a que ele pertence. */
  topico: string;
  /** Uma linha dizendo por que este tutorial está neste tópico. */
  porque: string;
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
  },
  {
    id: 2023,
    titulo: "Scarless aortic valve replacement (periareolar approach) with a limited suture technique",
    topico: "estenose-aortica",
    porque: "Acesso periareolar — alternativa quando o resultado estético pesa na decisão.",
  },
  {
    id: 907,
    titulo: "Minimally invasive redo-aortic valve replacement",
    topico: "estenose-aortica",
    porque: "Reoperação de prótese aórtica, que é o cenário do valve-in-valve cirúrgico.",
  },

  // ---- Insuficiência aórtica: preservar a valva em vez de trocá-la ----
  // A diretriz de 2025 recomenda o reparo valvar em centro experiente (IIa B) e a
  // troca da raiz com preservação em jovens (I B). Estes três são a técnica.
  {
    id: 76,
    titulo: "Valve-sparing aortic root replacement with the reimplantation technique",
    topico: "insuficiencia-aortica",
    porque: "A técnica de reimplante (David) — a operação que a diretriz recomenda em jovens.",
  },
  {
    id: 1206,
    titulo: "Valve-sparing aortic replacement: Root remodeling",
    topico: "insuficiencia-aortica",
    porque: "O remodelamento da raiz (Yacoub), a outra família de preservação valvar.",
  },
  {
    id: 1823,
    titulo: "Valve-sparing root reimplantation with a Valsalva graft for a trileaflet aortic valve",
    topico: "insuficiencia-aortica",
    porque: "Reimplante com enxerto de Valsalva em valva tricúspide nativa.",
  },

  // ---- Estenose mitral ----
  {
    id: 971,
    titulo: "Repair of rheumatic mitral stenosis with bicommissural release, anterior leaflet augmentation, and oversized annuloplasty",
    topico: "estenose-mitral",
    porque: "Reparo da estenose mitral reumática — a etiologia que predomina no Brasil.",
  },

  // ---- Insuficiência mitral: a plástica, que é a técnica recomendada ----
  {
    id: 821,
    titulo: "Mitral valve annuloplasty",
    topico: "insuficiencia-mitral",
    porque: "A anuloplastia mitral, base de quase toda plástica.",
  },
  {
    id: 763,
    titulo: "Mitral annuloplasty",
    topico: "insuficiencia-mitral",
    porque: "Segunda demonstração de anuloplastia, com abordagem distinta.",
  },
  {
    id: 1644,
    titulo: "Robotic transareolar mitral valve repair",
    topico: "insuficiencia-mitral",
    porque: "Plástica mitral robótica por via transareolar.",
  },
  {
    id: 1742,
    titulo: "Suture map for endoscopic mitral valve replacement",
    topico: "insuficiencia-mitral",
    porque: "Quando a plástica não é viável: mapa de sutura para troca endoscópica.",
  },

  // ---- Insuficiência tricúspide ----
  {
    id: 663,
    titulo: "Tricuspid valve annuloplasty for functional regurgitation",
    topico: "insuficiencia-tricuspide",
    porque: "Anuloplastia tricúspide na IT funcional, que é a apresentação mais comum.",
  },

  // ---- Endocardite infecciosa ----
  {
    id: 70,
    titulo: "Complex tricuspid valve repair for infective endocarditis: leaflet augmentation, chordae and annular reconstruction",
    topico: "endocardite-infecciosa",
    porque: "Reconstrução tricúspide na endocardite com destruição extensa.",
  },
  {
    id: 2138,
    titulo: "Infective endocarditis with aortic root abscess and septic coronary occlusion: Aortic allograft implantation and DOR ventriculoplasty in a redo-operation",
    topico: "endocardite-infecciosa",
    porque: "Abscesso de raiz aórtica com homoenxerto — a complicação que muda a operação inteira.",
  },

  // ---- Doença multivalvar ----
  {
    id: 525,
    titulo: "Mitral valve repair and aortic valve replacement with sutureless prosthesis implantation through a right minithoracotomy",
    topico: "doenca-multivalvar",
    porque: "Plástica mitral e troca aórtica no mesmo tempo, por minitoracotomia.",
  },
  {
    id: 727,
    titulo: "Surgical treatment of double and triple heart valve disease through a limited single-access right minithoracotomy",
    topico: "doenca-multivalvar",
    porque: "Dupla e tripla lesão valvar por acesso único.",
  },
  {
    id: 1768,
    titulo: "Coronary artery bypass grafting and mitral valve replacement via a left anterior minithoracotomy",
    topico: "doenca-multivalvar",
    porque: "Revascularização associada à troca mitral — a combinação mais frequente na prática.",
  },
];

/** Os tutoriais de um tópico da biblioteca, na ordem em que foram cadastrados. */
export function tutoriaisDoTopico(slug: string): TutorialMmcts[] {
  return TUTORIAIS.filter((t) => t.topico === slug);
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
