import jsPDF from "jspdf";
import { severityLabels, valveTypeLabels, caseStatusLabels } from "@/lib/clinicalLabels";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface MonthlyReportInput {
  doctor?: { full_name: string; crm: string; crm_uf: string; specialty: string } | null;
  periodStart: Date;
  periodEnd: Date;
  cases: Array<{
    id: string;
    patient_name: string;
    severity: string;
    status: string;
    valve_type: string;
    created_at: string;
    proposed_management?: string | null;
  }>;
  appointments: Array<{ scheduled_at: string; status: string }>;
  events: Array<{ event_type: string; event_date: string; case_id: string }>;
}

const C = {
  primary: [11, 79, 108] as [number, number, number],
  text: [30, 30, 30] as [number, number, number],
  muted: [110, 110, 110] as [number, number, number],
  bg: [245, 247, 250] as [number, number, number],
  accent: [0, 150, 136] as [number, number, number],
};

export function exportMonthlyReportPDF(m: MonthlyReportInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mx = 15;
  let y = 15;

  const ensure = (h: number) => {
    if (y + h > pageH - 18) {
      footer();
      doc.addPage();
      y = 15;
    }
  };
  const footer = () => {
    const tot = doc.getNumberOfPages();
    const cur = doc.getCurrentPageInfo().pageNumber;
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text(
      "ValvePath — Relatório consolidado do consultório • Apoio à prática clínica.",
      mx,
      pageH - 10,
    );
    doc.text(`Página ${cur}/${tot}`, pageW - mx, pageH - 10, { align: "right" });
  };
  const section = (label: string) => {
    ensure(12);
    doc.setFillColor(...C.primary);
    doc.rect(mx, y, 1.5, 6, "F");
    doc.setFontSize(11);
    doc.setTextColor(...C.primary);
    doc.setFont("helvetica", "bold");
    doc.text(label.toUpperCase(), mx + 4, y + 4.5);
    y += 9;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.text);
  };
  const line = (label: string, value: string | number) => {
    ensure(6);
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text(label, mx, y);
    doc.setTextColor(...C.text);
    doc.text(String(value), pageW - mx, y, { align: "right" });
    y += 5;
  };

  // HEADER
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório consolidado do consultório", mx, 13);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Período: ${format(m.periodStart, "dd/MM/yyyy", { locale: ptBR })} – ${format(m.periodEnd, "dd/MM/yyyy", { locale: ptBR })}`,
    mx,
    19,
  );
  y = 30;

  // MÉDICO
  if (m.doctor) {
    section("Profissional");
    doc.setFontSize(10);
    doc.text(m.doctor.full_name, mx, y);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text(
      `CRM ${m.doctor.crm}/${m.doctor.crm_uf} · ${m.doctor.specialty}`,
      mx,
      y,
    );
    y += 8;
    doc.setTextColor(...C.text);
  }

  // INDICADORES
  section("Indicadores do período");
  const total = m.cases.length;
  const severeCount = m.cases.filter(
    (c) => c.severity === "grave" || c.severity === "critica",
  ).length;
  const intervened = m.cases.filter((c) => c.status === "pos_intervencao").length;
  const interventionRate = total ? Math.round((intervened / total) * 100) : 0;
  const apptDone = m.appointments.filter((a) => a.status === "realizado").length;

  // tempo médio até intervenção
  const interventionEvents = m.events.filter((e) => e.event_type === "intervencao");
  let avgDaysToIntervention: number | null = null;
  if (interventionEvents.length) {
    const days: number[] = [];
    for (const ev of interventionEvents) {
      const c = m.cases.find((cc) => cc.id === ev.case_id);
      if (!c) continue;
      const diff =
        (new Date(ev.event_date).getTime() - new Date(c.created_at).getTime()) /
        (1000 * 60 * 60 * 24);
      if (diff >= 0) days.push(diff);
    }
    if (days.length)
      avgDaysToIntervention = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
  }

  line("Casos novos no período", total);
  line("Casos graves/críticos", severeCount);
  line("Pós-intervenção", intervened);
  line("Taxa de intervenção", `${interventionRate}%`);
  line("Consultas realizadas", apptDone);
  line(
    "Tempo médio até intervenção",
    avgDaysToIntervention !== null ? `${avgDaysToIntervention} dias` : "—",
  );

  // DISTRIBUIÇÃO POR SEVERIDADE
  section("Distribuição por severidade");
  const bySev: Record<string, number> = {};
  m.cases.forEach((c) => (bySev[c.severity] = (bySev[c.severity] ?? 0) + 1));
  Object.entries(bySev).forEach(([k, v]) =>
    line(severityLabels[k as keyof typeof severityLabels] ?? k, v),
  );
  if (Object.keys(bySev).length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text("Sem dados no período.", mx, y);
    y += 5;
  }

  // DISTRIBUIÇÃO POR VALVA
  section("Distribuição por valva");
  const byValve: Record<string, number> = {};
  m.cases.forEach((c) => (byValve[c.valve_type] = (byValve[c.valve_type] ?? 0) + 1));
  Object.entries(byValve).forEach(([k, v]) =>
    line(valveTypeLabels[k as keyof typeof valveTypeLabels] ?? k, v),
  );
  if (Object.keys(byValve).length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text("Sem dados no período.", mx, y);
    y += 5;
  }

  // STATUS
  section("Status dos casos");
  const byStatus: Record<string, number> = {};
  m.cases.forEach((c) => (byStatus[c.status] = (byStatus[c.status] ?? 0) + 1));
  Object.entries(byStatus).forEach(([k, v]) =>
    line(caseStatusLabels[k as keyof typeof caseStatusLabels] ?? k, v),
  );

  // LISTA DETALHADA
  if (m.cases.length) {
    section("Casos do período");
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text("Paciente", mx, y);
    doc.text("Severidade", mx + 75, y);
    doc.text("Status", mx + 115, y);
    doc.text("Data", pageW - mx, y, { align: "right" });
    y += 4;
    doc.setDrawColor(220, 220, 220);
    doc.line(mx, y, pageW - mx, y);
    y += 3;
    doc.setTextColor(...C.text);
    m.cases
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .forEach((c) => {
        ensure(6);
        doc.setFontSize(9);
        doc.text(c.patient_name.substring(0, 38), mx, y);
        doc.text(
          (severityLabels[c.severity as keyof typeof severityLabels] ?? c.severity).substring(0, 18),
          mx + 75,
          y,
        );
        doc.text(
          (caseStatusLabels[c.status as keyof typeof caseStatusLabels] ?? c.status).substring(0, 18),
          mx + 115,
          y,
        );
        doc.text(format(new Date(c.created_at), "dd/MM/yy"), pageW - mx, y, {
          align: "right",
        });
        y += 5;
      });
  }

  footer();
  doc.save(
    `relatorio-consultorio-${format(m.periodStart, "yyyy-MM-dd")}_${format(
      m.periodEnd,
      "yyyy-MM-dd",
    )}.pdf`,
  );
}
