import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const REQUESTS = [
  { id: "abc12345-0000-0000-0000-000000000000", user_id: "u9", right_type: "acesso", status: "recebido", requester_name: "Ana Souza", requester_email: "a@x.com", details: null, response: null, legal_basis: null, due_at: "2026-08-15T10:00:00Z", created_at: "2026-08-01T10:00:00Z", responded_at: null },
];

const updateSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ data: REQUESTS, error: null }) }),
      update: (values: any) => ({
        eq: (_c: string, id: string) => {
          updateSpy(values, id);
          return Promise.resolve({ error: null });
        },
      }),
    }),
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
  },
}));

vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AdminDPO from "./AdminDPO";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe("AdminDPO", () => {
  beforeEach(() => {
    updateSpy.mockClear();
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    vi.clearAllMocks();
  });

  it("lista as solicitações LGPD", async () => {
    render(<AdminDPO />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Ana Souza/)).toBeInTheDocument());
  });

  // Antes, o rascunho de edição era semeado num efeito e saveResponse
  // desistia em silêncio se ele não existisse: clicar em "Salvar" sem ter
  // editado nada não fazia absolutamente nada, sem erro nem aviso.
  it("Salvar funciona mesmo sem o admin ter editado nada antes", async () => {
    render(<AdminDPO />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Ana Souza/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Salvar/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [values, id] = updateSpy.mock.calls[0];
    // grava o que já estava no registro, em vez de não fazer nada
    expect(values).toMatchObject({ status: "recebido" });
    expect(id).toBe("abc12345-0000-0000-0000-000000000000");
  });
});
