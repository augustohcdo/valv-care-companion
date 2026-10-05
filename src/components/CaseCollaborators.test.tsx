import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const COLLABS = [
  { id: "k1", case_id: "c1", doctor_id: "d1", status: "aceito", access_level: "comentar", message: null, created_at: "2026-07-30T10:00:00Z", deleted_at: null },
  // convite pendente dirigido ao usuário logado (u1 → doctor d2)
  { id: "k2", case_id: "c1", doctor_id: "d2", status: "pendente", access_level: "leitura", message: "Opinião sobre a indicação?", created_at: "2026-07-31T10:00:00Z", deleted_at: null },
  // convite pendente de outro médico — não deve oferecer Aceitar/Recusar a u1
  { id: "k3", case_id: "c1", doctor_id: "d3", status: "pendente", access_level: "leitura", message: null, created_at: "2026-07-31T11:00:00Z", deleted_at: null },
];
const DOCTORS = [
  { id: "d1", user_id: "u9", crm: "111111", crm_uf: "SP", specialty: "Cardiologia" },
  { id: "d2", user_id: "u1", crm: "222222", crm_uf: "RJ", specialty: "Cirurgia cardíaca" },
  { id: "d3", user_id: "u8", crm: "333333", crm_uf: "MG", specialty: "Cardiologia" },
];
/**
 * O que o RPC `participantes_do_caso` devolve. O mock anterior simulava uma
 * consulta a `profiles` que na RLS real **sempre volta vazia** para outra
 * pessoa — o teste ficava verde enquanto a tela mostrava "Dr(a). —".
 */
const PARTICIPANTES = [
  { user_id: "u9", full_name: "Ana Souza", crm: "111111", crm_uf: "SP", specialty: "Cardiologia" },
  { user_id: "u1", full_name: "Bruno Lima", crm: "222222", crm_uf: "RJ", specialty: "Cirurgia cardíaca" },
  { user_id: "u8", full_name: "Carla Dias", crm: "333333", crm_uf: "MG", specialty: "Cardiologia" },
];

/**
 * Liga a falha na busca por CRM. Fora deste teste ela fica desligada, para não
 * contaminar os outros.
 */
let buscaDeCrmFalha = false;

/**
 * O que `medico_por_crm` devolve. `null` é "não achei esse CRM"; um objeto é o
 * colega encontrado — e o RPC devolve só `id` e `user_id`, nada mais, que é
 * estritamente menos do que a leitura de `doctors` que ele substituiu.
 */
let medicoAchadoPorCrm: { id: string; user_id: string } | null = null;

let collabs = [...COLLABS];
let participantes: unknown[] = [...PARTICIPANTES];
const updateSpy = vi.fn();
const insertSpy = vi.fn();


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
    rpc: (nome: string) => {
      /**
       * `medico_por_crm` não é promessa nua: o cliente real devolve um
       * construtor de consulta, e o `CaseCollaborators` encadeia
       * `.maybeSingle()` nele — a função SQL devolve `TABLE(...)`, ou seja uma
       * lista, e é o `maybeSingle` que a reduz a uma linha ou `null`.
       *
       * Modelado como promessa nua, a tela estoura com "maybeSingle is not a
       * function". Foi isto que apareceu quando a busca por CRM saiu da leitura
       * direta de `doctors` e passou a vir por RPC — e apareceu porque o teste
       * abaixo existia. Sem ele, o convite de colega teria ido para produção
       * quebrado.
       */
      if (nome === "medico_por_crm") {
        const resposta = buscaDeCrmFalha
          ? { data: null, error: { message: "network error" } }
          : { data: medicoAchadoPorCrm, error: null };
        const p: any = Promise.resolve({
          data: resposta.data ? [resposta.data] : [],
          error: resposta.error,
        });
        p.maybeSingle = () => Promise.resolve(resposta);
        return p;
      }
      return Promise.resolve(
        nome === "participantes_do_caso"
          ? { data: participantes, error: null }
          : { data: null, error: null },
      );
    },
    from: (table: string) => ({
      select: () => {
        const chain: any = {
          eq: () => chain,
          is: () => chain,
          in: () =>
            Promise.resolve({ data: table === "doctors" ? DOCTORS : [], error: null }),
          order: () => Promise.resolve({ data: collabs, error: null }),
          // A busca por CRM saiu daqui: ela era um `.from("doctors").eq("crm", …)`
          // e virou o RPC `medico_por_crm`, porque aquela leitura era a única
          // coisa que a quinta porta de `pode_ver_medico` servia — e aquela
          // porta deixava todo médico ler a tabela inteira. Nada mais do
          // componente encadeia `maybeSingle` numa tabela; este ramo fica só
          // para não quebrar quem venha a encadear.
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        };
        return chain;
      },
      insert: (values: any) => {
        insertSpy(table, values);
        return Promise.resolve({ error: null });
      },
      update: (values: any) => ({
        eq: (col: string, val: any) => {
          updateSpy(values, col, val);
          if (values.deleted_at) collabs = collabs.filter((c) => c.id !== val);
          else collabs = collabs.map((c) => (c.id === val ? { ...c, ...values } : c));
          return escrita({ error: null });
        },
      }),
    }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CaseCollaborators } from "./CaseCollaborators";
