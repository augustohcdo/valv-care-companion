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

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => {
        const chain: any = {
          order: () => chain,
          limit: () => (gate ? gate.then(() => ({ data: ERRORS, error: null })) : Promise.resolve({ data: ERRORS, error: null })),
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
});
