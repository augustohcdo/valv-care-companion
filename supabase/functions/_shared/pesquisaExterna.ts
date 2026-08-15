/**
 * Pesquisa externa da IA clínica — livre dentro de uma cerca, não fora dela.
 *
 * A base ValvePath é pequena por desenho: guarda síntese com citação, não a
 * literatura. Isso limita o médico, que pergunta sobre estudo recente, dado
 * brasileiro, especificação de prótese. A saída óbvia — dar internet aberta ao
 * modelo — trocaria um limite por um risco pior: resposta clínica ancorada em
 * blog, fórum ou folheto promocional, com a mesma cara de autoridade das
 * outras.
 *
 * Duas decisões sustentam este arquivo:
 *
 * 1. **A cerca é a origem, não o filtro.** Não existe busca aberta seguida de
 *    descarte do que não presta: o único caminho de rede aqui é a E-utilities
 *    do NCBI e o `fetch` de domínio que consta em `trusted_sources`. Domínio de
 *    fora não é rejeitado no fim — ele nunca chega a ser buscado. Filtrar
 *    depois já teria deixado o conteúdo influenciar a resposta.
 *
 * 2. **Confiável é o par (fonte, pergunta), não a fonte.** Cada domínio declara
 *    `citable_for` e `never_for`, e esses textos vão literalmente para a
 *    instrução do modelo. O site da Edwards é a melhor fonte que existe para o
 *    diâmetro de anel de um modelo dela e a pior possível para decidir entre
 *    TAVI e cirurgia. Sem esse par, "fonte confiável" vira carimbo que
 *    atravessa qualquer pergunta.
 *
 * A busca de literatura usa a E-utilities do NCBI: pública, sem chave, e —
 * o que importa aqui — devolve **metadado estruturado** (periódico, ano, tipo
 * de publicação). É isso que deixa o médico pesar o achado: metanálise em
 * European Heart Journal não é o mesmo que série de casos.
 */

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

/** Cortesia com o NCBI: identifica o cliente, como a documentação deles pede. */
const UA = "ValvePath/1.0 (apoio a decisao em valvopatia; contato: valvepath@gmail.com)";

export interface FonteConfiavel {
  domain: string;
  name: string;
  category: "sociedade_medica" | "orgao_publico" | "literatura" | "fabricante";
  citable_for: string;
  never_for: string | null;
}

export interface ArtigoEncontrado {
  pmid: string;
  titulo: string;
  revista: string;
  ano: string;
  /** "Meta-Analysis", "Randomized Controlled Trial", "Guideline"… */
  tipos: string[];
  resumo: string;
  url: string;
}

