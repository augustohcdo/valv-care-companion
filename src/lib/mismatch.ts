/**
 * *Mismatch* prótese-paciente e leitura do gradiente transprotético.
 *
 * Fonte única de todos os limiares deste arquivo:
 * Lancellotti P, Pibarot P, Chambers J, Edvardsen T, Delgado V, Dulgheru R,
 * Pepi M, Cosyns B, Dweck MR, Garbi M, Magne J, Nieman K, Rosenhek R,
 * Bernard A, Lowenstein J, Vieira MLC, Rabischoffsky A, Vyhmeister RH, Zhou X,
 * Zhang Y, Zamorano J-L, Habib G.
 * "Recommendations for the imaging assessment of prosthetic heart valves",
 * Eur Heart J Cardiovasc Imaging 2016;17:589-590 — **Tabelas 12, 13 e 15**.
 *
 * Os números foram lidos do documento, tabela por tabela, e não de memória.
 * Ficam aqui em constantes exportadas porque a tela mostra a tabela inteira ao
 * lado do resultado: um limiar clínico escondido dentro de um `if` é um limiar
 * que ninguém confere.
 *
 * ## Duas perguntas diferentes, e misturá-las é o erro comum
 *
 * 1. **Antes de operar** — qual prótese escolher? Usa-se a EOA de *referência*
 *    publicada para aquele modelo e tamanho, dividida pela superfície corporal:
 *    é a *EOA indexada projetada*.
 * 2. **Depois de operar** — este gradiente alto é *mismatch* ou obstrução?
 *    Usa-se a EOA **medida** no ecocardiograma, mais o DVI e o tempo de
 *    aceleração. Gradiente alto com DVI normal e EOA próxima da de referência
 *    aponta *mismatch*; gradiente alto com DVI baixo e EOA muito abaixo da
 *    referência aponta obstrução.
 *
 * ## O limite da projeção, que vai dito na tela
 *
 * A EOA projetada por tabela de referência **superestima** o *mismatch* em
 * relação à EOA medida — há literatura específica sobre isso ("the fallacy of
 * indexed effective orifice area charts", J Thorac Cardiovasc Surg 2021). A
 * projeção serve para escolher prótese, não para carimbar diagnóstico, e este
 * módulo devolve os dois caminhos separados justamente para que a tela não
 * possa apresentar um como se fosse o outro.
 */

export type PosicaoValvar = "aortica" | "mitral";
export type GrauPPM = "ausente" | "moderado" | "grave";
export type Origem = "projetada" | "medida";

/**
 * Tabela 12 do documento. `severo` é o teto do grave; `moderado` é o teto do
 * moderado. Acima do teto do moderado, não há *mismatch*.
 *
 * A folga entre 0,65 e 0,66 (e entre 0,55 e 0,56, e assim por diante) é do
 * arredondamento da tabela publicada, não deste código: ela lista "0,85–0,66" e
 * "≤ 0,65". Um valor caído no vão vira **moderado**, que é a leitura
 * conservadora — e a única defensável, porque a alternativa seria classificar
 * como grave um paciente que a tabela não classifica.
 */
export const LIMIARES_PPM: Record<PosicaoValvar, Record<"normal" | "obeso", { grave: number; moderado: number }>> = {
  aortica: {
    normal: { grave: 0.65, moderado: 0.85 },
    obeso: { grave: 0.55, moderado: 0.70 },
  },
  mitral: {
    normal: { grave: 0.90, moderado: 1.20 },
    obeso: { grave: 0.75, moderado: 1.00 },
  },
};

/** O IMC a partir do qual a Tabela 12 troca de coluna. */
export const IMC_OBESIDADE = 30;

export interface ResultadoPPM {
  /** EOA indexada, em cm²/m². */
  ieoa: number;
  grau: GrauPPM;
  origem: Origem;
  /** `true` quando o IMC ≥ 30 fez valer a coluna de obesidade da Tabela 12. */
  faixaDeObesidade: boolean;
  /** Os dois limiares usados, para a tela poder mostrá-los junto do resultado. */
  limiares: { grave: number; moderado: number };
}

/**
 * @param eoa  área efetiva de orifício, em cm² — de referência (projeção) ou
 *             medida no eco (pós-operatório).
 * @param bsa  superfície corporal em m² (DuBois; ver `bsa.ts`).
 * @param imcPaciente  quando ausente, usa-se a coluna de IMC < 30, que é a
 *             **mais exigente**: ela acusa *mismatch* em situações que a coluna
 *             de obesidade não acusaria. Não informar o IMC nunca faz o
 *             resultado parecer melhor do que é.
 */
export function classificarPPM(
  eoa: number, bsa: number, posicao: PosicaoValvar, origem: Origem, imcPaciente?: number | null,
): ResultadoPPM | null {
  if (!(eoa > 0) || !(bsa > 0)) return null;
  const faixaDeObesidade = imcPaciente != null && imcPaciente >= IMC_OBESIDADE;
  const limiares = LIMIARES_PPM[posicao][faixaDeObesidade ? "obeso" : "normal"];
  const ieoa = eoa / bsa;
  const grau: GrauPPM =
    ieoa <= limiares.grave ? "grave" : ieoa <= limiares.moderado ? "moderado" : "ausente";
  return { ieoa, grau, origem, faixaDeObesidade, limiares };
}

