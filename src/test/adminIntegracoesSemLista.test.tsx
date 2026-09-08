import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

/**
 * O painel de integrações quando a lista não carrega.
 *
 * ## O que a falha convidava a fazer
 *
 * Zero hospitais e zero chaves de API numa tela ADMINISTRATIVA não é só
 * informação faltando: é convite ao pior ato possível ali — recadastrar o que já
 * existe. Hospital duplicado, segunda chave de API emitida para quem já tinha
 * uma. E chave de API não se "desemite": ela passa a existir, com acesso, até
 * alguém notar.
 *
 * É diferente das outras telas desta série. Lá a falha fazia a tela mentir sobre
 * um paciente; aqui ela induz o administrador a uma escrita que não dá para
 * desfazer com um clique.
 *
 * ## Por que o mock é seletivo
 *
 * O papel de administrador precisa PASSAR e as listas precisam FALHAR. Com tudo
 * falhando, `isAdmin` fica indefinido, o componente devolve o spinner e nunca
 * chega à parte que este teste examina — o teste passaria sem olhar nada, que é
 * o defeito que esta sessão inteira persegue.
 */

const ERRO = { message: "network error", code: "PGRST000", details: null, hint: null };

/** Ligado por teste: quando falso, as listas carregam vazias de verdade. */
let listasFalham = true;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    // O papel de administrador sempre resolve: é o que dá acesso à tela.
    rpc: () => Promise.resolve({ data: true, error: null }),
    from: () => {
      const alvo: any = {};
      for (const m of ["select", "eq", "is", "in"]) alvo[m] = () => alvo;
      const resposta = () =>
        listasFalham ? { data: null, error: ERRO } : { data: [], error: null };
      alvo.order = () => Promise.resolve(resposta());
      alvo.maybeSingle = () => Promise.resolve(resposta());
      alvo.then = (resolve: any) => resolve(resposta());
      return alvo;
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, profile: { account_type: "medico" }, loading: false }),
}));
vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import AdminIntegracoes from "@/pages/app/AdminIntegracoes";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe("integrações administrativas com a lista falhando", () => {
  beforeEach(() => {
    listasFalham = true;
    vi.clearAllMocks();
  });

  it("desaconselha cadastrar, em vez de dizer que não há hospital nenhum", async () => {
    render(<AdminIntegracoes />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/não foi possível carregar a lista/i)).toBeInTheDocument(),
    );

    // A instrução é a parte que evita o estrago, e não o relato do erro.
    expect(screen.getByText(/não cadastre nada agora/i)).toBeInTheDocument();
    expect(screen.getByText(/pode já existir e você não está vendo/i)).toBeInTheDocument();

    // E a frase que induzia ao cadastro não pode aparecer.
    expect(screen.queryByText(/nenhum hospital cadastrado/i)).not.toBeInTheDocument();
  });

  it("com a lista lida e vazia, aí sim diz que não há hospital", async () => {
    // Contraprova. Sem ela, o teste acima passaria com a tela quebrada de um
    // jeito que nunca mostrasse nem uma coisa nem outra — e "nenhum hospital
    // cadastrado" É a mensagem certa quando a leitura funcionou e não há
    // nenhum. O defeito nunca foi a frase: foi dizê-la sem ter lido.
    listasFalham = false;
    render(<AdminIntegracoes />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/nenhum hospital cadastrado/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/não foi possível carregar a lista/i)).not.toBeInTheDocument();
  });
});
