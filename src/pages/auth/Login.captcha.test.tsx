import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * A proteção anti-robô só é real se o token chegar ao servidor de auth: é ele
 * quem valida contra a Cloudflare. Enquanto a verificação vivia só no
 * navegador, a API de login aceitava qualquer requisição sem captcha nenhum.
 *
 * Se alguém remover o `captchaToken` do payload, nada quebra em
 * desenvolvimento — quebra em produção, calado, virando de novo uma porta
 * aberta. Este teste existe para isso não passar despercebido.
 */

const signInWithPassword = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      signInWithOAuth: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      // O redirecionamento pós-login consulta o usuário; sem isto a promessa
      // rejeita fora do teste e polui o resultado.
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) })) })),
    })),
    functions: { invoke: vi.fn().mockResolvedValue({ data: { siteKey: "0xTESTE" }, error: null }) },
  },
}));

// O widget real depende do script da Cloudflare; aqui ele só devolve um token
// assim que monta, que é o que o formulário precisa para habilitar o envio.
vi.mock("@/components/TurnstileWidget", () => ({
  TurnstileWidget: ({ onToken }: { onToken: (t: string | null) => void }) => (
    <button type="button" onClick={() => onToken("token-do-desafio")}>
      resolver captcha
    </button>
  ),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false }),
}));

import Login from "./Login";

describe("Login — o captcha vai para o servidor", () => {
  beforeEach(() => signInWithPassword.mockClear());

  it("manda o token do desafio junto das credenciais", async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("resolver captcha"));
    fireEvent.change(screen.getByLabelText(/E-mail/i), {
      target: { value: "medico@exemplo.com" },
    });
    fireEvent.change(screen.getByLabelText(/Senha/i), {
      target: { value: "SenhaForte123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Entrar/i }));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled());
    expect(signInWithPassword.mock.calls[0][0]).toMatchObject({
      email: "medico@exemplo.com",
      options: { captchaToken: "token-do-desafio" },
    });
  });

  it("não tenta autenticar antes de o desafio ser resolvido", async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/E-mail/i), {
      target: { value: "medico@exemplo.com" },
    });
    fireEvent.change(screen.getByLabelText(/Senha/i), {
      target: { value: "SenhaForte123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Entrar/i }));

    await new Promise((r) => setTimeout(r, 50));
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
