import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const REQUESTS = [
  { id: "abc12345-0000-0000-0000-000000000000", user_id: "u1", right_type: "acesso", status: "recebido", requester_name: "Ana", details: null, response: null, legal_basis: null, due_at: "2026-08-15T10:00:00Z", created_at: "2026-08-01T10:00:00Z", responded_at: null },
];

let currentUser: any = { id: "u1", email: "a@x.com" };
const selectSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        selectSpy(table);
        const chain: any = {
          eq: () => chain,
          order: () => Promise.resolve({ data: REQUESTS, error: null }),
        };
        return chain;
      },
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: REQUESTS[0], error: null }) }) }),
    }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import DPO, { dpoRequestsKey } from "./DPO";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  </MemoryRouter>
);

describe("DPO (público)", () => {
  beforeEach(() => {
    currentUser = { id: "u1", email: "a@x.com" };
    selectSpy.mockClear();
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    vi.clearAllMocks();
  });

  // A consulta NÃO filtra por user_id — a separação é toda por RLS. Sem o id
  // do usuário na chave, a segunda conta a usar o mesmo navegador leria do
  // cache os pedidos LGPD da primeira.
  it("a chave da query inclui o id do usuário", () => {
    expect(dpoRequestsKey("u1")).toEqual(["dpo-requests", "u1"]);
    expect(dpoRequestsKey("u2")).not.toEqual(dpoRequestsKey("u1"));
  });

  it("lista os pedidos do usuário logado", async () => {
    render(<DPO />, { wrapper });
    await waitFor(() => expect(screen.getByText(/#abc12345/)).toBeInTheDocument());
  });

  // Uma query desabilitada fica "pending" no react-query v5. Se a tela usasse
  // isPending, o visitante deslogado ficaria preso num carregamento eterno.
  it("visitante deslogado não fica preso em carregamento nem consulta o banco", async () => {
    currentUser = null;
    render(<DPO />, { wrapper });
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument());
    expect(selectSpy).not.toHaveBeenCalledWith("dpo_requests");
    expect(screen.queryByText(/#abc12345/)).not.toBeInTheDocument();
  });
});
