import jsPDF from "jspdf";
import { severityLabels, valveTypeLabels, caseStatusLabels } from "@/lib/clinicalLabels";

export interface CohortMetrics {
  doctor?: { full_name: string; crm: string; crm_uf: string; specialty: string } | null;
  totalPatients: number;
  totalCases: number;
  casesByStatus: Record<string, number>;
  casesBySeverity: Record<string, number>;
  casesByValve: Record<string, number>;
  avgEF: number | null;
  avgAdherence: number | null;
  patientsWithCriticalSymptoms: number;
  recentCases: Array<{ patient_name: string; severity: string; status: string; created_at: string }>;
}

const C = {
  primary: [11, 79, 108] as [number, number, number],
  text: [30, 30, 30] as [number, number, number],
  muted: [110, 110, 110] as [number, number, number],
  bg: [245, 247, 250] as [number, number, number],
};

export function exportCohortPDF(m: CohortMetrics) {
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
    doc.text("ValvePath — Relatório de coorte • Apoio à prática clínica.", mx, pageH - 10);
    doc.text(`Página ${cur}/${tot}`, pageW - mx, pageH - 10, { align: "right" });
  };
  const section = (label: string) => {
    ensure(12);
    doc.setFillColor(...C.primary); doc.rect(mx, y, 1.5, 6, "F");
    doc.setFontSize(11); doc.setTextColor(...C.primary); doc.setFont("helvetica", "bold");
    doc.text(label.toUpperCase(), mx + 4, y + 4.5);
    y += 9; doc.setFont("helvetica", "normal"); doc.setTextColor(...C.text);
  };

  // HEADER
  doc.setFillColor(...C.primary); doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text("ValvePath", mx, 12);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("Relatório executivo da coorte", mx, 17);
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`, pageW - mx, 12, { align: "right" });
  if (m.doctor) doc.text(`Dr(a). ${m.doctor.full_name} — CRM ${m.doctor.crm}/${m.doctor.crm_uf}`, pageW - mx, 17, { align: "right" });
  y = 30;

  // KPIs
  section("Visão geral");
  const kpis: [string, string][] = [
    ["Pacientes vinculados", String(m.totalPatients)],
    ["Casos registrados", String(m.totalCases)],
    ["FE média da coorte", m.avgEF != null ? `${m.avgEF.toFixed(1)}%` : "—"],
    ["Aderência média (30d)", m.avgAdherence != null ? `${m.avgAdherence.toFixed(0)}%` : "—"],
    ["Pacientes com sintomas críticos (30d)", String(m.patientsWithCriticalSymptoms)],
  ];
  const colW = (pageW - mx * 2) / 2;
  kpis.forEach(([k, v], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const bx = mx + col * colW;
    const by = y + row * 16;
    ensure(16);
    doc.setFillColor(...C.bg); doc.rect(bx, by, colW - 2, 14, "F");
    doc.setFontSize(8); doc.setTextColor(...C.muted);
    doc.text(k.toUpperCase(), bx + 3, by + 5);
    doc.setFontSize(13); doc.setTextColor(...C.text); doc.setFont("helvetica", "bold");
    doc.text(v, bx + 3, by + 11);
    doc.setFont("helvetica", "normal");
  });
  y += Math.ceil(kpis.length / 2) * 16 + 4;

  // Distribuições
  const dist = (title: string, obj: Record<string, number>, labelMap?: Record<string, string>) => {
    section(title);
    const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]);
    if (!entries.length) {
      doc.setFontSize(9); doc.setTextColor(...C.muted); doc.text("Sem dados.", mx, y); y += 6; return;
    }
    const max = Math.max(...entries.map((e) => e[1]));
    entries.forEach(([k, v]) => {
      ensure(7);
      const label = labelMap?.[k] || k;
      doc.setFontSize(9); doc.setTextColor(...C.text);
      doc.text(label, mx, y);
      doc.text(String(v), pageW - mx, y, { align: "right" });
      const barW = (pageW - mx * 2) * (v / max);
      doc.setFillColor(...C.primary); doc.rect(mx, y + 1.5, barW, 1.5, "F");
      y += 6.5;
    });
  };
  dist("Casos por status", m.casesByStatus, caseStatusLabels);
  dist("Casos por severidade", m.casesBySeverity, severityLabels);
  dist("Casos por valva", m.casesByValve, valveTypeLabels);

  // Recentes
  if (m.recentCases.length) {
    section("Casos recentes");
    m.recentCases.slice(0, 15).forEach((c) => {
      ensure(6);
      doc.setFontSize(9); doc.setTextColor(...C.text);
      doc.text(c.patient_name, mx, y);
      doc.setTextColor(...C.muted); doc.setFontSize(8);
      doc.text(
        `${severityLabels[c.severity] || c.severity} • ${caseStatusLabels[c.status] || c.status} • ${new Date(c.created_at).toLocaleDateString("pt-BR")}`,
        pageW - mx, y, { align: "right" }
      );
      y += 5.5;
    });
  }

  footer();
  doc.save(`valvepath-relatorio-coorte-${new Date().toISOString().slice(0, 10)}.pdf`);
}
