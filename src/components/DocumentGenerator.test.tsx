import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * O documento que o médico copia para o prontuário.
 *
 * ## O que faltava
 *
 * A `clinical-ai` devolve `sources` em todos os modos menos o de orientação de
 * alta, e cada fonte traz `review_status`. O `ClinicalAIPanel`, ao lado, marca
 * cada trecho preliminar com "· gerado por IA ·" — marcação **estrutural**,
 * que não depende de o modelo ter obedecido à instrução do prompt.
 *
 * Esta tela descartava `sources` por inteiro. O médico gerava o documento,
 * clicava em Copiar e colava no prontuário um texto que podia se apoiar em
 * trechos gerados por IA a partir de diretriz e **ainda não revisados por
 * médico** — sem nada dizendo isso. A única marcação possível era a que o
 * próprio modelo tivesse escrito, que é esperança, não garantia.
 *
 * ## E por que o aviso precisa ir no TEXTO
 *
 * O aviso na tela não viaja com o documento. Quem copia leva só o texto, e o
 * prontuário é onde a afirmação passa a valer. Por isso a ressalva é
 * acrescentada ao que vai para a área de transferência — como o modelo de
 * evolução manual já fazia com o "revisar antes de arquivar".
 */

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  consent: vi.fn(),
  escrito: [] as string[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => mocks.invoke(...a) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
    }),
  },
}));
vi.mock("@/lib/consent", () => ({ hasActiveConsent: () => mocks.consent() }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), message: vi.fn() },
}));

import { DocumentGenerator } from "./DocumentGenerator";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const CASO = {
  id: "c1", patient_name: "Paciente Teste", valve_type: "aortica",
  valve_disease: "estenose", severity: "grave", ejection_fraction: 55,
};

const FONTE_REVISADA = {
  title: "ESC/EACTS 2025", organization: "ESC/EACTS", year: 2025,
  scope: "int", url: null, similarity: 0.9, review_status: "reviewed",
};
const FONTE_PRELIMINAR = {
  title: "SBC 2024", organization: "SBC", year: 2024,
  scope: "br", url: null, similarity: 0.8, review_status: "ai_generated",
};

const gerar = async () => {
  fireEvent.click(screen.getByRole("button", { name: /Nota de Consulta/i }));
};

describe("DocumentGenerator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.escrito = [];
    mocks.consent.mockResolvedValue(true);
    Object.assign(navigator, {
      clipboard: {
        writeText: (t: string) => { mocks.escrito.push(t); return Promise.resolve(); },
      },
    });
  });

  it("avisa na tela quando o documento se apoia em base preliminar", async () => {
    mocks.invoke.mockResolvedValue({
      data: { content: "Conduta sugerida: acompanhamento semestral.", sources: [FONTE_PRELIMINAR] },
      error: null,
    });
    render(<DocumentGenerator caso={CASO} />, { wrapper });
    await gerar();

    await waitFor(() => expect(screen.getByText(/Apoiado em base preliminar/i)).toBeInTheDocument());
    expect(
      screen.getByText(/ainda não foram revisados por médico/i),
      "a frase precisa dizer o que 'preliminar' significa",
    ).toBeInTheDocument();
    expect(screen.getByText(/SBC 2024/), "e qual fonte é").toBeInTheDocument();
  });

  it("a ressalva vai junto no texto COPIADO — é ele que chega ao prontuário", async () => {
    mocks.invoke.mockResolvedValue({
      data: { content: "Conduta sugerida: acompanhamento semestral.", sources: [FONTE_PRELIMINAR] },
      error: null,
    });
    render(<DocumentGenerator caso={CASO} />, { wrapper });
    await gerar();
    await waitFor(() => expect(screen.getByText(/Apoiado em base preliminar/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Copiar Texto/i }));
    await waitFor(() => expect(mocks.escrito.length).toBe(1));

    const copiado = mocks.escrito[0];
    expect(copiado, "o documento em si precisa continuar ali").toContain("acompanhamento semestral");
    expect(
      copiado,
      "sem isto, o aviso fica na tela e o prontuário recebe o texto limpo",
    ).toMatch(/PRELIMINAR/);
    expect(copiado).toMatch(/NÃO revisados por/i);
    expect(copiado).toContain("SBC 2024");
  });

  it("não inventa ressalva quando todas as fontes são revisadas", async () => {
    // Avisar sempre é a mesma coisa que não avisar: o médico aprende a pular a
    // faixa vermelha, e ela deixa de significar o que significa.
    mocks.invoke.mockResolvedValue({
      data: { content: "Conduta sugerida: acompanhamento semestral.", sources: [FONTE_REVISADA] },
      error: null,
    });
    render(<DocumentGenerator caso={CASO} />, { wrapper });
    await gerar();
    await waitFor(() => expect(screen.getByLabelText(/editável/i)).toHaveValue(
      "Conduta sugerida: acompanhamento semestral.",
    ));

    expect(screen.queryByText(/Apoiado em base preliminar/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Copiar Texto/i }));
    await waitFor(() => expect(mocks.escrito.length).toBe(1));
    expect(mocks.escrito[0], "acrescentou ressalva sobre fonte revisada")
      .toBe("Conduta sugerida: acompanhamento semestral.");
  });

  it("uma resposta sem `sources` não vira alarme nem vira silêncio enganoso", async () => {
    // Sem campo `sources` não dá para afirmar que há trecho preliminar — e
    // inventar o aviso seria afirmar sobre o que não se leu. O documento sai
    // com o aviso genérico que a tela já traz ("Revise antes de anexar").
    mocks.invoke.mockResolvedValue({ data: { content: "Texto." }, error: null });
    render(<DocumentGenerator caso={CASO} />, { wrapper });
    await gerar();
    await waitFor(() => expect(screen.getByLabelText(/editável/i)).toHaveValue("Texto."));
    expect(screen.queryByText(/Apoiado em base preliminar/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Revise antes de anexar ao prontuário/i),
      "o aviso geral da tela continua valendo para todo documento",
    ).toBeInTheDocument();
  });

  it("documento truncado E preliminar leva as duas ressalvas no texto", async () => {
    mocks.invoke.mockResolvedValue({
      data: { content: "Conduta sugerida:", sources: [FONTE_PRELIMINAR], truncado: true },
      error: null,
    });
    render(<DocumentGenerator caso={CASO} />, { wrapper });
    await gerar();
    await waitFor(() => expect(screen.getByText(/Documento incompleto/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Copiar Texto/i }));
    await waitFor(() => expect(mocks.escrito.length).toBe(1));
    expect(mocks.escrito[0]).toMatch(/INCOMPLETO/);
    expect(mocks.escrito[0]).toMatch(/PRELIMINAR/);
  });
});
