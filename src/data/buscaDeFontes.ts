/**
 * O registro da busca por EOA de referência — inclusive onde ela deu vazio.
 *
 * Existe porque campo vazio tem dois significados clinicamente opostos, e a tela
 * precisa saber qual é:
 *
 *   1. **ninguém procurou ainda** — pode haver dado, é só ir atrás;
 *   2. **procurou-se e não há** — a literatura acessível não publica EOA por
 *      tamanho para aquele modelo.
 *
 * Sem essa distinção, um médico olha o campo em branco de uma Braile Biocor e
 * não tem como saber se o produto é mal documentado ou se o catálogo é
 * incompleto. E o pior: pode ler a ausência como "sem mismatch".
 *
 * Isto vive em arquivo versionado, e não no banco, de propósito: é o registro de
 * um esforço de pesquisa, com data e com o que foi consultado — documentação, e
 * não dado clínico por linha. (Também é o que dá para fazer sem DDL enquanto o
 * token da Management API estiver recusado.)
 */

export type ResultadoDaBusca = "sem_estudo" | "sem_dado_por_tamanho" | "amostra_pequena";

export interface BuscaDeFonte {
  /** `fabricante|modelo` — a mesma chave de família usada no catálogo. */
  familia: string;
  resultado: ResultadoDaBusca;
  /** O que foi consultado e o que se achou, em uma frase. */
  nota: string;
  /** O artigo mais próximo que existe, quando existe. */
  referencia?: { citacao: string; url: string };
}

/** Quando a varredura foi feita. Aparece na tela, para o médico saber a idade da informação. */
export const BUSCA_FEITA_EM = "2026-08-28";

/**
 * O piso de amostra para um valor virar referência.
 *
 * Prova prática de por que ele existe: no ensaio Dafodil-1, o 23 mm (n=3) marca
 * EOA 2,32 cm² e o 25 mm (n=3) marca 1,84 — a curva inverte. Isso é ruído de
 * amostra pequena, e alimentaria um recomendador que diz a um cirurgião qual
 * prótese evita mismatch.
 */
export const N_MINIMO = 10;

