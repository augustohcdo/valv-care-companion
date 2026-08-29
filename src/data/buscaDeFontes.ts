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
 * Sem essa distinção, um médico olha o campo em branco de uma prótese Braile e
 * não tem como saber se o produto é mal documentado ou se o catálogo é
 * incompleto. E o pior: pode ler a ausência como "sem mismatch".
 *
 * Isto vive em arquivo versionado, e não no banco, de propósito: é o registro de
 * um esforço de pesquisa, com data e com o que foi consultado — documentação, e
 * não dado clínico por linha. (Também é o que dá para fazer sem DDL enquanto o
 * token da Management API estiver recusado.)
 */

/**
 * `coberta_em_parte` entrou na segunda rodada, e por um erro meu: mudei a Open
 * Pivot de `sem_estudo` para `sem_dado_por_tamanho` depois de achar os valores
 * dela na ASE 2024, e a guarda que exige artigo citado em `sem_dado_por_tamanho`
 * reprovou — com razão. Os três estados originais só descreviam ausência total;
 * "tem dado em cinco tamanhos e falta um" não cabia em nenhum, e forçar o
 * encaixe faria a tela dizer algo falso sobre a família inteira.
 */
export type ResultadoDaBusca =
  | "sem_estudo"
  | "sem_dado_por_tamanho"
  | "amostra_pequena"
  | "coberta_em_parte";

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
    familia: "Braile|Prótese de Pericárdio Bovino",
    resultado: "sem_estudo",
    nota:
      "Esta família estava catalogada como 'Braile Biocor' — nome que não é da Braile: Biocor era a " +
      "Biocor Indústria e Pesquisas, comprada pela St. Jude Medical, hoje a linha Epic da Abbott. " +
      "Corrigido contra o catálogo do fabricante (código 261904), que também mostrou que faltavam " +
      "tamanhos: a aórtica vai a 29 mm e a mitral a 35 mm. Sobre a EOA: o acompanhamento tardio " +
      "publicado relata sobrevida e complicações e nenhum dado hemodinâmico; a tabela do catálogo " +
      "do fabricante traz EOA por tamanho, mas sem coorte, sem n e sem desvio — o catálogo irmão " +
      "da Vivere, no mesmo formato, diz 'resultados in vitro'. Bancada não vira EOA de referência.",
    referencia: {
      citacao: "Azeredo LG, et al. Late outcome analysis of the Braile Biomédica pericardial valve in the aortic position. Rev Bras Cir Cardiovasc 2014;29(3):316-321.",
      url: "https://pubmed.ncbi.nlm.nih.gov/25372903/",
    },
  },
  {
    familia: "Braile|Vivere",
    resultado: "sem_dado_por_tamanho",
    nota:
      "O catálogo do fabricante (código 610751) traz EOA e gradiente nos seis tamanhos de cada " +
      "posição — 19 a 29 mm na aórtica, 25 a 35 mm na mitral —, mas com '*Resultados in vitro*' " +
      "escrito embaixo das duas tabelas e desvio de ±0,01 cm², precisão que ensaio em paciente não " +
      "tem. É bancada, e bancada não projeta mismatch. Os valores ficam registrados em " +
      "scripts/catalogo/braile-catalogo-oficial.json, fora do campo clínico.",
    referencia: {
      citacao: "Braile-Sternieri MCVB, Goissis G, Giglioti AF, et al. In vivo evaluation of Vivere bovine pericardium valvular bioprosthesis with a new anticalcifying treatment. Artif Organs 2020;44(11):E482-E493.",
      url: "https://pubmed.ncbi.nlm.nih.gov/32364253/",
    },
  },
  {
    familia: "Braile|Inovare Alpha",
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
      "mas não calcula EOA em nenhum tamanho. O folheto do fabricante publica área GEOMÉTRICA do " +
      "orifício, que é medida do desenho da válvula e sempre maior que a efetiva — fica na descrição " +
      "de cada tamanho, com o nome certo, e fora do campo clínico. Este catálogo também trazia um " +
      "17 mm aórtico que não existe na tabela de pedido da Meril; foi desativado.",
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
    familia: "Meril|Dafodil Neo",
    resultado: "sem_estudo",
    nota:
      "A Meril vende e este catálogo não tem, e o motivo é falta de fonte de tamanhos: o link " +
      "'View Brochure' da página da Neo serve o PDF da Dafodil comum, não um da Neo, e a aba 'Size " +
      "Chart' carrega por JavaScript e não vem no HTML. Sem tabela do fabricante, os tamanhos não " +
      "são inventados — entrar com tamanho errado numa prótese é pior do que não ter a prótese.",
  },
  {
    familia: "Meril|Flomero",
    resultado: "sem_estudo",
    nota:
      "A Meril vende e este catálogo não tem. O único folheto disponível está marcado DRAFT em " +
      "marca-d'água nas duas páginas e não traz tabela de pedido; rascunho do fabricante não é fonte " +
      "para catálogo clínico. Da foto oficial dá para afirmar duas coisas: existe em aórtica e em " +
      "mitral, e há oferta de 17 mm.",
  },
  {
    familia: "Abbott|Navitor",
    resultado: "sem_dado_por_tamanho",
    nota:
      "O ensaio VANTAGE, de 2025, publica EOA de 1,8 cm² em 12 meses — mas somando os quatro " +
      "tamanhos (23, 25, 27 e 29 mm) numa medida só, e o texto completo não está livre no PMC. Um " +
      "valor único para toda a família não serve para projetar mismatch: a diferença entre o 23 e o " +
      "29 mm é justamente o que a ferramenta precisa saber.",
    referencia: {
      citacao: "Worthley SG, Giordano A, Corcione N, et al. 30-Day and 1-Year Outcomes of Navitor Transcatheter Aortic Valve in Low- or Intermediate-Risk Patients (VANTAGE). JACC Cardiovasc Interv 2025;18(20):2517-2527.",
      url: "https://pubmed.ncbi.nlm.nih.gov/40892604/",
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
    resultado: "coberta_em_parte",
    nota:
      "Aórtica coberta em 21 a 29 mm e mitral em 27 a 33 mm pela ASE 2024. Falta só o 25 mm mitral: a " +
      "Tabela A5 começa no 27 mm e não o traz. Registro do que mudou: esta família chegou a ficar inteira sem valor na " +
      "mitral porque a leitura linear do PDF perdia o glifo '±' e colava os números; a leitura por " +
      "posição de coluna mostrou que o segundo número está na coluna de EOA (x≈509) e que a de " +
      "velocidade de pico (x≈383) está vazia nessas linhas.",
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
    resultado: "coberta_em_parte",
    nota:
      "Tamanhos 27 a 33 mm cobertos pela Tabela A5 da ASE 2024. O 25 mm continua sem valor: a tabela " +
      "não o traz, e o estudo clínico agrupa 23 e 25 mm numa única medida (EOA 1,9 ± 0,9 cm²), que " +
      "não serve para projetar mismatch de um tamanho.",
    referencia: {
      citacao: "Kainuma S, et al. Clinical Outcomes of First-Time and Redo Mitral Valve Replacement Using MITRIS RESILIA Bioprosthesis. Ann Thorac Surg Short Rep 2026;4(2):618-624.",
      url: "https://pubmed.ncbi.nlm.nih.gov/42267016/",
    },
  },
  {
    familia: "Medtronic|Open Pivot",
    resultado: "coberta_em_parte",
    nota:
      "Aórtica 19 a 27 mm coberta pela Tabela A4 da ASE 2024, sob o nome 'ATS Bileaflet' — a Open " +
      "Pivot é a bileaflet da ATS Medical, comprada pela Medtronic em 2010. Ficam sem valor o 17 mm " +
      "aórtico (fora da tabela) e o 29 mm mitral (a A5 não tem entrada ATS). NÃO foi usada a linha " +
      "'ATS AP Bileaflet': é a série supra-anular, com outra numeração (18, 20, 22, 24, 26).",
  },
  {
    familia: "Edwards|Perimount",
    resultado: "coberta_em_parte",
    nota:
      "Coberta pela ASE 2024 nos dois lados: aórtica pela entrada 'Baxter Perimount' da Tabela A4 " +
      "(e não pela 'Carpentier-Edwards Pericardial' da mesma tabela, cujo 25 mm não traz EOA), " +
      "mitral pela 'Carpentier-Edwards Perimount, stented pericardial' da Tabela A5, em 25 a 33 mm.",
  },
  {
    familia: "Edwards|Magna Ease",
    resultado: "coberta_em_parte",
    nota:
      "Com valor apenas em 23 mm e 25 mm, de estudo próprio (Mayr 2021, n = 17 e n = 27). Sem valor " +
      "em 19, 21, 27 e 29 mm: a ASE 2024 não tem entrada 'Magna' nem 'Magna Ease' — conferido " +
      "varrendo os 62 rótulos da Tabela A4 —, e a Magna Ease é geração posterior à Perimount, então " +
      "emprestar o valor da Perimount seria inventar procedência. Existe medida de EOA da Magna Ease " +
      "21 mm em duplicador de pulso, citada ao lado, mas é bancada: não se mistura com valor clínico " +
      "no mesmo campo, e cobriria um tamanho só.",
    referencia: {
      citacao: "Sadat N, Scharfschwerdt M, Schaller T, et al. Functional performance of 8 small surgical aortic valve bioprostheses: an in vitro study. Eur J Cardiothorac Surg 2022;62(4):ezac426.",
      url: "https://pubmed.ncbi.nlm.nih.gov/35993864/",
    },
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
  coberta_em_parte:
    "Parte dos tamanhos tem EOA de referência publicada e parte não — os que faltam estão nomeados na nota.",
};


/**
 * A varredura por foto oficial — e por que algumas famílias seguem sem.
 *
 * A regra é a mesma da EOA: campo vazio precisa dizer se ninguém procurou ou se
 * procurou-se e não há. Onde não há foto, o cartão mostra o esquema construtivo
 * daqui — que é desenho nosso e não se confunde com produto.
 *
 * O que foi consultado, em 28/08/2026:
 *
 *   · **Edwards** — API de entrega do CMS deles (`deliver.kontent.ai`, leitura
 *     pública, a mesma que o site consome), 4.876 assets, cada um com o nome do
 *     item que o usa. É de onde saíram Sapien 3, Sapien 3 Ultra e Magna Mitral
 *     Ease nesta rodada.
 *   · **Abbott** — páginas de produto e o DAM próprio (`/content/dam/cv/`).
 *   · **Braile** — a REST do WordPress deles (`/wp-json/wp/v2/produto` e `/media`),
 *     aberta. Cinco fotos saíram de lá.
 *   · **Meril** — `strapi.merillife.com/uploads/...`, colhido do HTML das páginas
 *     de produto (a API do Strapi responde 403).
 *   · **Medtronic** — nada. Ver abaixo.
 *
 * ## A lista abaixo é uma afirmação, não um depósito
 *
 * Cada linha diz "procurei e não há". Se a família ganhar foto depois, a linha
 * vira mentira — e mentira aqui é pior do que ausência, porque quem lê o motivo
 * confia que ele foi conferido. Por isso `ferramentas:verificar` compara esta
 * lista com o catálogo servido nos dois sentidos: família sem foto tem de ter
 * motivo, e família **com** foto não pode ter. Foi assim que a Avalus saiu daqui.
 */
export const BUSCA_DE_FOTOS: { familia: string; motivo: string }[] = [
  {
    familia: "Edwards|Perimount",
    motivo:
      "As duas únicas candidatas no CMS da Edwards são radiografia de peça explantada — a segunda " +
      "traz 'Procedure: SPECIMEN IMAGING' escrito na própria imagem. A Edwards só publica foto de " +
      "produto da geração Magna Ease.",
  },
  ...["CG Future", "Contour 3D", "Evolut FX", "Evolut PRO+", "Freestyle", "Hancock II",
      "Open Pivot", "Profile 3D"].map((modelo) => ({
    familia: `Medtronic|${modelo}`,
    motivo:
      "medtronic.com responde 'Incorrect Browser' às páginas e 403 aos próprios arquivos de imagem: " +
      "é proteção contra robô, e não se contorna. O índice do arquivo da web chegou a devolver as " +
      "URLs canônicas do DAM da Medtronic — foi assim que a Avalus entrou —, mas o arquivo passou a " +
      "recusar conexão deste ambiente antes de as demais serem abertas, e URL que ninguém olhou não " +
      "entra. A única imagem livre encontrada é um conduto ápico-aórtico montado na mesa cirúrgica, " +
      "com a raiz porcina já recortada: não é foto de produto.",
  })),
  ...["Crown PRT", "Memo 3D", "Memo 4D", "Perceval Plus", "Solo Smart"].map((modelo) => ({
    familia: `Corcym|${modelo}`,
    motivo:
      "A Corcym não publica página de produto — o sitemap deles não tem nenhuma, e era daí que vinham " +
      "os cinco 404 que este catálogo carregava. A biblioteca de mídia oferece oito arquivos em " +
      "'product-images'; abri os oito, e são quadros de vídeo com o campo operatório aberto. Foto de " +
      "cirurgia não ilustra prótese em cartão de catálogo.",
  })),
  {
    familia: "Meril|Myval Octacor",
    motivo:
      "A Meril fundiu Myval e Myval Octacor numa página só, 'Myval THV series', com uma imagem que os " +
      "dados estruturados da própria página atribuem à **série** e não a um dos dois modelos. Usá-la " +
      "aqui seria afirmar que aquilo é a Octacor, que é justamente o erro que esta busca evita.",
  },
  {
    familia: "Abbott|Trifecta GT",
    motivo:
      "Retirada do mercado em 2023: a Abbott tirou a linha do site. Também não faria sentido " +
      "ilustrar com foto de produto uma prótese que não deve ser indicada.",
  },
  {
    familia: "Abbott|Portico",
    motivo:
      "A Abbott aposentou a página própria da Portico e a foto foi com ela — mas a válvula CONTINUA " +
      "no portfólio deles, listada em transcatheter-valve-solutions. Esta nota já dizia que a Portico " +
      "tinha sido substituída pela Navitor, e isso estava errado.",
  },
  {
    familia: "Abbott|Rigid Saddle Ring",
    motivo: "Sem foto de produto nas páginas de reparo valvar da Abbott varridas nesta rodada.",
  },
];

const PORFOTO = new Map(BUSCA_DE_FOTOS.map((b) => [b.familia, b.motivo]));

/** Por que esta família não tem foto oficial — ou `undefined` se ninguém registrou. */
export function motivoSemFoto(fabricante: string, modelo: string): string | undefined {
  return PORFOTO.get(`${fabricante}|${modelo}`);
}

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
