// Score de risco clínico simplificado para valvopatias.
// Inspirado em variáveis de scores estabelecidos (STS, EuroSCORE II) — mas
// é uma estimativa EDUCACIONAL e NÃO substitui calculadoras validadas.

export interface RiskInputs {
  age?: number | null;
  sex?: string | null;
  nyha?: string | null;             // I, II, III, IV
  ejection_fraction?: number | null;
  severity?: string | null;          // leve, moderada, importante, critica
  comorbidities?: string[] | null;
}

export interface RiskBreakdown {
  label: string;
  points: number;
  detail?: string;
}

export type RiskCategory = "Baixo" | "Intermediário" | "Alto" | "Muito alto";

export interface RiskResult {
  score: number;                     // 0–100
  category: RiskCategory;
  color: string;
  description: string;
  breakdown: RiskBreakdown[];
  /** Rótulos das entradas que ninguém informou. */
  faltando: string[];
  /**
   * A categoria é conclusiva com o que se sabe?
   *
   * Falso quando os pontos que as entradas ausentes **poderiam** somar bastam
   * para levar o score a uma faixa mais alta. É aritmética, não julgamento
   * clínico: nenhuma opinião sobre "quantos dados bastam" entra aqui.
   */
  categoriaDeterminada: boolean;
  /** Até onde o risco poderia chegar se tudo o que falta fosse o pior caso. */
  categoriaMaxima: RiskCategory;
}

/**
 * O teto de pontos de cada entrada, e o rótulo que o médico lê quando falta.
 *
 * Os tetos vêm do cálculo logo abaixo — se um peso mudar lá, muda aqui. Estão
 * no mesmo arquivo de propósito: separá-los seria a mesma armadilha da lista de
 * tabelas do backup, que envelheceu longe daquilo que deveria descrever.
 *
 * **Ausente não é o mesmo que zero ponto.** NYHA I, sexo feminino, lesão leve e
 * FE 60 são respostas legítimas que somam zero — são conhecimento, não lacuna.
 */
const ENTRADAS: { rotulo: string; maximo: number; ausente: (i: RiskInputs) => boolean }[] = [
  { rotulo: "idade", maximo: 25, ausente: (i) => i.age == null },
  // "O" é a opção rotulada "Outro / não informado" no formulário. O rótulo
  // mistura duas coisas, e a única leitura honesta da mistura é não afirmar
  // conhecimento — são 3 pontos, raramente decisivos para a faixa.
  { rotulo: "sexo", maximo: 3, ausente: (i) => !i.sex || i.sex === "O" },
  { rotulo: "classe NYHA", maximo: 28, ausente: (i) => !i.nyha },
  { rotulo: "fração de ejeção", maximo: 22, ausente: (i) => i.ejection_fraction == null },
  { rotulo: "gravidade da lesão", maximo: 22, ausente: (i) => !i.severity },
  // Lista vazia conta como ausente: um multi-select intocado é indistinguível
  // de "nenhuma comorbidade", e adotar a segunda leitura seria exatamente
  // afirmar o que ninguém disse.
  { rotulo: "comorbidades", maximo: 22, ausente: (i) => !i.comorbidities?.length },
];

/** Quantas entradas o score considera — o denominador de "N de 6 dados". */
export const TOTAL_ENTRADAS = ENTRADAS.length;

/**
 * As faixas, com o texto que cada uma afirma quando a categoria é conclusiva.
 *
 * Tabela em vez de `if/else` porque a categoria real e a categoria máxima
 * precisam sair do **mesmo** classificador; dois encadeamentos paralelos
 * divergiriam no primeiro limiar que alguém mexesse.
 */
const FAIXAS: { abaixoDe: number; categoria: RiskCategory; color: string; description: string }[] = [
  {
    abaixoDe: 20,
    categoria: "Baixo",
    color: "text-success",
    description: "Perfil clínico favorável. Seguimento ambulatorial conforme diretrizes.",
  },
  {
    abaixoDe: 40,
    categoria: "Intermediário",
    color: "text-accent-foreground",
    description: "Discutir condutas e antecipar avaliações multidisciplinares.",
  },
  {
    abaixoDe: 65,
    categoria: "Alto",
    color: "text-warning",
    description: "Avaliação por Heart Team é recomendada. Discutir intervenção precoce.",
  },
  {
    abaixoDe: Infinity,
    categoria: "Muito alto",
    color: "text-destructive",
    description: "Considerar avaliação imediata por Heart Team. Risco cirúrgico relevante.",
  },
];

const faixaDe = (score: number) => FAIXAS.find((f) => score < f.abaixoDe)!;

const HIGH_RISK_COMORBIDITIES = [
  "Doença renal crônica",
  "DPOC",
  "AVC prévio",
  "Doença arterial coronariana",
  "Insuficiência cardíaca",
  "Fibrilação atrial",
];