/**
 * EOA pela equação de continuidade: (área da VSVE × VTI da VSVE) ÷ VTI da prótese.
 *
 * O diâmetro da via de saída entra ao quadrado, então um erro de 1 mm em 20 mm
 * muda a EOA em ~10%. A tela diz isso onde o campo é digitado.
 */
export function eoaPorContinuidade(
  diametroVsveMm: number, vtiVsveCm: number, vtiProteseCm: number,
): number | null {
  if (!(diametroVsveMm > 0) || !(vtiVsveCm > 0) || !(vtiProteseCm > 0)) return null;
  const raioCm = diametroVsveMm / 10 / 2;
  return (Math.PI * raioCm * raioCm * vtiVsveCm) / vtiProteseCm;
}

/**
 * Índice de velocidade Doppler.
 *
 * **A definição se inverte entre as posições**, e isto é fonte clássica de erro:
 * na aórtica é VTI da VSVE ÷ VTI da prótese (valores baixos são ruins); na
 * mitral é VTI da prótese ÷ VTI da VSVE (valores **altos** são ruins).
 */
export function dvi(posicao: PosicaoValvar, vtiVsveCm: number, vtiProteseCm: number): number | null {
  if (!(vtiVsveCm > 0) || !(vtiProteseCm > 0)) return null;
  return posicao === "aortica" ? vtiVsveCm / vtiProteseCm : vtiProteseCm / vtiVsveCm;
}

export type LeituraParametro = "normal" | "possivel" | "significativa";

export interface AchadoParametro {
  rotulo: string;
  valor: number;
  unidade: string;
  leitura: LeituraParametro;
  /** A linha da tabela publicada, para a tela mostrar de onde veio a leitura. */
  faixas: string;
}

/**
 * Tabela 13 — gradação da obstrução de prótese **aórtica**.
 *
 * `classificar` devolve a coluna da tabela. Cada parâmetro tem o seu sentido
 * (alguns pioram para cima, outros para baixo), e é por isso que cada um traz a
 * sua própria função em vez de um comparador genérico com um sinal invertido
 * em algum lugar.
 */
interface Parametro {
  rotulo: string;
  unidade: string;
  faixas: string;
  classificar: (v: number) => LeituraParametro;
}

const PARAMETROS_AORTICOS: Record<string, Parametro> = {
  velocidadePico: {
    rotulo: "Velocidade de pico", unidade: "m/s", faixas: "< 3 · 3–3,9 · ≥ 4",
    classificar: (v: number): LeituraParametro => (v < 3 ? "normal" : v < 4 ? "possivel" : "significativa"),
  },
  gradienteMedio: {
    rotulo: "Gradiente médio", unidade: "mmHg", faixas: "< 20 · 20–34 · ≥ 35",
    classificar: (v: number): LeituraParametro => (v < 20 ? "normal" : v < 35 ? "possivel" : "significativa"),
  },
  dvi: {
    rotulo: "Índice de velocidade Doppler (DVI)", unidade: "", faixas: "≥ 0,35 · 0,25–0,34 · < 0,25",
    classificar: (v: number): LeituraParametro => (v >= 0.35 ? "normal" : v >= 0.25 ? "possivel" : "significativa"),
  },
  eoa: {
    rotulo: "Área efetiva de orifício", unidade: "cm²", faixas: "> 1,1 · 0,8–1,1 · < 0,8",
    classificar: (v: number): LeituraParametro => (v > 1.1 ? "normal" : v >= 0.8 ? "possivel" : "significativa"),
  },
  tempoAceleracao: {
    rotulo: "Tempo de aceleração", unidade: "ms", faixas: "< 80 · 80–100 · > 100",
    classificar: (v: number): LeituraParametro => (v < 80 ? "normal" : v <= 100 ? "possivel" : "significativa"),
  },
};

/** Tabela 15 — gradação da obstrução de prótese **mitral**. */
const PARAMETROS_MITRAIS: Record<string, Parametro> = {
  velocidadePico: {
    rotulo: "Velocidade de pico", unidade: "m/s", faixas: "< 1,9 · 1,9–2,4 · ≥ 2,5",
    classificar: (v: number): LeituraParametro => (v < 1.9 ? "normal" : v < 2.5 ? "possivel" : "significativa"),
  },
  gradienteMedio: {
    rotulo: "Gradiente médio", unidade: "mmHg", faixas: "≤ 5 · 6–9 · ≥ 10",
    classificar: (v: number): LeituraParametro => (v <= 5 ? "normal" : v < 10 ? "possivel" : "significativa"),
  },
  dvi: {
    rotulo: "Índice de velocidade Doppler (DVI)", unidade: "", faixas: "< 2,2 · 2,2–2,5 · > 2,5",
    classificar: (v: number): LeituraParametro => (v < 2.2 ? "normal" : v <= 2.5 ? "possivel" : "significativa"),
  },
  eoa: {
    rotulo: "Área efetiva de orifício", unidade: "cm²", faixas: "≥ 2 · 1–2 · < 1",
    classificar: (v: number): LeituraParametro => (v >= 2 ? "normal" : v >= 1 ? "possivel" : "significativa"),
  },
  tempoHemipressao: {
    rotulo: "Tempo de meia-pressão (PHT)", unidade: "ms", faixas: "< 130 · 130–200 · > 200",
    classificar: (v: number): LeituraParametro => (v < 130 ? "normal" : v <= 200 ? "possivel" : "significativa"),
  },
};

