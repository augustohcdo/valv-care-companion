import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// `vi.mock` é içado para o topo do arquivo, então tudo que a fábrica usa
// precisa nascer dentro de `vi.hoisted` — senão a referência ainda não existe
// quando o módulo é substituído.
const mocks = vi.hoisted(() => ({
  /** O ouvinte registrado pela tela, para disparar o evento de recuperação. */
  ouvinte: null as ((evento: string, sessao: unknown) => void) | null,
  sessaoGuardada: null as { user: { email: string } } | null,
  unsubscribe: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (evento: string, sessao: unknown) => void) => {
        mocks.ouvinte = cb;
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      },
      getSession: () => Promise.resolve({ data: { session: mocks.sessaoGuardada } }),
      updateUser: mocks.updateUser,
      signOut: mocks.signOut,
    },
  },
}));

const { unsubscribe, updateUser, signOut } = mocks;

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import RedefinirSenha from "./RedefinirSenha";

const renderTela = () =>
  render(
    <MemoryRouter initialEntries={["/auth/redefinir"]}>
      <RedefinirSenha />
    </MemoryRouter>,
  );

/** Passa o prazo de espera pelo evento de recuperação. */
const esperarPrazo = async () => {
  await act(async () => {
    vi.advanceTimersByTime(2100);
  });
};

const recuperacaoChega = async (email: string) => {
  await act(async () => {
    mocks.ouvinte?.("PASSWORD_RECOVERY", { user: { email } });
  });
};

// Os `Label` do shadcn não carregam `htmlFor`, então não dá para achar os
// campos pelo rótulo — vão pelo tipo mesmo.
const preencher = (senha: string) => {
  const campos = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
  expect(campos).toHaveLength(2);
  campos.forEach((campo) => fireEvent.change(campo, { target: { value: senha } }));
};

describe("RedefinirSenha", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mocks.ouvinte = null;
    mocks.sessaoGuardada = null;
    window.location.hash = "";
    vi.clearAllMocks();
    updateUser.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    window.location.hash = "";
  });

  /**
   * O incidente real, em produção, duas vezes na mesma noite.
   *
   * O link de recuperação do admin foi consumido no servidor, a tela abriu sem
   * sessão de recuperação, e `updateUser` caiu na sessão de **médico** que o
   * navegador ainda guardava. Outra conta, outro dono — e a tela respondeu
   * "Senha atualizada".
   */
  it("sem evento de recuperação, não mostra o formulário nem escreve nada", async () => {
    mocks.sessaoGuardada = { user: { email: "medico@exemplo.com" } };
    renderTela();
    await esperarPrazo();

    expect(screen.getByText(/Link não validado/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Atualizar senha/i })).not.toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("nomeia a conta conectada que NÃO será alterada", async () => {
    mocks.sessaoGuardada = { user: { email: "medico@exemplo.com" } };
    renderTela();
    await esperarPrazo();

    await waitFor(() => expect(screen.getByText("medico@exemplo.com")).toBeInTheDocument());
    // O `<strong>` no meio parte o texto entre elementos, então a asserção vai
    // no texto normalizado do documento.
    const aviso = document.body.textContent?.replace(/\s+/g, " ") ?? "";
    expect(aviso).toMatch(/não vai alterar a senha dessa conta/i);
  });

  // O Supabase devolve isso no fragmento quando o link já foi usado — foi
  // exatamente o caso, porque o clique anterior tinha sido consumido no
  // servidor enquanto a rota devolvia 404. A tela ignorava e desenhava o
  // formulário como se estivesse tudo bem.
  it("link expirado ou já usado é dito com todas as letras", async () => {
    window.location.hash = "#error=access_denied&error_code=otp_expired";
    renderTela();
    await esperarPrazo();

    expect(screen.getByText(/expirou ou já foi usado/i)).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("com recuperação válida, mostra de qual conta é a senha antes de pedir os campos", async () => {
    renderTela();
    await recuperacaoChega("admin@exemplo.com");

    expect(screen.getByText("admin@exemplo.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Atualizar senha/i })).toBeInTheDocument();
  });

  it("com recuperação válida, atualiza a senha e encerra a sessão de recuperação", async () => {
    renderTela();
    await recuperacaoChega("admin@exemplo.com");

    preencher("SenhaBoa123");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Atualizar senha/i }));
    });

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: "SenhaBoa123" }));
    // Deixar a sessão de recuperação viva daria acesso à conta sem ninguém ter
    // digitado a senha nova.
    expect(signOut).toHaveBeenCalled();
  });

  it("cancela a inscrição do ouvinte ao desmontar", async () => {
    const { unmount } = renderTela();
    await recuperacaoChega("admin@exemplo.com");
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
