import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

let ERRORS: Record<string, unknown>[] = [];

const erro = (over: Record<string, unknown> = {}) => ({
  id: "e1",
  source: "edge_function",
  context: "clinical-ai",
  message: "Boom",
  stack: "at x",
  created_at: "2026-08-01T10:00:00Z",
  last_seen_at: "2026-08-01T10:00:00Z",
  occurrences: 1,
  metadata: null,
  ...over,
});

// portão para segurar a resposta e observar o estado de carregamento
let gate: Promise<void> | null = null;
let openGate: (() => void) | null = null;

// execuções bem sucedidas devolvidas pelo banco fake
let jobRuns: Record<string, unknown>[] = [];

const run = (job: string, daysAgo: number, extra: Record<string, unknown> = {}) => ({
  job,
  finished_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  items_ok: 22,
  items_failed: 0,
  details: { total_rows: 5 },
  ...extra,
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        const chain: any = {
          eq: () => chain,
          order: () => chain,
          limit: () => {
            if (table === "job_runs") return Promise.resolve({ data: jobRuns, error: null });
            return gate ? gate.then(() => ({ data: ERRORS, error: null })) : Promise.resolve({ data: ERRORS, error: null });
          },
        };
        return chain;
      },
    }),
  },
}));

import AdminErrors from "./AdminErrors";

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe("AdminErrors", () => {
  beforeEach(() => {
    gate = null;
    openGate = null;
    jobRuns = [run("weekly-export", 1), run("weekly-digest", 1, { items_ok: 3, details: null })];
    ERRORS = [erro()];
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    vi.clearAllMocks();
  });

  it("lista os erros capturados", async () => {
    render(<AdminErrors />, { wrapper });
    await waitFor(() => expect(screen.getByText("Boom")).toBeInTheDocument());
    expect(screen.getByText("clinical-ai")).toBeInTheDocument();
  });

  // A tela tem duas noções de "carregando": o spinner da lista (primeira
  // carga) e o do botão (recarga manual). Com um estado só, o botão parava de
  // dar retorno visual depois da primeira vez.
  it("o botão Atualizar gira durante a recarga, não só na primeira carga", async () => {
    render(<AdminErrors />, { wrapper });
    await waitFor(() => expect(screen.getByText("Boom")).toBeInTheDocument());

    const botao = screen.getByRole("button", { name: /Atualizar/i });
    expect(botao).not.toBeDisabled();

    gate = new Promise<void>((r) => { openGate = r; });
    fireEvent.click(botao);

    await waitFor(() => expect(screen.getByRole("button", { name: /Atualizar/i })).toBeDisabled());

    openGate!();
    await waitFor(() => expect(screen.getByRole("button", { name: /Atualizar/i })).not.toBeDisabled());
  });

  // 20 repetições idênticas foram tudo o que esta tabela recebeu na vida real.
  // Listadas uma a uma, empurram qualquer outro erro para fora da janela.
  it("agrupa repetições num contador em vez de listar linha a linha", async () => {
    ERRORS = [erro({ occurrences: 20, last_seen_at: "2026-08-01T10:00:06Z" })];
    render(<AdminErrors />, { wrapper });
    await waitFor(() => expect(screen.getByText("×20")).toBeInTheDocument());
    expect(screen.getByText(/1ª vez:/)).toBeInTheDocument();
    expect(screen.getAllByText("Boom")).toHaveLength(1);
  });

  it("não polui a linha com contador quando o erro aconteceu uma vez só", async () => {
    render(<AdminErrors />, { wrapper });
    await waitFor(() => expect(screen.getByText("Boom")).toBeInTheDocument());
    expect(screen.queryByText(/^×/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1ª vez:/)).not.toBeInTheDocument();
  });

  // Num "Script error." o navegador não manda stack; a origem é a única pista.
  it("mostra de onde o erro veio quando o navegador informou", async () => {
    ERRORS = [erro({ metadata: { filename: "https://valvepath.com.br/assets/x.js", lineno: 42 } })];
    render(<AdminErrors />, { wrapper });
    await waitFor(() =>
      expect(screen.getByText("https://valvepath.com.br/assets/x.js:42")).toBeInTheDocument(),
    );
  });

  it("mostra cada tarefa agendada em dia, com os números próprios de cada uma", async () => {
    render(<AdminErrors />, { wrapper });
    await waitFor(() => expect(screen.getByText("Backup semanal")).toBeInTheDocument());
    expect(screen.getByText("Resumo semanal do médico")).toBeInTheDocument();
    expect(screen.getByText(/22 tabelas, 5 registros/)).toBeInTheDocument();
    expect(screen.getByText(/3 médico\(s\) notificado\(s\)/)).toBeInTheDocument();
  });

  // Este é o estado que a tela precisava ter mostrado durante semanas: a tarefa
  // estava agendada, "ativa", e nunca tinha produzido nada.
  it("alarma quando uma tarefa nunca executou", async () => {
    jobRuns = [];
    render(<AdminErrors />, { wrapper });
    await waitFor(() =>
      expect(screen.getAllByText(/Nunca executou com sucesso/)).toHaveLength(2),
    );
  });

  // A regressão que motivou generalizar a tabela: com o alarme preso ao
  // backup, o resumo semanal podia parar de rodar sem ninguém ver.
  it("alarma a tarefa atrasada sem contaminar a que está em dia", async () => {
    jobRuns = [run("weekly-export", 1), run("weekly-digest", 20, { items_ok: 3 })];
    render(<AdminErrors />, { wrapper });

    await waitFor(() => expect(screen.getByText(/Última execução há 20 dia/)).toBeInTheDocument());
    expect(screen.getByText(/Última execução há 1 dia/)).toBeInTheDocument();
    // só uma das duas passou do prazo
    expect(screen.getAllByText(/Passou do prazo/)).toHaveLength(1);
  });
});