import { logAudit } from "@/lib/auditLog";
import { toast } from "sonner";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const renderComp = (props = {}) =>
  render(<CaseCollaborators caseId="c1" isOwner {...props} />, { wrapper });

describe("CaseCollaborators", () => {
  beforeEach(() => {
    collabs = [...COLLABS];
    participantes = [...PARTICIPANTES];
    updateSpy.mockClear();
    buscaDeCrmFalha = false;
    medicoAchadoPorCrm = null;
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  // O médico é resolvido em dois saltos: case_collaborators.doctor_id →
  // doctors → profiles. Errar a junção atribuiria o convite ao colega errado.
  it("resolve o médico de cada convite passando por doctors e profiles", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText(/Ana Souza/)).toBeInTheDocument());
    expect(screen.getByText("CRM 111111/SP • Cardiologia")).toBeInTheDocument();
    expect(screen.getByText(/Carla Dias/)).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há colaboradores", async () => {
    collabs = [];
    renderComp();
    await waitFor(() => expect(screen.getByText(/Nenhum colaborador/i)).toBeInTheDocument());
  });

  // Aceitar/Recusar só pode aparecer no convite pendente do próprio usuário —
  // caso contrário um médico responderia pelo convite de outro.
  it("sem nome resolvido, diz que não identificou — não mostra um travessão", async () => {
    participantes = [];
    render(<CaseCollaborators caseId="c1" isOwner />, { wrapper });
    await waitFor(() => expect(screen.getAllByText("colega não identificado").length).toBeGreaterThan(0));
  });

  it("oferece Aceitar/Recusar apenas no convite pendente do próprio usuário", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText(/Ana Souza/)).toBeInTheDocument());

    // dois convites pendentes na tela, mas só um é do usuário logado
    expect(screen.getAllByRole("button", { name: /Aceitar/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Recusar/i })).toHaveLength(1);
  });

  it("aceitar um convite grava o status e a data da resposta", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText(/Ana Souza/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Aceitar/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [values, col, val] = updateSpy.mock.calls[0];
    expect(values).toMatchObject({ status: "aceito" });
    expect(values.responded_at).toBeTruthy();
    expect(col).toBe("id");
    expect(val).toBe("k2");
  });

  it("remover faz soft-delete e registra auditoria", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText(/Ana Souza/)).toBeInTheDocument());

    fireEvent.click(
      screen.queryAllByRole("button").filter((b) => b.className.includes("text-destructive"))[0],
    );

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [values, col, val] = updateSpy.mock.calls[0];
    expect(values).toHaveProperty("deleted_at");
    expect(values.deleted_at).toBeTruthy();
    expect(col).toBe("id");
    expect(logAudit).toHaveBeenCalledWith(
      "collaborator_removed", "case_collaborators", val, expect.objectContaining({ case_id: "c1" }),
    );
  });

  it("quem não é dono do caso não pode convidar nem remover", async () => {
    renderComp({ isOwner: false });
    await waitFor(() => expect(screen.getByText(/Ana Souza/)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Convidar/i })).not.toBeInTheDocument();
    expect(
      screen.queryAllByRole("button").filter((b) => b.className.includes("text-destructive")),
    ).toHaveLength(0);
    // mas continua podendo responder ao próprio convite
    expect(screen.getByRole("button", { name: /Aceitar/i })).toBeInTheDocument();
  });
});

/**
 * A busca por CRM quando a leitura falha.
 *
 * A consulta descartava o `error` e caía no `if (!doc)`, que responde "Médico
 * não encontrado. Verifique o CRM e a UF". Numa falha de leitura essa frase é
 * falsa em dois níveis: o colega EXISTE, e a culpa ainda vai para a digitação de
 * quem está convidando. A pessoa confere o CRM três vezes, liga para o colega
 * para confirmar, e o problema nunca esteve ali.
 */