/** O host de uma URL, sem "www." e sem porta. `null` quando a URL é inválida. */
export function hostDe(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * A URL aponta para domínio permitido?
 *
 * Compara o host inteiro ou um subdomínio dele. Comparar por `includes` seria
 * o erro clássico: `abccardiol.org.exemplo-falso.com` passaria.
 */
export function permitida(url: string, fontes: FonteConfiavel[]): FonteConfiavel | null {
  const host = hostDe(url);
  if (!host) return null;
  return fontes.find((f) => {
    const d = f.domain.toLowerCase();
    return host === d || host.endsWith("." + d);
  }) ?? null;
}

/** Tira marcação e espaço em excesso — o resumo do PubMed vem em XML. */
export function limparTexto(bruto: string): string {
  return bruto
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Siglas que o médico escreve e que a literatura indexa igual. Passam intactas.
 *
 * A lista é explícita, e não uma regra de "tudo em maiúscula": "TAVI" é termo
 * de busca; "DR" e "SP", que aparecem no meio de uma pergunta, não são.
 */
const SIGLAS = new Set([
  "TAVI", "TAVR", "SAVR", "TEER", "MITRACLIP", "VIV", "PPM", "EOA", "EOAI",
  "BNP", "NT-PROBNP", "NYHA", "STS", "EUROSCORE", "AVA", "AVAI", "LVEF", "FE",
  "AF", "DOAC", "INR", "TC6", "CABG", "PCI", "AVR", "MVR", "TTE", "TEE",
]);

/**
 * Português → inglês, para os termos que aparecem em pergunta de valvopatia.
 *
 * Isto não é preciosismo: **a literatura é indexada em inglês, e a E-utilities
 * faz AND entre todos os termos.** Uma única palavra em português zera a busca.
 * Medido contra o PubMed antes de escrever esta função:
 *
 *   "aortic valve stenosis TAVI low risk"   → 689 resultados
 *   "aortic valve stenosis TAVI baixo risco" →   0 resultados
 *
 * Ou seja: mandar a pergunta do médico crua faria a pesquisa externa responder
 * "não encontrei literatura" em toda consulta, para sempre, parecendo que
 * funcionava. O que não estiver aqui nem nas siglas é descartado — busca com
 * termo a menos devolve resultado amplo; busca com termo errado devolve zero.
 */
const GLOSSARIO: Record<string, string> = {
  "baixo": "low", "alto": "high", "risco": "risk",
  "assintomatico": "asymptomatic", "assintomatica": "asymptomatic",
  "sintomatico": "symptomatic", "sintomatica": "symptomatic",
  "cirurgia": "surgery", "cirurgico": "surgical", "cirurgica": "surgical",
  "protese": "prosthesis", "proteses": "prosthesis",
  "mecanica": "mechanical", "biologica": "bioprosthesis", "bioprotese": "bioprosthesis",
  "anticoagulacao": "anticoagulation", "anticoagulante": "anticoagulant",
  "varfarina": "warfarin", "gestante": "pregnancy", "gravidez": "pregnancy",
  "idoso": "elderly", "idosos": "elderly", "jovem": "young",
  "reumatica": "rheumatic", "reumatico": "rheumatic",
  "valvoplastia": "valvuloplasty", "endocardite": "endocarditis",
  "fibrilacao": "atrial fibrillation", "atrial": "atrial",
  "insuficiencia": "regurgitation", "estenose": "stenosis",
  "gradiente": "gradient", "area": "valve area", "valvar": "valve",
  "fracao": "ejection fraction", "ejecao": "ejection fraction",
  "sobrevida": "survival", "mortalidade": "mortality",
  "desfecho": "outcome", "desfechos": "outcome",
  "seguimento": "follow-up", "acompanhamento": "follow-up",
  "diretriz": "guideline", "diretrizes": "guideline",
  "metanalise": "meta-analysis", "randomizado": "randomized",
  "durabilidade": "durability", "reintervencao": "reintervention",
  "marcapasso": "pacemaker", "coronaria": "coronary", "coronariana": "coronary",
  "obstrucao": "obstruction", "aortica": "aortic", "aortico": "aortic",
  "mitral": "mitral", "tricuspide": "tricuspid", "pulmonar": "pulmonary",
  "grave": "severe", "importante": "severe", "moderada": "moderate",
};

/** Tira acento para casar com o glossário sem precisar duplicar cada entrada. */
function semAcento(t: string): string {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Monta o termo de busca a partir do caso e da pergunta.
 *
 * Fica separado e puro para poder ser testado: um termo mal montado devolve
 * literatura de outra doença — ou, como a medição acima mostra, nenhuma.
 */
export function termoDeBusca(partes: {
  valveType?: string | null;
  valveDisease?: string | null;
  pergunta?: string | null;
}): string {
  const mapaValva: Record<string, string> = {
    aortica: "aortic valve", mitral: "mitral valve",
    tricuspide: "tricuspid valve", pulmonar: "pulmonary valve",
    multipla: "multivalvular",
  };
  const mapaLesao: Record<string, string> = {
    estenose: "stenosis", insuficiencia: "regurgitation", mista: "mixed lesion",
    prolapso: "prolapse", protese_disfuncao: "prosthetic valve dysfunction",
  };

  const doCaso = [
    mapaValva[(partes.valveType ?? "").toLowerCase()],
    mapaLesao[(partes.valveDisease ?? "").toLowerCase()],
  ].filter(Boolean);

  // Da pergunta só sobrevive o que a literatura entende: sigla conhecida ou
  // palavra com tradução no glossário.
  const daPergunta: string[] = [];
  for (const cru of (partes.pergunta ?? "").split(/[^\p{L}\p{N}-]+/u)) {
    if (!cru) continue;
    const sigla = cru.toUpperCase();
    if (SIGLAS.has(sigla)) {
      if (!daPergunta.includes(sigla)) daPergunta.push(sigla);
      continue;
    }
    const traducao = GLOSSARIO[semAcento(cru.toLowerCase())];
    if (traducao && !daPergunta.includes(traducao) && !doCaso.includes(traducao)) {
      daPergunta.push(traducao);
    }
  }

  // Teto de termos: cada um vira um AND, e uma pergunta longa produziria uma
  // conjunção tão específica que não casa com artigo nenhum.
  return [...doCaso, ...daPergunta.slice(0, 5)].join(" ").trim();
}

interface OpcoesBusca {
  max?: number;
  /** Só publicações dos últimos N anos. Diretriz velha é ruído para o médico. */
  anos?: number;
}

/**
 * Busca literatura indexada no PubMed.
 *
 * Devolve lista vazia — nunca lança — quando o NCBI está fora do ar ou demora:
 * a IA clínica precisa continuar respondendo com a base própria, e uma pesquisa
 * que falhou é ausência de reforço, não motivo para derrubar a consulta.
 */
export async function buscarLiteratura(
  termo: string,
  { max = 5, anos = 8 }: OpcoesBusca = {},
): Promise<ArtigoEncontrado[]> {
  if (!termo.trim()) return [];
  try {
    const filtro = `${termo} AND ("${new Date().getFullYear() - anos}"[PDAT] : "3000"[PDAT])`;
    const busca = await fetch(
      `${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&sort=relevance` +
      `&retmax=${max}&term=${encodeURIComponent(filtro)}`,
      { headers: { "User-Agent": UA } },
    );
    if (!busca.ok) return [];
    const ids: string[] = (await busca.json())?.esearchresult?.idlist ?? [];
    if (!ids.length) return [];

    const [resumoResp, textoResp] = await Promise.all([
      fetch(`${EUTILS}/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`,
            { headers: { "User-Agent": UA } }),
      fetch(`${EUTILS}/efetch.fcgi?db=pubmed&retmode=xml&rettype=abstract&id=${ids.join(",")}`,
            { headers: { "User-Agent": UA } }),
    ]);
    if (!resumoResp.ok) return [];

    const meta = (await resumoResp.json())?.result ?? {};
    const xml = textoResp.ok ? await textoResp.text() : "";
    const porArtigo = xml.split("<PubmedArticle>").slice(1);

    return ids.map((pmid, i) => {
      const m = meta[pmid] ?? {};
      const bloco = porArtigo[i] ?? "";
      const resumo = limparTexto(
        [...bloco.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)]
          .map((x) => x[1]).join(" "),
      ).slice(0, 1800);
      return {
        pmid,
        titulo: limparTexto(m.title ?? ""),
        revista: m.fulljournalname ?? m.source ?? "",
        ano: String(m.pubdate ?? "").slice(0, 4),
        tipos: Array.isArray(m.pubtype) ? m.pubtype : [],
        resumo,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      };
    // Artigo sem resumo não sustenta afirmação nenhuma — só o título, que
    // convida a inventar o conteúdo. Fica de fora.
    }).filter((a) => a.titulo && a.resumo.length > 120);
  } catch (e) {
    console.error("buscarLiteratura falhou", e);
    return [];
  }
}

/**
 * Lê uma página de domínio permitido.
 *
 * A checagem de domínio vem **antes** do `fetch`, não depois: buscar para
 * depois descartar já teria feito a requisição a um endereço arbitrário — e
 * com credencial de servidor, isso é requisição forjada do lado do servidor,
 * não um detalhe de estilo.
 */
export async function lerFonte(
  url: string,
  fontes: FonteConfiavel[],
  { maxChars = 6000 } = {},
): Promise<{ texto: string; fonte: FonteConfiavel } | null> {
  const fonte = permitida(url, fontes);
  if (!fonte) return null;
  if (!url.startsWith("https://")) return null;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "manual", // redirecionamento poderia sair da cerca sem avisar
    });
    if (!r.ok) return null;
    const bruto = await r.text();
    const corpo = bruto
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ");
    const texto = limparTexto(corpo).slice(0, maxChars);
    return texto.length > 200 ? { texto, fonte } : null;
  } catch (e) {
    console.error("lerFonte falhou", url, e);
    return null;
  }
}

/**
 * O bloco que entra no prompt, com o escopo de cada fonte declarado ao lado.
 *
 * O escopo não é decorativo: é ele que impede a literatura de virar diretriz e
 * o fabricante de virar indicação.
 */
export function blocoDePesquisa(
  artigos: ArtigoEncontrado[],
  fontes: FonteConfiavel[],
): string {
  if (!artigos.length) return "";
  const literatura = fontes.find((f) => f.domain === "pubmed.ncbi.nlm.nih.gov");
  const regra = literatura
    ? `PODE EMBASAR: ${literatura.citable_for}` +
      (literatura.never_for ? `\nNÃO PODE: ${literatura.never_for}` : "")
    : "";
  return "\n\nLITERATURA RECUPERADA (PubMed — camada externa, distinta da base ValvePath):\n" +
    regra + "\n\n" +
    artigos.map((a, i) =>
      `[L${i + 1}] ${a.titulo}\n` +
      `    ${a.revista}, ${a.ano} · ${a.tipos.join(", ") || "tipo não informado"} · PMID ${a.pmid}\n` +
      `    "${a.resumo}"`
    ).join("\n\n");
}
