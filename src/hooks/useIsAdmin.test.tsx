import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

let ehAdmin = false;
let usuario: { id: string } | null = { id: "u1" };
const rpc = vi.fn(() => Promise.resolve({ data: ehAdmin, error: null }));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: () => rpc() } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: usuario }) }));

import { useIsAdmin, isAdminKey } from "./useIsAdmin";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe("useIsAdmin", () => {
  beforeEach(() => {
    ehAdmin = false;
    usuario = { id: "u1" };
    rpc.mockClear();
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  });

  it("responde que é admin quando o papel existe", async () => {
    ehAdmin = true;
    const { result } = renderHook(() => useIsAdmin(), { wrapper });
    await waitFor(() => expect(result.current.isAdmin).toBe(true));
    expect(result.current.carregando).toBe(false);
  });

  it("responde que não é admin quando o papel não existe", async () => {
    const { result } = renderHook(() => useIsAdmin(), { wrapper });
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });

  // "Ainda não sei" tratado como "não é admin" mandaria o administrador para a
  // tela do médico durante um carregamento normal.
  it("distingue carregando de não-admin", async () => {
    ehAdmin = true;
    const { result } = renderHook(() => useIsAdmin(), { wrapper });
    expect(result.current.carregando).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    await waitFor(() => expect(result.current.isAdmin).toBe(true));
  });

  // Sem usuário a consulta fica desabilitada e, no react-query v5, desabilitada
  // é `pending` para sempre — um visitante deslogado ficaria preso no spinner.
  it("visitante deslogado não fica carregando para sempre", async () => {
    usuario = null;
    const { result } = renderHook(() => useIsAdmin(), { wrapper });
    expect(result.current.carregando).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  // Duas contas no mesmo navegador não podem compartilhar a resposta.
  it("a chave separa por usuário", () => {
    expect(isAdminKey("u1")).not.toEqual(isAdminKey("u2"));
  });
});
