import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const DOCTOR = { id: "d1", user_id: "u1", crm: "123456", crm_uf: "SP", specialty: "Cardiologia" };
const PATIENT = { id: "p1", user_id: "pu1", linked_doctor_id: "d1", city: "São Paulo", uf: "SP", comorbidities: ["HAS"], deleted_at: null };

let doctorRow: any = DOCTOR;
let patientRow: any = PATIENT;
// registra os filtros aplicados na consulta de patients
let patientFilters: [string, unknown][] = [];

const navigateSpy = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy, useParams: () => ({ id: "p1" }) };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        const chain: any = {
          is: () => chain,
          eq: (col: string, val: unknown) => {
            if (table === "patients") patientFilters.push([col, val]);
            return chain;
          },
          neq: () => chain,
          gte: () => chain,
          in: () => chain,
          limit: () => chain,
          order: () => Promise.resolve({ data: [], error: null }),
          maybeSingle: () => {
            if (table === "doctors") return Promise.resolve({ data: doctorRow, error: null });
            if (table === "patients") return Promise.resolve({ data: patientRow, error: null });
            return Promise.resolve({ data: { full_name: "Ana Souza", phone: null }, error: null });
          },
        };
        return chain;
      },
    }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import MedicoPacienteDetalhe from "./MedicoPacienteDetalhe";
import { toast } from "sonner";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe("MedicoPacienteDetalhe", () => {
  beforeEach(() => {
    doctorRow = DOCTOR;
    patientRow = PATIENT;
    patientFilters = [];
    navigateSpy.mockClear();
    vi.clearAllMocks();
  });

  it("mostra o paciente vinculado", async () => {
    render(<MedicoPacienteDetalhe />, { wrapper });
    await waitFor(() => expect(screen.getAllByText(/Ana Souza/).length).toBeGreaterThan(0));
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  // Sem o filtro por linked_doctor_id, um médico abriria o prontuário de
  // paciente de outro só trocando o id na URL.
  it("busca o paciente exigindo o vínculo com este médico", async () => {
    render(<MedicoPacienteDetalhe />, { wrapper });
    await waitFor(() => expect(screen.getAllByText(/Ana Souza/).length).toBeGreaterThan(0));
    expect(patientFilters).toContainEqual(["linked_doctor_id", "d1"]);
    expect(patientFilters).toContainEqual(["id", "p1"]);
  });

  it("redireciona quando o paciente não está vinculado a este médico", async () => {
    patientRow = null;
    render(<MedicoPacienteDetalhe />, { wrapper });
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/app/medico/pacientes"));
    expect(toast.error).toHaveBeenCalled();
  });

  it("redireciona quem não tem registro de médico", async () => {
    doctorRow = null;
    render(<MedicoPacienteDetalhe />, { wrapper });
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/app/medico/pacientes"));
  });

  // O redirecionamento não pode disparar antes dos dados chegarem, senão o
  // médico é expulso da tela durante o carregamento normal.
  it("não redireciona enquanto os dados estão carregando", () => {
    render(<MedicoPacienteDetalhe />, { wrapper });
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
