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

let collabs = [...COLLABS];
let participantes: unknown[] = [...PARTICIPANTES];
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
    rpc: (nome: string) =>
      Promise.resolve(
        nome === "participantes_do_caso"
          ? { data: participantes, error: null }
          : { data: null, error: null },
      ),
    from: (table: string) => ({
      select: () => {
        const chain: any = {
          eq: () => chain,
          is: () => chain,
          in: () =>
            Promise.resolve({ data: table === "doctors" ? DOCTORS : [], error: null }),
          order: () => Promise.resolve({ data: collabs, error: null }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        };
        return chain;
      },
      insert: () => Promise.resolve({ error: null }),
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
