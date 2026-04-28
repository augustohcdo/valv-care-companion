import jsPDF from "jspdf";
import {
  valveTypeLabels,
  valveDiseaseLabels,
  severityLabels,
  caseStatusLabels,
  nyhaLabels,
  eventTypeLabels,
  appointmentTypeLabels,
  appointmentStatusLabels,
} from "@/lib/clinicalLabels";
import { calculateRisk } from "@/lib/riskScore";

interface ExportData {
  caso: any;
  doctor?: { full_name: string; crm: string; crm_uf: string; specialty: string };
  events?: any[];
  appointments?: any[];
  documents?: any[];
}

const COLORS = {
  primary: [11, 79, 108] as [number, number, number],     // hsl primary aprox
  text: [30, 30, 30] as [number, number, number],
  muted: [110, 110, 110] as [number, number, number],
  border: [220, 220, 220] as [number, number, number],
  bg: [245, 247, 250] as [number, number, number],
};

export function exportCasePDF({ caso, doctor, events = [], appointments = [], documents = [] }: ExportData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 15;
  let y = 15;

  const ensureSpace = (h: number) => {
    if (y + h > pageH - 18) {
      addFooter();
      doc.addPage();
      y = 15;
    }
  };

  const addFooter = () => {
    const total = doc.getNumberOfPages();
    const current = doc.getCurrentPageInfo().pageNumber;
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(
      "ValvePath — Relatório clínico • Documento informativo, não substitui prontuário oficial.",
      marginX, pageH - 10
    );
    doc.text(`Página ${current}/${total}`, pageW - marginX, pageH - 10, { align: "right" });
  };

  const sectionTitle = (label: string) => {
    ensureSpace(12);
    doc.setFillColor(...COLORS.primary);
    doc.rect(marginX, y, 1.5, 6, "F");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.primary);
    doc.setFont("helvetica", "bold");
    doc.text(label.toUpperCase(), marginX + 4, y + 4.5);
    y += 9;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.text);
  };

  const kv = (label: string, value: string) => {
    ensureSpace(6);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(label.toUpperCase(), marginX, y);
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.text);
    const lines = doc.splitTextToSize(value || "—", pageW - marginX * 2);
    doc.text(lines, marginX, y + 4);
    y += 4 + lines.length * 4 + 2;
  };

  const paragraph = (text: string, size = 9) => {
    if (!text) return;
    doc.setFontSize(size);
    doc.setTextColor(...COLORS.text);
    const lines = doc.splitTextToSize(text, pageW - marginX * 2);
    ensureSpace(lines.length * 4 + 2);
    doc.text(lines, marginX, y);
    y += lines.length * 4 + 2;
  };

  // ===== HEADER =====
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("ValvePath", marginX, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Relatório clínico do caso", marginX, 17);

  doc.text(
    `Emitido em ${new Date().toLocaleString("pt-BR")}`,
    pageW - marginX, 12, { align: "right" }
  );
  doc.text("Documento informativo", pageW - marginX, 17, { align: "right" });
  y = 30;

  // ===== TÍTULO =====
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(caso.patient_name, marginX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    `${valveTypeLabels[caso.valve_type] || caso.valve_type} — ${valveDiseaseLabels[caso.valve_disease] || caso.valve_disease}`,
    marginX, y
  );
  y += 8;

  // ===== IDENTIFICAÇÃO =====
  sectionTitle("Identificação do paciente");
  kv("Nome", caso.patient_name);
  if (caso.patient_age) kv("Idade", `${caso.patient_age} anos`);
  if (caso.patient_sex) kv("Sexo", caso.patient_sex);

  if (doctor) {
    kv(
      "Médico responsável",
      `Dr(a). ${doctor.full_name} — CRM ${doctor.crm}/${doctor.crm_uf} — ${doctor.specialty}`
    );
  }

  // ===== STATUS =====
  sectionTitle("Status do caso");
  kv("Status atual", caseStatusLabels[caso.status] || caso.status);
  kv("Severidade", severityLabels[caso.severity] || caso.severity);
  if (caso.nyha) kv("Classe funcional", nyhaLabels[caso.nyha] || `NYHA ${caso.nyha}`);
  kv("Registrado em", new Date(caso.created_at).toLocaleDateString("pt-BR"));

  // ===== ACHADOS =====
  sectionTitle("Achados ecocardiográficos");
  if (caso.ejection_fraction) kv("Fração de ejeção", `${caso.ejection_fraction}%`);
  if (caso.mean_gradient) kv("Gradiente médio", `${caso.mean_gradient} mmHg`);
  if (caso.peak_gradient) kv("Gradiente máximo", `${caso.peak_gradient} mmHg`);
  if (caso.valve_area) kv("Área valvar", `${caso.valve_area} cm²`);
  if (caso.regurgitation_grade) kv("Regurgitação", caso.regurgitation_grade);

  if (caso.symptoms?.length) {
    sectionTitle("Sintomas");
    paragraph(caso.symptoms.join(" • "));
  }

  if (caso.comorbidities?.length) {
    sectionTitle("Comorbidades");
    paragraph(caso.comorbidities.join(" • "));
  }

  // ===== RISCO =====
  const risk = calculateRisk({
    age: caso.patient_age,
    sex: caso.patient_sex,
    nyha: caso.nyha,
    ejection_fraction: caso.ejection_fraction,
    severity: caso.severity,
    comorbidities: caso.comorbidities,
  });
  sectionTitle("Estimativa de risco (educacional)");
  kv("Score", `${risk.score} / 100`);
  kv("Categoria", `Risco ${risk.category}`);
  paragraph(risk.description);
  if (risk.breakdown.length) {
    risk.breakdown.forEach((b) => {
      paragraph(`• ${b.label}${b.detail ? ` — ${b.detail}` : ""} (+${b.points})`, 9);
    });
  }

  // ===== CONDUTA =====
  if (caso.proposed_management) {
    sectionTitle("Conduta proposta");
    paragraph(caso.proposed_management);
  }
  if (caso.clinical_notes) {
    sectionTitle("Notas clínicas");
    paragraph(caso.clinical_notes);
  }

  // ===== TIMELINE =====
  if (events.length) {
    sectionTitle("Timeline evolutiva");
    events.forEach((e) => {
      ensureSpace(10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.primary);
      doc.text(
        `${new Date(e.event_date + "T00:00:00").toLocaleDateString("pt-BR")} — ${eventTypeLabels[e.event_type] || e.event_type}`,
        marginX, y
      );
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.text);
      paragraph(e.title, 9);
      if (e.description) paragraph(e.description, 8.5);
      y += 1;
    });
  }

  // ===== AGENDA =====
  if (appointments.length) {
    sectionTitle("Agenda de retornos");
    appointments.forEach((a) => {
      const d = new Date(a.scheduled_at);
      ensureSpace(8);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.text);
      doc.text(
        `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — ${appointmentTypeLabels[a.appointment_type]}`,
        marginX, y
      );
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.muted);
      doc.setFontSize(8);
      const meta = `[${appointmentStatusLabels[a.status]}]${a.location ? ` — ${a.location}` : ""}`;
      doc.text(meta, marginX, y);
      y += 4;
      if (a.notes) paragraph(a.notes, 8.5);
      y += 1;
    });
  }

  // ===== DOCUMENTOS =====
  if (documents.length) {
    sectionTitle("Documentos anexados");
    documents.forEach((d) => {
      ensureSpace(6);
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.text);
      doc.text(`• ${d.file_name}`, marginX, y);
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.muted);
      doc.text(
        `${d.document_type} — ${new Date(d.created_at).toLocaleDateString("pt-BR")}`,
        pageW - marginX, y, { align: "right" }
      );
      y += 6;
    });
  }

  // ===== AVISO =====
  ensureSpace(20);
  y += 4;
  doc.setFillColor(...COLORS.bg);
  doc.rect(marginX, y, pageW - marginX * 2, 18, "F");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.text);
  const aviso = doc.splitTextToSize(
    "Este relatório é informativo e foi gerado a partir dos dados registrados na plataforma ValvePath. " +
    "Não substitui prontuário oficial nem laudos médicos. As estimativas de risco apresentadas são educacionais. " +
    "Decisões clínicas devem considerar avaliação individual e julgamento do Heart Team.",
    pageW - marginX * 2 - 4
  );
  doc.text(aviso, marginX + 2, y + 4);

  addFooter();

  doc.save(`valvepath-caso-${caso.patient_name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
