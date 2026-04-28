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

export interface RiskResult {
  score: number;                     // 0–100
  category: "Baixo" | "Intermediário" | "Alto" | "Muito alto";
  color: string;
  description: string;
  breakdown: RiskBreakdown[];
}

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
  if (inputs.sex === "masculino") {
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

  let category: RiskResult["category"];
  let color: string;
  let description: string;

  if (score < 20) {
    category = "Baixo";
    color = "text-success";
    description = "Perfil clínico favorável. Seguimento ambulatorial conforme diretrizes.";
  } else if (score < 40) {
    category = "Intermediário";
    color = "text-accent-foreground";
    description = "Discutir condutas e antecipar avaliações multidisciplinares.";
  } else if (score < 65) {
    category = "Alto";
    color = "text-warning";
    description = "Avaliação por Heart Team é recomendada. Discutir intervenção precoce.";
  } else {
    category = "Muito alto";
    color = "text-destructive";
    description = "Considerar avaliação imediata por Heart Team. Risco cirúrgico relevante.";
  }

  return { score, category, color, description, breakdown };
}
