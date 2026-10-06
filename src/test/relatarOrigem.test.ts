/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import ts from "typescript";
// @ts-expect-error -- `.mjs` sem tipos; é script de verificação, não código do app.
import { criarRelator, daTela } from "../../scripts/lib/relatar.mjs";

/**
 * Cada número do relatório diz de onde veio.
 *
 * ## O defeito
 *
 * `ferramentas-verificar.mjs` — a conferência que roda todo dia contra produção
 * e cujo resultado chega como agenda — tem dois relatores: `conferir`, que
 * imprime `tela:`, e `conferirDado`, que imprime `dado:`. O comentário do
 * primeiro já dizia a regra, e já registrava que ela havia sido violada:
 *
 *   > "Havia conferências passando por aqui com valor vindo do RPC, e a saída
 *   >  anunciava 'tela: Medtronic' sobre um número que ninguém tinha lido da
 *   >  página. Rótulo que mente sobre a própria origem é a versão pequena do
 *   >  defeito que este script existe para pegar."
 *
 * A regra estava escrita, o `conferirDado` existia, e tinha UMA chamada. Das 30
 * chamadas a `conferir`, **24** passavam valor vindo de `await resp.json()` ou
 * de um `status` de HTTP. A agenda imprimia 24 linhas `tela: N` sobre dados que
 * nunca tocaram a página, e fechava com "31 de 31 conferências passaram".
 *
 * A rota por `fetch` é deliberada e está documentada: o navegador daquele
 * contêiner recebe `ERR_CONNECTION_RESET` no RPC do catálogo (~150 kB). O
 * comentário de lá diz que "fingir que mediu isso num navegador que não alcança
 * o banco seria justamente o verde vazio que este script existe para impedir" —
 * e o prefixo `tela:` fazia o fingimento trinta linhas acima dessa frase.
 * Defeito do rótulo, não da rota.
 *
 * ## Como eu medi, e o erro que cometi medindo
 *
 * Minha primeira contagem disse "22 de 29" e estava errada: o extrator
 * mascarava literais de texto por expressão regular e perdeu duas chamadas de
 * uma linha só. Contei de novo com o analisador de verdade (`typescript`): 31
 * chamadas, 30 de `conferir`, 24 sem tela. O número errado era o mais
 * tranquilizador dos dois — como de hábito.
 *
 * É a décima vez nesta sessão que um analisador por expressão regular se perde
 * num delimitador, e a segunda vez num medidor que eu mesmo escrevi no mesmo
 * dia. Daí esta guarda contar pelo AST.
 *
 * ## As duas metades
 *
 * `conferir` PARA se receber valor sem `daTela()` — mas só quando a chamada
 * executa, e um ramo que não rodou naquele dia não é conferido por ninguém. A
 * varredura por AST confere os 30 call sites, executados ou não.
 *
 * ## O que esta guarda NÃO garante — medido, não suposto
 *
 * `daTela(x)` é DECLARAÇÃO de origem, não prova dela. Uma das inversões desta
 * rodada envolveu um dado do RPC em `daTela(...)` e passou, de propósito:
 * nenhuma análise de texto segue a procedência de um número até o
 * `innerText()` que o produziu, e detector que tenta isso erra dos dois lados
 * — que é o defeito que os testes desta base já tiveram.
 *
 * O que ela elimina é o caso em que NINGUÉM declarou nada e a saída afirmou
 * `tela:` sozinha, que era o estado de 24 das 30 conferências. Quem escrever
 * `daTela` sobre um dado da API tem de digitar a mentira; antes bastava não
 * pensar no assunto. É o piso, não o teto, e está escrito para ninguém ler
 * "origem conferida" onde está "origem declarada".
 */

const RELATOR = "scripts/lib/relatar.mjs";

