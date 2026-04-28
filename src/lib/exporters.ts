/**
 * Wrappers que enfileiram exportações usando dynamic import dos geradores.
 * Cada chamada devolve o jobId para quem quiser observar.
 *
 * Os geradores pesados (jspdf, jspdf-autotable, etc.) só são carregados no clique.
 */
import { exportQueue } from "./exportQueue";

// ---- CSV ---------------------------------------------------------------

export function queueCsvExport(input: {
  label: string;
  filename: string;
  cases: any[];
}): string {
  return exportQueue.enqueue({
    label: input.label,
    run: async ({ setStatus, setProgress }) => {
      setStatus("loading");
      setProgress(20);
      const { exportCasesToCsv } = await import("./casesCsv");
      setStatus("running");
      setProgress(70);
      exportCasesToCsv(input.cases, input.filename);
      setProgress(100);
    },
  });
}

// ---- PDF Prontuário do paciente ---------------------------------------

export function queuePatientPdf(input: {
  label: string;
  data: () => Promise<import("./patientPdf").PatientPdfData>;
}): string {
  return exportQueue.enqueue({
    label: input.label,
    run: async ({ setStatus, setProgress }) => {
      setStatus("loading");
      setProgress(15);
      const [{ exportPatientPDF }, data] = await Promise.all([
        import("./patientPdf"),
        input.data(),
      ]);
      setStatus("running");
      setProgress(70);
      exportPatientPDF(data);
      setProgress(100);
    },
  });
}

// ---- PDF Cohort (executivo) -------------------------------------------

export function queueCohortPdf(input: {
  label: string;
  metrics: import("./cohortPdf").CohortMetrics;
}): string {
  return exportQueue.enqueue({
    label: input.label,
    run: async ({ setStatus, setProgress }) => {
      setStatus("loading");
      setProgress(20);
      const { exportCohortPDF } = await import("./cohortPdf");
      setStatus("running");
      setProgress(70);
      exportCohortPDF(input.metrics);
      setProgress(100);
    },
  });
}

// ---- PDF Mensal por período -------------------------------------------

export function queueMonthlyReportPdf(input: {
  label: string;
  payload: () => Promise<Parameters<typeof import("./monthlyReportPdf").exportMonthlyReportPDF>[0]>;
}): string {
  return exportQueue.enqueue({
    label: input.label,
    run: async ({ setStatus, setProgress }) => {
      setStatus("loading");
      setProgress(15);
      const [{ exportMonthlyReportPDF }, payload] = await Promise.all([
        import("./monthlyReportPdf"),
        input.payload(),
      ]);
      setStatus("running");
      setProgress(70);
      exportMonthlyReportPDF(payload);
      setProgress(100);
    },
  });
}
