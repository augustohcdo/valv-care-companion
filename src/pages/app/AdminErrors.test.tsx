import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const ERRORS = [
  { id: "e1", source: "edge_function", context: "clinical-ai", message: "Boom", stack: "at x", created_at: "2026-08-01T10:00:00Z" },
];

// portão para segurar a resposta e observar o estado de carregamento
let gate: Promise<void> | null = null;
let openGate: (() => void) | null = null;

// data do último backup bem sucedido; null = nunca rodou
let lastBackupAt: string | null = new Date().toISOString();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        const chain: any = {
          eq: () => chain,
          order: () => chain,
          maybeSingle: () =>
            Promise.resolve({
              data: lastBackupAt
                ? { finished_at: lastBackupAt, ok: true, tables_ok: 22, tables_failed: 0, total_rows: 5, error: null }
                : null,
              error: null,
            }),
          limit: () => {
            if (table === "backup_runs") return chain;
            return gate ? gate.then(() => ({ data: ERRORS, error: null })) : Promise.resolve({ data: ERRORS, error: null });
          },
        };
        return chain;
      },
    }),
  },
}));

import AdminErrors from "./AdminErrors";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe("AdminErrors", () => {
  beforeEach(() => {
    gate = null;
    openGate = null;
    lastBackupAt = new Date().toISOString();
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    vi.clearAllMocks();
  });

  it("lista os erros capturados", async () => {
    render(<AdminErrors />, { wrapper });
    await waitFor(() => expect(screen.getByText("Boom")).toBeInTheDocument());
    expect(screen.getByText("clinical-ai")).toBeInTheDocument();
  });

  // A tela tem duas noções de "carregando": o spinner da lista (primeira
  // carga) e o do botão (recarga manual). Com um estado só, o botão parava de
  // dar retorno visual depois da primeira vez.
  it("o botão Atualizar gira durante a recarga, não só na primeira carga", async () => {
    render(<AdminErrors />, { wrapper });
    await waitFor(() => expect(screen.getByText("Boom")).toBeInTheDocument());

    const botao = screen.getByRole("button", { name: /Atualizar/i });
    expect(botao).not.toBeDisabled();

    gate = new Promise<void>((r) => { openGate = r; });
    fireEvent.click(botao);

    await waitFor(() => expect(screen.getByRole("button", { name: /Atualizar/i })).toBeDisabled());

    openGate!();
    await waitFor(() => expect(screen.getByRole("button", { name: /Atualizar/i })).not.toBeDisabled());
  });

  it("mostra o último backup quando ele está em dia", async () => {
    render(<AdminErrors />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Último backup há/)).toBeInTheDocument());
    expect(screen.getByText(/22 tabelas/)).toBeInTheDocument();
  });

  // Este é o estado que a tela precisava ter mostrado durante semanas: o
  // export estava agendado, "ativo", e nunca tinha produzido um arquivo.
  it("alarma quando nunca houve backup", async () => {
    lastBackupAt = null;
    render(<AdminErrors />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Nenhum backup registrado/)).toBeInTheDocument());
  });

  it("alarma quando o backup passou do prazo semanal", async () => {
    lastBackupAt = new Date(Date.now() - 20 * 86_400_000).toISOString();
    render(<AdminErrors />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Último backup há 20 dias/)).toBeInTheDocument());
    expect(screen.getByText(/Passou do prazo/)).toBeInTheDocument();
  });
});