export interface EntradaHemodinamica {
  velocidadePico?: number | null;
  gradienteMedio?: number | null;
  dvi?: number | null;
  eoa?: number | null;
  /** Aórtica: tempo de aceleração (ms). Mitral: tempo de meia-pressão (ms). */
  tempoAceleracao?: number | null;
  tempoHemipressao?: number | null;
  /** EOA de referência do modelo implantado, para a diferença da Tabela 13/15. */
  eoaReferencia?: number | null;
}

export interface LeituraHemodinamica {
  achados: AchadoParametro[];
  /** Quantos parâmetros o médico informou — a leitura global depende disso. */
  informados: number;
  /** A pior coluna atingida por qualquer parâmetro informado. */
  pior: LeituraParametro | null;
  /**
   * `null` enquanto não houver parâmetro suficiente. **Não** existe leitura
   * "normal" por ausência de dado: sem medida não há afirmação.
   */
  conclusao: string | null;
  /** Diferença entre a EOA de referência e a medida, quando ambas existem. */
  diferencaParaReferencia: number | null;
}

const ORDEM: Record<LeituraParametro, number> = { normal: 0, possivel: 1, significativa: 2 };

export function avaliarHemodinamica(
  posicao: PosicaoValvar, e: EntradaHemodinamica,
): LeituraHemodinamica {
  const tabela = posicao === "aortica" ? PARAMETROS_AORTICOS : PARAMETROS_MITRAIS;
  const achados: AchadoParametro[] = [];

  const somar = (chave: string, valor: number | null | undefined) => {
    if (valor == null || !Number.isFinite(valor)) return;
    const p = tabela[chave];
    // Chave sem linha na tabela seria um parâmetro medido e descartado em
    // silêncio — exatamente o formato de defeito que este projeto persegue.
    if (!p) throw new Error(`parâmetro sem linha na tabela publicada: ${chave}`);
    achados.push({
      rotulo: p.rotulo, valor, unidade: p.unidade,
      leitura: p.classificar(valor), faixas: p.faixas,
    });
  };

  somar("velocidadePico", e.velocidadePico);
  somar("gradienteMedio", e.gradienteMedio);
  somar("dvi", e.dvi);
  somar("eoa", e.eoa);
  if (posicao === "aortica") somar("tempoAceleracao", e.tempoAceleracao);
  else somar("tempoHemipressao", e.tempoHemipressao);

  const diferencaParaReferencia =
    e.eoaReferencia != null && e.eoa != null ? e.eoaReferencia - e.eoa : null;

  const pior = achados.length
    ? achados.reduce<LeituraParametro>((p, a) => (ORDEM[a.leitura] > ORDEM[p] ? a.leitura : p), "normal")
    : null;

  return {
    achados, informados: achados.length, pior,
    conclusao: achados.length ? conclusaoDe(pior!, achados, diferencaParaReferencia) : null,
    diferencaParaReferencia,
  };
}

/**
 * O texto que a tela mostra. Deliberadamente descreve o achado e o que ele
 * sugere — **não** emite conduta, e não carimba classe de recomendação de
 * diretriz num número calculado.
 */
function conclusaoDe(
  pior: LeituraParametro, achados: AchadoParametro[], diferenca: number | null,
): string {
  const anormais = achados.filter((a) => a.leitura !== "normal").length;
  if (pior === "normal") {
    return `Os ${achados.length} parâmetros informados estão na faixa normal da tabela.`;
  }
  const base =
    pior === "significativa"
      ? `${anormais} de ${achados.length} parâmetros informados caem na coluna de obstrução significativa.`
      : `${anormais} de ${achados.length} parâmetros informados caem na coluna de possível obstrução.`;

  // O discriminador da própria publicação: gradiente alto com DVI preservado e
  // EOA próxima da de referência aponta *mismatch*, não obstrução.
  const dviAchado = achados.find((a) => a.rotulo.startsWith("Índice de velocidade"));
  const gradiente = achados.find((a) => a.rotulo === "Gradiente médio");
  if (gradiente && gradiente.leitura !== "normal" && dviAchado?.leitura === "normal") {
    const perto = diferenca != null && diferenca < 0.25;
    return `${base} O gradiente está elevado com DVI preservado` +
      (perto ? " e EOA próxima do valor de referência do modelo" : "") +
      ", padrão que sugere mismatch prótese-paciente antes de obstrução. " +
      "Confirme com a EOA indexada e com a estrutura valvar à imagem.";
  }
  return `${base} Interprete junto da estrutura e da mobilidade valvar à imagem.`;
}
