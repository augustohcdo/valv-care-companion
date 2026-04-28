import jsPDF from "jspdf";
import {
  valveTypeLabels, valveDiseaseLabels, severityLabels, caseStatusLabels,
  examTypeLabels,
} from "@/lib/clinicalLabels";

interface PatientPdfData {
  profile: any;
  patient: any;
  doctor?: { full_name: string; crm: string; crm_uf: string; specialty: string } | null;
  cases: any[];
  exams: any[];          // case_exams (todos os casos)
  symptoms: any[];       // symptom_entries últimos 30
  medications: any[];    // ativas
  medLogs: any[];        // últimos 30 dias
}

const C = {
  primary: [11, 79, 108] as [number, number, number],
  text: [30, 30, 30] as [number, number, number],
  muted: [110, 110, 110] as [number, number, number],
  bg: [245, 247, 250] as [number, number, number],
};

export function exportPatientPDF(data: PatientPdfData) {
  const { profile, patient, doctor, cases, exams, symptoms, medications, medLogs } = data;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mx = 15;
  let y = 15;

  const ensure = (h: number) => {
    if (y + h > pageH - 18) { footer(); doc.addPage(); y = 15; }
  };
  const footer = () => {
    const tot = doc.getNumberOfPages();
    const cur = doc.getCurrentPageInfo().pageNumber;
    doc.setFontSize(8); doc.setTextColor(...C.muted);
    doc.text("ValvePath — Prontuário do paciente • Documento informativo, não substitui prontuário oficial.", mx, pageH - 10);
    doc.text(`Página ${cur}/${tot}`, pageW - mx, pageH - 10, { align: "right" });
  };
  const section = (label: string) => {
    ensure(12);
    doc.setFillColor(...C.primary); doc.rect(mx, y, 1.5, 6, "F");
    doc.setFontSize(11); doc.setTextColor(...C.primary); doc.setFont("helvetica", "bold");
    doc.text(label.toUpperCase(), mx + 4, y + 4.5);
    y += 9; doc.setFont("helvetica", "normal"); doc.setTextColor(...C.text);
  };
  const kv = (label: string, value: string) => {
    ensure(8);
    doc.setFontSize(8); doc.setTextColor(...C.muted);
    doc.text(label.toUpperCase(), mx, y);
    doc.setFontSize(10); doc.setTextColor(...C.text);
    const lines = doc.splitTextToSize(value || "—", pageW - mx * 2);
    doc.text(lines, mx, y + 4);
    y += 4 + lines.length * 4 + 2;
  };
  const para = (t: string, size = 9) => {
    if (!t) return;
    doc.setFontSize(size); doc.setTextColor(...C.text);
    const lines = doc.splitTextToSize(t, pageW - mx * 2);
    ensure(lines.length * 4 + 2);
    doc.text(lines, mx, y); y += lines.length * 4 + 2;
  };

  // HEADER
  doc.setFillColor(...C.primary); doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text("ValvePath", mx, 12);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("Prontuário consolidado do paciente", mx, 17);
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`, pageW - mx, 12, { align: "right" });
  if (doctor) doc.text(`Dr(a). ${doctor.full_name} — CRM ${doctor.crm}/${doctor.crm_uf}`, pageW - mx, 17, { align: "right" });
  y = 30;

  // IDENTIFICAÇÃO
  doc.setTextColor(...C.text); doc.setFontSize(15); doc.setFont("helvetica", "bold");
  doc.text(profile?.full_name || "Paciente", mx, y); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...C.muted);
  const sub = [
    profile?.birth_date ? `nasc. ${new Date(profile.birth_date).toLocaleDateString("pt-BR")}` : null,
    patient?.sex,
    patient?.city ? `${patient.city}${patient.uf ? "/" + patient.uf : ""}` : null,
    profile?.phone,
  ].filter(Boolean).join(" • ");
  doc.text(sub || "—", mx, y); y += 8;

  if (patient?.comorbidities?.length) {
    section("Comorbidades");
    para(patient.comorbidities.join(" • "));
  }

  // CASOS
  section(`Casos clínicos (${cases.length})`);
  if (!cases.length) para("Nenhum caso registrado.");
  cases.forEach((c) => {
    ensure(20);
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.primary);
    doc.text(`${valveTypeLabels[c.valve_type] || c.valve_type} — ${valveDiseaseLabels[c.valve_disease] || c.valve_disease}`, mx, y);
    y += 4;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...C.muted);
    doc.text(`${caseStatusLabels[c.status] || c.status} • Severidade: ${severityLabels[c.severity] || c.severity} • Aberto em ${new Date(c.created_at).toLocaleDateString("pt-BR")}`, mx, y);
    y += 5;
    doc.setTextColor(...C.text); doc.setFontSize(9);
    const fields: string[] = [];
    if (c.ejection_fraction != null) fields.push(`FE ${c.ejection_fraction}%`);
    if (c.mean_gradient != null) fields.push(`Grad méd ${c.mean_gradient}mmHg`);
    if (c.valve_area != null) fields.push(`Área ${c.valve_area}cm²`);
    if (c.regurgitation_grade) fields.push(`Reg ${c.regurgitation_grade}`);
    if (fields.length) { doc.text(fields.join(" • "), mx, y); y += 4; }
    if (c.proposed_management) para(`Conduta: ${c.proposed_management}`, 8.5);
    y += 1;
  });

  // EXAMES SERIADOS
  if (exams.length) {
    section(`Exames seriados (${exams.length})`);
    exams.forEach((e) => {
      ensure(8);
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.text);
      doc.text(`${new Date(e.exam_date + "T00:00:00").toLocaleDateString("pt-BR")} — ${examTypeLabels[e.exam_type] || e.exam_type}`, mx, y);
      y += 4;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...C.muted);
      const vals: string[] = [];
      if (e.ejection_fraction != null) vals.push(`FE ${e.ejection_fraction}%`);
      if (e.mean_gradient != null) vals.push(`GradMed ${e.mean_gradient}`);
      if (e.peak_gradient != null) vals.push(`GradMax ${e.peak_gradient}`);
      if (e.valve_area != null) vals.push(`Área ${e.valve_area}`);
      if (e.psap != null) vals.push(`PSAP ${e.psap}`);
      if (e.bnp != null) vals.push(`BNP ${e.bnp}`);
      if (e.nt_probnp != null) vals.push(`NT-proBNP ${e.nt_probnp}`);
      if (vals.length) { doc.text(vals.join(" • "), mx, y); y += 4; }
      if (e.notes) para(e.notes, 8);
    });
  }

  // SINTOMAS (resumo)
  if (symptoms.length) {
    section(`Diário de sintomas (${symptoms.length} registros recentes)`);
    const avg = (k: string) => {
      const vals = symptoms.map((s) => s[k]).filter((v) => v != null);
      return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "—";
    };
    kv("Médias (0–10)",
      `Dispneia ${avg("dyspnea")} • Fadiga ${avg("fatigue")} • Dor torácica ${avg("chest_pain")} • Palpitações ${avg("palpitations")}`);
    const alerts = symptoms.filter((s) => s.dyspnea >= 7 || s.chest_pain >= 7 || s.syncope);
    if (alerts.length) kv("Alertas no período", `${alerts.length} entrada(s) com sintomas críticos.`);
  }

  // MEDICAÇÕES
  if (medications.length) {
    section(`Medicações ativas (${medications.length})`);
    medications.forEach((m) => {
      ensure(6);
      doc.setFontSize(9); doc.setTextColor(...C.text);
      const horarios = (m.times || []).join(", ");
      doc.text(`• ${m.name}${m.dose ? " — " + m.dose : ""}${horarios ? " • " + horarios : ""}`, mx, y);
      y += 5;
    });
    if (medLogs.length) {
      const taken = medLogs.filter((l) => l.status === "tomado").length;
      const total = medLogs.length;
      kv("Aderência (30 dias)", `${total ? Math.round((taken / total) * 100) : 0}% (${taken}/${total} doses confirmadas)`);
    }
  }

  // AVISO
  ensure(22); y += 4;
  doc.setFillColor(...C.bg); doc.rect(mx, y, pageW - mx * 2, 18, "F");
  doc.setFontSize(8); doc.setTextColor(...C.text);
  const aviso = doc.splitTextToSize(
    "Documento gerado pela plataforma ValvePath para apoio à prática clínica. Não substitui prontuário oficial " +
    "nem laudos. Decisões devem considerar avaliação individual e julgamento do Heart Team.",
    pageW - mx * 2 - 4
  );
  doc.text(aviso, mx + 2, y + 4);

  footer();
  doc.save(`valvepath-prontuario-${(profile?.full_name || "paciente").replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
