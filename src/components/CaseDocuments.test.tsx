import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const DOCS = [
  { id: "d1", case_id: "c1", document_type: "ecocardiograma", file_name: "eco.pdf", file_size: 1024, created_at: "2026-07-31T10:00:00Z", storage_path: "c1/eco.pdf", deleted_at: null },
  { id: "d2", case_id: "c1", document_type: "laudo_medico", file_name: "laudo.pdf", file_size: 2048, created_at: "2026-07-30T10:00:00Z", storage_path: "c1/laudo.pdf", deleted_at: null },
];

let rows = [...DOCS];
const updateSpy = vi.fn();
const storageRemoveSpy = vi.fn();

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
          rows = rows.filter((r) => r.id !== val);
          return Promise.resolve({ error: null });
        },
      }),
    }),
    storage: {
      from: () => ({
        remove: (paths: string[]) => {
          storageRemoveSpy(paths);
          return Promise.resolve({ error: null });
        },
        createSignedUrl: () => Promise.resolve({ data: { signedUrl: "https://x" }, error: null }),
      }),
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { CaseDocuments } from "./CaseDocuments";
import { logAudit } from "@/lib/auditLog";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const renderComp = (props = {}) =>
  render(<CaseDocuments caseId="c1" {...props} />, { wrapper });

describe("CaseDocuments", () => {
  beforeEach(() => {
    rows = [...DOCS];
    updateSpy.mockClear();
    storageRemoveSpy.mockClear();
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("lista os documentos do caso", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText("eco.pdf")).toBeInTheDocument());
    expect(screen.getByText("laudo.pdf")).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há documentos", async () => {
    rows = [];
    renderComp();
    await waitFor(() => expect(screen.getByText(/Nenhum documento anexado/i)).toBeInTheDocument());
  });

  it("excluir faz soft-delete, remove o arquivo do storage e registra auditoria", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText("eco.pdf")).toBeInTheDocument());

    // o botão de excluir é o último de cada linha
    const deleteButtons = screen.getAllByRole("button").filter((b) =>
      b.className.includes("text-destructive"),
    );
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());

    // soft-delete, não hard delete
    const [values, col, val] = updateSpy.mock.calls[0];
    expect(values).toHaveProperty("deleted_at");
    expect(values.deleted_at).toBeTruthy();
    expect(col).toBe("id");

    // o arquivo em si é removido de verdade do storage (privacidade)
    expect(storageRemoveSpy).toHaveBeenCalledWith([expect.stringContaining("c1/")]);

    expect(logAudit).toHaveBeenCalledWith(
      "document_deleted",
      "case_documents",
      val,
      expect.objectContaining({ case_id: "c1" }),
    );

    // a lista reflete a remoção via invalidação da query
    await waitFor(() => expect(screen.queryByText("eco.pdf")).not.toBeInTheDocument());
  });

  it("em readOnly não oferece upload nem exclusão", async () => {
    renderComp({ readOnly: true });
    await waitFor(() => expect(screen.getByText("eco.pdf")).toBeInTheDocument());
    expect(screen.queryByText(/Selecionar arquivo/i)).not.toBeInTheDocument();
    const destructive = screen.getAllByRole("button").filter((b) =>
      b.className.includes("text-destructive"),
    );
    expect(destructive).toHaveLength(0);
  });
});
