import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * A tela da transparência não pode dizer "Ativo" sobre um texto que a pessoa
 * não aceitou.
 *
 * ## O defeito, na tela
 *
 * O painel renderiza `def.description` — o texto VIGENTE do catálogo — e, logo
 * abaixo, "Aceito em <data> · versão 2.2", com o selo verde **Ativo** ao lado.
 * Quem lê conclui que aceitou aquele texto.
 *
 * No `ai_processing` o texto mudou de sentido: a versão anterior dizia que os
 * dados iam ao Google "sem meu nome", e isso era falso para o caminho do laudo
 * anexado, que vai inteiro — com nome, data de nascimento e número de registro
 * impressos. O texto novo diz as duas coisas separadas.
 *
 * Esta é a tela em que o titular exerce o direito de acesso do art. 18 e vê a
 * que consentiu. Afirmar "Ativo" sobre um processamento descrito por um texto
 * que ele nunca aceitou é o controlador afirmando um consentimento que não tem
 * — e o art. 8º §2º põe o ônus de provar sobre ele.
 *
 * ## Por que teste de RENDERIZAÇÃO
 *
 * Varredura de texto no JSX diria que o arquivo menciona a versão. O que
 * importa é que a frase CHEGUE À TELA, e com o selo certo ao lado. É o mesmo
 * motivo do teste do formulário do diretório: "as guardas conferem que o
 * formulário lê do catálogo; isto confere o outro lado, que o texto chega à
 * tela".
 */

const mocks = vi.hoisted(() => ({
  consents: [] as unknown[],
  perfil: { account_type: "medico" } as Record<string, unknown> | null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (tabela: string) => {
      const resposta = tabela === "user_consents"
        ? { data: mocks.consents, error: null }
        : { data: [], error: null };
      const encadeado = {
        select: () => encadeado,
        eq: () => encadeado,
        order: () => encadeado,
        limit: () => Promise.resolve(resposta),
        then: (f: (r: unknown) => unknown) => Promise.resolve(resposta).then(f),
      };
      return encadeado;
    },
    rpc: vi.fn(),
  },
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, profile: mocks.perfil }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { PrivacyPreferencesPanel } from "./PrivacyPreferencesPanel";
import { CONSENT_CATALOG, versaoDoConsentimento } from "@/lib/consent";

const VIGENTE = versaoDoConsentimento("ai_processing");

function linhaDeIA(document_version: string, extra: Record<string, unknown> = {}) {
  return {
    consent_type: "ai_processing",
    granted: true,
    granted_at: "2026-09-01T10:00:00Z",
    revoked_at: null,
    document_version,
    updated_at: "2026-09-01T10:00:00Z",
    ...extra,
  };
}

const montar = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PrivacyPreferencesPanel />
    </QueryClientProvider>,
  );
};

describe("o painel de privacidade e a versão aceita", () => {
  beforeEach(() => {
    mocks.consents = [];
    mocks.perfil = { account_type: "medico" };
  });

  it("a premissa: o `ai_processing` tem versão própria e texto que fala do laudo", () => {
    /**
     * Sem isto, o cenário abaixo poderia estar comparando a versão global com
     * ela mesma e passando por construção.
     */
    const def = CONSENT_CATALOG.find((c) => c.type === "ai_processing");
    expect(def?.version, "`ai_processing` perdeu a versão própria").toBeTruthy();
    expect(def?.description).toMatch(/enviado como está/);
  });

  it("O DEFEITO: aceite de versão anterior não sai como `Ativo`", async () => {
    const [maior, menor] = VIGENTE.split(".").map(Number);
    const anterior = `${maior}.${Math.max(0, (menor ?? 1) - 1)}`;
    mocks.consents = [linhaDeIA(anterior)];
    montar();

    await waitFor(() => expect(screen.getByText("Processamento por IA clínica")).toBeInTheDocument());
    expect(
      screen.getByText("Precisa confirmar"),
      "o aceite de uma versão anterior continua saindo como Ativo",
    ).toBeInTheDocument();
    // E a tela diz que o texto exibido não é o que a pessoa aceitou.
    expect(
      screen.getByText(new RegExp(`o texto acima é a versão ${VIGENTE.replace(".", "\\.")}`)),
    ).toBeInTheDocument();
    // E diz o que fazer: marcar o problema sem caminho de saída é meio aviso.
    expect(screen.getByText(/Desligue e ligue de novo/)).toBeInTheDocument();
  });

  it("aceite na versão vigente sai como `Ativo`, sem alarme", async () => {
    /**
     * O outro lado, e decide se a tela sobrevive: falso vermelho custa o mesmo
     * que falso verde. Um painel que avisa sobre quem está em ordem é um painel
     * que a pessoa aprende a ignorar — inclusive quando o aviso for verdadeiro.
     */
    mocks.consents = [linhaDeIA(VIGENTE)];
    montar();

    await waitFor(() => expect(screen.getByText("Processamento por IA clínica")).toBeInTheDocument());
    expect(screen.queryByText("Precisa confirmar")).not.toBeInTheDocument();
    expect(screen.getAllByText("Ativo").length).toBeGreaterThan(0);
  });

  it("versão POSTERIOR à vigente também sai como `Ativo`", async () => {
    // Frontend publicado antes das functions, ou texto re-versionado depois do
    // aceite: quem consentiu com o texto MAIS completo não pode ser cobrado.
    const [maior, menor] = VIGENTE.split(".").map(Number);
    mocks.consents = [linhaDeIA(`${maior}.${(menor ?? 0) + 1}`)];
    montar();

    await waitFor(() => expect(screen.getByText("Processamento por IA clínica")).toBeInTheDocument());
    expect(screen.queryByText("Precisa confirmar")).not.toBeInTheDocument();
  });

  it("consentimento revogado não ganha o aviso de versão", async () => {
    /**
     * "Retirado" e "o texto mudou" são estados diferentes, e empilhá-los diria
     * à pessoa para confirmar um texto de um consentimento que ela desligou de
     * propósito.
     */
    const [maior, menor] = VIGENTE.split(".").map(Number);
    mocks.consents = [
      linhaDeIA(`${maior}.${Math.max(0, (menor ?? 1) - 1)}`, {
        granted: false, revoked_at: "2026-10-01T10:00:00Z",
      }),
    ];
    montar();

    await waitFor(() => expect(screen.getByText("Processamento por IA clínica")).toBeInTheDocument());
    expect(screen.queryByText("Precisa confirmar")).not.toBeInTheDocument();
    expect(screen.getByText(/Revogado em/)).toBeInTheDocument();
  });

  it("sem nenhum registro, a tela não inventa versão nem alarme", async () => {
    mocks.consents = [];
    montar();

    await waitFor(() => expect(screen.getByText("Processamento por IA clínica")).toBeInTheDocument());
    expect(screen.queryByText("Precisa confirmar")).not.toBeInTheDocument();
    expect(screen.queryByText(/o texto acima é a versão/)).not.toBeInTheDocument();
  });

  it("o texto que a tela mostra é o do catálogo, não uma redação própria", async () => {
    // O muro do painel de IA tinha a sua, e ela afirmava que o nome não é
    // enviado — a frase que esta base tirou do catálogo por ser falsa.
    mocks.consents = [linhaDeIA(VIGENTE)];
    montar();

    const def = CONSENT_CATALOG.find((c) => c.type === "ai_processing")!;
    await waitFor(() =>
      expect(screen.getByText(def.description, { exact: false })).toBeInTheDocument(),
    );
  });
});
