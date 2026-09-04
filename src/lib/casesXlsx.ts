// Exportação Excel (.xlsx) real de casos clínicos — duas abas: dados brutos e resumo agregado.
import ExcelJS from "exceljs";
import { COLUMNS, type CaseRow } from "./casesCsv";
import { severityLabels, valveTypeLabels, caseStatusLabels } from "./clinicalLabels";

const BRAND_PRIMARY = "0B2850";

function countBy(cases: CaseRow[], key: "severity" | "status" | "valve_type", labels: Record<string, string>) {
  const acc: Record<string, number> = {};
  cases.forEach((c) => {
    const v = c[key] as string;
    if (!v) return;
    acc[v] = (acc[v] || 0) + 1;
  });
  return Object.entries(acc)
    .map(([k, v]) => ({ name: labels[k] || k, value: v }))
    .sort((a, b) => b.value - a.value);
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND_PRIMARY}` } };
    cell.alignment = { vertical: "middle" };
  });
  row.height = 20;
}

/**
 * Monta a planilha e devolve os bytes.
 *
 * Separado do download de propósito: é o que permite `casesXlsx.test.ts` gerar
 * o arquivo de verdade e LER de volta, em vez de conferir só que a função não
 * explodiu. Sem essa separação, o teste dependeria de `Blob` e de
 * `URL.createObjectURL`, que no jsdom são fachada — o arquivo nunca chegaria a
 * existir e o teste "passaria" sem exercitar o exceljs.
 */
export async function montarPlanilhaDeCasos(cases: CaseRow[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ValvePath";
  workbook.created = new Date();

  // Aba 1 — Casos (mesmas colunas do CSV)
  const sheet = workbook.addWorksheet("Casos", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = COLUMNS.map((col) => ({ header: col.header, key: col.header, width: Math.max(col.header.length + 2, 14) }));
  cases.forEach((c) => {
    sheet.addRow(Object.fromEntries(COLUMNS.map((col) => [col.header, col.get(c) ?? ""])));
  });
  styleHeaderRow(sheet.getRow(1));
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

  // Aba 2 — Resumo agregado
  const summary = workbook.addWorksheet("Resumo");
  summary.columns = [
    { header: "Categoria", key: "cat", width: 22 },
    { header: "Valor", key: "val", width: 28 },
    { header: "Casos", key: "count", width: 10 },
  ];
  styleHeaderRow(summary.getRow(1));

  summary.addRow({ cat: "Total de casos", val: "", count: cases.length });
  // Quem abre a planilha lê o Resumo antes de rolar a aba de casos. Se há caso
  // fictício no meio, o agregado precisa dizer isso aqui também — senão a
  // coluna da outra aba avisa tarde demais.
  const demo = cases.filter((c) => c.is_demo).length;
  if (demo > 0) {
    summary.addRow({ cat: "Dos quais fictícios", val: "demonstração, não é dado real", count: demo });
  }
  summary.addRow({});

  const sections: [string, ReturnType<typeof countBy>][] = [
    ["Severidade", countBy(cases, "severity", severityLabels)],
    ["Status", countBy(cases, "status", caseStatusLabels)],
    ["Valvopatia", countBy(cases, "valve_type", valveTypeLabels)],
  ];
  for (const [label, entries] of sections) {
    entries.forEach((e, i) => {
      summary.addRow({ cat: i === 0 ? label : "", val: e.name, count: e.value });
    });
    summary.addRow({});
  }

  return workbook.xlsx.writeBuffer() as unknown as Promise<ArrayBuffer>;
}

export async function exportCasesToXlsx(cases: CaseRow[], filename = "casos-clinicos.xlsx") {
  const buffer = await montarPlanilhaDeCasos(cases);
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