export function calculateRisk(inputs: RiskInputs): RiskResult {
  const breakdown: RiskBreakdown[] = [];
  let score = 0;

  // Idade
  if (inputs.age != null) {
    let p = 0;
    if (inputs.age >= 80) p = 25;
    else if (inputs.age >= 70) p = 18;
    else if (inputs.age >= 60) p = 10;
    else if (inputs.age >= 50) p = 5;
    if (p > 0) {
      breakdown.push({ label: "Idade", points: p, detail: `${inputs.age} anos` });
      score += p;
    }
  }

  // Sexo (homem leve fator de risco em algumas valvopatias)
  //
  // `"M"` é o valor que o formulário grava (`NovoCaso.tsx`, opções F/M/O); a
  // comparação era só com `"masculino"`, então estes 3 pontos **nunca somaram
  // nada em produção** — o campo era coletado, impresso no PDF, passado para cá
  // e descartado em silêncio. `"masculino"` fica aceito para dado antigo e para
  // qualquer outro chamador que use a forma por extenso.
  if (inputs.sex === "M" || inputs.sex === "masculino") {
    breakdown.push({ label: "Sexo masculino", points: 3 });
    score += 3;
  }

  // NYHA
  if (inputs.nyha) {
    const nyhaPts: Record<string, number> = { I: 0, II: 8, III: 18, IV: 28 };
    const p = nyhaPts[inputs.nyha] ?? 0;
    if (p > 0) {
      breakdown.push({ label: `Classe NYHA ${inputs.nyha}`, points: p });
      score += p;
    }
  }

  // Fração de ejeção
  if (inputs.ejection_fraction != null) {
    let p = 0;
    if (inputs.ejection_fraction < 30) p = 22;
    else if (inputs.ejection_fraction < 40) p = 14;
    else if (inputs.ejection_fraction < 50) p = 7;
    if (p > 0) {
      breakdown.push({
        label: "Disfunção sistólica",
        points: p,
        detail: `FE ${inputs.ejection_fraction}%`,
      });
      score += p;
    }
  }

  // Severidade da valvopatia
  if (inputs.severity) {
    const sevPts: Record<string, number> = {
      leve: 0,
      moderada: 6,
      importante: 14,
      critica: 22,
      indeterminada: 0,
    };
    const p = sevPts[inputs.severity] ?? 0;
    if (p > 0) {
      breakdown.push({
        label: `Lesão ${inputs.severity}`,
        points: p,
      });
      score += p;
    }
  }

  // Comorbidades
  if (inputs.comorbidities?.length) {
    const high = inputs.comorbidities.filter((c) => HIGH_RISK_COMORBIDITIES.includes(c));
    if (high.length > 0) {
      const p = Math.min(high.length * 4, 16);
      breakdown.push({
        label: `Comorbidades de alto risco`,
        points: p,
        detail: high.join(", "),
      });
      score += p;
    }
    const others = inputs.comorbidities.length - high.length;
    if (others > 0) {
      const p = Math.min(others * 2, 6);
      breakdown.push({ label: `Outras comorbidades (${others})`, points: p });
      score += p;
    }
  }

  score = Math.min(score, 100);

  const faixa = faixaDe(score);

  // Entrada que falta não soma nada — e, sem este bloco, "não somou nada" era
  // indistinguível de "somou zero porque o paciente está bem". Um caso só com
  // `severity: "importante"` (a única coluna obrigatória no banco) dá 14
  // pontos, cai abaixo do limiar de 20 e era apresentado como "Perfil clínico
  // favorável. Seguimento ambulatorial conforme diretrizes.", em verde, no anel
  // da tela e no PDF do prontuário.
  const ausentes = ENTRADAS.filter((e) => e.ausente(inputs));
  const faltando = ausentes.map((e) => e.rotulo);
  const potencial = ausentes.reduce((soma, e) => soma + e.maximo, 0);
  const faixaMaxima = faixaDe(Math.min(score + potencial, 100));
  const categoriaDeterminada = faixaMaxima.categoria === faixa.categoria;

  // O score não muda: ele continua sendo a soma do que se sabe. O que muda é
  // parar de afirmar um perfil clínico a partir dele enquanto o desconhecido
  // ainda puder mudar a faixa.
  const description = categoriaDeterminada
    ? faixa.description
    : `Estimativa incompleta: ${faltando.length} de ${TOTAL_ENTRADAS} dados não foram ` +
      `informados (${faltando.join(", ")}). Só com o que está preenchido o score é ${score}, ` +
      `mas com esses dados o risco poderia chegar a "${faixaMaxima.categoria}" — a categoria ` +
      `ainda não é conclusiva.`;

  return {
    score,
    category: faixa.categoria,
    color: faixa.color,
    description,
    breakdown,
    faltando,
    categoriaDeterminada,
    categoriaMaxima: faixaMaxima.categoria,
  };
}
