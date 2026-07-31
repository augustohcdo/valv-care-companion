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
  const chain: any = {
    eq: (col: string, val: any) => {
      updateSpy(values, col, val);
      // aplica a mutação no "banco" fake
      if (col === "id") {
        rows = rows.map((r) =>
          r.id === val ? { ...r, ...values } : r,
        ).filter((r: any) => !r.deleted_at);
      }
      return { ...chain, then: (res: any) => res({ error: null }) };
    },
    then: (res: any) => res({ error: null }),
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
