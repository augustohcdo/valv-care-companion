import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const PATIENT = { id: "p1", user_id: "u1", linked_doctor_id: null, deleted_at: null };

const DOCS = [
  { id: "pd1", patient_id: "p1", document_type: "ecocardiograma", file_name: "eco.pdf", file_size: 1024, storage_path: "u1/eco.pdf", description: null, shared_with_doctor: true, created_at: "2026-07-31T10:00:00Z", deleted_at: null },
  { id: "pd2", patient_id: "p1", document_type: "laudo_medico", file_name: "laudo.pdf", file_size: 2048, storage_path: "u1/laudo.pdf", description: null, shared_with_doctor: false, created_at: "2026-07-30T10:00:00Z", deleted_at: null },
];

let patientRow: any = PATIENT;
let docs: any[] = [...DOCS];
const updateSpy = vi.fn();
const storageRemoveSpy = vi.fn();
/**
 * Quantas linhas a escrita afeta. Zero é como a RLS recusa um UPDATE: o
 * PostgREST responde 200 com `error: null` e lista vazia.
 */
let linhasAfetadas = 1;


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
    from: (table: string) => ({
      select: () => {
        const chain: any = {
          is: () => chain,
          eq: () => chain,
          order: () => Promise.resolve({ data: docs, error: null }),
          maybeSingle: () => Promise.resolve({ data: patientRow, error: null }),
        };
        return chain;
      },
      update: (values: any) => ({
        eq: (col: string, val: any) => {
          updateSpy(table, values, col, val);
          if (linhasAfetadas > 0) {
            if (values.deleted_at) docs = docs.filter((d) => d.id !== val);
            else docs = docs.map((d) => (d.id === val ? { ...d, ...values } : d));
          }
          return escrita({ error: null }, linhasAfetadas);
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
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import PacienteDocumentos, { patientDocumentsKey } from "./PacienteDocumentos";
import { logAudit } from "@/lib/auditLog";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe("PacienteDocumentos", () => {
  beforeEach(() => {
    patientRow = PATIENT;
    linhasAfetadas = 1;
    docs = [...DOCS];
    updateSpy.mockClear();
    storageRemoveSpy.mockClear();
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("lista os documentos do paciente com o estado de compartilhamento", async () => {
    render(<PacienteDocumentos />, { wrapper });
    await waitFor(() => expect(screen.getByText("eco.pdf")).toBeInTheDocument());
    expect(screen.getByText("laudo.pdf")).toBeInTheDocument();
    expect(screen.getByText(/Compartilhado/)).toBeInTheDocument();
    expect(screen.getByText(/Privado/)).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há documentos", async () => {
    docs = [];
    render(<PacienteDocumentos />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Nenhum documento ainda/i)).toBeInTheDocument());
  });

  it("alternar compartilhamento inverte o sinalizador do documento", async () => {
    render(<PacienteDocumentos />, { wrapper });
    await waitFor(() => expect(screen.getByText("eco.pdf")).toBeInTheDocument());

    fireEvent.click(screen.getAllByTitle(/Alternar compartilhamento/i)[0]);

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [table, values, col, val] = updateSpy.mock.calls[0];
    expect(table).toBe("patient_documents");
    expect(values).toEqual({ shared_with_doctor: false }); // pd1 estava compartilhado
    expect(col).toBe("id");
    expect(val).toBe("pd1");
  });

  // O arquivo em si é apagado de verdade (privacidade), mas a linha só recebe
  // deleted_at — trocar isso por .delete() destruiria a trilha de auditoria.

  // A ordem importa e é decisão, não acaso: a linha primeiro, o arquivo depois.
  // Na ordem inversa, uma recusa na marcação deixaria a linha viva apontando
  // para um arquivo já destruído — exatamente o estado que o alarme de
  // "documento sem arquivo" existe para denunciar.
  it("escrita recusada: não apaga o arquivo, não audita e mantém o documento", async () => {
    linhasAfetadas = 0;

    render(<PacienteDocumentos />, { wrapper });
    await waitFor(() => expect(screen.getByText("eco.pdf")).toBeInTheDocument());

    fireEvent.click(
      screen.queryAllByRole("button").filter((b) => b.className.includes("text-destructive"))[0],
    );

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    expect(storageRemoveSpy).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
    expect(screen.getByText("eco.pdf")).toBeInTheDocument();
  });

  it("remover apaga o arquivo do storage, faz soft-delete da linha e audita", async () => {
    render(<PacienteDocumentos />, { wrapper });
    await waitFor(() => expect(screen.getByText("eco.pdf")).toBeInTheDocument());

    fireEvent.click(
      screen.queryAllByRole("button").filter((b) => b.className.includes("text-destructive"))[0],
    );

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    expect(storageRemoveSpy).toHaveBeenCalledWith(["u1/eco.pdf"]);

    const [table, values, col, val] = updateSpy.mock.calls[0];
    expect(table).toBe("patient_documents");
    expect(values).toHaveProperty("deleted_at");
    expect(values.deleted_at).toBeTruthy();
    expect(col).toBe("id");
    expect(logAudit).toHaveBeenCalledWith(
      "patient_document_deleted", "patient_documents", val,
      expect.objectContaining({ file_name: "eco.pdf" }),
    );

    await waitFor(() => expect(screen.queryByText("eco.pdf")).not.toBeInTheDocument());
  });

  it("bloqueia o envio enquanto o usuário não tem registro de paciente", async () => {
    patientRow = null;
    render(<PacienteDocumentos />, { wrapper });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Selecionar arquivo/i })).toBeDisabled(),
    );
  });

  it("a chave da query inclui o id do paciente, para não vazar cache entre contas", () => {
    expect(patientDocumentsKey("p1")).toEqual(["patient-documents", "p1"]);
    expect(patientDocumentsKey("p2")).not.toEqual(patientDocumentsKey("p1"));
  });
});
