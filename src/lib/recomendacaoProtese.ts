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
 *
 * ## Em que ordem os fabricantes aparecem
 *
 * Por **cobertura de evidência**: quantos tamanhos daquele fabricante têm dado
 * de referência publicado nesta posição valvar, e em quantos modelos. O
 * critério aparece escrito na tela, com o número de cada um ao lado.
 *
 * Isto é ordem de procedência, não de mérito comercial — a Resolução CFM
 * 2.336/2023 proíbe ranking de produto, e um "fabricante preferido" gravado no
 * código seria exatamente isso. Aqui quem lidera, lidera porque tem mais
 * medida publicada, e deixa de liderar no dia em que outro publicar mais.
 *
 * Medido em 28/08/2026, na aórtica: Edwards 28 tamanhos com dado em 8 modelos,
 * Medtronic 28 em 6, Abbott 21 em 6. Na mitral: Edwards 9, Medtronic 5,
 * Abbott 4. A Edwards fica em primeiro nas duas posições — pelo número, não
 * por estar escrita numa lista.
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
  /** Gradiente médio de referência do modelo neste tamanho, quando publicado. */
  gradiente: number | null;
  gradienteDesvio: number | null;
  fonteRotulo: string | null;
  fonteUrl: string | null;
  /** EOA indexada projetada = EOA ÷ superfície corporal. */
  ieoa: number;
  grau: GrauPPM;
  anelMin: number | null;
  anelMax: number | null;
  imagem: string | null;
  paginaDoFabricante: string | null;
  /** Alerta regulatório, quando existe. Prótese com alerta nunca é indicada. */
  alerta: { tipo: string; nota: string; url: string; data: string | null } | null;
}

export interface RecomendacaoDoFabricante {
  fabricante: string;
  /** As que não produzem *mismatch* relevante, do menor tamanho para o maior. */
  adequadas: OpcaoProtese[];
  /** As que produziriam *mismatch*, para o médico ver onde está a fronteira. */
  insuficientes: OpcaoProtese[];
  /**
   * As que **não devem ser indicadas** por alerta regulatório, independentemente
   * da conta de mismatch.
   *
   * Ficam numa lista própria, e nunca em `adequadas`: o cálculo pode dizer que
   * a prótese serve, e a prótese ter sido retirada do mercado por falhar cedo.
   * Foi exatamente o caso da Trifecta GT — a EOA dela é excelente, e a Abbott a
   * recolheu em 2023 por deterioração estrutural precoce.
   */
  desaconselhadas: OpcaoProtese[];
  /** Quantos tamanhos deste fabricante ficaram de fora por não terem EOA publicada. */
  semEoaPublicada: number;
  /** Quantos tamanhos deste fabricante têm EOA de referência publicada. */
  comEoaPublicada: number;
  /** Em quantos modelos distintos esse dado publicado se espalha. */
  modelosComDado: number;
}

export interface Recomendacao {
  fabricantes: RecomendacaoDoFabricante[];
  /** Total de tamanhos da posição escolhida que não têm EOA publicada. */
  semEoaPublicada: number;
  /** Total avaliado. */
  avaliadas: number;
  /** Quantas ficaram de fora por alerta regulatório. */
  desaconselhadas: number;
  limiares: { grave: number; moderado: number };
  faixaDeObesidade: boolean;
  /** Frase que a tela mostra para explicar a ordem dos fabricantes. */
  criterioDeOrdem: string;
}

export const CRITERIO_DE_ORDEM =
  "Fabricantes em ordem de cobertura de evidência: quantos tamanhos têm EOA de " +
  "referência publicada nesta posição, e em quantos modelos. Não é ranking de " +
  "qualidade nem de preferência comercial.";

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
      f = {
        fabricante: nome, adequadas: [], insuficientes: [], desaconselhadas: [],
        semEoaPublicada: 0, comEoaPublicada: 0, modelosComDado: 0,
      };
      porFabricante.set(nome, f);
    }
    return f;
  };

  let semEoaPublicada = 0;
  let avaliadas = 0;
  /** fabricante -> modelos com pelo menos um tamanho com dado publicado. */
  const modelosComDado = new Map<string, Set<string>>();

  for (const p of daPosicao) {
    const f = garantir(p.manufacturer);
    if (p.effective_orifice_area == null || p.size == null) {
      f.semEoaPublicada++;
      semEoaPublicada++;
      continue;
    }
    f.comEoaPublicada++;
    if (!modelosComDado.has(p.manufacturer)) modelosComDado.set(p.manufacturer, new Set());
    modelosComDado.get(p.manufacturer)!.add(p.model_name);
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
      gradiente: p.mean_gradient_ref,
      gradienteDesvio: p.mean_gradient_ref_sd,
      fonteRotulo: p.eoa_source_label,
      fonteUrl: p.eoa_source_url,
      ieoa: r.ieoa,
      grau: r.grau,
      anelMin: p.annulus_min_mm,
      anelMax: p.annulus_max_mm,
      imagem: p.image_url,
      paginaDoFabricante: p.reference_url,
      alerta: p.advisory
        ? { tipo: p.advisory, nota: p.advisory_note ?? "", url: p.advisory_url ?? "", data: p.advisory_date }
        : null,
    };

    // O alerta vem ANTES da conta. Uma prótese retirada do mercado não entra em
    // "adequadas" nem que a EOA indexada seja ótima.
    if (opcao.alerta) f.desaconselhadas.push(opcao);
    else if (r.grau === "ausente") f.adequadas.push(opcao);
    else f.insuficientes.push(opcao);
  }

  // Menor tamanho primeiro: numa lista de opções que já evitam mismatch, a
  // menor é a que tem mais chance de caber no anel. Não é ordenação por mérito
  // entre fabricantes — dentro de cada fabricante, é ordem de viabilidade.
  const porTamanho = (a: OpcaoProtese, b: OpcaoProtese) =>
    a.tamanho - b.tamanho || a.modelo.localeCompare(b.modelo, "pt-BR");
  for (const f of porFabricante.values()) {
    f.modelosComDado = modelosComDado.get(f.fabricante)?.size ?? 0;
    f.adequadas.sort(porTamanho);
    f.desaconselhadas.sort(porTamanho);
    // Nas insuficientes, a maior primeiro: é a que chega mais perto de servir.
    f.insuficientes.sort((a, b) => b.ieoa - a.ieoa);
  }

  // Cobertura de evidência: tamanhos com dado publicado, depois em quantos
  // modelos esse dado se espalha, e só então o alfabeto. O desempate por
  // modelos existe porque na aórtica Edwards e Medtronic empatam em 28
  // tamanhos — e 28 espalhados por 8 modelos cobrem mais decisões clínicas do
  // que 28 concentrados em 6.
  const porEvidencia = (a: RecomendacaoDoFabricante, b: RecomendacaoDoFabricante) =>
    b.comEoaPublicada - a.comEoaPublicada ||
    b.modelosComDado - a.modelosComDado ||
    a.fabricante.localeCompare(b.fabricante, "pt-BR");

  return {
    fabricantes: [...porFabricante.values()].sort(porEvidencia),
    semEoaPublicada,
    avaliadas,
    desaconselhadas: [...porFabricante.values()].reduce((n, f) => n + f.desaconselhadas.length, 0),
    limiares,
    faixaDeObesidade,
    criterioDeOrdem: CRITERIO_DE_ORDEM,
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
