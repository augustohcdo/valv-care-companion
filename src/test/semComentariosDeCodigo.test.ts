/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { semComentariosDeCodigo } from "./semComentariosDeCodigo";

/**
 * O limpador de comentários, conferido caso a caractere.
 *
 * ## Por que ele existe
 *
 * Havia OITO cópias disto espalhadas pelas guardas desta base, em duas
 * famílias, e nenhuma estava correta:
 *
 *   · seis por expressão regular, da forma `.replace(/(^|[^:])\/\/.*$/gm, "$1")`.
 *     O `[^:]` existe para não decapitar `https://…`, e é todo o contexto que
 *     elas têm: um `//` dentro de literal de texto é apagado como comentário;
 *   · uma varredor caractere a caractere, que rastreava aspas — melhor, e ainda
 *     assim quebrada em literal de REGEX. Em `/\/\*[\s\S]*?\*\//g`, o `\/`
 *     seguido de `/` virava começo de comentário e ela apagava o resto da
 *     linha. Esse literal existe aqui: é o próprio limpador por regex, citado
 *     dentro de um teste.
 *
 * Medido antes de trocar: nenhuma das divergências mudava o veredito de guarda
 * nenhuma. Fragilidade latente, alcance zero — e consolidar foi endurecimento,
 * não conserto. O que justifica o endurecimento é a reincidência: analisador por
 * texto se perdendo num delimitador foi o defeito de onze achados desta sessão.
 *
 * ## Por que estes casos, e não outros
 *
 * A primeira versão desta função tinha contraprova de SEIS casos e passava nos
 * seis — e não apagava nenhum JSDoc. O TypeScript parseia `/** … *\/` para
 * dentro da árvore (ele usa a anotação para inferir tipo), e o nó é uma FOLHA
 * que cobre o texto do comentário; marcando folhas como token, todo comentário
 * de documentação sobrevivia. Um `/* nota *\/` solto era apagado direito, e
 * nenhum dos seis casos tinha JSDoc.
 *
 * Quem pegou foram duas guardas de verdade, ao serem ligadas nesta função:
 * `aplicarComSelect` e `marcasDeCarregamento` reprovaram. A contraprova não
 * pegou porque não olhava a forma que 100% dos comentários explicativos desta
 * base usam.
 *
 * Daí a lista abaixo começar pelo JSDoc.
 */

/** Sobrou algum comentário? */
const temComentario = (s: string) => /\/\*|\/\//.test(s.replace(/"[^"]*"|`[^`]*`|'[^']*'/g, ""));