describe("o relator distingue tela de dado", () => {
  it("`conferir` para quando o valor não veio da tela, e diz o rótulo", () => {
    // A metade em tempo de execução. O rótulo entra na mensagem porque sem ele
    // quem topar com o erro não sabe QUAL conferência consertar.
    const { conferir } = criarRelator({ imprimir: () => {} });
    expect(() => conferir("catálogo: nenhuma EOA sem fonte", 0, 0))
      .toThrow(/catálogo: nenhuma EOA sem fonte/);
    expect(() => conferir("x", 0, 0)).toThrow(/não veio da tela/);
    // As formas em que um valor cru chega: número, texto, nulo, objeto comum.
    for (const cru of [0, 42, "texto", null, undefined, { valor: 1 }]) {
      expect(() => conferir("x", cru as never, 0), `aceitou ${JSON.stringify(cru)}`).toThrow();
    }
  });

  it("`conferir` com `daTela` imprime `tela:` e registra a origem", () => {
    const saida: string[] = [];
    const r = criarRelator({ imprimir: (l: string) => saida.push(l) });
    r.conferir("superfície corporal", daTela(1.68), 1.68, 0.006);
    expect(saida.join("\n"), "o prefixo impresso É o conserto").toContain("tela: 1.68");
    expect(saida.join("\n")).not.toContain("dado:");
    expect(r.casos[0].origem).toBe("tela");
    expect(r.falhas).toEqual([]);
  });

  it("`conferirDado` imprime `dado:` e aceita valor cru", () => {
    const saida: string[] = [];
    const r = criarRelator({ imprimir: (l: string) => saida.push(l) });
    r.conferirDado("catálogo: nenhum tamanho acima de 42 mm", 0, 0);
    expect(saida.join("\n")).toContain("dado: 0");
    expect(saida.join("\n")).not.toContain("tela:");
    expect(r.casos[0].origem).toBe("dado");
  });

  it("a comparação continua funcionando nos dois relatores", () => {
    // O conserto mexeu no caminho por onde TODAS as 31 conferências passam.
    // Se a tolerância ou a comparação por expressão regular tivessem quebrado,
    // o script passaria a dizer ✓ sobre qualquer número — e a agenda ficaria
    // verde sobre o que quer que produção estivesse servindo.
    const r = criarRelator({ imprimir: () => {} });
    expect(r.conferir("dentro da tolerância", daTela(1.684), 1.68, 0.006)).toBe(true);
    expect(r.conferir("fora da tolerância", daTela(1.9), 1.68, 0.006)).toBe(false);
    expect(r.conferirDado("sem tolerância, exato", 0, 0)).toBe(true);
    expect(r.conferirDado("sem tolerância, diferente", 1, 0)).toBe(false);
    expect(r.conferirDado("regex casa", 21, /^[1-9]/)).toBe(true);
    expect(r.conferirDado("regex não casa", 0, /^[1-9]/)).toBe(false);
    expect(r.falhas).toEqual([
      "fora da tolerância", "sem tolerância, diferente", "regex não casa",
    ]);
    expect(r.quantasDe("tela")).toBe(2);
    expect(r.quantasDe("dado")).toBe(4);
  });

  it("cada relator começa limpo", () => {
    // Fábrica em vez de estado de módulo: um `zerar()` esquecido entre dois
    // testes é contagem de um vazando no outro, e aí o número que esta guarda
    // confere passa a medir outra coisa.
    const a = criarRelator({ imprimir: () => {} });
    a.conferirDado("um", 0, 0);
    const b = criarRelator({ imprimir: () => {} });
    expect(b.casos).toEqual([]);
    expect(a.casos).toHaveLength(1);
  });
});

