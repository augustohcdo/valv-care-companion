/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { semComentariosDeCodigo } from "./semComentariosDeCodigo";

/**
 * A suíte roda o que existe, e cada teste afirma algo.
 *
 * ## Por que esta guarda, no fim de uma sessão sobre sucesso sem trabalho
 *
 * Toda guarda deste repositório confia numa coisa que ninguém conferia: que a
 * suíte EXECUTA o arquivo em que a guarda mora, e que cada `it` dela chega a
 * afirmar alguma coisa. Quatro jeitos de isso ser falso, e os quatro deixam a
 * saída dizendo "todos passaram":
 *
 *   1. **arquivo fora do alcance do vitest.** `vitest.config.ts` tem
 *      `include: ["src/**\/*.{test,spec}.{ts,tsx}"]`. Um teste escrito em
 *      `supabase/functions/_shared/x.test.ts` nunca roda, e nada avisa — o
 *      arquivo existe, está versionado, e a suíte segue verde sem ele;
 *   2. **`it.only`.** Um `only` esquecido silencia TODOS os outros testes do
 *      arquivo, e a execução continua relatando sucesso. É a forma mais barata
 *      de desligar uma guarda sem desligá-la;
 *   3. **arquivo sem nenhum `it`.** Passa por vazio. Já aconteceu nesta base
 *      com guardas de lista vazia, e a lição foi a mesma: zero é o que uma
 *      varredura quebrada também devolve;
 *   4. **`it` sem nenhuma asserção.** O corpo roda, nada é cobrado, e o teste
 *      conta como passado.
 *
 * ## O que foi medido quando ela foi escrita
 *
 * 144 arquivos de teste versionados, **todos** sob `src/`; 144 executados pelo
 * vitest; 1313 chamadas a `it`/`test`; **zero** `.only`, zero `.skip`, zero
 * arquivos sem `it`, zero `it` sem asserção. O único `it` sem `expect` que a
 * varredura achou era de um arquivo temporário meu, da própria medição.
 *
 * Os quatro buracos são latentes, de alcance zero hoje. O que justifica fechá-los
 * é o custo: um `it.only` esquecido num `git commit` apressado desliga um arquivo
 * inteiro de guardas, e a CI não tem como notar.
 */

/** Variantes que ainda DECLARAM teste. `only`, `skip` e `todo` não entram. */
const VARIANTES_VALIDAS = new Set([
  "each", "for", "concurrent", "sequential", "extend", "runIf", "skipIf", "fails",
]);

interface Declaracao {
  arquivo: string;
  linha: number;
  titulo: string;
  /** O caminho de propriedades: `["each"]` para `it.each(...)`. */
  variantes: string[];
  temAsercao: boolean;
}

/** A raiz da cadeia e os nomes de propriedade, de fora para dentro. */
function cadeia(no: ts.Node): { raiz: string | null; props: string[] } {
  const props: string[] = [];
  let atual: ts.Node = no;
  for (;;) {
    if (ts.isCallExpression(atual)) { atual = atual.expression; continue; }
    if (ts.isPropertyAccessExpression(atual)) { props.unshift(atual.name.text); atual = atual.expression; continue; }
    if (ts.isParenthesizedExpression(atual) || ts.isNonNullExpression(atual)) { atual = atual.expression; continue; }
    break;
  }
  return { raiz: ts.isIdentifier(atual) ? atual.text : null, props };
}

/** O primeiro argumento que é função — o corpo do teste. */
function corpoDoTeste(chamada: ts.CallExpression): ts.Node | null {
  for (const arg of chamada.arguments) {
    if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) return arg;
  }
  return null;
}

function arquivosDeTesteVersionados(): string[] {
  // `git ls-files` em vez de varrer o disco: o que importa é o que está
  // VERSIONADO. Um arquivo de teste não versionado não é guarda de ninguém, e
  // um versionado fora do alcance do vitest é o buraco nº 1.
  return execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter((l) => /\.(test|spec)\.(ts|tsx)$/.test(l))
    .sort();
}

