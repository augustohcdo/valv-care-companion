import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * O que esta tela precisa garantir é menos "o formulário salva" e mais três
 * regras que sustentam a confiança do médico na pesquisa da IA:
 *
 * 1. o par (pode embasar / não pode) nunca fica vazio para fabricante, que é a
 *    categoria com conflito de interesse por definição;
 * 2. desligar a última fonte de busca automática avisa **antes**, porque o
 *    sintoma depois seria "não encontrei artigo" — indistinguível de uma busca
 *    sem resultado;
 * 3. recusa do banco não vira sucesso na tela.
 */

const FONTES = [
  {
    id: "f1", domain: "pubmed.ncbi.nlm.nih.gov", name: "PubMed",
    category: "literatura", citable_for: "Artigos indexados.",
    never_for: "Resumo não é diretriz.", consulta: "automatica",
    enabled: true, notes: null,
  },
  {
    id: "f2", domain: "www.edwards.com", name: "Edwards Lifesciences",
    category: "fabricante", citable_for: "Especificação do próprio produto.",
    never_for: "Nunca para indicação.", consulta: "referencia",
    enabled: true, notes: null,
  },
];

let rows = [...FONTES];
const updateSpy = vi.fn();
const insertSpy = vi.fn();
let falhar = false;

function escrita(afetadas: number) {
  const p: any = Promise.resolve({ error: null });
  p.select = () => Promise.resolve({
    data: Array.from({ length: afetadas }, () => ({ id: "x" })), error: null,
  });
  return p;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => {
        const chain: any = { order: () => chain, then: undefined };
        chain.order = () => ({
          order: () => Promise.resolve({ data: rows, error: null }),
        });
        return chain;
      },
      update: (values: any) => ({
        eq: (_c: string, id: string) => {
          updateSpy(values, id);
          return escrita(falhar ? 0 : 1);
        },
      }),
      insert: (values: any) => {
        insertSpy(values);
        return escrita(falhar ? 0 : 1);
      },
    }),
  },
}));

vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import AdminFontes, { normalizarDominio, validarFonte } from "./AdminFontes";
import type { FormularioFonte } from "./AdminFontes";
import { logAudit } from "@/lib/auditLog";
import { toast } from "sonner";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("normalizarDominio", () => {
  it("guarda o host, não a URL colada", () => {
    // Guardar "https://www.escardio.org/" onde a cerca compara o host faria a
    // fonte nunca casar — e a falha seria silenciosa: cadastrada e ignorada.
    expect(normalizarDominio("https://www.escardio.org/guidelines")).toBe("www.escardio.org");
    expect(normalizarDominio("www.escardio.org")).toBe("www.escardio.org");
    expect(normalizarDominio("  ABCCardiol.ORG  ")).toBe("abccardiol.org");
  });

  it("recusa entrada que não vira domínio", () => {
    expect(normalizarDominio("")).toBeNull();
    expect(normalizarDominio("   ")).toBeNull();
  });
});

describe("validarFonte", () => {
  const form = (over: Partial<FormularioFonte> = {}): FormularioFonte => ({
    domain: "www.escardio.org", name: "European Society of Cardiology",
    category: "sociedade_medica", citable_for: "Diretrizes de doença valvar.",
    never_for: "", consulta: "referencia", notes: "", ...over,
  });

  it("aceita uma fonte bem descrita", () => {
    expect(validarFonte(form())).toBeNull();
  });

  it("exige domínio, nome e o que a fonte pode embasar", () => {
    expect(validarFonte(form({ domain: "  " }))?.erro).toMatch(/Domínio/);
    expect(validarFonte(form({ name: " " }))?.erro).toMatch(/nome/i);
    expect(validarFonte(form({ citable_for: "" }))?.erro).toMatch(/pode embasar/i);
  });

  /**
   * A regra que dá sentido ao "filtro forte". O fabricante vende a prótese
   * sobre a qual informa: é a melhor fonte do mundo para o diâmetro do próprio
   * anel e a pior possível para decidir a conduta. Sem o limite escrito, a
   * página dele embasaria indicação.
   */
  it("fabricante sem o limite escrito é recusado", () => {
    const r = validarFonte(form({ category: "fabricante", never_for: "" }));
    expect(r?.erro).toBe("Fabricante precisa do limite escrito");
    expect(r?.detalhe).toMatch(/NÃO pode embasar/);
  });

  it("fabricante com o limite escrito passa", () => {
    expect(validarFonte(form({
      category: "fabricante", never_for: "Nunca para indicação nem comparação entre marcas.",
    }))).toBeNull();
  });

  it("sociedade médica pode ficar sem o campo de limite", () => {
    // Só o fabricante tem conflito de interesse estrutural; exigir de todos
    // viraria campo preenchido no automático, que não protege ninguém.
    expect(validarFonte(form({ never_for: "" }))).toBeNull();
  });
});

describe("AdminFontes", () => {
  beforeEach(() => {
    rows = [...FONTES];
    falhar = false;
    vi.clearAllMocks();
  });

  it("lista as fontes dizendo quais são buscadas automaticamente", async () => {
    render(<AdminFontes />, { wrapper });
    await waitFor(() => expect(screen.getByText("PubMed")).toBeInTheDocument());
    expect(screen.getByText("busca automática")).toBeInTheDocument();
    expect(screen.getByText("aceita como referência")).toBeInTheDocument();
  });

  it("mostra o escopo de cada fonte, que é o critério do filtro", async () => {
    render(<AdminFontes />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Especificação do próprio produto/)).toBeInTheDocument());
    expect(screen.getByText(/Nunca para indicação/)).toBeInTheDocument();
  });

  it("avisa antes de desligar a última fonte de busca automática", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<AdminFontes />, { wrapper });
    await waitFor(() => expect(screen.getByText("PubMed")).toBeInTheDocument());

    // O primeiro card é o do PubMed (ordenado por categoria/nome no mock).
    fireEvent.click(screen.getAllByRole("button", { name: /Desativar/i })[0]);

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("única fonte de busca automática"));
    expect(updateSpy).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("desligar fonte de referência não pede confirmação", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AdminFontes />, { wrapper });
    await waitFor(() => expect(screen.getByText("Edwards Lifesciences")).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: /Desativar/i })[1]);

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    expect(confirm).not.toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledWith(
      "trusted_source_toggled", "trusted_sources", "f2",
      expect.objectContaining({ enabled: false }),
    );
    confirm.mockRestore();
  });

  it("recusa do banco não vira sucesso nem entra na trilha", async () => {
    falhar = true;
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AdminFontes />, { wrapper });
    await waitFor(() => expect(screen.getByText("Edwards Lifesciences")).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: /Desativar/i })[1]);

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    expect(logAudit).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("sem nenhuma fonte automática ativa, a tela avisa que a busca está desligada", async () => {
    rows = [{ ...FONTES[0], enabled: false }, FONTES[1]];
    render(<AdminFontes />, { wrapper });
    await waitFor(() =>
      expect(screen.getByText(/Nenhuma fonte de busca automática está ativa/i)).toBeInTheDocument(),
    );
  });
});
