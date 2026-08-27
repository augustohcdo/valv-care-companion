import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CONSENT_CATALOG } from "@/lib/consent";

/**
 * O consentimento do diretório, renderizado — não varrido por texto.
 *
 * As guardas de `acessoProfissional` conferem que o formulário lê do catálogo.
 * Isto confere o outro lado: que o texto **chega à tela**. Um `CONSENTIMENTO`
 * resolvido para `undefined`, ou um `description` vazio, passaria naquelas e
 * deixaria o médico marcando uma caixa sem texto — que é aceite sem informação.
 */

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/TurnstileWidget", () => ({
  TurnstileWidget: () => <div data-testid="captcha" />,
}));

import { SolicitarAcessoForm } from "./SolicitarAcessoForm";

const def = CONSENT_CATALOG.find((c) => c.type === "directory_listing")!;

const montar = () =>
  render(
    <MemoryRouter>
      <SolicitarAcessoForm />
    </MemoryRouter>,
  );

describe("a caixa de consentimento do diretório", () => {
  it("mostra o título e o corpo que ficam registrados", () => {
    montar();
    expect(screen.getByText(def.title)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(def.description.slice(0, 45)))).toBeInTheDocument();
  });

  it("a revogação aparece em negrito", () => {
    montar();
    const frase = screen.getByText(def.destaque!);
    expect(frase.tagName.toLowerCase()).toBe("strong");
  });

  it("o texto do catálogo não está vazio — caixa sem texto é aceite sem informação", () => {
    expect(def.title.trim().length).toBeGreaterThan(20);
    expect(def.description.trim().length).toBeGreaterThan(120);
    expect(def.destaque?.trim().length ?? 0).toBeGreaterThan(20);
  });

  it("o envio fica travado enquanto a caixa não é marcada", () => {
    montar();
    const botao = screen.getByRole("button", { name: /Enviar solicitação/i });
    expect(botao).toBeDisabled();
  });
});
