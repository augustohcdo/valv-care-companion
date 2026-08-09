import { describe, it, expect, vi } from "vitest";
import { isChunkLoadError, recarregarUmaVez, liberarRecarga, RELOAD_KEY } from "./chunkReload";

/** Um `sessionStorage` de mentira, para não depender do jsdom. */
function storageFalso(inicial: Record<string, string> = {}) {
  const dados = { ...inicial };
  return {
    dados,
    getItem: (k: string) => dados[k] ?? null,
    setItem: (k: string, v: string) => void (dados[k] = v),
    removeItem: (k: string) => void delete dados[k],
  };
}

describe("isChunkLoadError", () => {
  /**
   * O teste que motivou o arquivo. Esta é a string exata gravada em
   * `client_errors` em 08/08, de um usuário logado num iPhone: o navegador pediu
   * um módulo JavaScript e o servidor devolveu o `index.html`. A lista antiga
   * não a reconhecia, então a recarga automática não disparou e a pessoa ficou
   * com a tela quebrada.
   */
  it("reconhece HTML servido no lugar de JavaScript", () => {
    expect(isChunkLoadError("'text/html' is not a valid JavaScript MIME type.")).toBe(true);
  });

  it.each([
    "Importing a module script failed",
    "Failed to fetch dynamically imported module: https://valvepath.com.br/assets/x.js",
    "error loading dynamically imported module",
    "Loading chunk 42 failed",
    "ChunkLoadError: Loading chunk 3 failed",
    "Unexpected token '<'",
    "expected expression, got '<'",
  ])("reconhece %s", (msg) => {
    expect(isChunkLoadError(msg)).toBe(true);
  });

  // A direção oposta importa tanto quanto: recarregar a página por causa de um
  // erro comum esconderia o defeito e perderia o que o usuário estava fazendo.
  it.each([
    "TypeError: Cannot read properties of undefined",
    "Script error.",
    "NetworkError when attempting to fetch resource.",
    "",
  ])("não confunde %s com falha de chunk", (msg) => {
    expect(isChunkLoadError(msg)).toBe(false);
  });
});

describe("recarregarUmaVez", () => {
  it("recarrega na primeira vez e não na segunda", () => {
    const s = storageFalso();
    const recarregar = vi.fn();

    expect(recarregarUmaVez(s, recarregar)).toBe(true);
    expect(recarregar).toHaveBeenCalledTimes(1);

    // Se a recarga também falhar, insistir viraria aba piscando para sempre.
    expect(recarregarUmaVez(s, recarregar)).toBe(false);
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it("volta a recarregar depois que o app subiu e liberou a trava", () => {
    const s = storageFalso();
    const recarregar = vi.fn();

    recarregarUmaVez(s, recarregar);
    liberarRecarga(s);
    expect(s.getItem(RELOAD_KEY)).toBeNull();

    // Um deploy seguinte, na mesma aba, precisa poder se curar também.
    expect(recarregarUmaVez(s, recarregar)).toBe(true);
    expect(recarregar).toHaveBeenCalledTimes(2);
  });
});
