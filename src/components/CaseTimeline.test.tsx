import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const EVENTS = [
  { id: "e1", case_id: "c1", event_type: "consulta", event_date: "2026-07-31", title: "Consulta de retorno", description: "Paciente estável", created_at: "2026-07-31T10:00:00Z", deleted_at: null },
  { id: "e2", case_id: "c1", event_type: "exame", event_date: "2026-07-20", title: "Eco de controle", description: null, created_at: "2026-07-20T10:00:00Z", deleted_at: null },
];

let rows = [...EVENTS];
const updateSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => {
        const chain: any = {
          eq: () => chain,
          is: () => chain,
          order: () => {
            const o: any = { order: () => Promise.resolve({ data: rows, error: null }) };
            return o;
          },
        };
        return chain;
      },
      update: (values: any) => ({
        eq: (col: string, val: any) => {
          updateSpy(values, col, val);
          rows = rows.filter((r) => r.id !== val);
          return Promise.resolve({ error: null });
        },
      }),
      insert: () => Promise.resolve({ error: null }),
    }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CaseTimeline } from "./CaseTimeline";
import { logAudit } from "@/lib/auditLog";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("CaseTimeline", () => {
  beforeEach(() => {
    rows = [...EVENTS];
    updateSpy.mockClear();
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("lista os eventos do caso", async () => {
    render(<CaseTimeline caseId="c1" />, { wrapper });
    await waitFor(() => expect(screen.getByText("Consulta de retorno")).toBeInTheDocument());
    expect(screen.getByText("Eco de controle")).toBeInTheDocument();
  });

  it("mostra estado vazio sem eventos", async () => {
    rows = [];
    render(<CaseTimeline caseId="c1" />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Nenhum evento registrado/i)).toBeInTheDocument());
  });

  it("remover faz soft-delete, audita e some da lista", async () => {
    render(<CaseTimeline caseId="c1" />, { wrapper });
    await waitFor(() => expect(screen.getByText("Consulta de retorno")).toBeInTheDocument());

    const del = screen.getAllByRole("button").filter((b) => b.className.includes("text-destructive"));
    fireEvent.click(del[0]);

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [values, col] = updateSpy.mock.calls[0];
    expect(values).toHaveProperty("deleted_at");
    expect(values.deleted_at).toBeTruthy();
    expect(col).toBe("id");
    expect(logAudit).toHaveBeenCalledWith("event_deleted", "case_events", expect.any(String), { case_id: "c1" });

    await waitFor(() => expect(screen.queryByText("Consulta de retorno")).not.toBeInTheDocument());
  });

  it("em readOnly não oferece criar nem remover", async () => {
    render(<CaseTimeline caseId="c1" readOnly />, { wrapper });
    await waitFor(() => expect(screen.getByText("Consulta de retorno")).toBeInTheDocument());
    expect(screen.queryByText("Novo evento")).not.toBeInTheDocument();
    // queryAllByRole (não getAllByRole): em readOnly não sobra botão nenhum,
    // e o get* lança quando não encontra em vez de devolver lista vazia.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
