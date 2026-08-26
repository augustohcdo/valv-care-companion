import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const COMMENTS = [
  { id: "cm1", case_id: "c1", author_id: "u1", body: "Gradiente em progressão.", is_heart_team_decision: false, created_at: "2026-07-30T10:00:00Z", deleted_at: null },
  { id: "cm2", case_id: "c1", author_id: "u2", body: "Indicação de TAVI.", is_heart_team_decision: true, created_at: "2026-07-31T10:00:00Z", deleted_at: null },
];
/**
 * O que o RPC `participantes_do_caso` devolve. Antes este teste simulava duas
 * consultas — `profiles` e `doctors` — e passava; mas `profiles` de outra
 * pessoa **sempre volta vazio** na RLS real, então o teste verde escondia uma
 * tela que exibia "Dr(a). Médico" em produção. O mock agora tem a forma do que
 * o banco de verdade responde.
 */
const PARTICIPANTES = [
  { user_id: "u1", full_name: "Ana Souza", crm: null, crm_uf: null, specialty: null },
  { user_id: "u2", full_name: "Bruno Lima", crm: "654321", crm_uf: "RJ", specialty: "Cardiologia" },
];

let comments = [...COMMENTS];
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
    from: (_table: string) => ({
      select: () => {
        const chain: any = {
          eq: () => chain,
          is: () => chain,
          in: () => Promise.resolve({ data: [], error: null }),
          order: () => Promise.resolve({ data: comments, error: null }),
        };
        return chain;
      },
      insert: () => Promise.resolve({ error: null }),
      update: (values: any) => ({
        eq: (col: string, val: any) => {
          updateSpy(values, col, val);
          comments = comments.filter((c) => c.id !== val);
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

import { CaseDiscussion } from "./CaseDiscussion";
import { logAudit } from "@/lib/auditLog";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const renderComp = (props = {}) =>
  render(<CaseDiscussion caseId="c1" canComment {...props} />, { wrapper });

describe("CaseDiscussion", () => {
  beforeEach(() => {
    comments = [...COMMENTS];
    participantes = [...PARTICIPANTES];
    updateSpy.mockClear();
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("lista os comentários do caso", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText("Gradiente em progressão.")).toBeInTheDocument());
    expect(screen.getByText("Indicação de TAVI.")).toBeInTheDocument();
  });

  // Nome e CRM vêm de duas consultas separadas (profiles e doctors) e são
  // casados por author_id dentro da query — trocar essa junção misturaria a
  // autoria de opiniões clínicas entre médicos.
  it("resolve o autor de cada comentário pelo RPC do caso", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText(/Ana Souza/)).toBeInTheDocument());
    expect(screen.getByText(/Bruno Lima/)).toBeInTheDocument();
    // só o u2 tem registro de médico
    expect(screen.getByText("CRM 654321/RJ")).toBeInTheDocument();
  });

  it("sem nome resolvido, diz que não identificou — não inventa um", async () => {
    // O defeito que motivou a rodada: a tela caía em `|| "Médico"` e toda
    // opinião do caso ficava assinada por alguém chamado "Médico".
    participantes = [];
    renderComp();
    await waitFor(() => expect(screen.getAllByText("autor não identificado").length).toBe(2));
    expect(screen.queryByText(/Dr\(a\)\. Médico$/)).toBeNull();
  });

  it("destaca a decisão de Heart Team", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText(/Decisão Heart Team/)).toBeInTheDocument());
  });

  it("mostra estado vazio quando não há discussão", async () => {
    comments = [];
    renderComp();
    await waitFor(() => expect(screen.getByText(/Sem discussão ainda/i)).toBeInTheDocument());
  });

  it("só oferece excluir no comentário do próprio usuário", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText("Gradiente em progressão.")).toBeInTheDocument());
    // dois comentários na tela, mas só um é do usuário logado (u1)
    const destructive = screen
      .queryAllByRole("button")
      .filter((b) => b.className.includes("text-destructive"));
    expect(destructive).toHaveLength(1);
  });

  it("excluir faz soft-delete e registra auditoria", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText("Gradiente em progressão.")).toBeInTheDocument());

    fireEvent.click(
      screen.queryAllByRole("button").filter((b) => b.className.includes("text-destructive"))[0],
    );

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [values, col, val] = updateSpy.mock.calls[0];
    expect(values).toHaveProperty("deleted_at");
    expect(values.deleted_at).toBeTruthy();
    expect(col).toBe("id");
    expect(val).toBe("cm1");
    expect(logAudit).toHaveBeenCalledWith(
      "comment_deleted", "case_comments", "cm1", expect.objectContaining({ case_id: "c1" }),
    );

    await waitFor(() =>
      expect(screen.queryByText("Gradiente em progressão.")).not.toBeInTheDocument(),
    );
  });

  it("sem permissão de comentar, esconde o formulário e avisa que é somente leitura", async () => {
    renderComp({ canComment: false });
    await waitFor(() => expect(screen.getByText("Indicação de TAVI.")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Enviar/i })).not.toBeInTheDocument();
    expect(screen.getByText(/acesso somente leitura/i)).toBeInTheDocument();
  });
});
