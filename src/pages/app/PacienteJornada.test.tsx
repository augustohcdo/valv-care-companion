import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

/**
 * A jornada do paciente: duas regras que se parecem e são opostas.
 *
 * ## 1. A leitura que falha não pode virar "você não tem caso nenhum"
 *
 * O `try/catch` desta tela já existia, mas o cliente do Supabase **não lança**:
 * devolve `{ data: null, error }`. O `catch` nunca via falha nenhuma, `cases`
 * ficava vazio e a tela dizia **"Nenhum caso clínico ainda"** — para um paciente
 * que tem casos registrados pelo médico.
 *
 * Aqui isso é pior do que nas telas do médico. O médico conhece o sistema e
 * desconfia; o paciente lê aquilo como informação sobre a própria saúde, e a
 * conclusão razoável é que o médico não registrou nada — que ninguém está
 * olhando o caso dele.
 *
 * ## 2. A falha TOLERADA tem que ser observada, não ignorada
 *
 * O RPC `meus_medicos` traz só o **nome** do médico. Se ele falhar sozinho, a
 * tela segue: perder o nome não é perder a jornada, e derrubar tudo por causa
 * disso seria degradar para pior. Essa decisão está escrita no componente e
 * continua valendo.
 *
 * O que mudou é que o erro passa por `console.warn` em vez de sumir. Falha
 * silenciosa e falha tolerada não são a mesma coisa: a segunda alguém consegue
 * diagnosticar depois. E "continua valendo" é exatamente o tipo de afirmação
 * que só um teste sustenta — sem ele, alguém "conserta" isso para um `throw` e
 * a jornada inteira passa a cair quando um nome não vem.
 */

const ERRO = { message: "network error", code: "PGRST000", details: null, hint: null };

/** Qual leitura falha neste teste. `nenhuma` = tudo carrega. */
let falha: "nenhuma" | "patients" | "clinical_cases" | "doctors" = "nenhuma";
/** O RPC dos nomes falha sozinho — a degradação deliberada. */
let rpcDeNomesFalha = false;
/** O paciente existe e de fato não tem caso nenhum. É o terceiro estado. */
let semCasoNenhum = false;

const PACIENTE = { id: "p1" };
const CASO = {
  id: "c1",
  doctor_id: "d1",
  patient_id: "p1",
  valve_type: "aortica",
  valve_disease: "estenose",
  severity: "importante",
  status: "em_seguimento",
  proposed_management: null,
  created_at: "2026-03-10T10:00:00Z",
  deleted_at: null,
};
const MEDICO = { id: "d1", user_id: "u9", crm: "12345", crm_uf: "SP", specialty: "Cardiologia" };

function consulta(tabela: string): any {
  const quebrou = tabela === falha;
  const lista =
    tabela === "clinical_cases"
      ? semCasoNenhum ? [] : [CASO]
      : tabela === "doctors" ? [MEDICO] : [];

  const alvo: any = {};
  for (const m of ["select", "eq", "is", "neq", "in", "order", "limit"]) alvo[m] = () => alvo;
  alvo.maybeSingle = () =>
    Promise.resolve(
      quebrou
        ? { data: null, error: ERRO }
        : { data: tabela === "patients" ? PACIENTE : null, error: null },
    );
  alvo.then = (resolve: any) =>
    resolve(quebrou ? { data: null, error: ERRO } : { data: lista, error: null });
  return alvo;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (tabela: string) => consulta(tabela),
    rpc: () =>
      Promise.resolve(
        rpcDeNomesFalha
          ? { data: null, error: ERRO }
          : { data: [{ doctor_id: "d1", full_name: "Ana Souza" }], error: null },
      ),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, profile: { account_type: "paciente" }, loading: false }),
}));
vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

// Os cartões do caso aberto puxam dados por conta própria e não são o assunto.
vi.mock("@/components/CaseExams", () => ({ CaseExams: () => null }));
vi.mock("@/components/CaseTimeline", () => ({ CaseTimeline: () => null }));
vi.mock("@/components/CaseAppointments", () => ({ CaseAppointments: () => null }));
vi.mock("@/components/CaseDocuments", () => ({ CaseDocuments: () => null }));
vi.mock("@/components/CaseChat", () => ({ CaseChat: () => null }));

import PacienteJornada from "./PacienteJornada";
import { toast } from "sonner";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

const renderJornada = () => render(<PacienteJornada />, { wrapper });

