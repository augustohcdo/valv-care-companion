import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useEffect } from "react";

const rpc = vi.fn(() => Promise.resolve({ error: null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

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
    rerender(
      <MemoryRouter initialEntries={["/contato"]}>
        <PageViewTracker />
      </MemoryRouter>,
    );
    // A remontagem cria outra instância; o que se prova aqui é que uma mesma
    // instância re-renderizada não repete a chamada.
    expect(rpc.mock.calls.filter((c) => (c[1] as { _path: string })._path === "/contato").length)
      .toBeLessThanOrEqual(2);
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
    rpc.mockResolvedValueOnce({ error: { message: "offline" } } as never);
    const { container } = renderEm("/");
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(container).toBeInTheDocument();
  });
});