export const BUSCA_DE_FONTES: BuscaDeFonte[] = [
  {
    familia: "Braile|Biocor",
    resultado: "sem_estudo",
    nota:
      "O acompanhamento tardio da válvula pericárdica Braile em posição aórtica relata sobrevida e " +
      "complicações, e nenhum dado hemodinâmico — nem EOA, nem gradiente por tamanho.",
    referencia: {
      citacao: "Azeredo LG, et al. Late outcome analysis of the Braile Biomédica pericardial valve in the aortic position. Rev Bras Cir Cardiovasc 2014;29(3):316-321.",
      url: "https://pubmed.ncbi.nlm.nih.gov/25372903/",
    },
  },
  {
    familia: "Braile|Inovare",
    resultado: "sem_dado_por_tamanho",
    nota:
      "O estudo hemodinâmico da Inovare relata gradiente médio de 5,59 ± 2,61 mmHg no pós-operatório, " +
      "mas não calcula EOA e não separa por tamanho (21 pacientes ao todo).",
    referencia: {
      citacao: "Fiori AG, et al. Hemodynamic and imaging assessment of TAVR with the Inovare Proseal using MDCT. Braz J Cardiovasc Surg 2020;35(2):127-133.",
      url: "https://pubmed.ncbi.nlm.nih.gov/32369290/",
    },
  },
  {
    familia: "Meril|Miltonia",
    resultado: "sem_dado_por_tamanho",
    nota:
      "A experiência clínica publicada com a Miltonia traz gradiente de pico e médio por tamanho, " +
      "mas não calcula EOA em nenhum tamanho.",
    referencia: {
      citacao: "Kashyap NK, et al. Clinical experience with the Miltonia valve. Indian J Thorac Cardiovasc Surg 2024;41(4):420-425.",
      url: "https://pubmed.ncbi.nlm.nih.gov/40144606/",
    },
  },
  {
    familia: "Meril|Myval",
    resultado: "sem_dado_por_tamanho",
    nota:
      "A durabilidade de quatro anos do Myval publica EOA média de 1,7 ± 0,4 cm² somando todos os " +
      "tamanhos. A tabela por tamanho existe, mas em material suplementar que não abre sem assinatura — " +
      "e número visto só em resumo de buscador não entra aqui.",
    referencia: {
      citacao: "Jain A, et al. Four-year durability of the Myval balloon-expandable transcatheter aortic valve. EuroIntervention 2025;21(13):e758-e765.",
      url: "https://pubmed.ncbi.nlm.nih.gov/40627005/",
    },
  },
  {
    familia: "Meril|Myval Octacor",
    resultado: "sem_estudo",
    nota:
      "Geração seguinte do Myval, sem estudo hemodinâmico próprio por tamanho publicado até esta busca.",
  },
  {
    familia: "Abbott|Navitor",
    resultado: "sem_dado_por_tamanho",
    nota:
      "A avaliação do sistema Navitor descreve 'gradiente baixo e EOA grande' sem publicar nenhum " +
      "valor — nem geral, nem por tamanho.",
    referencia: {
      citacao: "Aoun J, et al. A Comprehensive Evaluation of the NAVITOR Transcatheter Aortic Valve Replacement System. Heart Int 2024;18(1):26-29.",
      url: "https://pubmed.ncbi.nlm.nih.gov/39006462/",
    },
  },
  {
    familia: "Abbott|St. Jude Masters HP",
    resultado: "sem_estudo",
    nota:
      "Sem estudo com EOA por tamanho para a série Masters HP na busca da PMC. A entrada da ASE 2024 " +
      "para 'St. Jude Medical HaemPlus' saiu truncada no PDF e traz EOA caindo com o aumento do " +
      "tamanho (1,9 → 1,8 → 1,7), o que não se sustenta — não foi usada.",
  },
  {
    familia: "Abbott|Epic",
    resultado: "sem_dado_por_tamanho",
    nota:
      "A posição aórtica está coberta pela ASE 2024. Na mitral, a Tabela A5 traz só dois pares por " +
      "linha e, em posição mitral, velocidade de pico (m/s) e EOA (cm²) caem na mesma faixa numérica: " +
      "não dá para saber qual coluna é qual.",
  },
  {
    familia: "Corcym|Crown PRT",
    resultado: "sem_dado_por_tamanho",
    nota:
      "O ensaio randomizado que compara Magna Ease, Crown PRT e Trifecta relata gradiente por " +
      "prótese e por faixa (≤ 21 mm e > 21 mm), não por tamanho, e não publica EOA.",
    referencia: {
      citacao: "Montero-Cruces L, et al. One-Year Hemodynamic Performance of Three Cardiac Aortic Bioprostheses. J Clin Med 2021;10(22):5340.",
      url: "https://pubmed.ncbi.nlm.nih.gov/34830622/",
    },
  },
  {
    familia: "Edwards|Konect Resilia",
    resultado: "sem_estudo",
    nota:
      "Conduto valvado aórtico, sem estudo hemodinâmico por tamanho na busca da PMC. A EOA de um " +
      "conduto também não é comparável à de uma prótese isolada.",
  },
  {
    familia: "Edwards|Magna Mitral Ease",
    resultado: "sem_dado_por_tamanho",
    nota:
      "O acompanhamento de médio prazo da Magna mitral mostra a EOA indexada apenas em gráfico, sem " +
      "valores numéricos nem desvio por tamanho; a ênfase é no gradiente transmitral.",
    referencia: {
      citacao: "Loor G, et al. The Carpentier-Edwards Perimount Magna mitral valve bioprosthesis: intermediate-term efficacy and durability. J Cardiothorac Surg 2016;11:20.",
      url: "https://pubmed.ncbi.nlm.nih.gov/26818795/",
    },
  },
  {
    familia: "Edwards|Mitris Resilia",
    resultado: "sem_dado_por_tamanho",
    nota:
      "Os resultados clínicos publicados agrupam os tamanhos 23 e 25 mm numa única medida (EOA 1,9 ± " +
      "0,9 cm²) e apresentam os demais só em figura, sem valor por tamanho.",
    referencia: {
      citacao: "Kainuma S, et al. Clinical Outcomes of First-Time and Redo Mitral Valve Replacement Using MITRIS RESILIA Bioprosthesis. Ann Thorac Surg Short Rep 2026;4(2):618-624.",
      url: "https://pubmed.ncbi.nlm.nih.gov/42267016/",
    },
  },
  {
    familia: "Medtronic|Open Pivot",
    resultado: "sem_estudo",
    nota:
      "A única publicação encontrada é de dinâmica de fluidos comparando desenhos de dobradiça, sem " +
      "EOA clínica por tamanho.",
  },
  {
    familia: "Edwards|Perimount",
    resultado: "amostra_pequena",
    nota:
      "Coberta pela ASE 2024 em todos os tamanhos. Registrado aqui só para dizer que a entrada usada " +
      "é 'Baxter Perimount' da Tabela A4, e não a 'Carpentier-Edwards Pericardial' da mesma tabela, " +
      "cujo 25 mm não traz EOA.",
  },
];

