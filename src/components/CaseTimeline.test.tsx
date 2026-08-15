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
const insertSpy = vi.fn();


/**
 * Resultado de escrita no formato do cliente real: dá para aguardar direto ou
 * encadear `.select(...)`. Precisa dos dois porque o código passou a pedir as
 * linhas afetadas — a RLS recusa devolvendo 200 com zero linhas, não erro.
 */
function escrita(resultado: { error: { message: string } | null }, afetadas = 1) {
  const p: any = Promise.resolve(resultado);
  p.select = () =>
    Promise.resolve({
      data: resultado.error ? [] : Array.from({ length: afetadas }, (_, i) => ({ id: `r${i}` })),
      error: resultado.error,
    });
  return p;
}

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
          // Só a remoção tira a linha da lista; a edição atualiza no lugar.
          if (values.deleted_at) rows = rows.filter((r) => r.id !== val);
          else rows = rows.map((r) => (r.id === val ? { ...r, ...values } : r));
          return escrita({ error: null });
        },
      }),
      insert: (values: any) => {
        insertSpy(values);
        return escrita({ error: null });
      },
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
    insertSpy.mockClear();
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

  /**
   * A linha do tempo só deixava criar e remover. Um evento com data ou título
   * errado obrigava a apagar e recriar — e apagar registro de prontuário para
   * corrigir digitação é a pior das duas saídas.
   */
  it("editar carrega o evento no formulário e salva por update, não por insert", async () => {
    render(<CaseTimeline caseId="c1" />, { wrapper });
    await waitFor(() => expect(screen.getByText("Consulta de retorno")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Editar evento Consulta de retorno/i }));
    expect(await screen.findByText("Editar evento clínico")).toBeInTheDocument();

    const titulo = screen.getByDisplayValue("Consulta de retorno");
    fireEvent.change(titulo, { target: { value: "Consulta de retorno (revisada)" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [values, col, val] = updateSpy.mock.calls[0];
    expect(values.title).toBe("Consulta de retorno (revisada)");
    expect(values).not.toHaveProperty("deleted_at");
    expect(col).toBe("id");
    expect(val).toBe("e1");
    expect(insertSpy).not.toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledWith("event_updated", "case_events", "e1", { case_id: "c1" });
  });

  it("fechar a edição não deixa o evento carregado no formulário de criação", async () => {
    render(<CaseTimeline caseId="c1" />, { wrapper });
    await waitFor(() => expect(screen.getByText("Eco de controle")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Editar evento Eco de controle/i }));
    expect(await screen.findByDisplayValue("Eco de controle")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByText("Editar evento clínico")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Novo evento/i }));
    expect(await screen.findByText("Registrar evento clínico")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Eco de controle")).not.toBeInTheDocument();
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
