import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const PATIENT = { id: "p1", user_id: "u1", linked_doctor_id: null, deleted_at: null };

const ENTRIES = [
  { id: "s1", patient_id: "p1", entry_date: "2026-07-30", dyspnea: 8, fatigue: 4, chest_pain: 2, palpitations: 0, edema: true, syncope: false, orthopnea: false, weight_kg: 72, bp_systolic: 130, bp_diastolic: 80, notes: "Cansaço ao subir escada", deleted_at: null },
];

let patientRow: any = PATIENT;
let entries: any[] = [...ENTRIES];
const upsertSpy = vi.fn();
const updateSpy = vi.fn();


/**
 * Resultado de escrita no formato do cliente real: dá para aguardar direto ou
 * encadear `.select(...)`. Precisa dos dois porque o código passou a pedir as
 * linhas afetadas — a RLS recusa devolvendo 200 com zero linhas, não erro.
 */
function escrita(resultado: { error: { message: string } | null }, afetadas = 1) {
  const p: any = Promise.resolve(resultado);
  p.select = () =>
    Promise.resolve({
      data: resultado.error ? [] : Array.from({ length: afetadas }, (_, i) => ({ id: `r${i}` })),
      error: resultado.error,
    });
  return p;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        const chain: any = {
          is: () => chain,
          eq: () => chain,
          order: () => chain,
          limit: () => Promise.resolve({ data: entries, error: null }),
          maybeSingle: () => Promise.resolve({ data: patientRow, error: null }),
        };
        return chain;
      },
      upsert: (values: any, opts: any) => {
        upsertSpy(table, values, opts);
        return Promise.resolve({ error: null });
      },
      update: (values: any) => ({
        eq: (col: string, val: any) => {
          updateSpy(table, values, col, val);
          entries = entries.filter((e) => e.id !== val);
          return escrita({ error: null });
        },
      }),
    }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import PacienteDiario, { symptomEntriesKey } from "./PacienteDiario";
import { logAudit } from "@/lib/auditLog";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

/** Abre a aba "Histórico" (o Radix troca no mousedown, não no click). */
const openHistorico = () =>
  fireEvent.mouseDown(screen.getByRole("tab", { name: /Histórico/i }));

describe("PacienteDiario", () => {
  beforeEach(() => {
    patientRow = PATIENT;
    entries = [...ENTRIES];
    upsertSpy.mockClear();
    updateSpy.mockClear();
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("lista os registros de sintomas no histórico", async () => {
    render(<PacienteDiario />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Registros \(60 dias\)/)).toBeInTheDocument());
    openHistorico();
    await waitFor(() =>
      expect(screen.getByText(/Cansaço ao subir escada/)).toBeInTheDocument(),
    );
  });

  it("sinaliza o registro com sintomas relevantes", async () => {
    render(<PacienteDiario />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Registros \(60 dias\)/)).toBeInTheDocument());
    openHistorico();
    // dispneia 8/10 passa do limiar de destaque
    await waitFor(() => expect(screen.getByText(/Sintomas relevantes/)).toBeInTheDocument());
  });

  it("pede para completar o perfil quando o usuário não tem registro de paciente", async () => {
    patientRow = null;
    render(<PacienteDiario />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Complete seu perfil/i)).toBeInTheDocument());
  });

  it("remover faz soft-delete e registra auditoria", async () => {
    render(<PacienteDiario />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Registros \(60 dias\)/)).toBeInTheDocument());
    openHistorico();
    await waitFor(() => expect(screen.getByText(/Cansaço ao subir escada/)).toBeInTheDocument());

    fireEvent.click(
      screen.queryAllByRole("button").filter((b) => b.className.includes("text-destructive"))[0],
    );

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [table, values, col, val] = updateSpy.mock.calls[0];
    expect(table).toBe("symptom_entries");
    expect(values).toHaveProperty("deleted_at");
    expect(values.deleted_at).toBeTruthy();
    expect(col).toBe("id");
    expect(logAudit).toHaveBeenCalledWith("symptom_entry_deleted", "symptom_entries", val);
  });

  // O upsert usa patient_id+entry_date como chave. Sem o deleted_at: null no
  // payload, registrar de novo um dia cujo registro foi apagado atualizaria a
  // linha soft-deletada — o paciente salvaria e não veria nada aparecer.
  it("o upsert limpa o deleted_at, para não reviver um registro invisível", async () => {
    render(<PacienteDiario />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Registros \(60 dias\)/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Registrar hoje|Atualizar hoje/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/i }));

    await waitFor(() => expect(upsertSpy).toHaveBeenCalled());
    const [table, values, opts] = upsertSpy.mock.calls[0];
    expect(table).toBe("symptom_entries");
    expect(values.deleted_at).toBeNull();
    expect(values.patient_id).toBe("p1");
    expect(opts).toEqual({ onConflict: "patient_id,entry_date" });
  });

  it("a chave da query inclui o id do paciente, para não vazar cache entre contas", () => {
    expect(symptomEntriesKey("p1")).toEqual(["symptom-entries", "p1"]);
    expect(symptomEntriesKey("p2")).not.toEqual(symptomEntriesKey("p1"));
  });
});
