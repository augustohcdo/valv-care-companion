import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const DOCTOR = { id: "d1", user_id: "u1", crm: "123456", crm_uf: "SP", specialty: "Cardiologia" };

let doctorRow: any = DOCTOR;
let currentUser: any = { id: "u1" };
const selectSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        selectSpy(table);
        const chain: any = {
          eq: () => chain,
          maybeSingle: () => Promise.resolve({ data: doctorRow, error: null }),
        };
        return chain;
      },
    }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: currentUser }) }));

import { useDoctor, doctorKey } from "./useDoctor";

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("useDoctor", () => {
  beforeEach(() => {
    doctorRow = DOCTOR;
    currentUser = { id: "u1" };
    selectSpy.mockClear();
  });

  it("resolve o registro de médico do usuário logado", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDoctor(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(DOCTOR);
    expect(selectSpy).toHaveBeenCalledWith("doctors");
  });

  it("devolve null (sem erro) quando o usuário não tem registro de médico", async () => {
    doctorRow = null;
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDoctor(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it("não consulta o banco enquanto não há usuário (enabled)", () => {
    currentUser = null;
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDoctor(), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it("a chave inclui o id do usuário, para não vazar cache entre contas", () => {
    expect(doctorKey("u1")).toEqual(["doctor", "u1"]);
    expect(doctorKey("u2")).not.toEqual(doctorKey("u1"));
  });

  // Este é o ganho da fatia: nove telas da área médica refaziam esta consulta.
  it("telas diferentes compartilham uma única consulta (deduplicação)", async () => {
    const { wrapper } = makeWrapper();
    const a = renderHook(() => useDoctor(), { wrapper });
    const b = renderHook(() => useDoctor(), { wrapper });

    await waitFor(() => expect(a.result.current.isLoading).toBe(false));
    await waitFor(() => expect(b.result.current.isLoading).toBe(false));

    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(b.result.current.data).toEqual(DOCTOR);
  });
});
