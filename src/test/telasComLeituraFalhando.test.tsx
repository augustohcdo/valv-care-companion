import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

/**
 * O que as telas dizem quando a leitura FALHA.
 *
 * ## Por que este arquivo existe
 *
 * As correções de leitura cega desta sessão trocaram afirmações falsas por
 * faixas de erro: "0 pacientes" virou "não foi possível carregar", "Paciente
 * ainda não registrou sintomas" virou "isto não quer dizer que ele esteja sem
 * sintomas". Nada disso tinha teste. A prova era o contador de
 * `readErrors.test.ts`, que conta PADRÕES NO CÓDIGO — ele sabe que o `error`
 * está sendo observado, e não sabe o que aparece na tela.
 *
 * E a outra prova que eu tinha tentado — abrir as telas num navegador — não
 * cobre nenhuma delas: sem sessão, as 39 rotas de `/app/` param no login.
 *
 * Então o caminho que sobra, e que é o certo, é este: renderizar o componente
 * com o cliente do Supabase devolvendo erro, e cobrar o que o médico lê.
 *
 * ## O que cada teste cobra, em duas partes
 *
 * Toda tela aqui é cobrada nos dois sentidos, porque só o segundo é que pega o
 * defeito original:
 *
 *   1. a faixa de falha APARECE;
 *   2. a frase que afirmava ausência **não** aparece.
 *
 * Sem a segunda, uma tela que mostrasse a faixa E o "nenhum paciente
 * vinculado" logo abaixo passaria — e é exatamente essa a tela que engana:
 * o olho lê a frase categórica e ignora o aviso.
 */

// ---------------------------------------------------------------------------
// O cliente que sempre falha
// ---------------------------------------------------------------------------

const ERRO = { message: "network error", code: "PGRST000", details: null, hint: null };

/** Encadeamento do cliente real: qualquer método devolve a si mesmo até o fim. */
function consultaQueFalha(): any {
  const alvo: any = {};
  const metodos = ["select", "eq", "is", "neq", "in", "gte", "lte", "order", "limit", "filter"];
  for (const m of metodos) alvo[m] = () => alvo;
  alvo.maybeSingle = () => Promise.resolve({ data: null, error: ERRO });
  alvo.single = () => Promise.resolve({ data: null, error: ERRO });
  alvo.then = (resolve: any) => resolve({ data: null, count: null, error: ERRO });
  return alvo;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => consultaQueFalha(),
    rpc: () => Promise.resolve({ data: null, error: ERRO }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, profile: { full_name: "Ana Souza", account_type: "medico" }, loading: false }),
}));
vi.mock("@/hooks/useDoctor", () => ({
  useDoctor: () => ({ data: { id: "d1", verified: true, crm: "1", crm_uf: "SP" }, isLoading: false }),
}));
vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

// Filhos que puxam dados por conta própria e não são o assunto destes testes.
vi.mock("@/components/DashboardCharts", () => ({ DashboardCharts: () => null }));
vi.mock("@/components/AdvancedStats", () => ({ AdvancedStats: () => null }));
vi.mock("@/components/DoctorLinkRequests", () => ({ DoctorLinkRequests: () => null }));

import { PatientSymptomsViewer } from "@/components/PatientSymptomsViewer";
import MedicoHome from "@/pages/app/MedicoHome";
import MedicoPacientes from "@/pages/app/MedicoPacientes";
import MedicoColaboracoes from "@/pages/app/MedicoColaboracoes";

// `MemoryRouter` porque as telas de lista usam `<Link>`. Sem ele o React quebra
// no roteador antes de chegar à faixa de erro — e o teste reprovaria pelo motivo
// errado, que é uma forma de falso vermelho tão ruim quanto o falso verde.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------

describe("diário de sintomas com a leitura falhando", () => {
  /**
   * A mais grave das telas desta sessão. Falhando, ela mostrava "Registros
   * (60d): 0", "Sintomas relevantes (14d): 0", "Paciente ainda não registrou
   * sintomas no diário" — e o card de "Alertas recentes" nem era desenhado.
   *
   * Em valvopatia, sintomático × assintomático decide intervenção.
   */
  it("diz que não conseguiu ler, e NÃO diz que o paciente está sem sintomas", async () => {
    render(<PatientSymptomsViewer patientId="p1" />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/não foi possível carregar o diário de sintomas/i)).toBeInTheDocument(),
    );

    // O ponto todo: a tela precisa DESMENTIR a leitura de ausência.
    expect(screen.getByText(/não quer dizer que ele esteja sem sintomas/i)).toBeInTheDocument();

    // E a frase antiga não pode estar em lugar nenhum da tela.
    expect(screen.queryByText(/ainda não registrou sintomas no diário/i)).not.toBeInTheDocument();
  });

  it("não mostra os contadores zerados junto com a falha", async () => {
    // Mostrar "Registros (60d): 0" ao lado do aviso seria pior que não mostrar
    // nada: o olho lê o número e ignora a faixa.
    render(<PatientSymptomsViewer patientId="p1" />, { wrapper });
    await waitFor(() =>
      expect(screen.getByText(/não foi possível carregar o diário/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/registros \(60d\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sintomas relevantes/i)).not.toBeInTheDocument();
  });
});

describe("lista de pacientes com a leitura falhando", () => {
  it("não afirma que o médico não tem paciente vinculado", async () => {
    render(<MedicoPacientes />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/não foi possível carregar seus pacientes/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/falha de leitura, não a ausência de vínculos/i)).toBeInTheDocument();

    // A frase antiga vinha com um convite a divulgar o CRM — conselho errado
    // para quem tem pacientes e não conseguiu vê-los.
    expect(screen.queryByText(/nenhum paciente vinculado/i)).not.toBeInTheDocument();
  });
});

describe("colaborações com a leitura falhando", () => {
  it("não afirma que ninguém convidou o médico", async () => {
    render(<MedicoColaboracoes />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/não foi possível carregar suas colaborações/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/não a ausência de convites/i)).toBeInTheDocument();
    expect(screen.queryByText(/nenhum convite ainda/i)).not.toBeInTheDocument();
  });
});

describe("painel do médico com a leitura falhando", () => {
  /**
   * A PRIMEIRA tela depois de entrar. O `?? 0` fazia ela anunciar
   * "0 pacientes, 0 casos, 0 em acompanhamento" em números grandes — não é tela
   * vazia, é a tela afirmando um fato falso sobre a prática do médico.
   */
  it("não anuncia que o médico não tem paciente nem caso", async () => {
    render(<MedicoHome />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/não foi possível carregar seu painel/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/não a ausência de pacientes ou casos/i)).toBeInTheDocument();

    // Os rótulos dos contadores não podem aparecer: a faixa substitui o painel,
    // não convive com ele. Número grande ao lado de aviso pequeno é lido como
    // número grande.
    expect(screen.queryByText(/casos ativos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/total de casos/i)).not.toBeInTheDocument();
  });
});
