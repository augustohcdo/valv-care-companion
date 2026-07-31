import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const REQUESTS = [
  { id: "r1", patient_id: "u1", status: "pendente", purpose: "Continuidade do cuidado", resource_scopes: ["Observation", "Condition"], created_at: "2026-07-31T10:00:00Z", hospitals: { trade_name: "Hospital Alfa", legal_name: "Alfa SA" } },
];
const GRANTS = [
  { id: "g1", patient_id: "u1", granted_at: "2026-07-20T10:00:00Z", revoked_at: null, resource_scopes: ["Observation"], direction: "inbound", hospitals: { trade_name: "Hospital Beta", legal_name: "Beta SA" } },
];

let requests = [...REQUESTS];
const updateSpy = vi.fn();
// Portão para segurar a resposta da query e observar o estado de carregamento.
let gate: Promise<void> | null = null;
let openGate: (() => void) | null = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        const chain: any = {
          eq: () => chain,
          order: () => chain,
          limit: () => chain,
          then: (res: any) => {
            const data = table === "data_access_requests" ? requests
              : table === "data_access_grants" ? GRANTS : [];
            if (gate) return gate.then(() => res({ data, error: null }));
            return res({ data, error: null });
          },
        };
        return chain;
      },
      update: (values: any) => ({
        eq: (_c: string, id: string) => {
          updateSpy(table, values, id);
          requests = requests.map((r) => (r.id === id ? { ...r, ...values } : r));
          return Promise.resolve({ error: null });
        },
      }),
    }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import PacienteIntegracoes, { patientIntegrationsKey } from "./PacienteIntegracoes";

// Um cliente por teste (recriado no beforeEach), estável entre renderizações —
// se fosse criado dentro do wrapper, cada re-render zeraria o cache.
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe("PacienteIntegracoes", () => {
  beforeEach(() => {
    requests = [...REQUESTS];
    updateSpy.mockClear();
    gate = null;
    openGate = null;
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  // O código pretende abrir na aba de pendentes quando há pedido aguardando
  // (defaultValue={pending.length ? "pendentes" : "ativos"}), mas o Tabs lê o
  // defaultValue só na primeira renderização — quando os dados ainda não
  // chegaram e pending está vazio. Resultado: a aba nunca abria sozinha.
  it("abre na aba de pendentes quando há pedido aguardando decisão", async () => {
    render(<PacienteIntegracoes />, { wrapper });
    await waitFor(() => expect(screen.getAllByText(/Hospital Alfa/).length).toBeGreaterThan(0));
    expect(screen.getByText(/Continuidade do cuidado/)).toBeInTheDocument();
  });

  it("abre na aba de acessos ativos quando não há pendências", async () => {
    requests = [];
    render(<PacienteIntegracoes />, { wrapper });
    // Hospital Beta só está no conteúdo da aba "ativos" — o Radix não monta
    // o conteúdo das abas inativas, então isso prova qual aba abriu.
    await waitFor(() => expect(screen.getByText(/Hospital Beta/)).toBeInTheDocument());
  });

  it("respeita a aba escolhida pelo paciente mesmo com pedido pendente", async () => {
    render(<PacienteIntegracoes />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Continuidade do cuidado/)).toBeInTheDocument());

    // o Radix troca a aba no mousedown, não no click
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Acessos ativos/i }));

    await waitFor(() => expect(screen.getByText(/Hospital Beta/)).toBeInTheDocument());
    expect(screen.queryByText(/Continuidade do cuidado/)).not.toBeInTheDocument();
  });

  // Mudança deliberada da migração: a tela usa `isFetching`, não `isLoading`.
  // Com `isLoading` o spinner só apareceria na primeira carga e sumiria de vez
  // — o paciente clicaria em "Aprovar" e não veria retorno visual nenhum.
  it("mostra o indicador de carregamento também nas recargas, não só na primeira", async () => {
    const { container } = render(<PacienteIntegracoes />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Continuidade do cuidado/)).toBeInTheDocument());
    expect(container.querySelector(".animate-spin")).toBeNull();

    // segura a próxima resposta e força uma recarga
    gate = new Promise<void>((r) => { openGate = r; });
    client.invalidateQueries({ queryKey: patientIntegrationsKey("u1") });

    await waitFor(() => expect(container.querySelector(".animate-spin")).not.toBeNull());

    openGate!();
    await waitFor(() => expect(container.querySelector(".animate-spin")).toBeNull());
  });

  it("a chave da query inclui o id do usuário, para não vazar cache entre contas", () => {
    expect(patientIntegrationsKey("u1")).toEqual(["patient-integrations", "u1"]);
    expect(patientIntegrationsKey("u2")).not.toEqual(patientIntegrationsKey("u1"));
  });

  it("aprovar um pedido grava a decisão e recarrega a lista", async () => {
    render(<PacienteIntegracoes />, { wrapper });
    await waitFor(() => expect(screen.getAllByText(/Hospital Alfa/).length).toBeGreaterThan(0));

    const aprovar = screen.getByRole("button", { name: /Aprovar/i });
    fireEvent.click(aprovar);

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [table, values, id] = updateSpy.mock.calls[0];
    expect(table).toBe("data_access_requests");
    expect(values).toMatchObject({ status: "aprovado" });
    expect(id).toBe("r1");
  });

  it("revogar uma autorização registra quem revogou e o motivo", async () => {
    // sem pendências a tela abre já na aba de acessos ativos
    requests = [];
    render(<PacienteIntegracoes />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Hospital Beta/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Revogar/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [table, values] = updateSpy.mock.calls[0];
    expect(table).toBe("data_access_grants");
    expect(values).toMatchObject({ revoked_by: "u1" });
    expect(values.revoked_at).toBeTruthy();
  });
});
