import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const CASE = {
  id: "c1", doctor_id: "d1", patient_id: "p1", patient_name: "Ana Souza",
  valve_type: "aortica", valve_disease: "estenose", severity: "importante",
  status: "em_seguimento", nyha: "II", clinical_notes: "Notas iniciais",
  symptoms: null, comorbidities: null, ejection_fraction: 55,
  mean_gradient: null, peak_gradient: null, valve_area: null,
  regurgitation_grade: null, proposed_management: null, prosthesis_id: null,
  created_at: "2026-07-01T10:00:00Z", deleted_at: null,
};

let doctorRow: any = { id: "d1", user_id: "u1", crm: "1", crm_uf: "SP", specialty: "Cardio" };
let caseRow: any = CASE;
let collabRow: any = null;

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn(), useParams: () => ({ id: "c1" }) };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        const chain: any = {
          is: () => chain,
          eq: () => chain,
          order: () => Promise.resolve({ data: [], error: null }),
          maybeSingle: () => {
            if (table === "doctors") return Promise.resolve({ data: doctorRow, error: null });
            if (table === "clinical_cases") return Promise.resolve({ data: caseRow, error: null });
            if (table === "case_collaborators") return Promise.resolve({ data: collabRow, error: null });
            if (table === "patients") return Promise.resolve({ data: { user_id: "pu1" }, error: null });
            return Promise.resolve({ data: null, error: null });
          },
        };
        return chain;
      },
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  },
}));

// Os filhos são pesados (chat, IA, upload) e não são o alvo deste teste.
// A fábrica do vi.mock é içada para o topo do arquivo, então não pode
// referenciar um helper declarado aqui — cada stub vai inline.
vi.mock("@/components/CaseDocuments", () => ({ CaseDocuments: () => <div data-testid="CaseDocuments" /> }));
vi.mock("@/components/CaseTimeline", () => ({ CaseTimeline: () => <div data-testid="CaseTimeline" /> }));
vi.mock("@/components/CaseAppointments", () => ({ CaseAppointments: () => <div data-testid="CaseAppointments" /> }));
vi.mock("@/components/CaseChat", () => ({ CaseChat: () => <div data-testid="CaseChat" /> }));
vi.mock("@/components/CaseExams", () => ({ CaseExams: () => <div data-testid="CaseExams" /> }));
vi.mock("@/components/CaseCollaborators", () => ({ CaseCollaborators: () => <div data-testid="CaseCollaborators" /> }));
vi.mock("@/components/ClinicalAIPanel", () => ({ ClinicalAIPanel: () => <div data-testid="ClinicalAIPanel" /> }));
vi.mock("@/components/CaseExternalData", () => ({ CaseExternalData: () => <div data-testid="CaseExternalData" /> }));
vi.mock("@/components/DocumentGenerator", () => ({ DocumentGenerator: () => <div data-testid="DocumentGenerator" /> }));
vi.mock("@/components/RiskScoreCard", () => ({ RiskScoreCard: () => <div data-testid="RiskScoreCard" /> }));
vi.mock("@/components/GuidelineRecommendations", () => ({ GuidelineRecommendations: () => <div data-testid="GuidelineRecommendations" /> }));
vi.mock("@/components/CaseDiscussion", () => ({
  CaseDiscussion: ({ canComment }: { canComment: boolean }) => (
    <div data-testid="CaseDiscussion">{canComment ? "pode comentar" : "somente leitura"}</div>
  ),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import CasoDetalhe from "./CasoDetalhe";
import { logAudit } from "@/lib/auditLog";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  </MemoryRouter>
);

describe("CasoDetalhe", () => {
  beforeEach(() => {
    doctorRow = { id: "d1", user_id: "u1", crm: "1", crm_uf: "SP", specialty: "Cardio" };
    caseRow = CASE;
    collabRow = null;
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    vi.clearAllMocks();
  });

  it("mostra o caso do médico responsável", async () => {
    render(<CasoDetalhe />, { wrapper });
    await waitFor(() => expect(screen.getAllByText(/Ana Souza/).length).toBeGreaterThan(0));
  });

  it("o médico responsável pode comentar", async () => {
    render(<CasoDetalhe />, { wrapper });
    await waitFor(() => expect(screen.getByTestId("CaseDiscussion")).toHaveTextContent("pode comentar"));
  });

  it("colaborador aceito com nível comentar pode comentar", async () => {
    doctorRow = { id: "d2", user_id: "u1", crm: "2", crm_uf: "SP", specialty: "Cardio" };
    collabRow = { status: "aceito", access_level: "comentar" };
    render(<CasoDetalhe />, { wrapper });
    await waitFor(() => expect(screen.getByTestId("CaseDiscussion")).toHaveTextContent("pode comentar"));
  });

  it("colaborador só de leitura não pode comentar", async () => {
    doctorRow = { id: "d2", user_id: "u1", crm: "2", crm_uf: "SP", specialty: "Cardio" };
    collabRow = { status: "aceito", access_level: "leitura" };
    render(<CasoDetalhe />, { wrapper });
    await waitFor(() => expect(screen.getByTestId("CaseDiscussion")).toHaveTextContent("somente leitura"));
  });

  it("colaborador removido (sem vínculo ativo) não pode comentar", async () => {
    doctorRow = { id: "d2", user_id: "u1", crm: "2", crm_uf: "SP", specialty: "Cardio" };
    collabRow = null; // a consulta filtra deleted_at, então não acha nada
    render(<CasoDetalhe />, { wrapper });
    await waitFor(() => expect(screen.getByTestId("CaseDiscussion")).toHaveTextContent("somente leitura"));
  });

  // O react-query refaz a busca ao voltar o foco da janela. Se a auditoria
  // estivesse dentro da queryFn, a trilha registraria aberturas de prontuário
  // que nunca aconteceram.
  it("registra a abertura do prontuário uma única vez, mesmo com refetch", async () => {
    render(<CasoDetalhe />, { wrapper });
    await waitFor(() => expect(logAudit).toHaveBeenCalledWith("case_viewed", "clinical_cases", "c1"));

    await client.refetchQueries();
    await waitFor(() =>
      expect((logAudit as any).mock.calls.filter((c: any[]) => c[0] === "case_viewed")).toHaveLength(1),
    );
  });
});
