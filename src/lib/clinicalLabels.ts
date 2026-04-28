// Labels clínicos em português para enums do banco

export const valveTypeLabels: Record<string, string> = {
  aortica: "Valva aórtica",
  mitral: "Valva mitral",
  tricuspide: "Valva tricúspide",
  pulmonar: "Valva pulmonar",
  multipla: "Doença multivalvar",
};

export const valveDiseaseLabels: Record<string, string> = {
  estenose: "Estenose",
  insuficiencia: "Insuficiência (regurgitação)",
  mista: "Lesão mista",
  prolapso: "Prolapso",
  protese_disfuncao: "Disfunção de prótese",
  outra: "Outra",
};

export const severityLabels: Record<string, string> = {
  leve: "Leve",
  moderada: "Moderada",
  importante: "Importante",
  critica: "Crítica",
  indeterminada: "Indeterminada",
};

export const severityColors: Record<string, string> = {
  leve: "bg-success/10 text-success border-success/30",
  moderada: "bg-accent/10 text-accent-foreground border-accent/30",
  importante: "bg-warning/10 text-warning border-warning/30",
  critica: "bg-destructive/10 text-destructive border-destructive/30",
  indeterminada: "bg-muted text-muted-foreground border-border",
};

export const nyhaLabels: Record<string, string> = {
  I: "NYHA I — sem limitação",
  II: "NYHA II — leve limitação",
  III: "NYHA III — limitação acentuada",
  IV: "NYHA IV — sintomas em repouso",
};

export const caseStatusLabels: Record<string, string> = {
  avaliacao_inicial: "Avaliação inicial",
  em_seguimento: "Em seguimento",
  pre_intervencao: "Pré-intervenção",
  pos_intervencao: "Pós-intervenção",
  alta: "Alta clínica",
  arquivado: "Arquivado",
};

export const documentTypeLabels: Record<string, string> = {
  ecocardiograma: "Ecocardiograma",
  ressonancia: "Ressonância magnética",
  tomografia: "Tomografia",
  cateterismo: "Cateterismo",
  eletrocardiograma: "Eletrocardiograma",
  laudo_medico: "Laudo médico",
  receita: "Receita",
  exame_laboratorial: "Exame laboratorial",
  outro: "Outro",
};

export const commonSymptoms = [
  "Dispneia aos esforços",
  "Dispneia em repouso",
  "Dor torácica",
  "Síncope",
  "Pré-síncope",
  "Palpitações",
  "Edema de membros inferiores",
  "Fadiga",
  "Tontura",
  "Ortopneia",
  "Dispneia paroxística noturna",
  "Assintomático",
];

export const commonComorbidities = [
  "Hipertensão arterial",
  "Diabetes mellitus",
  "Dislipidemia",
  "Doença arterial coronariana",
  "Fibrilação atrial",
  "Insuficiência cardíaca",
  "DPOC",
  "Doença renal crônica",
  "AVC prévio",
  "Tabagismo",
  "Obesidade",
];

export function formatBytes(bytes?: number | null) {
  if (!bytes) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