const arquivos = arquivosDeTesteVersionados();

const declaracoes: Declaracao[] = [];
const comOnly: string[] = [];
const semNenhumIt: string[] = [];

for (const arquivo of arquivos) {
  /**
   * Nada de limpar comentário antes — e descobri isso invertendo.
   *
   * A primeira versão passava o arquivo por `semComentariosDeCodigo` antes de
   * parsear, "para não ler comentário como código". A inversão que removia esse
   * passo e plantava um `it.only("x", () => { expect(1).toBe(1); })` DENTRO de
   * um comentário não reprovou: nada mudou.
   *
   * O motivo é que o passo era redundante. Esta varredura procura
   * `CallExpression` na árvore, e o parser do TypeScript já trata comentário
   * como trivia — nenhum nó cobre o texto de um comentário, com ou sem
   * limpeza. Por construção, detector por AST é imune à classe de defeito que
   * limpador de comentário existe para evitar.
   *
   * Tirei a linha em vez de deixá-la: código defensivo que a inversão mostra
   * não defender nada afirma uma proteção que não existe, que é a versão
   * pequena do defeito desta sessão. O limpador continua onde ele conta — na
   * regra da premissa abaixo, que casa expressão regular contra o TEXTO do
   * `vitest.config.ts`.
   */
  const fonte = ts.createSourceFile(
    arquivo, readFileSync(arquivo, "utf8"), ts.ScriptTarget.Latest, true,
    arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  let quantosNesteArquivo = 0;
  const anda = (no: ts.Node) => {
    if (ts.isCallExpression(no)) {
      const { raiz, props } = cadeia(no);
      if (raiz === "it" || raiz === "test" || raiz === "describe") {
        const linha = fonte.getLineAndCharacterOfPosition(no.getStart(fonte)).line + 1;
        if (props.includes("only")) comOnly.push(`  · ${arquivo}:${linha} — ${raiz}.${props.join(".")}`);
        // Só a chamada MAIS EXTERNA da cadeia declara o teste: em
        // `it.each(X)("t", fn)` a interna é `it.each(X)`, que não tem corpo.
        const ehExterna = !(ts.isCallExpression(no.parent) && no.parent.expression === no);
        if (
          (raiz === "it" || raiz === "test") && ehExterna &&
          props.every((p) => VARIANTES_VALIDAS.has(p))
        ) {
          quantosNesteArquivo++;
          const corpo = corpoDoTeste(no);
          let temAsercao = false;
          if (corpo) {
            const olhar = (m: ts.Node) => {
              if (ts.isIdentifier(m) && (m.text === "expect" || m.text === "assert")) temAsercao = true;
              ts.forEachChild(m, olhar);
            };
            olhar(corpo);
          }
          declaracoes.push({
            arquivo, linha,
            titulo: (no.arguments[0]?.getText(fonte) ?? "?").replace(/\s+/g, " ").slice(0, 70),
            variantes: props,
            // Sem corpo de função (um `it("x")` de marcação) também não afirma.
            temAsercao: corpo !== null && temAsercao,
          });
        }
      }
    }
    ts.forEachChild(no, anda);
  };
  anda(fonte);
  if (quantosNesteArquivo === 0) semNenhumIt.push(`  · ${arquivo}`);
}

/**
 * `it` que pode não afirmar nada, com o motivo.
 *
 * Vazio, e é o estado a defender. Para acrescentar uma entrada, escreva o que
 * o teste garante sem cobrar nada — e desconfie da resposta.
 */
const PODEM_NAO_AFIRMAR: Record<string, string> = {};

describe("a suíte roda o que existe", () => {
  it("todo arquivo de teste versionado está no alcance do vitest", () => {
    const fora = arquivos.filter((a) => !a.startsWith("src/"));
    expect(
      fora,
      `\n${fora.map((a) => `  · ${a}`).join("\n")}\n\n` +
        "Este arquivo de teste está versionado e o vitest NUNCA o roda: o\n" +
        "`include` do `vitest.config.ts` é `src/**/*.{test,spec}.{ts,tsx}`.\n" +
        "Ele existe, parece guarda, e a suíte segue verde sem ele.\n\n" +
        "Mova para `src/` ou amplie o `include` — e, se ampliar, conserte a\n" +
        "premissa cobrada no `it` seguinte.",
    ).toEqual([]);
  });

  it("a premissa continua valendo: o `include` do vitest é o que se supõe", () => {
    /**
     * Isto não é exigência, é a PREMISSA da regra acima, remedida. Se o
     * `include` for ampliado, a regra acima fica mais rígida do que precisa — e
     * guarda rígida sem motivo é guarda que alguém desliga. Então a asserção
     * reprova pedindo para RECONSIDERAR a regra, não para desfazer a mudança.
     */
    const config = semComentariosDeCodigo(
      readFileSync("vitest.config.ts", "utf8"), "vitest.config.ts",
    );
    expect(
      config,
      "o `include` do vitest mudou. A regra acima exige que todo teste esteja " +
        "em `src/`; se o alcance foi ampliado de propósito, amplie a regra junto.",
    ).toMatch(/include:\s*\["src\/\*\*\/\*\.\{test,spec\}\.\{ts,tsx\}"\]/);
  });

  it("nenhum `.only` silencia os vizinhos", () => {
    expect(
      comOnly,
      `\n${comOnly.join("\n")}\n\n` +
        "Um `.only` faz o vitest rodar SÓ este teste no arquivo e relatar\n" +
        "sucesso — todos os outros do mesmo arquivo somem da execução sem\n" +
        "aparecer como pulados. É a forma mais barata de desligar um arquivo\n" +
        "inteiro de guardas sem que a CI note.",
    ).toEqual([]);
  });

  it("`it.only` dentro de comentário não é acusado", () => {
    /**
     * O que a inversão ensinou, fixado como caso. Metade dos arquivos desta
     * pasta DISCUTE `it.only` em prosa — este mesmo, aqui, três vezes — e um
     * detector por texto acusaria todos eles.
     *
     * Não há limpeza de comentário nesta varredura, e é de propósito: o parser
     * trata comentário como trivia, então um `it.only(…)` comentado não é
     * `CallExpression` nenhuma. O caso abaixo é a prova de que a imunidade é por
     * construção e não por sorte.
     */
    const plantado = 'import { it, expect } from "vitest";\n' +
      '// it.only("comentado", () => { expect(1).toBe(1); });\n' +
      '/* it.only("em bloco", () => { expect(1).toBe(1); }); */\n' +
      'it("de verdade", () => { expect(1).toBe(1); });\n';
    const fonte = ts.createSourceFile(
      "plantado.test.ts", plantado, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS,
    );
    const achados: string[] = [];
    const anda = (no: ts.Node) => {
      if (ts.isCallExpression(no)) {
        const { raiz, props } = cadeia(no);
        if ((raiz === "it" || raiz === "test") && props.includes("only")) {
          achados.push(no.getText(fonte).slice(0, 40));
        }
      }
      ts.forEachChild(no, anda);
    };
    anda(fonte);
    expect(achados, "um `it.only` comentado foi lido como chamada").toEqual([]);
  });

  it("todo arquivo de teste tem pelo menos um teste", () => {
    expect(
      semNenhumIt,
      `\n${semNenhumIt.join("\n")}\n\n` +
        "Arquivo de teste sem nenhum `it`/`test` passa por vazio: ele conta\n" +
        "como arquivo que passou, e não cobra nada.",
    ).toEqual([]);
  });

  it("todo teste chega a afirmar alguma coisa", () => {
    const mudos = declaracoes
      .filter((d) => !d.temAsercao && !(`${d.arquivo}:${d.linha}` in PODEM_NAO_AFIRMAR))
      .map((d) => `  · ${d.arquivo}:${d.linha} — ${d.titulo}`);
    expect(
      mudos,
      `\n${mudos.join("\n")}\n\n` +
        "Este teste roda e não cobra nada: sem `expect`, o corpo pode fazer o\n" +
        "que quiser e o resultado é 'passou'. Se a garantia é 'não estoura',\n" +
        "escreva isso — `expect(() => f()).not.toThrow()` —, porque aí a guarda\n" +
        "aparece no relatório e sobrevive a um refactor que remova a chamada.",
    ).toEqual([]);
  });

  it("toda dispensa aponta para um teste que de fato não afirma", () => {
    for (const [lugar, motivo] of Object.entries(PODEM_NAO_AFIRMAR)) {
      expect(motivo.length, `a dispensa de ${lugar} não tem motivo escrito`).toBeGreaterThan(30);
      const achado = declaracoes.find((d) => `${d.arquivo}:${d.linha}` === lugar);
      expect(achado, `PODEM_NAO_AFIRMAR aponta para ${lugar}, que não é um teste`).toBeDefined();
      expect(
        achado!.temAsercao,
        `${lugar} está dispensado mas já afirma algo — tire a dispensa`,
      ).toBe(false);
    }
  });
});

describe("os pisos desta varredura", () => {
  /**
   * Quatro zeros afirmados acima, e zero é o que uma varredura que não acha
   * nada também devolve. Cada piso mata uma forma de o zero ser falso.
   */
  it("achou os arquivos de teste do repositório", () => {
    expect(
      arquivos.length,
      `só ${arquivos.length} arquivos de teste versionados — eram 144 quando ` +
        "esta guarda foi escrita; o `git ls-files` ou o filtro pararam de casar",
    ).toBeGreaterThan(100);
  });

  it("achou as declarações de teste, nas duas formas", () => {
    expect(
      declaracoes.length,
      `só ${declaracoes.length} declarações de \`it\`/\`test\` — eram 1313`,
    ).toBeGreaterThan(900);
    // `it.each(...)(...)` é a outra forma, e existe em cinco arquivos daqui.
    // Sem reconhecê-la, a regra "todo arquivo tem um teste" acusaria um arquivo
    // cujos testes são todos `it.each` — falso vermelho —, e a regra da
    // asserção não olharia nenhum deles.
    expect(
      declaracoes.filter((d) => d.variantes.includes("each")).length,
      "nenhum `it.each` reconhecido — o detector só entende a forma simples",
    ).toBeGreaterThan(0);
  });

  it("o detector reconhece as formas, e distingue `only` de `each`", () => {
    // Contraprova em material plantado, para a varredura do repositório nunca
    // o encontrar.
    const ler = (codigo: string) => {
      const f = ts.createSourceFile("p.ts", codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const achados: Array<{ raiz: string | null; props: string[] }> = [];
      const anda = (n: ts.Node) => {
        if (ts.isCallExpression(n)) {
          const c = cadeia(n);
          if (c.raiz === "it" || c.raiz === "test") achados.push(c);
        }
        ts.forEachChild(n, anda);
      };
      anda(f);
      return achados;
    };
    expect(ler('it("a", () => {});')[0]).toEqual({ raiz: "it", props: [] });
    expect(ler('it.only("a", () => {});')[0].props).toEqual(["only"]);
    expect(ler('it.each([1])("a", () => {});')[0].props).toEqual(["each"]);
    expect(ler('test.skip("a", () => {});')[0].props).toEqual(["skip"]);
    // E o corpo é achado na forma `it.each(X)(titulo, fn)`.
    const f = ts.createSourceFile(
      "p.ts", 'it.each([1])("a", () => { expect(1).toBe(1); });',
      ts.ScriptTarget.Latest, true, ts.ScriptKind.TS,
    );
    let externa: ts.CallExpression | null = null;
    const anda = (n: ts.Node) => {
      if (ts.isCallExpression(n) && !(ts.isCallExpression(n.parent) && n.parent.expression === n)) {
        if (cadeia(n).raiz === "it") externa = n;
      }
      ts.forEachChild(n, anda);
    };
    anda(f);
    expect(externa, "não achou a chamada externa de `it.each`").not.toBeNull();
    expect(corpoDoTeste(externa!), "não achou o corpo de `it.each`").not.toBeNull();
  });
});