describe("nenhuma conferência afirma `tela` sem ter lido a tela", () => {
  /**
   * A varredura estática, por AST — a metade que a verificação em tempo de
   * execução não cobre: um ramo que não executou naquele dia não é conferido
   * por ninguém, e era num ramo desses que o `conferirDado` original ficou
   * esquecido por 24 chamadas.
   *
   * Varre `scripts/` inteiro, e não só o arquivo onde o defeito apareceu:
   * regra amarrada ao diretório do defeito é o próprio defeito.
   *
   * ## A primeira versão desta regra era larga demais
   *
   * Ela proibia qualquer script de definir o seu próprio `conferir`, e acusou
   * `conferir-publicacao.mjs` — que tem um relator local, sim, e imprime
   * `obtido:`. Esse prefixo não afirma origem nenhuma, e todos os valores de lá
   * vêm do RPC: o script é honesto e a regra o reprovava. Guarda que pune quem
   * fez certo é guarda que alguém desliga.
   *
   * A garantia de verdade é mais estreita: **a palavra `tela:` num relatório só
   * pode sair do caminho marcado.** Daí as duas regras abaixo — uma cobre as
   * chamadas do relator compartilhado, a outra impede que alguém recrie um
   * relator que afirme tela por fora dele.
   */
  const fora = new Set(["node_modules", "dist"]);
  function arquivosMjs(raiz: string): string[] {
    const saida: string[] = [];
    const andar = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        if (fora.has(nome) || nome.startsWith(".")) continue;
        const caminho = `${dir}/${nome}`;
        if (statSync(caminho).isDirectory()) andar(caminho);
        else if (nome.endsWith(".mjs")) saida.push(caminho);
      }
    };
    andar(raiz);
    return saida.sort();
  }

  const scripts = arquivosMjs("scripts");
  const lido = scripts.map((arquivo) => {
    const texto = readFileSync(arquivo, "utf8");
    return {
      arquivo,
      texto,
      fonte: ts.createSourceFile(arquivo, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS),
    };
  });

  /**
   * Importa do relator compartilhado? Então a regra A vale.
   *
   * Qualquer importação dele serve: o `conferir` não vem no `import`, vem de
   * desestruturar `criarRelator()`. A primeira versão desta função exigia o
   * nome `conferir` na cláusula de importação, não achou nenhum arquivo, e a
   * regra A passou com ZERO chamadas conferidas — verde vazio dentro da guarda
   * contra verde vazio. Quem pegou foi o piso, três `it` abaixo.
   */
  const importaDoRelator = ({ fonte }: { fonte: ts.SourceFile }) =>
    fonte.statements.some(
      (st) =>
        ts.isImportDeclaration(st) &&
        ts.isStringLiteral(st.moduleSpecifier) &&
        st.moduleSpecifier.text.includes("lib/relatar.mjs"),
    );

  const usamORelator = lido.filter(importaDoRelator);

  interface Chamada { arquivo: string; linha: number; rotulo: string; valor: string }
  const chamadas: Chamada[] = [];
  for (const { arquivo, fonte } of usamORelator) {
    const anda = (no: ts.Node) => {
      if (ts.isCallExpression(no) && ts.isIdentifier(no.expression) && no.expression.text === "conferir") {
        chamadas.push({
          arquivo,
          linha: fonte.getLineAndCharacterOfPosition(no.getStart(fonte)).line + 1,
          rotulo: (no.arguments[0]?.getText(fonte) ?? "?").replace(/\s+/g, " ").slice(0, 60),
          valor: (no.arguments[1]?.getText(fonte) ?? "(sem segundo argumento)")
            .replace(/\s+/g, " ").slice(0, 80),
        });
      }
      ts.forEachChild(no, anda);
    };
    anda(fonte);
  }

  it("A. toda chamada ao `conferir` do relator passa o valor por `daTela(...)`", () => {
    const sem = chamadas.filter((c) => !/^daTela\s*\(/.test(c.valor));
    expect(
      sem.map((c) => `${c.arquivo}:${c.linha} ${c.rotulo}`),
      "\n" + sem.map((c) => `  · ${c.arquivo}:${c.linha}  valor: ${c.valor}`).join("\n") +
        "\n\nEsta conferência vai imprimir `tela:` sobre um valor que ninguém\n" +
        "declarou como lido da página. Era o estado de 24 das 30 chamadas, e a\n" +
        "agenda diária afirmava ter conferido a tela 24 vezes a mais do que\n" +
        "conferia.\n\n" +
        "Se o valor saiu do texto da página, embrulhe com `daTela(...)`. Se veio\n" +
        "da API ou foi calculado no script, use `conferirDado` — a saída dele diz\n" +
        "`dado:`, que é a verdade.",
    ).toEqual([]);
  });

  it("B. só o relator pode imprimir o rótulo `tela:`", () => {
    /**
     * A saída de escape da regra A: um relator local que imprima `tela:` sem
     * cobrar a marca devolve as 30 chamadas ao estado anterior com a guarda
     * verde. A marca é um `Symbol` privado do módulo, então só a definição de
     * lá consegue exigi-la.
     *
     * Olha só LITERAIS de texto, pelo AST. Os comentários do próprio
     * `ferramentas-verificar.mjs` citam `tela:` cinco vezes ao explicar este
     * defeito — guarda que lê comentário não confere código, e esta é a décima
     * vez que a lição aparece nesta sessão.
     *
     * `conferir-publicacao.mjs` tem relator próprio e passa: ele imprime
     * `obtido:`, que não afirma origem.
     */
    const culpados: string[] = [];
    for (const { arquivo, fonte } of lido) {
      if (arquivo.endsWith("lib/relatar.mjs")) continue;
      const anda = (no: ts.Node) => {
        const ehTexto =
          ts.isStringLiteral(no) ||
          ts.isNoSubstitutionTemplateLiteral(no) ||
          ts.isTemplateHead(no) ||
          ts.isTemplateMiddle(no) ||
          ts.isTemplateTail(no);
        if (ehTexto && /tela:/.test((no as ts.LiteralLikeNode).text)) {
          const { line } = fonte.getLineAndCharacterOfPosition(no.getStart(fonte));
          culpados.push(`  · ${arquivo}:${line + 1}`);
        }
        ts.forEachChild(no, anda);
      };
      anda(fonte);
    }
    expect(
      culpados,
      "\n" + culpados.join("\n") + "\n\n" +
        "Este literal imprime o rótulo `tela:` por fora do relator, que é a\n" +
        "única coisa capaz de cobrar a marca de `daTela()`. Um relator local que\n" +
        "afirme tela sem cobrar a marca desfaz o conserto com a guarda verde.\n\n" +
        "Importe `conferir` de `" + RELATOR + "`, ou use um rótulo que não\n" +
        "afirme origem — `obtido:`, como o `conferir-publicacao.mjs` faz.",
    ).toEqual([]);
  });

  it("os pisos da varredura", () => {
    // Três zeros afirmados acima, e zero é o que uma varredura vazia devolve.
    expect(scripts.length, "nenhum `.mjs` em `scripts/`").toBeGreaterThan(10);
    expect(
      usamORelator.map((l) => l.arquivo),
      "nenhum script importa `conferir` do relator — a regra A não conferiu nada",
    ).toContain("scripts/ferramentas-verificar.mjs");
    expect(
      chamadas.length,
      `só ${chamadas.length} chamadas a \`conferir\` — eram 6 (as da calculadora, ` +
        "que de fato leem `innerText()`) quando esta guarda foi escrita",
    ).toBeGreaterThanOrEqual(6);
  });
});