describe("jornada do paciente com a leitura falhando", () => {
  beforeEach(() => {
    falha = "nenhuma";
    rpcDeNomesFalha = false;
    semCasoNenhum = false;
    vi.clearAllMocks();
  });

  it("diz que foi falha de conexão, e não que não há casos", async () => {
    falha = "clinical_cases";
    renderJornada();

    await waitFor(() =>
      expect(screen.getByText(/não foi possível carregar sua jornada agora/i)).toBeInTheDocument(),
    );

    // A parte que importa para quem lê: a faixa precisa DESMENTIR a leitura
    // errada, não só relatar um erro técnico.
    expect(screen.getByText(/não significa que não haja casos/i)).toBeInTheDocument();
    expect(screen.getByText(/nada foi apagado/i)).toBeInTheDocument();

    // E a frase que o paciente lia como fato sobre a própria saúde.
    expect(screen.queryByText(/nenhum caso clínico ainda/i)).not.toBeInTheDocument();
  });

  it("a faixa fica na tela, não só o toast que some", async () => {
    // O toast dura segundos; a tela fica. Quem abriu a jornada, saiu para
    // atender o telefone e voltou veria só o estado vazio — e essa é a leitura
    // mais provável, não a menos.
    falha = "patients";
    renderJornada();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText(/não foi possível carregar sua jornada agora/i)).toBeInTheDocument();
  });

  it("a falha na lista de médicos também segura a jornada", async () => {
    // Contraprova de abrangência: as três leituras obrigatórias têm `throw`, e
    // não só a primeira que eu lembrei de tratar.
    falha = "doctors";
    renderJornada();

    await waitFor(() =>
      expect(screen.getByText(/não foi possível carregar sua jornada agora/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/nenhum caso clínico ainda/i)).not.toBeInTheDocument();
  });

  it("com tudo lido, a jornada aparece — senão os testes acima passariam com a tela quebrada", async () => {
    renderJornada();

    await waitFor(() => expect(screen.getByText(/Valva aórtica/i)).toBeInTheDocument());
    expect(screen.getByText(/Dr\(a\)\. Ana Souza/)).toBeInTheDocument();
    expect(screen.queryByText(/não foi possível carregar sua jornada agora/i)).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("paciente sem nenhum caso: aí sim o estado vazio é a verdade", async () => {
    // O terceiro estado, e o que separa esta guarda de uma que só proíbe uma
    // frase. "Nenhum caso clínico ainda" nunca foi errada — errado era dizê-la
    // sem ter conseguido ler. Com a leitura boa e a lista vazia, ela é a
    // resposta certa e precisa continuar aparecendo.
    semCasoNenhum = true;
    renderJornada();

    await waitFor(() =>
      expect(screen.getByText(/nenhum caso clínico ainda/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/não foi possível carregar sua jornada agora/i)).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("jornada do paciente quando só os NOMES dos médicos não vêm", () => {
  let avisos: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    falha = "nenhuma";
    semCasoNenhum = false;
    rpcDeNomesFalha = true;
    vi.clearAllMocks();
    avisos = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => avisos.mockRestore());

  it("a jornada continua na tela: perder o nome não é perder o caso", async () => {
    renderJornada();

    await waitFor(() => expect(screen.getByText(/Valva aórtica/i)).toBeInTheDocument());
    // A degradação é deliberada e este teste existe para que ela continue
    // deliberada: transformar isto num `throw` derrubaria a jornada inteira
    // por causa de um nome.
    expect(screen.queryByText(/não foi possível carregar sua jornada agora/i)).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("sem o nome, mostra 'Médico responsável' e o CRM — não um Dr(a). vazio", async () => {
    renderJornada();

    await waitFor(() => expect(screen.getByText(/Médico responsável/i)).toBeInTheDocument());
    expect(screen.getByText(/CRM 12345\/SP/)).toBeInTheDocument();
    expect(screen.queryByText(/Dr\(a\)\.\s*$/)).not.toBeInTheDocument();
  });

  it("o erro tolerado É registrado — falha tolerada não é falha silenciosa", async () => {
    renderJornada();

    await waitFor(() => expect(avisos).toHaveBeenCalled());
    const [texto, erro] = (avisos.mock.calls[0] ?? []) as unknown[];
    expect(String(texto)).toMatch(/nome dos médicos/i);
    // O objeto do erro junto: sem ele, o aviso não permite diagnosticar nada.
    expect(erro).toBeTruthy();
  });
});
