import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * O que a pessoa lê depois de encerrar a conta — renderizado de verdade.
 *
 * A tela promete, na lista do "O que é apagado" e antes de qualquer clique:
 *
 *   > "Acesso à conta: o login deixa de funcionar **e as sessões abertas caem**"
 *
 * Essa promessa tem uma etapa que pode falhar sozinha. A função de
 * encerramento devolve `sessoes_derrubadas`, e o "Conta encerrada" sem
 * ressalva, dito sobre uma resposta em que ela é `false`, é a promessa acima
 * sendo quebrada em silêncio — com o agravante de que quem leu a lista tem
 * motivo para acreditar.
 *
 * Os dois sentidos são cobrados: a ressalva aparece quando precisa, e NÃO
 * aparece quando não precisa. Sem a segunda metade, um componente que avisasse
 * sempre passaria — e avisar sempre é a mesma coisa que não avisar.
 */

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => mocks.invoke(...a) } },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { EncerrarContaDialog } from "./EncerrarContaDialog";
import { toast } from "sonner";

const abrirEConfirmar = async () => {
  fireEvent.click(screen.getByRole("button", { name: /Encerrar conta/i }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Encerrar definitivamente/i })).toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: /Encerrar definitivamente/i }));
};

describe("EncerrarContaDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("diz que as sessões abertas caem — e é essa promessa que o resto cobra", async () => {
    render(<EncerrarContaDialog />);
    fireEvent.click(screen.getByRole("button", { name: /Encerrar conta/i }));
    await waitFor(() =>
      expect(screen.getByText(/as sessões abertas caem/i)).toBeInTheDocument(),
    );
  });

  it("com as sessões derrubadas, anuncia sucesso sem ressalva", async () => {
    mocks.invoke.mockResolvedValue({
      data: { ok: true, relatorio: {}, sessoes_derrubadas: true },
      error: null,
    });
    render(<EncerrarContaDialog />);
    await abrirEConfirmar();

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(
      toast.warning,
      "avisou de uma ressalva que não existe — avisar sempre é não avisar",
    ).not.toHaveBeenCalled();
  });

  it("com as sessões DE PÉ, não diz só 'Conta encerrada'", async () => {
    // A forma de falha que este teste existe para impedir: a etapa falhou, a
    // conta está encerrada e banida, mas quem tinha sessão aberta continua
    // dentro até o token expirar. Dizer só "Conta encerrada" é repetir a
    // promessa da lista sobre o que não aconteceu.
    mocks.invoke.mockResolvedValue({
      data: { ok: true, relatorio: {}, sessoes_derrubadas: false },
      error: null,
    });
    render(<EncerrarContaDialog />);
    await abrirEConfirmar();

    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
    expect(
      toast.success,
      "anunciou sucesso liso sobre um encerramento com etapa pendente",
    ).not.toHaveBeenCalled();

    const [titulo, opcoes] = (toast.warning as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0] as [string, { description?: string }];
    expect(titulo).toMatch(/ressalva/i);
    expect(
      opcoes?.description,
      "a ressalva precisa dizer o que ficou de pé e até quando",
    ).toMatch(/sess/i);
  });

  it("uma recusa da função não vira sucesso", async () => {
    // A guarda que já existia no componente, coberta para não se perder: a
    // função devolve `{ error }` no corpo em recusas de regra (única conta de
    // administrador, por exemplo), com `error` de transporte nulo.
    mocks.invoke.mockResolvedValue({
      data: { error: "rpc_failed", detail: "é a única conta de administrador" },
      error: null,
    });
    render(<EncerrarContaDialog />);
    await abrirEConfirmar();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("sem `sessoes_derrubadas` na resposta, não inventa ressalva", async () => {
    // Uma função ainda não implantada não devolve o campo. `undefined` não é
    // `false`: não dá para afirmar que as sessões ficaram de pé sem ter lido
    // que ficaram. A distinção entre "não" e "não sei" é a mesma da sessão
    // inteira, aplicada ao campo novo.
    mocks.invoke.mockResolvedValue({ data: { ok: true, relatorio: {} }, error: null });
    render(<EncerrarContaDialog />);
    await abrirEConfirmar();

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(toast.warning).not.toHaveBeenCalled();
  });
});
