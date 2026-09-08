import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { ReactNode } from "react";

/**
 * O PDF do caso não sai quando falta uma parte dele.
 *
 * ## O defeito que este teste tranca
 *
 * `CasoDetalhe.handleExport` fazia quatro leituras num `Promise.all` sem
 * observar o erro, e o `|| []` logo abaixo transformava falha em seção vazia. Um
 * caso sem eventos e um caso cujos eventos NÃO PUDERAM SER LIDOS geravam o mesmo
 * documento — e ele saía com cara de completo.
 *
 * PDF não é tela. Tela o médico recarrega; PDF é impresso, anexado ao
 * prontuário, mandado ao colega. O erro sai do sistema junto com o papel e não
 * volta.
 *
 * ## Por que este arquivo tem mock próprio
 *
 * O outro arquivo de telas com falha usa um cliente que reprova TUDO. Aqui
 * precisa ser o contrário, porque é esse o caso perigoso: o caso carrega, a tela
 * abre, o botão está lá, e só a evolução clínica não veio. É a falha parcial que
 * produz o documento enganoso — a falha total é visível.
 */

const ERRO = { message: "network error", code: "PGRST000", details: null, hint: null };

const CASO = {
  id: "c1",
  doctor_id: "d1",
  patient_id: null,
  patient_name: "Paciente Teste",
  status: "em_seguimento",
  valve_type: "aortica",
  severity: "importante",
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-01T10:00:00Z",
  deleted_at: null,
};

/** Qual tabela deve falhar neste teste. Trocado por teste. */
let tabelaQueFalha = "case_events";

function consulta(tabela: string): any {
  const falha = tabela === tabelaQueFalha;
  const resultado = falha
    ? { data: null, error: ERRO }
    : { data: tabela === "clinical_cases" ? [CASO] : [], error: null };

  const alvo: any = {};
  for (const m of ["select", "eq", "is", "neq", "in", "gte", "order", "limit"]) alvo[m] = () => alvo;
  alvo.maybeSingle = () =>
    Promise.resolve(
      falha
        ? { data: null, error: ERRO }
        : { data: tabela === "clinical_cases" ? CASO : { id: "x" }, error: null },
    );
  alvo.then = (resolve: any) => resolve(resultado);
  return alvo;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (tabela: string) => consulta(tabela),
    rpc: () => Promise.resolve({ data: [], error: null }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, profile: { full_name: "Ana", account_type: "medico" }, loading: false }),
}));
vi.mock("@/hooks/useDoctor", () => ({
  useDoctor: () => ({ data: { id: "d1", user_id: "u1", verified: true, crm: "1", crm_uf: "SP" }, isLoading: false }),
}));
vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/casePdf", () => ({ exportCasePDF: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

// Componentes filhos que puxam dados por conta própria e não são o assunto aqui.
vi.mock("@/components/CaseChat", () => ({ CaseChat: () => null }));
vi.mock("@/components/ClinicalAIPanel", () => ({ ClinicalAIPanel: () => null }));
vi.mock("@/components/CaseExternalData", () => ({ CaseExternalData: () => null }));
vi.mock("@/components/CaseDiscussion", () => ({ CaseDiscussion: () => null }));
vi.mock("@/components/CaseCollaborators", () => ({ CaseCollaborators: () => null }));
vi.mock("@/components/CaseTimeline", () => ({ CaseTimeline: () => null }));
vi.mock("@/components/CaseAppointments", () => ({ CaseAppointments: () => null }));
vi.mock("@/components/CaseDocuments", () => ({ CaseDocuments: () => null }));
vi.mock("@/components/CaseExams", () => ({ CaseExams: () => null }));
vi.mock("@/components/DocumentGenerator", () => ({ DocumentGenerator: () => null }));

import CasoDetalhe from "@/pages/app/CasoDetalhe";
import { exportCasePDF } from "@/lib/casePdf";
import { toast } from "sonner";

function renderCaso() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={["/app/medico/casos/c1"]}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
  return render(
    <Routes>
      <Route path="/app/medico/casos/:id" element={<CasoDetalhe />} />
    </Routes>,
    { wrapper },
  );
}

describe("exportar o PDF do caso com uma leitura falhando", () => {
  beforeEach(() => {
    tabelaQueFalha = "case_events";
    vi.clearAllMocks();
  });

  it("NÃO gera o PDF quando a evolução do caso não pôde ser lida", async () => {
    renderCaso();
    const botao = await screen.findByRole("button", { name: /exportar pdf/i }, { timeout: 5000 });
    fireEvent.click(botao);

    // O ponto: antes, `exportCasePDF` era chamado com `events: []` e o
    // documento saía sem a evolução, sem nada indicando a ausência.
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(exportCasePDF).not.toHaveBeenCalled();
  });

  it("diz QUAL parte faltou, e não só que deu erro", async () => {
    // "Erro ao gerar PDF" mandaria o médico tentar de novo às cegas. Nomear a
    // parte que faltou é o que permite decidir se vale insistir.
    renderCaso();
    fireEvent.click(await screen.findByRole("button", { name: /exportar pdf/i }, { timeout: 5000 }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const mensagem = String((toast.error as any).mock.calls[0][0]);
    expect(mensagem).toMatch(/evolução do caso/i);
    expect(mensagem).toMatch(/não foi gerado/i);
  });

  it("a mesma regra vale para as consultas, não só para a evolução", async () => {
    // Contraprova de que a checagem cobre as quatro leituras, e não só a
    // primeira que eu lembrei de tratar.
    tabelaQueFalha = "appointments";
    renderCaso();
    fireEvent.click(await screen.findByRole("button", { name: /exportar pdf/i }, { timeout: 5000 }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(String((toast.error as any).mock.calls[0][0])).toMatch(/consultas/i);
    expect(exportCasePDF).not.toHaveBeenCalled();
  });

  it("com tudo lido, o PDF É gerado — senão o teste acima passaria com o botão quebrado", async () => {
    tabelaQueFalha = "__nenhuma__";
    renderCaso();
    fireEvent.click(await screen.findByRole("button", { name: /exportar pdf/i }, { timeout: 5000 }));

    await waitFor(() => expect(exportCasePDF).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();
  });
});
