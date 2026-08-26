import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const DOCTOR = {
  id: "d1", user_id: "du1", crm: "123456", crm_uf: "SP", specialty: "Cardiologia",
  rqe: null, institution: null, city: null, bio: null, verified: false,
};

let patientRow: any = { id: "p1", user_id: "u1", linked_doctor_id: "d1", deleted_at: null };
let doctorRow: any = DOCTOR;
/**
 * O que `meus_medicos` devolve. O mock antigo simulava um `maybeSingle` em
 * `profiles` que na RLS real volta vazio para outra pessoa — o teste passava
 * enquanto o paciente lia "Dr(a). Médico(a)" no cartão do próprio médico.
 */
let meusMedicos: unknown[] = [{
  doctor_id: "d1", user_id: "du1", full_name: "Ana Souza",
  crm: "123456", crm_uf: "SP", specialty: "Cardiologia", institution: null,
}];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (nome: string) =>
      Promise.resolve(
        nome === "meus_medicos" ? { data: meusMedicos, error: null } : { data: [], error: null },
      ),
    from: (table: string) => ({
      select: () => {
        const chain: any = {
          is: () => chain,
          eq: () => chain,
          ilike: () => chain,
          in: () => Promise.resolve({ data: [{ user_id: "du1", full_name: "Ana Souza" }], error: null }),
          limit: () => Promise.resolve({ data: [], error: null }),
          maybeSingle: () => {
            if (table === "patients") return Promise.resolve({ data: patientRow, error: null });
            if (table === "doctors") return Promise.resolve({ data: doctorRow, error: null });
            return Promise.resolve({ data: { full_name: "Ana Souza" }, error: null });
          },
        };
        return chain;
      },
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import PacienteMedico from "./PacienteMedico";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe("PacienteMedico", () => {
  beforeEach(() => {
    patientRow = { id: "p1", user_id: "u1", linked_doctor_id: "d1", deleted_at: null };
    doctorRow = DOCTOR;
    meusMedicos = [{
      doctor_id: "d1", user_id: "du1", full_name: "Ana Souza",
      crm: "123456", crm_uf: "SP", specialty: "Cardiologia", institution: null,
    }];
    vi.clearAllMocks();
  });

  it("mostra o médico vinculado com o nome resolvido pelo RPC", async () => {
    render(<PacienteMedico />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Ana Souza/)).toBeInTheDocument());
    expect(screen.getByText("Vínculo ativo")).toBeInTheDocument();
    expect(screen.getByText(/CRM 123456\/SP/)).toBeInTheDocument();
  });

  it("mostra o estado sem vínculo quando o paciente não tem médico", async () => {
    patientRow = { ...patientRow, linked_doctor_id: null };
    render(<PacienteMedico />, { wrapper });
    await waitFor(() =>
      expect(screen.getByText(/ainda não está vinculado/i)).toBeInTheDocument(),
    );
  });

  // Esta é a mudança de comportamento introduzida pela migração: antes, se o
  // médico vinculado não fosse encontrado, o card continuava exibindo o médico
  // anterior. Agora o card é limpo.
  it("limpa o card quando o médico vinculado não é encontrado", async () => {
    doctorRow = null;
    render(<PacienteMedico />, { wrapper });
    await waitFor(() =>
      expect(screen.getByText(/ainda não está vinculado/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText("Vínculo ativo")).not.toBeInTheDocument();
  });

  it("não mostra vínculo quando o usuário não tem registro de paciente", async () => {
    patientRow = null;
    render(<PacienteMedico />, { wrapper });
    await waitFor(() =>
      expect(screen.getByText(/ainda não está vinculado/i)).toBeInTheDocument(),
    );
  });
});
