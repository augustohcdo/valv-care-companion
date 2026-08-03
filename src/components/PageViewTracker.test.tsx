import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useEffect } from "react";

type Args = { _path: string; _new_visit: boolean };
type Resposta = Promise<{ error: { message: string } | null }>;

const rpc = vi.fn((_fn: string, _args: Args): Resposta => Promise.resolve({ error: null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (fn: string, args: Args) => rpc(fn, args) },
}));

import PageViewTracker from "./PageViewTracker";

/** Componente que navega uma vez, para exercitar a troca de rota. */
function VaiPara({ to }: { to: string }) {
  const nav = useNavigate();
  useEffect(() => { nav(to); }, [nav, to]);
  return null;
}

function renderEm(inicial: string, extra?: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[inicial]}>
      <PageViewTracker />
      <Routes>
        <Route path="*" element={<>{extra}</>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PageViewTracker", () => {
  beforeEach(() => {
    rpc.mockClear();
    sessionStorage.clear();
  });

  it("conta a tela e marca a primeira como início de sessão", async () => {
    renderEm("/aprender");
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(rpc).toHaveBeenCalledWith("record_page_view", {
      _path: "/aprender",
      _new_visit: true,
    });
  });

  // Sem isto, cada tela aberta viraria uma "visita" e o número de sessões
  // seria idêntico ao de visualizações — dois nomes para a mesma coisa.
  it("a segunda tela da mesma sessão não conta como nova visita", async () => {
    renderEm("/", <VaiPara to="/aprender" />);
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
    expect(rpc).toHaveBeenNthCalledWith(1, "record_page_view", { _path: "/", _new_visit: true });
    expect(rpc).toHaveBeenNthCalledWith(2, "record_page_view", { _path: "/aprender", _new_visit: false });
  });

  it("não conta duas vezes quando a rota não mudou", async () => {
    const { rerender } = renderEm("/contato");
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    // Mesmo tipo de elemento: o React reconcilia e mantém a instância, então
    // isto é uma re-renderização de verdade, não uma remontagem.
    rerender(
      <MemoryRouter initialEntries={["/contato"]}>
        <PageViewTracker />
        <Routes><Route path="*" element={null} /></Routes>
      </MemoryRouter>,
    );
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1]._path).toBe("/contato");
  });

  it("não quebra quando o navegador bloqueia o armazenamento", async () => {
    const original = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() { throw new Error("bloqueado"); },
    });
    try {
      renderEm("/");
      // Conta a visualização mesmo sem conseguir marcar a sessão: perder o
      // número da sessão é aceitável, quebrar a navegação não é.
      await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
      expect(rpc).toHaveBeenCalledWith("record_page_view", { _path: "/", _new_visit: false });
    } finally {
      if (original) Object.defineProperty(window, "sessionStorage", original);
    }
  });

  it("uma falha na contagem não chega à tela", async () => {
    rpc.mockResolvedValueOnce({ error: { message: "offline" } });
    const { container } = renderEm("/");
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(container).toBeInTheDocument();
  });
});
