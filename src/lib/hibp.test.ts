import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { verificarSenhaVazada, mensagemSenhaVazada, bloquearSeSenhaVazada } from "./hibp";
import { toast } from "sonner";

/**
 * SHA-1 de "Password123" = B2E98AD6F6EB8508DD6A14CFA704BAD7F05F6FB1
 * prefixo = B2E98 | sufixo = AD6F6EB8508DD6A14CFA704BAD7F05F6FB1
 */
const PREFIXO = "B2E98";
const SUFIXO = "AD6F6EB8508DD6A14CFA704BAD7F05F6FB1";

let chamadas: { url: string; init?: RequestInit }[] = [];

function responderCom(corpo: string, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      chamadas.push({ url, init });
      return Promise.resolve({ ok, status, text: () => Promise.resolve(corpo) });
    }),
  );
}

describe("verificarSenhaVazada", () => {
  beforeEach(() => {
    chamadas = [];
  });
  afterEach(() => vi.unstubAllGlobals());

  /**
   * O ponto de privacidade, e o motivo de este ser o primeiro teste: a senha
   * não pode sair do navegador. Só os 5 primeiros caracteres do hash viajam.
   */
  it("envia apenas o prefixo de 5 caracteres do hash — nunca a senha", async () => {
    responderCom(`${SUFIXO}:42`);
    await verificarSenhaVazada("Password123");

    expect(chamadas).toHaveLength(1);
    const url = chamadas[0]!.url;
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${PREFIXO}`);

    // Nem a senha, nem o hash completo, nem o sufixo aparecem na requisição.
    expect(url).not.toContain("Password123");
    expect(url).not.toContain(SUFIXO);
    expect(url.split("/range/")[1]).toHaveLength(5);
  });

  it("pede o preenchimento que esconde o tamanho real da resposta", async () => {
    responderCom(`${SUFIXO}:42`);
    await verificarSenhaVazada("Password123");
    expect(chamadas[0]!.init?.headers).toMatchObject({ "Add-Padding": "true" });
  });

  it("reconhece a senha vazada e devolve quantas vezes apareceu", async () => {
    responderCom(`AAAA111:5\n${SUFIXO}:24230577\nBBBB222:9`);
    const r = await verificarSenhaVazada("Password123");
    expect(r).toEqual({ estado: "vazada", ocorrencias: 24230577 });
  });

  it("senha ausente da lista passa como limpa", async () => {
    responderCom("AAAA111:5\nBBBB222:9");
    expect(await verificarSenhaVazada("Password123")).toEqual({ estado: "limpa" });
  });

  // O padding da HIBP vem com contagem 0: é sufixo inventado para despistar o
  // tamanho da resposta, não um acerto real.
  it("sufixo de preenchimento (contagem 0) não conta como vazamento", async () => {
    responderCom(`${SUFIXO}:0`);
    expect(await verificarSenhaVazada("Password123")).toEqual({ estado: "limpa" });
  });

  /**
   * Falha aberta, e é deliberado: travar a criação de conta porque um serviço
   * de terceiro caiu seria pior que o risco que se evita. Quem chama distingue
   * "limpa" de "indisponivel" e decide — mas nunca recebe um falso "limpa".
   */
  it("erro de rede devolve indisponível, não 'limpa'", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    const r = await verificarSenhaVazada("Password123");
    expect(r.estado).toBe("indisponivel");
    expect(r).not.toEqual({ estado: "limpa" });
  });

  it("resposta HTTP de erro devolve indisponível", async () => {
    responderCom("", false, 503);
    const r = await verificarSenhaVazada("Password123");
    expect(r).toEqual({ estado: "indisponivel", motivo: "HTTP 503" });
  });
});

describe("mensagemSenhaVazada", () => {
  it("diz quantas vezes a senha vazou, com separador de milhar", () => {
    expect(mensagemSenhaVazada(24230577)).toContain("24.230.577");
  });
});

/**
 * A regra de falha aberta mora aqui, num lugar só, para os três pontos que
 * criam senha não terem cada um a sua interpretação.
 */
describe("bloquearSeSenhaVazada", () => {
  beforeEach(() => {
    chamadas = [];
    vi.clearAllMocks();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("bloqueia e avisa quando a senha vazou", async () => {
    responderCom(`${SUFIXO}:1505362`);
    expect(await bloquearSeSenhaVazada("Password123")).toBe(true);
    expect(toast.error).toHaveBeenCalledWith(
      "Senha exposta em vazamento público",
      { description: expect.stringContaining("1.505.362") },
    );
  });

  it("deixa passar senha limpa, sem avisar nada", async () => {
    responderCom("AAAA111:5");
    expect(await bloquearSeSenhaVazada("Password123")).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });

  // O caso que decide o desenho: serviço fora do ar não pode virar cadastro
  // recusado. Travar a criação de conta porque um terceiro caiu é pior que o
  // risco evitado.
  it("API indisponível NÃO bloqueia o cadastro", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    expect(await bloquearSeSenhaVazada("Password123")).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
