// Exportação CSV de casos clínicos
import { valveTypeLabels, valveDiseaseLabels, severityLabels, caseStatusLabels, nyhaLabels } from "./clinicalLabels";

interface CaseRow {
  id: string;
  patient_name: string;
  patient_age: number | null;
  patient_sex: string | null;
  valve_type: string;
  valve_disease: string;
  severity: string;
  nyha: string | null;
  status: string;
  ejection_fraction: number | null;
  mean_gradient: number | null;
  peak_gradient: number | null;
  valve_area: number | null;
  regurgitation_grade: string | null;
  symptoms: string[] | null;
  comorbidities: string[] | null;
  proposed_management: string | null;
  clinical_notes: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS: { header: string; get: (c: CaseRow) => string | number | null | undefined }[] = [
  { header: "ID", get: (c) => c.id },
  { header: "Paciente", get: (c) => c.patient_name },
  { header: "Idade", get: (c) => c.patient_age ?? "" },
  { header: "Sexo", get: (c) => c.patient_sex ?? "" },
  { header: "Valva", get: (c) => valveTypeLabels[c.valve_type] || c.valve_type },
  { header: "Lesão", get: (c) => valveDiseaseLabels[c.valve_disease] || c.valve_disease },
  { header: "Severidade", get: (c) => severityLabels[c.severity] || c.severity },
  { header: "NYHA", get: (c) => (c.nyha ? nyhaLabels[c.nyha] || c.nyha : "") },
  { header: "Status", get: (c) => caseStatusLabels[c.status] || c.status },
  { header: "FE (%)", get: (c) => c.ejection_fraction ?? "" },
  { header: "Gradiente médio (mmHg)", get: (c) => c.mean_gradient ?? "" },
  { header: "Gradiente pico (mmHg)", get: (c) => c.peak_gradient ?? "" },
  { header: "Área valvar (cm²)", get: (c) => c.valve_area ?? "" },
  { header: "Regurgitação", get: (c) => c.regurgitation_grade ?? "" },
  { header: "Sintomas", get: (c) => (c.symptoms ?? []).join("; ") },
  { header: "Comorbidades", get: (c) => (c.comorbidities ?? []).join("; ") },
  { header: "Conduta proposta", get: (c) => c.proposed_management ?? "" },
  { header: "Notas clínicas", get: (c) => c.clinical_notes ?? "" },
  { header: "Criado em", get: (c) => new Date(c.created_at).toISOString() },
  { header: "Atualizado em", get: (c) => new Date(c.updated_at).toISOString() },
];

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n;\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportCasesToCsv(cases: CaseRow[], filename = "casos-clinicos.csv") {
  const header = COLUMNS.map((c) => escapeCsv(c.header)).join(",");
  const rows = cases.map((c) => COLUMNS.map((col) => escapeCsv(col.get(c))).join(","));
  // BOM UTF-8 para Excel reconhecer acentuação
  const csv = "\uFEFF" + [header, ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
