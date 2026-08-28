import { calculateRisk, type RiskResult } from "@/lib/riskScore";

/**
 * O mapeamento do caso clínico para as entradas do escore — num lugar só.
 *
 * Nasceu de um defeito medido: `CasoDetalhe` renderizava `<RiskScoreCard>` e
 * `<DocumentGenerator>` lado a lado, o card mostrava o escore calculado, e o
 * documento gerado dizia **"escore de risco pendente de registro"** — porque a
 * propriedade `riskScore` nunca era passada. Duas telas irmãs afirmando coisas
 * diferentes sobre o mesmo caso, no mesmo instante.
 *
 * Com o mapeamento aqui, o card e o documento leem o mesmo número por
 * construção, e não por coincidência.
 */

export interface CasoComRisco {
  patient_age?: number | null;
  patient_sex?: string | null;
  nyha?: string | null;
  ejection_fraction?: number | null;
  severity?: string | null;
  comorbidities?: string[] | null;
}

export const NOME_DO_ESCORE = "ValvePath";

export function riscoDoCaso(caso: CasoComRisco): RiskResult {
  return calculateRisk({
    age: caso.patient_age,
    sex: caso.patient_sex,
    nyha: caso.nyha,
    ejection_fraction: caso.ejection_fraction,
    severity: caso.severity,
    comorbidities: caso.comorbidities,
  });
}

/** A forma que o gerador de documentos espera, já com os avisos que ela carrega. */
export function riscoParaDocumento(caso: CasoComRisco) {
  const r = riscoDoCaso(caso);
  return {
    model: NOME_DO_ESCORE,
    value: r.score,
    categoria: r.category,
    conclusiva: r.categoriaDeterminada,
  };
}
