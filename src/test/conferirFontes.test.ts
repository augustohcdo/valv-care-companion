/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
// `.mjs` de verificação, sem tipos — e o import resolve sozinho sob
// `tsconfig.app.json`, então um `@ts-expect-error` aqui fica SEM uso e o
// próprio `tsc` acusa. Eu já acrescentei essa diretiva por reflexo duas vezes
// nesta sessão, e as duas vezes a CI a devolveu.
import { urlsDoCatalogo, estadoDaResposta } from "../../scripts/conferir-fontes.mjs";
import { semComentariosDeCodigo } from "./semComentariosDeCodigo";

/**
 * O conferidor de fontes do catálogo, e a razão de ele existir.
 *
 * ## O rótulo que media outra coisa
 *
 * A conferência diária tinha uma linha chamada **"catálogo: nenhuma EOA gravada
 * sem fonte citável"**, e o que ela media era `!l.eoa_source_url` — o campo
 * está preenchido ou não. Uma URL que devolve 404 passava por "citável".
 *
 * Não é defeito hipotético. O cabeçalho do `conferir-mmcts.mjs` registra, entre
 * as três vezes em que este projeto aprendeu a mesma lição:
 *
 *   > "links da Corcym que devolviam 404 depois de o site ser reorganizado"
 *
 * São 82 URLs únicas de fonte em 16 domínios, quase todas de fabricante. Quem
 * clica é um cardiologista conferindo a procedência da área efetiva de orifício
 * que ele usa para escolher tamanho de prótese. Fonte que não abre é pior do que
 * fonte nenhuma: a primeira afirma uma procedência que não existe, a segunda
 * não afirma nada.
 *
 * Medido na primeira execução: **82 de 82 resolvem**, zero mortas, zero não
 * conferidas. O conferidor guarda esse estado; o rótulo da diária passou a
 * dizer "presença, não alcance".
 *
 * ## Por que o 403 não é 404
 *
 * Página protegida não é página morta, e contorná-la está fora de questão —
 * este projeto já topou com o desafio do Cloudflare da ANVISA e com a parede de
 * navegador da Medtronic, e as duas vezes a decisão registrada foi a mesma. O
 * script devolve NÃO CONFERIDO (saída 2) para 403, 429, 5xx, erro de rede e
 * tempo esgotado, e DIVERGE (saída 1) só para 404 e 410.
 */

const SCRIPT = "scripts/conferir-fontes.mjs";

