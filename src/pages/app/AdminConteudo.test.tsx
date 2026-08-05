import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  revisar: vi.fn(),
  permissao: { pode: true, motivo: null as string | null, revisor: "Dra. Fulana", crm: "12345/SP" },
  trechos: [] as unknown[],
  selos: [] as unknown[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (nome: string, args?: unknown) => {
      if (nome === "posso_revisar_conteudo") {
        return Promise.resolve({ data: [mocks.permissao], error: null });
      }
      return mocks.revisar(nome, args);
    },
    from: (tabela: string) => ({
      select: () => {
        const dados = tabela === "knowledge_chunks" ? mocks.trechos : mocks.selos;
        const chain: Record<string, unknown> = {
          order: () => Promise.resolve({ data: dados, error: null }),
          eq: () => Promise.resolve({ data: dados, error: null }),
        };
        return chain;
      },
    }),
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AdminConteudo from "./AdminConteudo";
import { toast } from "sonner";

const trecho = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  topic: "Estenose aórtica",
  section: "Indicação cirúrgica",
  content: "Texto integral do trecho que alimenta a IA clínica.",
  review_status: "ai_generated",
  knowledge_sources: { title: "Diretriz", organization: "SBC", year: 2024, url: null },
  ...over,
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const renderTela = () => render(<AdminConteudo />, { wrapper });

describe("AdminConteudo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.revisar.mockResolvedValue({ error: null });
    mocks.permissao = { pode: true, motivo: null, revisor: "Dra. Fulana", crm: "12345/SP" };
    mocks.trechos = [trecho()];
    mocks.selos = [];
  });

  it("mostra o texto integral do trecho — revisar sem ler seria o mesmo defeito", async () => {
    renderTela();
    await waitFor(() =>
      expect(screen.getByText(/Texto integral do trecho/)).toBeInTheDocument(),
    );
    expect(screen.getByText("Estenose aórtica")).toBeInTheDocument();
  });

  /**
   * A regra central desta tela: a identidade do revisor vem do banco, e quem
   * não tem CRM verificado não aprova nada. Sem isso, marcar "revisado por
   * médico" seria fabricar autoridade clínica.
   */
  it("sem CRM verificado, não oferece aprovação e explica o motivo", async () => {
    mocks.permissao = {
      pode: false,
      motivo: "aprovar conteudo clinico exige registro de medico com CRM verificado",
      revisor: null,
      crm: null,
    };
    renderTela();

    await waitFor(() => expect(screen.getByText(/Você pode ler, mas não aprovar/)).toBeInTheDocument());
    expect(screen.getByText(/CRM verificado/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marcar como revisado/i })).not.toBeInTheDocument();
  });

  it("diz em nome de quem a aprovação será registrada", async () => {
    renderTela();
    await waitFor(() => expect(screen.getByText("Dra. Fulana")).toBeInTheDocument());
    expect(screen.getByText(/CRM 12345\/SP/)).toBeInTheDocument();
  });

  // A confirmação é a fricção deliberada antes de uma afirmação clínica.
  it("o botão só habilita depois da confirmação de leitura", async () => {
    renderTela();
    await waitFor(() => expect(screen.getByText("Estenose aórtica")).toBeInTheDocument());

    const botao = screen.getByRole("button", { name: /Marcar como revisado/i });
    expect(botao).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(botao).toBeEnabled());
  });

  it("aprovar chama o RPC com o trecho e as notas", async () => {
    renderTela();
    await waitFor(() => expect(screen.getByText("Estenose aórtica")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Notas da revisão/i), {
      target: { value: "Confere com a diretriz." },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Marcar como revisado/i }));

    await waitFor(() =>
      expect(mocks.revisar).toHaveBeenCalledWith("revisar_trecho", {
        _chunk_id: "c1",
        _aprovar: true,
        _notas: "Confere com a diretriz.",
      }),
    );
  });

  it("recusa do banco não vira sucesso na tela", async () => {
    mocks.revisar.mockResolvedValue({
      error: { message: "aprovar conteudo clinico exige registro de medico com CRM verificado" },
    });
    renderTela();
    await waitFor(() => expect(screen.getByText("Estenose aórtica")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Marcar como revisado/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("trecho já revisado mostra quem revisou e oferece revogar", async () => {
    mocks.trechos = [trecho({ review_status: "reviewed" })];
    mocks.selos = [
      {
        content_key: "c1",
        reviewer_name: "Dr. Beltrano",
        reviewer_crm: "999",
        reviewer_crm_uf: "RJ",
        reviewed_at: "2026-08-05T00:00:00Z",
        notes: "Confere.",
      },
    ];
    renderTela();

    await waitFor(() => expect(screen.getByText(/Dr\. Beltrano — CRM 999\/RJ/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Revogar revisão/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marcar como revisado/i })).not.toBeInTheDocument();
  });
});