const PORFAMILIA = new Map(BUSCA_DE_FONTES.map((b) => [b.familia, b]));

/** O que se sabe sobre a ausência de EOA nesta família — ou `undefined` se ninguém procurou. */
export function buscaDaFamilia(fabricante: string, modelo: string): BuscaDeFonte | undefined {
  return PORFAMILIA.get(`${fabricante}|${modelo}`);
}

export const TEXTO_DO_RESULTADO: Record<ResultadoDaBusca, string> = {
  sem_estudo: "Procuramos e não há estudo publicado com EOA por tamanho para este modelo.",
  sem_dado_por_tamanho:
    "Há estudo publicado, mas ele não separa a EOA por tamanho — e um valor somando todos os tamanhos não serve para projetar mismatch.",
  amostra_pequena:
    "Há valor publicado, mas com amostra pequena demais para servir de referência.",
};


/**
 * A varredura por alerta regulatório — e o que ela achou.
 *
 * Nasceu de um susto: o catálogo listava a **Abbott Trifecta GT** com EOA
 * excelente, e o recomendador a indicava ativamente. A Abbott retirou a família
 * Trifecta do mercado dos EUA em 31/07/2023 por deterioração estrutural
 * precoce. A ferramenta estava sugerindo a um cirurgião uma válvula recolhida
 * por falhar cedo.
 *
 * Descobrir isso por acaso — a página de produtos da Abbott simplesmente não
 * cita mais a Trifecta — deixou claro que "nenhum alerta" também precisa ser
 * uma afirmação com data, e não um silêncio.
 */
export const VARREDURA_DE_ALERTAS = {
  feitaEm: "2026-08-28",
  /** O que foi consultado. */
  fontes: [
    "carta ao cliente da Abbott sobre a família Trifecta (31/07/2023)",
    "comunicado FDA/Abbott sobre deterioração estrutural precoce (27/02/2023)",
    "busca por recolhimentos Classe I de válvulas cardíacas entre 2023 e 2025",
  ],
  /** Modelos com alerta que impede nova indicação. */
  comAlerta: ["Abbott|Trifecta GT"],
  /**
   * O que foi conferido e **não** tem alerta que impeça indicação. Os
   * recolhimentos Classe 2 encontrados (sistema de entrega da Sapien 3,
   * embalagem da Perceval) são de acessório ou lote, não da prótese, e não
   * mudam a indicação.
   */
  semAlerta: [
    "Edwards|Perimount", "Edwards|Magna Ease", "Edwards|Inspiris Resilia",
    "Edwards|Intuity Elite", "Edwards|Konect Resilia", "Edwards|Mitris Resilia",
    "Edwards|Sapien 3", "Abbott|Epic", "Abbott|Portico", "Abbott|Navitor",
    "Abbott|St. Jude Regent", "Abbott|St. Jude Masters HP", "Medtronic|Avalus",
    "Medtronic|Freestyle", "Medtronic|Hancock II", "Medtronic|Open Pivot",
    "Medtronic|Evolut FX", "Medtronic|Evolut PRO+", "Corcym|Perceval Plus",
  ],
} as const;
