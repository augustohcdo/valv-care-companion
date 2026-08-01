import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

const APPTS = [
  { id: "a1", case_id: "c1", scheduled_at: inDays(3), duration_minutes: 30, appointment_type: "consulta_retorno", status: "agendado", location: "Sala 305", notes: null, deleted_at: null, clinical_cases: { id: "c1", patient_name: "Ana Souza" } },
  { id: "a2", case_id: "c1", scheduled_at: inDays(5), duration_minutes: 30, appointment_type: "exame", status: "agendado", location: null, notes: null, deleted_at: "2026-08-01T10:00:00Z", clinical_cases: { id: "c1", patient_name: "Bruno Lima" } },
];

// registra se a consulta de appointments filtrou deleted_at
let filteredDeleted = false;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        const chain: any = {
          is: (col: string) => {
            if (table === "appointments" && col === "deleted_at") filteredDeleted = true;
            return chain;
          },
          eq: () => chain,
          neq: () => Promise.resolve({ data: [{ id: "c1" }], error: null }),
          in: () => chain,
          maybeSingle: () => Promise.resolve({ data: { id: "d1" }, error: null }),
          order: () =>
            Promise.resolve({
              // o "banco" devolve só o que não está apagado, como o Postgres faria
              data: filteredDeleted ? APPTS.filter((a) => !a.deleted_at) : APPTS,
              error: null,
            }),
        };
        return chain;
      },
    }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import MedicoAgenda from "./MedicoAgenda";

describe("MedicoAgenda", () => {
  beforeEach(() => {
    filteredDeleted = false;
    vi.clearAllMocks();
  });

  // Compromisso removido pelo médico na tela do caso continuava aparecendo na
  // agenda: o soft-delete foi aplicado em CaseAppointments, mas esta consulta
  // nunca ganhou o filtro correspondente.
  it("não mostra na agenda um compromisso que foi removido", async () => {
    render(
      <MemoryRouter>
        <MedicoAgenda />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText(/Ana Souza/).length).toBeGreaterThan(0));
    expect(filteredDeleted).toBe(true);
    expect(screen.queryByText(/Bruno Lima/)).not.toBeInTheDocument();
  });
});
