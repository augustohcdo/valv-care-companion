import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

let isAdminResult: boolean = true;
// portão para segurar a resposta do has_role
let gate: Promise<void> | null = null;
let openGate: (() => void) | null = null;

const navigateSpy = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, Navigate: (p: { to: string }) => { navigateSpy(p.to); return <div data-testid="redirect" />; } };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: () =>
      gate
        ? gate.then(() => ({ data: isAdminResult, error: null }))
        : Promise.resolve({ data: isAdminResult, error: null }),
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
    }),
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" }, loading: false }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AdminIntegracoes from "./AdminIntegracoes";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  </MemoryRouter>
);

describe("AdminIntegracoes", () => {
  beforeEach(() => {
    isAdminResult = true;
    gate = null;
    openGate = null;
    navigateSpy.mockClear();
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    vi.clearAllMocks();
  });

  it("mostra a tela para quem é admin", async () => {
    render(<AdminIntegracoes />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Integrações/i)).toBeInTheDocument());
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("redireciona quem não é admin", async () => {
    isAdminResult = false;
    render(<AdminIntegracoes />, { wrapper });
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/app/medico"));
  });

  // "Ainda não sei" (query em voo) tem que continuar mostrando o spinner.
  // Tratar isso como "não é admin" expulsaria o próprio admin da tela durante
  // o carregamento normal.
  it("enquanto has_role não responde, mostra o spinner em vez de redirecionar", async () => {
    gate = new Promise<void>((r) => { openGate = r; });
    const { container } = render(<AdminIntegracoes />, { wrapper });

    await waitFor(() => expect(container.querySelector(".animate-spin")).not.toBeNull());
    expect(navigateSpy).not.toHaveBeenCalled();

    openGate!();
    await waitFor(() => expect(screen.getByText(/Integrações/i)).toBeInTheDocument());
  });
});
