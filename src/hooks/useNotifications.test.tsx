import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const NOTIFICATIONS = [
  { id: "n1", user_id: "u1", type: "case_created", title: "Caso criado", body: null, link: null, read: false, metadata: null, created_at: "2026-07-31T10:00:00Z" },
  { id: "n2", user_id: "u1", type: "system", title: "Bem-vindo", body: null, link: null, read: true, metadata: null, created_at: "2026-07-30T10:00:00Z" },
];

// Estado mutável do "banco" fake, para provar que a UI reflete a mutação.
let rows = [...NOTIFICATIONS];
const updateSpy = vi.fn();

const selectChain = () => {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    order: () => chain,
    limit: () => Promise.resolve({ data: rows, error: null }),
  };
  return chain;
};

const updateChain = (values: any) => {
  // Quantas linhas o `.eq()` alcançou — é o que o `.select(...)` devolve.
  //
  // O mock antes devolvia só `{ error: null }`, sem `.select`: uma forma que o
  // cliente real não tem. O hook, corrigido para conferir as linhas afetadas
  // (a RLS recusando devolve 200 com `error: null` e ZERO linhas), quebrava
  // aqui por defeito do mock.
  //
  // E o detalhe que faz o mock valer: SEM `.select(...)` não vem `data`. Com os
  // dois iguais, a conferência passaria sem ninguém ter pedido as linhas.
  const encadear = (afetadas: any[]) => ({
    ...chain,
    then: (res: any) => res({ error: null }),
    select: () => Promise.resolve({ data: afetadas, error: null }),
  });
  const chain: any = {
    eq: (col: string, val: any) => {
      updateSpy(values, col, val);
      // Sem inicializador: os dois ramos atribuem, e o `= []` seria valor
      // morto — `no-useless-assignment` reprova, e com razão.
      let afetadas: any[];
      // aplica a mutação no "banco" fake
      if (col === "id") {
        afetadas = rows.filter((r: any) => r.id === val).map((r: any) => ({ id: r.id }));
        rows = rows.map((r) =>
          r.id === val ? { ...r, ...values } : r,
        ).filter((r: any) => !r.deleted_at);
      } else {
        afetadas = rows.map((r: any) => ({ id: r.id }));
      }
      return encadear(afetadas);
    },
    then: (res: any) => res({ error: null }),
    select: () => Promise.resolve({ data: rows.map((r: any) => ({ id: r.id })), error: null }),
  };
  return chain;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: selectChain().select,
      update: (values: any) => updateChain(values),
    }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));

import { useNotifications } from "./useNotifications";
import { logAudit } from "@/lib/auditLog";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useNotifications", () => {
  beforeEach(() => {
    rows = [...NOTIFICATIONS];
    updateSpy.mockClear();
    vi.clearAllMocks();
  });

  it("carrega as notificações e conta apenas as não lidas", async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toHaveLength(2);
    // n1 é read:false, n2 é read:true
    expect(result.current.unread).toBe(1);
  });

  it("markAsRead marca no banco E atualiza a lista sem depender do realtime", async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.unread).toBe(1);

    await act(async () => {
      result.current.markAsRead("n1");
    });

    expect(updateSpy).toHaveBeenCalledWith({ read: true }, "id", "n1");
    // Este é o ponto da migração: antes a contagem só mudava se o realtime
    // respondesse. Agora a invalidação da query atualiza a UI sozinha.
    await waitFor(() => expect(result.current.unread).toBe(0));
  });

  it("recusa de RLS — 200 com zero linhas — não audita a remoção", async () => {
    /**
     * A forma de falha que não vem como erro.
     *
     * Quando a RLS recusa o UPDATE, o PostgREST devolve 200 com `error: null` e
     * ZERO linhas. Conferindo só o `error`, a mutação seguia e o
     * `logAudit("notification_deleted")` gravava na trilha de auditoria a
     * remoção de uma notificação que continuava lá.
     *
     * Aqui zero linhas NÃO é ambíguo: pediu-se para apagar UMA, por id.
     *
     * Conferido por inversão: tirando a checagem de `data.length` do hook, este
     * teste reprova.
     */
    // O id não existe na lista fake, então o `.eq("id", …)` alcança zero linhas.
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.remove("id-que-nao-existe");
    });

    expect(
      logAudit,
      "auditou a remoção de uma notificação que não foi removida",
    ).not.toHaveBeenCalled();
  });

  it("remove faz soft-delete, tira o item da lista e registra auditoria", async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(2);

    await act(async () => {
      result.current.remove("n1");
    });

    // soft-delete (update com deleted_at), nunca .delete()
    const [values, col, val] = updateSpy.mock.calls[0];
    expect(values).toHaveProperty("deleted_at");
    expect(values.deleted_at).toBeTruthy();
    expect([col, val]).toEqual(["id", "n1"]);

    expect(logAudit).toHaveBeenCalledWith("notification_deleted", "notifications", "n1");
    await waitFor(() => expect(result.current.items).toHaveLength(1));
  });

  it("markAllAsRead filtra por usuário e por não-lidas", async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.markAllAsRead();
    });

    expect(updateSpy).toHaveBeenCalledWith({ read: true }, "user_id", "u1");
    expect(updateSpy).toHaveBeenCalledWith({ read: true }, "read", false);
  });
});
