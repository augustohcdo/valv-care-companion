import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const PATIENT = { id: "p1", user_id: "u1", linked_doctor_id: null, deleted_at: null };

let patientRow: any = PATIENT;
let currentUser: any = { id: "u1" };
const selectSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        selectSpy(table);
        const chain: any = {
          is: () => chain,
          eq: () => chain,
          maybeSingle: () => Promise.resolve({ data: patientRow, error: null }),
        };
        return chain;
      },
    }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: currentUser }) }));

import { usePatient, patientKey } from "./usePatient";

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("usePatient", () => {
  beforeEach(() => {
    patientRow = PATIENT;
    currentUser = { id: "u1" };
    selectSpy.mockClear();
  });

  it("resolve o registro de paciente do usuário logado", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePatient(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(PATIENT);
    expect(selectSpy).toHaveBeenCalledWith("patients");
  });

  it("devolve null (sem erro) quando o usuário ainda não tem registro de paciente", async () => {
    patientRow = null;
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePatient(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it("não consulta o banco enquanto não há usuário (enabled)", async () => {
    currentUser = null;
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePatient(), { wrapper });

    // com enabled:false a query fica pendente sem disparar fetch
    expect(result.current.fetchStatus).toBe("idle");
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it("a chave inclui o id do usuário, para não vazar cache entre contas", () => {
    expect(patientKey("u1")).toEqual(["patient", "u1"]);
    expect(patientKey("u2")).not.toEqual(patientKey("u1"));
  });

  it("duas telas que usam o hook compartilham uma única consulta (deduplicação)", async () => {
    const { wrapper } = makeWrapper();
    // mesmo QueryClient = mesmo cache, como acontece no app real
    const a = renderHook(() => usePatient(), { wrapper });
    const b = renderHook(() => usePatient(), { wrapper });

    await waitFor(() => expect(a.result.current.isLoading).toBe(false));
    await waitFor(() => expect(b.result.current.isLoading).toBe(false));

    // Este é o ganho da fatia: antes cada tela refazia essa mesma consulta.
    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(b.result.current.data).toEqual(PATIENT);
  });
});
