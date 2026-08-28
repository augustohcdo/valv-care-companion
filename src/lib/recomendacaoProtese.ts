import { classificarPPM, IMC_OBESIDADE, LIMIARES_PPM, type GrauPPM, type PosicaoValvar } from "@/lib/mismatch";
import type { ProteseDoCatalogo } from "@/hooks/useCatalogoProteses";

/**
 * Quais próteses, de cada fabricante, evitam *mismatch* neste paciente.
 *
 * A conta é a EOA indexada **projetada**: a EOA de referência publicada do
 * modelo dividida pela superfície corporal. Se o resultado passa do limiar da
 * Tabela 12 da EACVI, aquele tamanho não deve produzir *mismatch* relevante.
 *
 * ## O que este módulo NÃO sabe, e diz
 *
 * **O anel do paciente.** É ele que decide o que cabe — não a preferência do
 * cirurgião nem esta lista. Uma paciente de 1,50 m pode precisar de uma prótese
 * de 25 mm para não ter *mismatch* e ter um anel que só aceita 19 mm. Por isso
 * a saída traz a faixa de anel de cada opção e a tela diz, com todas as letras,
 * que a escolha final depende da medida do anel.
 *
 * E a projeção por tabela **superestima** o *mismatch* em relação à EOA medida
 * (Vriesendorp et al., EHJ-CI 2020) — serve para escolher prótese, não para
 * carimbar diagnóstico.
 *
 * ## Por que agrupado por fabricante
 *
 * Porque é assim que a decisão acontece na sala: o serviço tem contrato,
 * consignação ou disponibilidade de uma ou duas marcas. Uma lista única
 * ordenada por EOA seria um ranking entre fabricantes — o que este produto não
 * faz — e ainda por cima inútil para quem só tem duas marcas na prateleira.
 */

export interface OpcaoProtese {
  id: string;
  fabricante: string;
  modelo: string;
  tipo: string;
  tamanho: number;
  /** EOA de referência publicada, em cm². */
  eoa: number;
  eoaDesvio: number | null;
  fonteRotulo: string | null;
  fonteUrl: string | null;
  /** EOA indexada projetada = EOA ÷ superfície corporal. */
  ieoa: number;
  grau: GrauPPM;
  anelMin: number | null;
  anelMax: number | null;
  imagem: string | null;
  paginaDoFabricante: string | null;
}

export interface RecomendacaoDoFabricante {
  fabricante: string;
  /** As que não produzem *mismatch* relevante, do menor tamanho para o maior. */
  adequadas: OpcaoProtese[];
  /** As que produziriam *mismatch*, para o médico ver onde está a fronteira. */
  insuficientes: OpcaoProtese[];
  /** Quantos tamanhos deste fabricante ficaram de fora por não terem EOA publicada. */
  semEoaPublicada: number;
}

export interface Recomendacao {
  fabricantes: RecomendacaoDoFabricante[];
  /** Total de tamanhos da posição escolhida que não têm EOA publicada. */
  semEoaPublicada: number;
  /** Total avaliado. */
  avaliadas: number;
  limiares: { grave: number; moderado: number };
  faixaDeObesidade: boolean;
}

/** Só faz sentido projetar *mismatch* para prótese que substitui a valva. */
const TIPOS_DE_SUBSTITUICAO = new Set(["biologica_aortica", "biologica_mitral", "mecanica", "tavi"]);

export function ehSubstituicao(tipo: string): boolean {
  return TIPOS_DE_SUBSTITUICAO.has(tipo);
}

/**
 * @param bsa superfície corporal em m² (DuBois — ver `bsa.ts`).
 * @param imc quando ausente, vale a coluna mais exigente da tabela. Não
 *            informar nunca faz o resultado parecer melhor do que é.
 */
export function recomendarProteses(
  catalogo: ProteseDoCatalogo[],
  bsa: number,
  posicao: PosicaoValvar,
  imc?: number | null,
): Recomendacao {
  const faixaDeObesidade = imc != null && imc >= IMC_OBESIDADE;
  const limiares = LIMIARES_PPM[posicao][faixaDeObesidade ? "obeso" : "normal"];

  const daPosicao = catalogo.filter(
    (p) => p.valve_position === posicao && ehSubstituicao(p.type),
  );

  const porFabricante = new Map<string, RecomendacaoDoFabricante>();
  const garantir = (nome: string) => {
    let f = porFabricante.get(nome);
    if (!f) {
      f = { fabricante: nome, adequadas: [], insuficientes: [], semEoaPublicada: 0 };
      porFabricante.set(nome, f);
    }
    return f;
  };

  let semEoaPublicada = 0;
  let avaliadas = 0;

  for (const p of daPosicao) {
    const f = garantir(p.manufacturer);
    if (p.effective_orifice_area == null || p.size == null) {
      f.semEoaPublicada++;
      semEoaPublicada++;
      continue;
    }
    const r = classificarPPM(p.effective_orifice_area, bsa, posicao, "projetada", imc);
    if (!r) continue;
    avaliadas++;

    const opcao: OpcaoProtese = {
      id: p.id,
      fabricante: p.manufacturer,
      modelo: p.model_name,
      tipo: p.type,
      tamanho: p.size,
      eoa: p.effective_orifice_area,
      eoaDesvio: p.eoa_reference_sd,
      fonteRotulo: p.eoa_source_label,
      fonteUrl: p.eoa_source_url,
      ieoa: r.ieoa,
      grau: r.grau,
      anelMin: p.annulus_min_mm,
      anelMax: p.annulus_max_mm,
      imagem: p.image_url,
      paginaDoFabricante: p.reference_url,
    };
    (r.grau === "ausente" ? f.adequadas : f.insuficientes).push(opcao);
  }

  // Menor tamanho primeiro: numa lista de opções que já evitam mismatch, a
  // menor é a que tem mais chance de caber no anel. Não é ordenação por mérito
  // entre fabricantes — dentro de cada fabricante, é ordem de viabilidade.
  const porTamanho = (a: OpcaoProtese, b: OpcaoProtese) =>
    a.tamanho - b.tamanho || a.modelo.localeCompare(b.modelo, "pt-BR");
  for (const f of porFabricante.values()) {
    f.adequadas.sort(porTamanho);
    // Nas insuficientes, a maior primeiro: é a que chega mais perto de servir.
    f.insuficientes.sort((a, b) => b.ieoa - a.ieoa);
  }

  return {
    fabricantes: [...porFabricante.values()].sort((a, b) =>
      a.fabricante.localeCompare(b.fabricante, "pt-BR"),
    ),
    semEoaPublicada,
    avaliadas,
    limiares,
    faixaDeObesidade,
  };
}

/**
 * O menor tamanho, por família de modelo, que evita *mismatch*.
 *
 * A lista completa de tamanhos adequados vira ruído quando um modelo tem seis
 * deles e todos servem. O que o cirurgião procura é o **piso**: a partir de que
 * tamanho aquele modelo deixa de produzir *mismatch* naquele paciente.
 */
export function menoresPorModelo(opcoes: OpcaoProtese[]): OpcaoProtese[] {
  const menor = new Map<string, OpcaoProtese>();
  for (const o of opcoes) {
    const atual = menor.get(o.modelo);
    if (!atual || o.tamanho < atual.tamanho) menor.set(o.modelo, o);
  }
  return [...menor.values()].sort((a, b) => a.modelo.localeCompare(b.modelo, "pt-BR"));
}
