/// <reference types="node" />
import { describe, it, expect } from "vitest";
import {
  arquivosComMjs,
  escritosNuncaLidos,
  fonteDe,
  formatarEscrito,
  type EscritoNuncaLido,
} from "./valorEscritoEhLido";

/**
 * Nenhum valor é escrito num lugar que ninguém lê.
 *
 * ## De onde veio
 *
 * `restore.mjs` gravava o motivo de cada tabela recusar a carga num mapa
 * `carregado` que nunca era lido. A conferência do fim mostrava "esperado 50,
 * no alvo 0" e a mensagem do `insert` — a metade útil, às três da manhã, no
 * script da restauração de desastre — ia para o lixo.
 *
 * Nenhuma guarda viu, e o porquê é a parte que vale: `resultadoNaoSePerde`
 * varre `src/` e `supabase/functions/`, e só `.ts`/`.tsx`. Os 36 `.mjs` de
 * `scripts/`, que são os que falam com produção, **nunca passaram por detector
 * de AST nenhum**. Esta guarda é a primeira a varrê-los.
 *
 * Medido: 321 arquivos, 37 deles `.mjs` — 36 em `scripts/` e um só no
 * `.github/`. O número do `.github/` é esse mesmo: lá existe um único script, e
 * dizer "varre o `.github/`" sem dizer que é um arquivo faria a cobertura
 * parecer maior do que é.
 *
 * ## O que ela cobra, e o que não
 *
 * Cobra: declaração que recebe valor — atribuição, incremento, escrita em
 * membro, `push` — e nunca é lida. Trabalho feito e descartado.
 *
 * Não cobra: `const x = f();` sem escrita nenhuma depois. Isso é
 * `no-unused-vars`, que este repositório desligou por decisão ("não usado é
 * estilo"), e juntar as duas coisas enterraria o sinal no ruído.
 *
 * Também não cobra se o valor é USADO BEM. `if (error) return;` conta como
 * leitura. Separar "tratou" de "viu e seguiu" exige entender intenção, e
 * detector que tenta isso erra dos dois lados — já errou aqui.
 *
 * O detector subnotifica por construção: nomes casam por texto no arquivo, sem
 * resolução de escopo, então um homônimo lido em outra função absolve o
 * primeiro. É o lado certo para errar.
 */

const RAIZES = ["src", "supabase/functions", "scripts", ".github"];

/**
 * Dispensas, com o motivo. Vazio, e é o estado a defender.
 *
 * Para acrescentar uma entrada, escreva por que ali o valor é escrito e nunca
 * lido de propósito — e desconfie da resposta: na única ocorrência que esta
 * base teve, o "de propósito" era esquecimento de três linhas abaixo.
 */
const PODEM_DESCARTAR: Record<string, string> = {};

const arquivos = arquivosComMjs(RAIZES);
const achados: EscritoNuncaLido[] = [];
for (const arquivo of arquivos) {
  achados.push(...escritosNuncaLidos(arquivo, fonteDe(arquivo)));
}

