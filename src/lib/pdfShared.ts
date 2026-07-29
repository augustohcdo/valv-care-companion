import jsPDF from "jspdf";

/**
 * Paleta dos PDFs — RGB derivado com precisão das CSS vars reais de
 * src/index.css (não valores inventados), para o PDF bater com a marca
 * do site em vez de usar uma cor genérica.
 */
export const PDF_COLORS = {
  primary: [11, 40, 80] as [number, number, number], // hsl(215 75% 18%)
  accent: [48, 166, 162] as [number, number, number], // hsl(178 55% 42%)
  success: [39, 155, 112] as [number, number, number], // hsl(158 60% 38%)
  text: [17, 28, 44] as [number, number, number], // hsl(215 45% 12%)
  muted: [88, 104, 126] as [number, number, number], // hsl(215 18% 42%)
  bg: [239, 242, 245] as [number, number, number], // hsl(210 25% 95%)
  white: [255, 255, 255] as [number, number, number],
};

/** Rodapé padrão: disclaimer + numeração de página, centralizado em qualquer documento ValvePath. */
export function addPdfFooter(doc: jsPDF, disclaimer: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mx = 15;
  const tot = doc.getNumberOfPages();
  const cur = doc.getCurrentPageInfo().pageNumber;
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.text(disclaimer, mx, pageH - 10);
  doc.text(`Página ${cur}/${tot}`, pageW - mx, pageH - 10, { align: "right" });
}

interface CoverPageInput {
  title: string;
  subtitle: string;
  doctor?: { full_name: string; crm: string; crm_uf: string; specialty: string } | null;
  periodLabel?: string;
}

/**
 * Capa cheia de identidade visual — "modo apresentação": faixa de marca,
 * título do relatório, dados do médico e período, antes do conteúdo
 * analítico começar na página seguinte.
 */
export function addCoverPage(doc: jsPDF, input: CoverPageInput) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mx = 20;

  doc.setFillColor(...PDF_COLORS.primary);
  doc.rect(0, 0, pageW, pageH, "F");

  doc.setFillColor(...PDF_COLORS.accent);
  doc.rect(0, pageH / 2 - 0.4, pageW, 0.8, "F");

  doc.setTextColor(...PDF_COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("ValvePath", mx, pageH / 2 - 26);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Apoio à decisão clínica em valvopatias", mx, pageH / 2 - 19);

  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(input.title, pageW - mx * 2);
  doc.text(titleLines, mx, pageH / 2 + 4);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(input.subtitle, mx, pageH / 2 + 4 + titleLines.length * 9 + 6);

  let infoY = pageH - 40;
  doc.setFontSize(10);
  if (input.doctor) {
    doc.text(`Dr(a). ${input.doctor.full_name} — CRM ${input.doctor.crm}/${input.doctor.crm_uf}`, mx, infoY);
    infoY += 6;
    if (input.doctor.specialty) {
      doc.setTextColor(...PDF_COLORS.white);
      doc.text(input.doctor.specialty, mx, infoY);
      infoY += 6;
    }
  }
  if (input.periodLabel) {
    doc.text(input.periodLabel, mx, infoY);
    infoY += 6;
  }
  doc.setFontSize(8);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, mx, pageH - 12);

  doc.addPage();
}
