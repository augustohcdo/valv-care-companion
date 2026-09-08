import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";

/**
 * `profileError`: distinguir "não tem perfil" de "não consegui ler o perfil".
 *
 * ## Por que a distinção importa
 *
 * `profile` nulo por erro de rede fazia a interface tratar a pessoa como conta
 * sem cadastro. Quem consome o contexto precisa poder dizer "não consegui ler"
 * em vez de agir como se não houvesse nada.
 *
 * ## E a regra que não tem outra prova
 *
 * Na releitura, o perfil anterior **não é descartado**. Se já havia um perfil
 * carregado e uma releitura falha, apagá-lo trocaria informação boa por nenhuma
 * — o nome do médico sumiria do cabeçalho por causa de uma falha momentânea.
 *
 * Isso está escrito em três linhas de comentário no `useAuth` e não é
 * verificado em lugar nenhum. Comentário não é guarda.
 */

/** Liga e desliga a falha na leitura de `profiles`, entre chamadas. */
let leituraFalha = false;
const PERFIL = { id: "p1", user_id: "u1", full_name: "Ana Souza", account_type: "medico", phone: null };

let disparaMudancaDeAuth: ((evento: string, sessao: unknown) => void) | null = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const alvo: any = {};
      for (const m of ["select", "eq"]) alvo[m] = () => alvo;
      alvo.maybeSingle = () =>
        Promise.resolve(
          leituraFalha
            ? { data: null, error: { message: "network error" } }
            : { data: PERFIL, error: null },
        );
      return alvo;
    },
    auth: {
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
        disparaMudancaDeAuth = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      getSession: () =>
        Promise.resolve({ data: { session: { user: { id: "u1" } } } }),
      signOut: vi.fn(),
    },
  },
}));

import { AuthProvider, useAuth } from "./useAuth";

/** Mostra o estado do contexto em texto, que é o que o teste consegue ler. */
function Sonda() {
  const { profile, profileError, loading } = useAuth();
  return (
    <div>
      <span data-testid="carregando">{String(loading)}</span>
      <span data-testid="nome">{profile?.full_name ?? "(sem perfil)"}</span>
      <span data-testid="falhou">{String(profileError)}</span>
    </div>
  );
}

const renderProvider = () =>
  render(
    <AuthProvider>
      <Sonda />
    </AuthProvider>,
  );

describe("useAuth quando a leitura do perfil falha", () => {
  beforeEach(() => {
    leituraFalha = false;
    disparaMudancaDeAuth = null;
    vi.clearAllMocks();
  });

  it("marca profileError quando a primeira leitura falha", async () => {
    leituraFalha = true;
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("carregando")).toHaveTextContent("false"));
    expect(screen.getByTestId("falhou")).toHaveTextContent("true");
    expect(screen.getByTestId("nome")).toHaveTextContent("(sem perfil)");
  });

  it("não fica carregando para sempre quando a leitura falha", async () => {
    // O `return` antecipado no erro passa pelo `finally` que desliga o
    // `loading`. Se algum dia alguém mover essa chamada, a tela inteira fica
    // presa no spinner e o `ProtectedRoute` nunca libera — sintoma que
    // pareceria "o site não abre", e não "não li o perfil".
    leituraFalha = true;
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("carregando")).toHaveTextContent("false"));
  });

  it("perfil lido com sucesso: sem erro e com o nome", async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("nome")).toHaveTextContent("Ana Souza"));
    expect(screen.getByTestId("falhou")).toHaveTextContent("false");
  });

  it("uma RELEITURA que falha não apaga o perfil que já estava carregado", async () => {
    // O caso que o comentário do `useAuth` descreve e ninguém verificava.
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("nome")).toHaveTextContent("Ana Souza"));

    leituraFalha = true;
    await act(async () => {
      disparaMudancaDeAuth?.("TOKEN_REFRESHED", { user: { id: "u1" } });
      // O `loadProfile` é adiado com `setTimeout(..., 0)` para evitar deadlock.
      await new Promise((r) => setTimeout(r, 10));
    });

    await waitFor(() => expect(screen.getByTestId("falhou")).toHaveTextContent("true"));
    // O nome CONTINUA lá: trocar informação boa por nenhuma é piorar.
    expect(screen.getByTestId("nome")).toHaveTextContent("Ana Souza");
  });
});
