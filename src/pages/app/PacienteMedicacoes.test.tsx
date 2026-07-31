import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { format } from "date-fns";

const TODAY = format(new Date(), "yyyy-MM-dd");
const PATIENT = { id: "p1", user_id: "u1", linked_doctor_id: null, deleted_at: null };

const MEDS = [
  { id: "m1", patient_id: "p1", name: "Losartana", dose: "50 mg", frequency: "1x ao dia", times: ["08:00"], start_date: "2026-07-01", end_date: null, active: true, notes: null },
];

let meds = [...MEDS];
let logs: any[] = [];
// registra a data usada em cada consulta a medication_logs
const logsQueryDates: string[] = [];
const insertSpy = vi.fn();
const updateSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        const chain: any = {
          is: () => chain,
          eq: (col: string, val: any) => {
            if (table === "medication_logs" && col === "log_date") logsQueryDates.push(val);
            return chain;
          },
          order: () => chain,
          maybeSingle: () => Promise.resolve({ data: PATIENT, error: null }),
          then: (res: any) =>
            res({ data: table === "medications" ? meds : logs, error: null }),
        };
        return chain;
      },
      insert: (values: any) => {
        insertSpy(table, values);
        logs = [...logs, { id: "l-new", ...values }];
        return Promise.resolve({ error: null });
      },
      update: (values: any) => ({
        eq: (_col: string, val: any) => {
          updateSpy(table, values, val);
          return Promise.resolve({ error: null });
        },
      }),
    }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import PacienteMedicacoes, { medicationLogsKey, medicationsKey } from "./PacienteMedicacoes";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  // MemoryRouter é necessário: PageHeader renderiza breadcrumbs com <Link>.
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe("PacienteMedicacoes", () => {
  beforeEach(() => {
    meds = [...MEDS];
    logs = [];
    logsQueryDates.length = 0;
    insertSpy.mockClear();
    updateSpy.mockClear();
    vi.clearAllMocks();
  });

  it("lista as medicações ativas do paciente", async () => {
    render(<PacienteMedicacoes />, { wrapper });
    // o nome aparece no checklist de hoje e na lista completa
    await waitFor(() => expect(screen.getAllByText("Losartana").length).toBeGreaterThan(0));
    expect(screen.getAllByText(/50 mg/).length).toBeGreaterThan(0);
  });

  // Esta é a regressão que a migração introduziria se a data ficasse de fora
  // da chave: com a tela aberta na virada da meia-noite, o cache continuaria
  // servindo os registros do dia anterior.
  it("a chave da query de logs inclui a data", () => {
    expect(medicationLogsKey("p1", "2026-07-31")).toEqual(["medication-logs", "p1", "2026-07-31"]);
    expect(medicationLogsKey("p1", "2026-08-01")).not.toEqual(
      medicationLogsKey("p1", "2026-07-31"),
    );
    // e a de medicações NÃO depende da data (não deve invalidar à toa)
    expect(medicationsKey("p1")).toEqual(["medications", "p1"]);
  });

  it("consulta os logs filtrando pela data de hoje", async () => {
    render(<PacienteMedicacoes />, { wrapper });
    await waitFor(() => expect(screen.getAllByText("Losartana").length).toBeGreaterThan(0));
    expect(logsQueryDates).toContain(TODAY);
  });

  it("marcar como tomado cria um registro novo quando ainda não existe log", async () => {
    render(<PacienteMedicacoes />, { wrapper });
    await waitFor(() => expect(screen.getAllByText("Losartana").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: /Tomar/i }));

    await waitFor(() => expect(insertSpy).toHaveBeenCalled());
    const [table, values] = insertSpy.mock.calls[0];
    expect(table).toBe("medication_logs");
    expect(values).toMatchObject({
      medication_id: "m1",
      patient_id: "p1",
      log_date: TODAY,
      scheduled_time: "08:00",
      status: "tomado",
    });
  });

  it("marcar de novo atualiza o log existente em vez de duplicar", async () => {
    logs = [{ id: "l1", medication_id: "m1", patient_id: "p1", log_date: TODAY, scheduled_time: "08:00", status: "tomado" }];
    render(<PacienteMedicacoes />, { wrapper });
    await waitFor(() => expect(screen.getAllByText("Losartana").length).toBeGreaterThan(0));

    // com log existente o botão passa a dizer "Tomado"
    fireEvent.click(screen.getByRole("button", { name: /Tomado/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    // decidiu update lendo os logs vindos da query — não inseriu duplicado
    expect(insertSpy).not.toHaveBeenCalled();
    const [table, , id] = updateSpy.mock.calls[0];
    expect(table).toBe("medication_logs");
    expect(id).toBe("l1");
  });
});