describe("CaseCollaborators — busca por CRM com a leitura falhando", () => {
  beforeEach(() => {
    collabs = [...COLLABS];
    participantes = [...PARTICIPANTES];
    buscaDeCrmFalha = true;
    medicoAchadoPorCrm = null;
    vi.clearAllMocks();
  });

  it("não diz que o médico não existe quando a consulta é que não chegou", async () => {
    renderComp();
    // O formulário mora num diálogo: primeiro o gatilho, depois os campos.
    fireEvent.click(await screen.findByRole("button", { name: /convidar/i }));
    const campoCrm = await screen.findByPlaceholderText("123456");
    fireEvent.change(campoCrm, { target: { value: "222222" } });
    const botoes = screen.getAllByRole("button", { name: /convidar|enviar/i });
    fireEvent.click(botoes[botoes.length - 1]);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [titulo, opcoes] = (toast.error as any).mock.calls[0];

    expect(String(titulo)).toMatch(/não foi possível consultar o crm/i);
    expect(String(titulo)).not.toMatch(/médico não encontrado/i);
    // E precisa desmentir a leitura de ausência, não só relatar erro.
    expect(String(opcoes?.description ?? "")).toMatch(/não quer dizer que o médico não exista/i);
  });
});

/**
 * O caminho de sucesso da busca por CRM — que não tinha teste nenhum.
 *
 * ## Por que agora
 *
 * A busca saiu de `select id, user_id from doctors where crm = … and crm_uf = …`
 * e passou para o RPC `medico_por_crm`, porque aquela leitura era a ÚNICA coisa
 * que a quinta porta de `pode_ver_medico` servia — e aquela porta dizia "quem é
 * médico vê qualquer médico", inclusive as linhas de quem desmarcou "Aparecer
 * no diretório", cuja tela promete que desmarcar tira da lista (LGPD art. 8º
 * §5º; Resolução CFM nº 2.336/2023).
 *
 * Trocar a forma da consulta sem teste do caminho feliz é o risco de a tela
 * parar de achar colega nenhum e dizer "Médico não encontrado — verifique o CRM
 * e a UF" para sempre: a mesma frase falsa que o bloco acima existe para
 * impedir, por outra causa.
 *
 * ## E o segundo teste, que parece pequeno
 *
 * O RPC devolve exatamente dois campos, `id` e `user_id`. O `id` vira o
 * `doctor_id` do convite; o `user_id` serve a uma coisa só: barrar convidar a
 * si mesmo. Se o RPC parar de devolvê-lo, a trava passa a comparar `undefined`
 * com o id de quem convida, nunca dispara, e o médico se convida para o próprio
 * caso sem nada acusar — o `UNIQUE (case_id, doctor_id)` não pega, porque não é
 * duplicata de nada.
 */
describe("CaseCollaborators — convite por CRM encontrado", () => {
  beforeEach(() => {
    collabs = [...COLLABS];
    participantes = [...PARTICIPANTES];
    buscaDeCrmFalha = false;
    medicoAchadoPorCrm = null;
    vi.clearAllMocks();
  });

  const convidar = async (crm = "444444") => {
    renderComp();
    fireEvent.click(await screen.findByRole("button", { name: /convidar/i }));
    fireEvent.change(await screen.findByPlaceholderText("123456"), { target: { value: crm } });
    const botoes = screen.getAllByRole("button", { name: /convidar|enviar/i });
    fireEvent.click(botoes[botoes.length - 1]);
  };

  it("o colega que o RPC achou vira convite, com o `id` que ele devolveu", async () => {
    medicoAchadoPorCrm = { id: "d-novo", user_id: "u-novo" };
    await convidar();

    await waitFor(() => expect(insertSpy).toHaveBeenCalled());
    const [tabela, valores] = insertSpy.mock.calls[0];
    expect(tabela).toBe("case_collaborators");
    expect(valores).toMatchObject({
      case_id: "c1",
      doctor_id: "d-novo",
      invited_by: "u1",
    });
    expect(toast.success).toHaveBeenCalledWith("Convite enviado");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("CRM que o RPC não acha continua dizendo o que é verdade", async () => {
    // `null` do RPC é "não existe esse CRM" — aqui a frase sobre a digitação é
    // correta, e é por isso que a distinção entre `error` e `null` importa.
    medicoAchadoPorCrm = null;
    await convidar("999999");

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(String((toast.error as any).mock.calls[0][0])).toMatch(/médico não encontrado/i);
    expect(insertSpy, "convidou sem ter achado o médico").not.toHaveBeenCalled();
  });

  it("o `user_id` do RPC é o que barra convidar a si mesmo", async () => {
    medicoAchadoPorCrm = { id: "d-eu", user_id: "u1" }; // u1 é quem está logado
    await convidar("111111");

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(String((toast.error as any).mock.calls[0][0])).toMatch(/não pode convidar a si mesmo/i);
    expect(insertSpy, "deixou o médico se convidar para o próprio caso").not.toHaveBeenCalled();
  });
});