describe("tirar comentário de código, pelo parser", () => {
  it("apaga JSDoc — o caso que a primeira contraprova não tinha", () => {
    const src = '/** doc */\nconst x = 1;';
    const limpo = semComentariosDeCodigo(src);
    expect(limpo).toBe("          \nconst x = 1;");
    expect(limpo).not.toContain("doc");
  });

  it("apaga JSDoc de várias linhas, preservando as quebras", () => {
    const src = "/**\n * nota\n */\nconst x = 1;";
    const limpo = semComentariosDeCodigo(src);
    expect(limpo.split("\n")).toHaveLength(4);
    expect(limpo).not.toContain("nota");
    expect(limpo.split("\n")[3]).toBe("const x = 1;");
  });

  it("apaga bloco solto e bloco no meio da linha", () => {
    // Os espaços são CALCULADOS, e não contados à mão: a primeira versão deste
    // caso falhou porque eu escrevi dez espaços onde cabiam nove. Expectativa
    // contada a dedo reprova a função certa e manda consertar o que está bom.
    const solto = "/* nota */";
    expect(semComentariosDeCodigo(`${solto}\nconst x = 1;`))
      .toBe(`${" ".repeat(solto.length)}\nconst x = 1;`);

    const meio = "/* n */";
    expect(semComentariosDeCodigo(`const a = 1; ${meio} const b = 2;`))
      .toBe(`const a = 1; ${" ".repeat(meio.length)} const b = 2;`);
  });

  it("apaga comentário de linha, inclusive com URL dentro", () => {
    // A família regex precisava de um `[^:]` para não cortar no `//` de
    // `https://`. Aqui não há caso especial: o parser sabe o que é comentário.
    const src = "// veja https://ex.com/a\nconst x = 1;";
    const limpo = semComentariosDeCodigo(src);
    expect(limpo).toBe(" ".repeat(24) + "\nconst x = 1;");
  });

  it("NÃO toca em `//` dentro de literal de texto, template ou regex", () => {
    for (const src of [
      'const u = "a // b"; const x = 1;',
      "const u = `a // b`; const x = 1;",
      "const r = /\\/\\//g; const x = 1;",
      // O literal que derrubava o varredor: é o limpador por regex, citado.
      "const r = /\\/\\*[\\s\\S]*?\\*\\//g; const x = 1;",
      'const u = "/* nao e comentario */"; const x = 1;',
    ]) {
      expect(semComentariosDeCodigo(src), `mexeu em:\n${src}`).toBe(src);
    }
  });

  it("preserva o tamanho e as linhas, caractere a caractere", () => {
    /**
     * Guardas desta base relatam `arquivo:linha`, e algumas classificam a
     * ocorrência pelo ÍNDICE dela na instrução — a de `mercado_br` decide
     * leitura contra escrita pela posição relativa ao `SET` e ao `WHERE`. Um
     * limpador que encurta o texto faz a acusação apontar a linha errada, e
     * isso já aconteceu aqui: a inversão dizia 150 com o defeito na 158.
     */
    const src = "const a = 1; // nota\n/** doc */\nconst b = 2;\n";
    const limpo = semComentariosDeCodigo(src);
    expect(limpo).toHaveLength(src.length);
    expect(limpo.split("\n")).toHaveLength(src.split("\n").length);
    // A linha de `const b` continua sendo a terceira.
    expect(limpo.split("\n")[2]).toBe("const b = 2;");
  });

  it("lê `.tsx` sem estragar o JSX, e `.mjs` com `await` no topo", () => {
    /**
     * O caso do `//` no TEXTO do JSX é o que torna a escolha da extensão
     * load-bearing, e eu só descobri isso invertendo.
     *
     * A primeira versão deste `it` usava `{/* nota *\/}` dentro do JSX e
     * passava IGUAL quando eu mutava a função para parsear todo arquivo como
     * `.ts` — em modo TS o `<div>` vira asserção de tipo malformada, a
     * recuperação de erro ainda tokeniza o resto, e o comentário continua
     * sendo trivia. A inversão "ignora a extensão" não derrubava nada: a
     * escolha de `ScriptKind` não estava sendo conferida por ninguém.
     *
     * Com `//` dentro do texto do JSX a diferença aparece: em `.tsx` é
     * `JsxText`, um TOKEN, e fica; em `.ts` o parser lê começo de comentário de
     * linha e apaga o resto da linha — inclusive o `</div>`.
     */
    const comBarras = "const a = <div>veja em //exemplo</div>;";
    const limpoTsx = semComentariosDeCodigo(comBarras, "a.tsx");
    expect(limpoTsx, "o texto do JSX foi lido como comentário").toBe(comBarras);

    const tsx = 'const a = <div className="x">{/* nota */}texto</div>;';
    const comJsx = semComentariosDeCodigo(tsx, "a.tsx");
    expect(comJsx).toContain('<div className="x">');
    expect(comJsx).toContain("texto");
    expect(comJsx).not.toContain("nota");

    const mjs = "// topo\nconst r = await fetch('x');\n";
    const limpoMjs = semComentariosDeCodigo(mjs, "a.mjs");
    expect(limpoMjs).toContain("await fetch('x')");
    expect(limpoMjs).not.toContain("topo");
  });

  it("nos arquivos reais, não sobra comentário e o tamanho não muda", () => {
    /**
     * O piso. Os casos acima são plantados; este confere que a função faz o
     * trabalho nos arquivos que as guardas de fato varrem — um `.mjs` cheio de
     * prosa, um `.tsx` com JSX, um `.ts` de edge function.
     *
     * `rotas-renderizam.mjs` está aqui porque foi nele que o defeito do JSDoc
     * apareceu: ele saía com os onze blocos `/**` intactos.
     */
    const reais = [
      "scripts/rotas-renderizam.mjs",
      "src/components/CaseFindingsEditor.tsx",
      "supabase/functions/_shared/logError.ts",
      "src/lib/mutate.ts",
    ];
    for (const arquivo of reais) {
      const original = readFileSync(arquivo, "utf8");
      const limpo = semComentariosDeCodigo(original, arquivo);
      expect(limpo.length, `${arquivo}: o tamanho mudou`).toBe(original.length);
      expect(
        (original.match(/\/\*\*/g) ?? []).length,
        `${arquivo} não tem JSDoc — escolha outro arquivo para este piso`,
      ).toBeGreaterThan(0);
      expect(temComentario(limpo), `${arquivo}: sobrou comentário`).toBe(false);
      // E o código continua lá: uma linha reconhecível de cada arquivo.
      expect(limpo, `${arquivo}: perdeu código`).toMatch(/\bconst\b|\bfunction\b|\bimport\b/);
    }
  });
});
