import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));

import { reportError, __resetReportErrorState } from "./reportError";

beforeEach(() => {
  invoke.mockClear();
  __resetReportErrorState();
});

describe("reportError", () => {
  it("envia a mensagem, a rota e a origem do erro", () => {
    reportError(new Error("quebrou"), { filename: "app.js", lineno: 10, colno: 3 });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][1].body).toMatchObject({
      message: "quebrou",
      filename: "app.js",
      lineno: 10,
      colno: 3,
    });
  });

  // Um erro em laço dispara o mesmo reporte dezenas de vezes por segundo. As 20
  // primeiras linhas que client_errors recebeu vieram de um aparelho só, em 6,6
  // segundos — cada uma foi uma chamada de rede.
  it("não repete o mesmo erro em sequência", () => {
    for (let i = 0; i < 8; i++) {
      reportError(new Error("laço"), { filename: "app.js", lineno: 10 });
    }
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("trata como distintos erros de origens diferentes", () => {
    reportError(new Error("igual"), { filename: "a.js", lineno: 1 });
    reportError(new Error("igual"), { filename: "b.js", lineno: 1 });
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("para de enviar depois do teto por carregamento de página", () => {
    for (let i = 0; i < 40; i++) {
      reportError(new Error(`distinto ${i}`));
    }
    expect(invoke.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it("usa o componentStack do error boundary quando não há stack", () => {
    reportError("string solta", { componentStack: "  em <Caso />" });
    expect(invoke.mock.calls[0][1].body).toMatchObject({
      message: "string solta",
      stack: "  em <Caso />",
    });
  });

  it("nunca lança, mesmo se o envio falhar", () => {
    invoke.mockImplementation(() => {
      throw new Error("rede fora");
    });
    expect(() => reportError(new Error("x"))).not.toThrow();
  });
});