describe("o conferidor de fontes do catálogo", () => {
  it("junta as URLs por valor, guardando campo e família", () => {
    const mapa = urlsDoCatalogo([
      {
        manufacturer: "Edwards", model_name: "Inspiris",
        eoa_source_url: "https://ex.invalid/a", image_url: "https://ex.invalid/b",
      },
      {
        manufacturer: "Edwards", model_name: "Perimount",
        // A MESMA url de outro campo e de outra família: tem de virar uma só
        // entrada, senão o conferidor bate duas vezes no mesmo link e o
        // relatório conta duas mortas onde há uma.
        reference_url: "https://ex.invalid/a",
      },
      { manufacturer: "Abbott", model_name: "Epic", eoa_source_url: null },
      // Valor que não é URL não entra: a coluna `mercado_br_fonte` guarda, em
      // algumas linhas, o nome do distribuidor em vez do endereço.
      { manufacturer: "Meril", model_name: "Hydra", mercado_br_fonte: "catálogo impresso" },
    ]);
    expect([...mapa.keys()].sort()).toEqual(["https://ex.invalid/a", "https://ex.invalid/b"]);
    const a = mapa.get("https://ex.invalid/a");
    expect([...a.campos].sort()).toEqual(["eoa_source_url", "reference_url"]);
    expect([...a.familias].sort()).toEqual(["Edwards Inspiris", "Edwards Perimount"]);
  });

  it("só 404 e 410 são MORTAS", () => {
    expect(estadoDaResposta({ status: 404 }).estado).toBe("morta");
    expect(estadoDaResposta({ status: 410 }).estado).toBe("morta");
  });

  it("2xx é ok, e o redirecionamento já foi seguido antes de chegar aqui", () => {
    for (const status of [200, 204, 206, 299]) {
      expect(estadoDaResposta({ status }).estado, `${status} não passou por ok`).toBe("ok");
    }
  });

  it("proteção, erro do outro lado e falha de rede são NÃO CONFERIDO", () => {
    /**
     * A distinção que o script existe para fazer. Um 403 da Medtronic e um 404
     * da Corcym são fatos diferentes: o primeiro diz "não deixei você olhar", o
     * segundo diz "a página não existe". Tratar os dois como quebra encheria a
     * agenda de falso vermelho sobre sites que estão de pé — e guarda que pune
     * quem fez certo é guarda que alguém desliga.
     *
     * E contornar a proteção para descobrir não está em questão.
     */
    for (const status of [401, 403, 429, 500, 502, 503]) {
      expect(
        estadoDaResposta({ status }).estado,
        `${status} foi tratado como morta`,
      ).toBe("naoConferido");
    }
    expect(estadoDaResposta({ erro: "getaddrinfo ENOTFOUND" }).estado).toBe("naoConferido");
    expect(estadoDaResposta({ erro: "sem resposta em 20s" }).estado).toBe("naoConferido");
  });

  it("o detalhe acompanha o veredito, para o relatório poder dizer o motivo", () => {
    // Sem o detalhe, a issue diria "não conferida" sem dizer se foi 403, DNS ou
    // tempo esgotado — e os três pedem providências diferentes.
    expect(estadoDaResposta({ status: 403 }).detalhe).toContain("403");
    expect(estadoDaResposta({ erro: "boom" }).detalhe).toBe("boom");
  });

  it("o código de saída diz a PIOR coisa que aconteceu", () => {
    /**
     * Lido no código, sem comentário: morta (1) tem de vir antes de não
     * conferida (2). Com a ordem trocada, uma execução com uma morta e uma
     * protegida sairia 2 — e ⚠️ não é ❌. A agenda trataria "a procedência
     * sumiu" como "não deu para olhar".
     */
    const codigo = semComentariosDeCodigo(readFileSync(SCRIPT, "utf8"), SCRIPT);
    const i1 = codigo.indexOf("process.exit(1)");
    const i2 = codigo.indexOf("process.exit(2)");
    const iUltimo2 = codigo.lastIndexOf("process.exit(2)");
    expect(i1, "não achei a saída 1").toBeGreaterThan(0);
    expect(iUltimo2, "não achei a saída 2 do fim").toBeGreaterThan(i1);
    expect(i2, "a saída 2 das credenciais ausentes continua antes de tudo").toBeLessThan(i1);
  });

  it("o script não tenta de novo depois de um 403", () => {
    // A linha que separa "identificar-se como navegador" de "furar proteção".
    // Um laço de retentativa em cima de 403/429 seria insistir contra uma
    // recusa explícita, e esta base decidiu duas vezes que não se contorna.
    const codigo = semComentariosDeCodigo(readFileSync(SCRIPT, "utf8"), SCRIPT);
    expect(codigo, "apareceu retentativa no conferidor").not.toMatch(/for\s*\([^)]*tentativa/i);
    expect(codigo).not.toMatch(/retry|tentarDeNovo/i);
  });

  it("o conferidor é chamado por algum workflow", () => {
    // A guarda `scriptDeVerificacaoRoda` já cobra isto para a classe inteira.
    // Aqui é nominal, pelo mesmo motivo do `mobile.mjs`: quem achar as 82
    // requisições lentas pode tirar o passo e declarar o script manual, o que
    // passaria pela regra geral.
    const semanal = readFileSync(".github/workflows/rotas-autenticadas.yml", "utf8");
    expect(semanal, "o conferidor de fontes saiu da varredura semanal")
      .toContain("scripts/conferir-fontes.mjs");
  });

  it("o rótulo da diária não promete mais alcance", () => {
    /**
     * O outro lado do conserto. Se o rótulo voltar a dizer "fonte citável"
     * medindo presença, a mentira volta — e desta vez com um conferidor de
     * verdade ao lado, o que a tornaria mais convincente.
     */
    const diaria = readFileSync("scripts/ferramentas-verificar.mjs", "utf8");
    const i = diaria.indexOf("catálogo: toda EOA gravada");
    expect(i, "não achei o rótulo da conferência de EOA").toBeGreaterThan(0);
    const rotulo = diaria.slice(i, diaria.indexOf('"', i + 20) + 1);
    expect(rotulo, "o rótulo voltou a prometer que a fonte é citável")
      .not.toMatch(/fonte citável/);
    expect(rotulo, "o rótulo não diz que mede presença").toMatch(/presença/);
  });
});
