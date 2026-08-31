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
    familia: "Abbott|Epic Plus Supra",
    resultado: "coberta_em_parte",
    nota:
      "Coberta em 21, 23, 25 e 27 mm pela entrada 'Abbott Epic' da Tabela A4 da ASE 2024; sem valor " +
      "no 19 mm, que a tabela não traz. Uma ressalva de procedência que precisa estar dita: a fonte " +
      "nomeia 'Abbott Epic', a geração anterior, e a Abbott hoje vende Epic Plus Supra — o rótulo da " +
      "fonte na tela continua dizendo o nome exato da entrada, para o médico saber que o valor é da " +
      "plataforma e não desta versão. O 29 mm que este catálogo trazia foi desativado: a tabela de " +
      "pedido da Abbott termina em 27 mm nos dois produtos aórticos de hoje.",
  },
  {
    familia: "Abbott|Epic Plus",
    resultado: "coberta_em_parte",
    nota:
      "Mitral coberta em 27, 29, 31 e 33 mm pela entrada 'AbbottEpic' da Tabela A5 da ASE 2024. Falta " +
      "só o 25 mm: a tabela começa no 27 mm. Esta família chegou a ficar inteira sem valor porque a " +
      "leitura linear do PDF perdia o glifo '±' e colava os números; a leitura por posição de coluna " +
      "mostrou que o segundo número cai na coluna de EOA (x≈509) e que a de velocidade de pico " +
      "(x≈383) está vazia nessas linhas. Mesma ressalva de geração da aórtica: a fonte nomeia 'Epic'.",
  },
  {
    familia: "Abbott|Epic Max",
    resultado: "sem_estudo",
    nota:
      "Entrou neste catálogo agora, com os cinco tamanhos e os códigos da tabela de pedido da Abbott " +
      "(EMAX-19 a EMAX-27). Não há EOA por tamanho publicada em diretriz: a página do produto fala em " +
      "hemodinâmica sem número, e a ASE 2024 não tem entrada 'Epic Max'. Emprestar o valor da 'Abbott " +
      "Epic' da tabela seria dar a uma geração o desempenho medido em outra.",
  },
  {
    familia: "Medtronic|Avalus Ultra",
    resultado: "sem_estudo",
    nota:
      "Entrou agora, com os seis tamanhos e os códigos da Medtronic (400U19 a 400U29). É a geração " +
      "seguinte da Avalus e ainda não tem entrada própria na ASE 2024 — a tabela traz 'Medtronic " +
      "Avalus', que é a primeira geração e já está no catálogo com valor próprio.",
  },
  {
    familia: "Medtronic|Mosaic",
    resultado: "coberta_em_parte",
    nota:
      "Entrou agora na posição mitral, com os cinco tamanhos e os códigos da Medtronic (310C25 a " +
      "310C33). A Tabela A5 da ASE 2024 traz só o 25 mm — 1,42 ± 0,29 cm² e 8,3 ± 1,71 mmHg, lidos " +
      "por posição de coluna. Os outros quatro, de 27 a 33 mm, continuam sem valor. Vale registrar " +
      "uma coincidência que parece erro e não é: essa linha da Mosaic traz números idênticos aos da " +
      "Hancock II 25 mm na mesma tabela. É o que a fonte publica, conferido nas duas páginas.",
  },
  {
    familia: "Labcor|Dokimos Plus Aórtica",
    resultado: "sem_estudo",
    nota:
      "Fabricante nacional que faltava neste catálogo, e a falta pesava mais que " +
      "qualquer nome errado de importada. Entra com os cinco tamanhos e os códigos da " +
      "tabela do fabricante (19A a 27A). Sem EOA por tamanho: a ASE 2024 não traz a " +
      "Dokimos Plus — traz a Labcor Santiago (19 mm) e a Synergy (21 mm), que são " +
      "gerações anteriores, um tamanho cada, e emprestar valor entre gerações é " +
      "inventar procedência. O diâmetro interno que o fabricante publica é medida " +
      "GEOMÉTRICA e por isso fica na descrição, fora do campo clínico.",
    referencia: {
      citacao: "Christ T, Grubitzsch H, Claus B, et al. Clinical outcome and hemodynamic behavior of the Labcor Dokimos Plus aortic valve. J Cardiothorac Surg 2016;11(1):160.",
      url: "https://pubmed.ncbi.nlm.nih.gov/27899119/",
    },
  },
  {
    familia: "Labcor|Dokimos Plus Mitral",
    resultado: "sem_estudo",
    nota:
      "Mesma família construtiva da aórtica, cinco tamanhos (25M a 33M) e registro " +
      "ANVISA próprio. Sem EOA por tamanho publicada: a literatura acessível da " +
      "Dokimos Plus é da versão aórtica, e a Tabela A5 da ASE 2024 não a traz.",
  },
  {
    familia: "Cardioprótese|Premium Aórtica",
    resultado: "sem_estudo",
    nota:
      "Fabricante nacional de Curitiba, citado no parecer técnico brasileiro de 2023 " +
      "junto com Braile e Labcor. Entra com os cinco tamanhos da página do fabricante. " +
      "A página fala em gradiente médio 'consistentemente de um dígito' sem número por " +
      "tamanho, e frase sem número não vira valor de referência.",
    referencia: {
      citacao: "Farias FR, Loures DRR, Costa FDA, et al. Aortic valve replacement with the Cardioprotese Premium bovine pericardium bioprosthesis: four-year clinical results. Interact Cardiovasc Thorac Surg 2012;15(2):229-234.",
      url: "https://pubmed.ncbi.nlm.nih.gov/22588029/",
    },
  },
  {
    familia: "Cardioprótese|Premium Mitral",
    resultado: "sem_estudo",
    nota:
      "Mesma plataforma em posição mitral, com aba de sutura reta e mais larga que a da " +
      "aórtica — diferença que o próprio fabricante descreve. Cinco tamanhos, de 25 a " +
      "33 mm. Sem hemodinâmica por tamanho publicada até esta busca.",
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
    familia: "Edwards|Magna Ease",
    resultado: "coberta_em_parte",
    nota:
      "Coberta em 21, 23, 25, 27 e 29 mm por Tsui 2022, que traz a tabela por tamanho na alta " +
      "hospitalar com coorte grande (n = 34, 87, 66, 19 e 11). Sem valor só no 19 mm, e por um motivo " +
      "específico: ali o n é 9, um paciente abaixo do piso de amostra desta base. Baixar o piso para " +
      "caber um caso é o mesmo que não ter piso — e o 19 mm é justamente o tamanho onde o mismatch " +
      "decide conduta, o pior lugar para relaxar critério. Os valores anteriores, de Mayr 2021, " +
      "cobriam só 23 e 25 mm com n = 17 e 27; foram substituídos pelos de Tsui, que medem a mesma " +
      "coisa em coorte cinco vezes maior. A ASE 2024 não tem entrada 'Magna' nem 'Magna Ease' — " +
      "conferido varrendo os 62 rótulos da Tabela A4.",
    referencia: {
      citacao: "Tsui S, Rosenbloom M, Abel J, et al. Eight-year outcomes of aortic valve replacement with the Carpentier-Edwards PERIMOUNT Magna Ease valve. J Card Surg 2022;37(12):4999-5010.",
      url: "https://pubmed.ncbi.nlm.nih.gov/36378942/",
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
 *   · **Medtronic** — `medtronic.scene7.com`. Ver abaixo.
 *   · **Corcym** — `corcym.s3.eu-central-1.amazonaws.com`, colhido do HTML das
 *     páginas de dispositivo.
 *
 * ## O erro que esta lista carregou por rodadas
 *
 * Durante três rodadas esta lista afirmou, com todas as letras, que as fotos da
 * Medtronic eram inalcançáveis: "medtronic.com responde 'Incorrect Browser'
 * para tudo — página de produto, site regional e asset direto. É proteção
 * contra robô, e não se contorna."
 *
 * A primeira frase é verdade. A conclusão era falsa, e por duas razões que eu
 * não tinha procurado:
 *
 *   1. `curl` não era o único meio — a busca da própria sessão sai por outro
 *      caminho, lê a página e grava o binário, então dá para **olhar**;
 *   2. a fotografia de produto da Medtronic **não mora em medtronic.com**. Mora
 *      em `medtronic.scene7.com`, que responde a qualquer cliente.
 *
 * Nove famílias ficaram anos sem foto porque um obstáculo real virou conclusão
 * geral sem ser testado até o fim. "Procurei e não há" só vale quando a busca
 * acabou; até lá é "não achei", que é outra coisa.
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
  // Vazia — e a lista vazia aqui é resultado, não descuido.
  //
  // Em 30/08/2026 as 36 famílias do catálogo cirúrgico têm imagem oficial do
  // fabricante, conferida uma a uma (o que foi visto em cada uma está em
  // `scripts/catalogo/fotos-oficiais.json`). A guarda dos dois sentidos no
  // `ferramentas:verificar` continua ligada: no dia em que entrar família sem
  // imagem, ela quebra até alguém escrever aqui o motivo.
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
 *
 * ## O segundo defeito, achado depois: a varredura cobria 42% e não dizia
 *
 * A lista `semAlerta` tinha 19 nomes. O catálogo tem **45 famílias**. As outras
 * 25 nunca tinham sido conferidas por ninguém, e a tela anunciava "1 com alerta;
 * 19 conferidos e sem alerta" — contando o que foi feito sem contar o que
 * faltava, que é a forma mais comum de um relatório mentir sem escrever nada
 * falso. Uma varredura parcial apresentada como completa é exatamente o que
 * deixaria o próximo caso Trifecta passar.
 *
 * As 45 foram varridas com `scripts/catalogo/varredura-alertas.mjs`, contra os
 * dois bancos públicos da FDA para dispositivos. As três listas abaixo somam o
 * catálogo inteiro, e `ferramentas:verificar` quebra se deixarem de somar.
 *
 * ## O que esta varredura NÃO prova, e a prova disso
 *
 * Silêncio da FDA não é ausência de alerta. A prova está dentro da própria
 * varredura: **`product_description:"Trifecta"` devolve 404 no banco de
 * recolhimentos** — nenhum registro — e a Trifecta é justamente a prótese que a
 * Abbott retirou do mercado em 2023 por deterioração estrutural precoce, por
 * carta ao cliente. Se este catálogo dependesse só da FDA, teria dado a
 * Trifecta como limpa e continuaria a indicando.
 */
export const VARREDURA_DE_ALERTAS = {
  feitaEm: "2026-08-30",
  /** O que foi consultado. */
  fontes: [
    "carta ao cliente da Abbott sobre a família Trifecta (31/07/2023)",
    "comunicado FDA/Abbott sobre deterioração estrutural precoce (27/02/2023)",
    "banco de recolhimentos de dispositivos da FDA (openFDA device/recall), as 36 famílias",
    "banco de ações de fiscalização da FDA (openFDA device/enforcement), as 36 famílias",
    "página de portfólio de cada fabricante, para separar o que se vende do que saiu de linha",
  ],
  /**
   * Modelos com alerta que impede nova indicação — hoje, nenhum.
   *
   * A lista esvaziou por uma razão boa: a Trifecta GT, a única que estava aqui,
   * **saiu do catálogo** nesta rodada, porque a Abbott não a vende mais. Ela
   * continua com o alerta gravado e reaparece em `referencia_historica()`, para
   * quem já a tem implantada.
   *
   * Lista vazia aqui NÃO quer dizer que o mecanismo virou enfeite. A exclusão
   * por alerta continua coberta por teste de unidade com linha sintética em
   * `src/lib/recomendacaoProtese.test.ts` — que é o lugar certo para provar que
   * a máquina funciona, já que ela só é exercitada quando houver caso real.
   */
  comAlerta: [] as string[],
  /**
   * Achado real da varredura que **não** impede indicação — e por quê, um a um.
   *
   * Recolhimento de acessório, de lote nomeado ou de rótulo é fato, e fica
   * escrito; promovê-lo a "não indicar" encheria a tela de alerta falso, e
   * alerta falso treina o médico a ignorar alerta.
   */
  achadoSemImpactoNaIndicacao: [
    {
      familia: "Medtronic|Hancock II",
      achado:
        "Dois achados de lote: válvulas distribuídas após excursão de temperatura (2009) e 15 unidades " +
        "com tamanho errado no rótulo da caixa (2019) — a válvula em si estava correta.",
    },
    {
      familia: "Medtronic|Mosaic",
      achado:
        "Mesma família de achados de lote da Hancock II, e em parte o mesmo evento: a Mosaic 310 mitral " +
        "(REF 310C29 e 310C31) entrou no recolhimento de rótulo de 21/05/2019, e a porcina com Cinch no " +
        "de excursão de temperatura de 2009. Há ainda um recolhimento de 2014 do obturador aórtico, que " +
        "é instrumento de medida e não prótese.",
    },
    {
      familia: "Medtronic|Open Pivot",
      achado: "Uma caixa rotulada como aórtica contendo válvula mitral (2020). A válvula estava certa.",
    },
  ],
  /**
   * Conferido nas fontes acima e sem achado nenhum. É afirmação, não silêncio —
   * e é afirmação sobre as fontes consultadas, não sobre o mundo.
   */
  semAlerta: [
    "Abbott|Epic Max", "Abbott|Epic Plus", "Abbott|Epic Plus Supra",
    "Cardioprótese|Premium Aórtica", "Cardioprótese|Premium Mitral",
    "Labcor|Dokimos Plus Aórtica", "Labcor|Dokimos Plus Mitral",
    "Abbott|St. Jude Masters HP", "Abbott|St. Jude Regent", "Braile|Anel Rígido Braile",
    "Braile|Anel Rígido Gregori", "Braile|Prótese de Pericárdio Bovino", "Braile|Vivere",
    "Corcym|Crown PRT", "Corcym|Memo 3D", "Corcym|Memo 4D", "Corcym|Perceval Plus",
    "Corcym|Solo Smart", "Edwards|Cosgrove-Edwards Band (4600)", "Edwards|Inspiris Resilia",
    "Edwards|Intuity Elite", "Edwards|Konect Resilia", "Edwards|MC3 Tricuspid (4900)",
    "Edwards|Magna Ease", "Edwards|Magna Mitral Ease", "Edwards|Mitris Resilia",
    "Edwards|Physio Flex (5300)", "Edwards|Physio II (5200)", "Medtronic|Avalus",
    "Medtronic|Avalus Ultra", "Medtronic|CG Future", "Medtronic|Contour 3D",
    "Medtronic|Freestyle", "Medtronic|Profile 3D", "Meril|Dafodil", "Meril|Miltonia",
    "Meril|Miltonia AP"
  ],
  /** O limite da varredura, dito na tela e não só aqui. */
  naoCobre:
    "os bancos brasileiro (ANVISA) e europeu, e carta de fabricante que não vire " +
    "recolhimento na FDA — limite que pesa mais desde que entraram fabricantes " +
    "nacionais, cujos recolhimentos, se houver, não passariam pela FDA",
} as const;

/** Quantas famílias esta varredura declara ter conferido, nas três listas somadas. */
export const FAMILIAS_VARRIDAS =
  VARREDURA_DE_ALERTAS.comAlerta.length +
  VARREDURA_DE_ALERTAS.achadoSemImpactoNaIndicacao.length +
  VARREDURA_DE_ALERTAS.semAlerta.length;
