import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

const APPOINTMENTS = [
  { id: "a1", case_id: "c1", appointment_type: "consulta_retorno", status: "agendado", scheduled_at: inDays(7), duration_minutes: 30, location: "Sala 305", notes: null, deleted_at: null },
  { id: "a2", case_id: "c1", appointment_type: "consulta_retorno", status: "realizado", scheduled_at: inDays(-30), duration_minutes: 30, location: null, notes: null, deleted_at: null },
  // agendado, mas a data já passou — pertence ao histórico, não aos próximos
  { id: "a3", case_id: "c1", appointment_type: "exame", status: "agendado", scheduled_at: inDays(-2), duration_minutes: 60, location: null, notes: null, deleted_at: null },
  // cancelado no futuro — também não é "próximo"
  { id: "a4", case_id: "c1", appointment_type: "exame", status: "cancelado", scheduled_at: inDays(10), duration_minutes: 60, location: null, notes: null, deleted_at: null },
];

let rows: any[] = [...APPOINTMENTS];
const updateSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => {
        const chain: any = {
          eq: () => chain,
          is: () => chain,
          order: () => Promise.resolve({ data: rows, error: null }),
        };
        return chain;
      },
      update: (values: any) => ({
        eq: (col: string, val: any) => {
          updateSpy(values, col, val);
          if (values.deleted_at) rows = rows.filter((r) => r.id !== val);
          else rows = rows.map((r) => (r.id === val ? { ...r, ...values } : r));
          return Promise.resolve({ error: null });
        },
      }),
    }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CaseAppointments } from "./CaseAppointments";
import { logAudit } from "@/lib/auditLog";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const renderComp = (props = {}) =>
  render(<CaseAppointments caseId="c1" {...props} />, { wrapper });

describe("CaseAppointments", () => {
  beforeEach(() => {
    rows = [...APPOINTMENTS];
    updateSpy.mockClear();
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("mostra estado vazio quando não há compromissos", async () => {
    rows = [];
    renderComp();
    await waitFor(() => expect(screen.getByText(/Nenhum compromisso agendado/i)).toBeInTheDocument());
  });

  // "Próximo" exige status agendado E data futura. Um agendado que já passou
  // continuaria sendo anunciado como próximo retorno se o filtro olhasse só o
  // status — e o contador do cabeçalho mentiria para o médico.
  it("conta como próximo só o compromisso agendado com data futura", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText("Próximos")).toBeInTheDocument());
    expect(screen.getByText("1 próximo")).toBeInTheDocument();
    expect(screen.getByText("Histórico")).toBeInTheDocument();
  });

  it("marcar como realizado atualiza o status do compromisso", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText("Próximos")).toBeInTheDocument());

    // o vencido em "Histórico" ainda tem status agendado e mostra o mesmo
    // botão; o [0] é o da seção "Próximos", renderizada antes
    fireEvent.click(screen.getAllByRole("button", { name: /Marcar realizado/i })[0]);

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [values, col, val] = updateSpy.mock.calls[0];
    expect(values).toEqual({ status: "realizado" });
    expect(col).toBe("id");
    expect(val).toBe("a1");
  });

  it("excluir faz soft-delete e registra auditoria", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText("Próximos")).toBeInTheDocument());

    fireEvent.click(
      screen.queryAllByRole("button").filter((b) => b.className.includes("text-destructive"))[0],
    );

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [values, col, val] = updateSpy.mock.calls[0];
    expect(values).toHaveProperty("deleted_at");
    expect(values.deleted_at).toBeTruthy();
    expect(col).toBe("id");
    expect(logAudit).toHaveBeenCalledWith(
      "appointment_deleted", "appointments", val, expect.objectContaining({ case_id: "c1" }),
    );
  });

  it("em readOnly não oferece agendar nem alterar compromissos", async () => {
    renderComp({ readOnly: true });
    await waitFor(() => expect(screen.getByText("Próximos")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Agendar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marcar realizado/i })).not.toBeInTheDocument();
    expect(
      screen.queryAllByRole("button").filter((b) => b.className.includes("text-destructive")),
    ).toHaveLength(0);
  });
});