describe("valor escrito é valor lido", () => {
  it("nenhum valor é gravado num lugar que ninguém lê", () => {
    const culpados = achados
      .filter((a) => !(`${a.arquivo}:${a.nome}` in PODEM_DESCARTAR))
      .map(formatarEscrito);
    expect(
      culpados,
      `\n${culpados.join("\n")}\n\n` +
        "Cada linha é um valor calculado e jogado fora. Foi assim que o motivo de\n" +
        "uma tabela recusar a carga sumiu do relatório da restauração: gravado num\n" +
        "mapa, nunca lido, e a conferência mostrando o número sem a razão.\n\n" +
        "Ou leia o valor onde ele serve, ou não o calcule.",
    ).toEqual([]);
  });

  it("o detector acha as quatro formas de escrever sem ler", () => {
    /**
     * A contraprova. Sem ela, o zero acima é só a notícia de que o detector não
     * acha nada — e esta sessão já viu guarda varrer o projeto inteiro e medir
     * outra coisa.
     *
     * O primeiro caso é literalmente o defeito que existiu, reduzido.
     */
    const plantado = `
      export function f(ts: string[], g: (t: string) => string) {
        const mapaPerdido: Record<string, string> = {};
        for (const t of ts) mapaPerdido[t] = g(t);

        let contadorPerdido = 0;
        contadorPerdido += 1;

        let incrementoPerdido = 0;
        incrementoPerdido++;

        const listaPerdida: string[] = [];
        listaPerdida.push("x");
      }
    `;
    const nomes = escritosNuncaLidos("plantado.ts", fonteDe("plantado.ts", plantado))
      .map((a) => a.nome)
      .sort();
    expect(nomes).toEqual([
      "contadorPerdido", "incrementoPerdido", "listaPerdida", "mapaPerdido",
    ]);
  });

  it("não acusa quem é lido, em nenhuma das formas de ler", () => {
    /**
     * O outro lado, e ele decide se a guarda sobrevive: falso vermelho custa o
     * mesmo que falso verde. Cada um destes é escrito E lido, de um jeito
     * diferente — argumento, condição, retorno, template, propriedade,
     * iteração.
     */
    const plantado = `
      export function f(g: (x: unknown) => void, lista: string[]) {
        const comoArgumento: string[] = [];
        comoArgumento.push("a");
        g(comoArgumento);

        let naCondicao = 0;
        naCondicao++;
        if (naCondicao > 1) g(null);

        const noTemplate: Record<string, number> = {};
        noTemplate.a = 1;
        g(\`\${noTemplate.a}\`);

        const naPropriedade: string[] = [];
        naPropriedade.push("b");
        g(naPropriedade.length);

        const naIteracao: string[] = [];
        naIteracao.push("c");
        for (const x of naIteracao) g(x);

        let noRetorno = 0;
        noRetorno += lista.length;
        return noRetorno;
      }
    `;
    const nomes = escritosNuncaLidos("ok.ts", fonteDe("ok.ts", plantado)).map((a) => a.nome);
    expect(nomes, "o detector acusou quem lê o próprio valor").toEqual([]);
  });

  it("repassar adiante conta como ler", () => {
    // Quem recebe é que decide o que fazer. Exigir que o valor seja CONSUMIDO
    // aqui transformaria "delegou" em acusação, e delegar é o desenho certo —
    // é o que `vereditoDaRestauracao` faz com as linhas que devolve.
    const plantado = `
      export function f(adiante: (v: unknown) => void) {
        const falhas: Record<string, string> = {};
        falhas["a"] = "b";
        adiante({ falhas });
      }
    `;
    expect(escritosNuncaLidos("r.ts", fonteDe("r.ts", plantado))).toEqual([]);
  });

  it("homônimo em outro escopo absolve — o detector subnotifica, nunca inventa", () => {
    /**
     * O limite, fixado. Os nomes casam por texto no arquivo, sem resolução de
     * escopo: um `falhas` lido em outra função faz o `falhas` perdido desta
     * passar. Está documentado no detector e fica aqui porque limite que não é
     * exercitado vira surpresa.
     *
     * O lado é deliberado. Uma guarda que erra para o vermelho em cima de quem
     * fez certo é uma guarda que alguém desliga — e aí ela não pega nem o que
     * pegava.
     */
    const plantado = `
      export function perde() {
        const falhas: Record<string, string> = {};
        falhas["a"] = "b";
      }
      export function usa(g: (v: unknown) => void) {
        const falhas: Record<string, string> = {};
        falhas["c"] = "d";
        g(falhas);
      }
    `;
    expect(
      escritosNuncaLidos("h.ts", fonteDe("h.ts", plantado)),
      "o detector passou a resolver escopo — reescreva este caso, não o apague",
    ).toEqual([]);
  });

  it("declaração sem escrita nenhuma não é acusada", () => {
    // Território do `no-unused-vars`, desligado aqui por decisão. Acusar junto
    // enterraria o sinal que importa.
    const plantado = `
      export function f(g: () => number) {
        const soDeclarado = g();
      }
    `;
    expect(escritosNuncaLidos("d.ts", fonteDe("d.ts", plantado))).toEqual([]);
  });

  it("os pisos: a varredura alcança os `.mjs` de `scripts/` e o `.github/`", () => {
    /**
     * A premissa inteira desta guarda é alcançar o que as outras não alcançam.
     * Sem estes pisos, apontar `RAIZES` para um diretório vazio daria zero
     * achados e verde — o formato exato do defeito que esta sessão persegue.
     */
    expect(arquivos.length, "a varredura achou quase nada").toBeGreaterThan(280);
    const mjs = arquivos.filter((a) => a.endsWith(".mjs"));
    expect(mjs.length, "nenhum `.mjs` entrou na varredura").toBeGreaterThan(30);
    expect(
      mjs.filter((a) => a.startsWith("scripts/")).length,
      "os scripts que falam com produção saíram da varredura",
    ).toBeGreaterThan(30);
    expect(
      arquivos.some((a) => a.startsWith(".github/")),
      "o `.github/` saiu da varredura",
    ).toBe(true);
    // E o arquivo onde o defeito morava continua sendo varrido.
    expect(arquivos, "o `restore.mjs` saiu da varredura").toContain("scripts/restore.mjs");
  });

  it("toda dispensa aponta para um descarte que de fato existe", () => {
    for (const [chave, motivo] of Object.entries(PODEM_DESCARTAR)) {
      expect(motivo.length, `a dispensa de ${chave} não tem motivo escrito`).toBeGreaterThan(40);
      expect(
        achados.map((a) => `${a.arquivo}:${a.nome}`),
        `${chave} está dispensado e não descarta mais — tire a dispensa`,
      ).toContain(chave);
    }
  });
});
