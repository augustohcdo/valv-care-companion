/// <reference types="node" />
import ts from "typescript";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Detector: valor ESCRITO num lugar que ninguém LÊ.
 *
 * ## A classe que nenhum detector daqui olhava
 *
 * Este repositório já tem quatro famílias de detector e todas medem o mesmo
 * eixo — se o `error` de uma chamada ao Supabase foi observado. `restore.mjs`
 * tinha isto:
 *
 *     const carregado = {};
 *     for (const tabela of ordem) {
 *       try {
 *         carregado[tabela] = await inserir(`public.${tabela}`, linhas, …);
 *       } catch (e) {
 *         carregado[tabela] = `ERRO: ${e.message.slice(0, 120)}`;
 *       }
 *     }
 *
 * `carregado` nunca é lido depois. A mensagem de por que a tabela mais
 * importante do sistema recusou a carga era gravada e jogada fora, e a
 * conferência do fim mostrava "esperado 50, no alvo 0" sem dizer o motivo — no
 * script da restauração de desastre, lido uma vez na vida, sob pressão.
 *
 * Nenhuma guarda viu, por três razões somadas:
 *
 *   · `resultadoNaoSePerde` varre só `src/` e `supabase/functions/`, e só
 *     `.ts`/`.tsx`. Os 36 `.mjs` de `scripts/` — que são justamente os que
 *     falam com produção — nunca passaram por detector de AST nenhum;
 *   · os detectores existentes procuram a FORMA de uma chamada ao Supabase, e
 *     os scripts usam `fetch` cru;
 *   · `@typescript-eslint/no-unused-vars` está desligado aqui de propósito,
 *     porque "não usado é estilo". Isto não é estilo: é trabalho feito e
 *     descartado.
 *
 * Medido com o detector pronto: **zero** em 321 arquivos de `src/`,
 * `supabase/functions/`, `scripts/` e `.github/` — depois do conserto. Antes,
 * um: o `carregado`.
 *
 * ## O que conta como escrita, e o que conta como leitura
 *
 * Escrita (o valor entra e não sai):
 *
 *   · `x = …`, e toda atribuição composta (`+=`, `??=`, …);
 *   · `x++`, `--x`;
 *   · `x[k] = …` e `x.k = …`;
 *   · `x.push(…)` e os outros mutadores da lista abaixo.
 *
 * Leitura é todo o resto — argumento, retorno, condição, template, `x.length`,
 * iteração. Repassar adiante conta como ler: quem recebeu é que decide.
 *
 * Fora da acusação de propósito: a declaração sem escrita nenhuma
 * (`const x = f();` e ponto). Isso é o território do `no-unused-vars`, que este
 * repositório desligou por decisão, e acusar junto enterraria o sinal que
 * importa num monte de ruído de estilo.
 *
 * ## O limite, e para que lado ele erra
 *
 * O casamento de nomes é por TEXTO dentro do arquivo, não por resolução de
 * escopo: um homônimo em outra função, se for lido, conta como leitura do
 * primeiro. Quer dizer que o detector **subnotifica** — ele deixa passar, nunca
 * inventa. É o lado certo para errar, porque falso vermelho custa o mesmo que
 * falso verde, e uma guarda que acusa quem fez certo é uma guarda que alguém
 * desliga. O caso plantado `homonimoNaoAcusa` fixa esse comportamento.
 */

/** Métodos que MUTAM o objeto sem que o valor dele seja consumido. */
const MUTADORES = new Set([
  "push", "unshift", "pop", "shift", "splice",
  "add", "set", "delete", "clear",
]);

export interface EscritoNuncaLido {
  arquivo: string;
  linha: number;
  nome: string;
  escritas: number;
}

export function formatarEscrito(a: EscritoNuncaLido): string {
  return `  · ${a.arquivo}:${a.linha}  \`${a.nome}\` — ${a.escritas} escrita(s), nenhuma leitura`;
}

/**
 * Arquivos de código de uma raiz, incluindo `.mjs`.
 *
 * `arquivosDeCodigo` de `astDeChamadas` só pega `.ts`/`.tsx`, e é por isso que
 * `scripts/` nunca foi varrido. Esta aceita as três extensões.
 */
export function arquivosComMjs(raizes: string[]): string[] {
  const saida: string[] = [];
  const andar = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      if (nome === "node_modules" || nome === "dist" || nome.startsWith(".")) continue;
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) {
        andar(caminho);
        continue;
      }
      if (!/\.(mjs|ts|tsx)$/.test(nome)) continue;
      // `src/test/` fica fora: os detectores daqui carregam material plantado —
      // inclusive, neste arquivo, mapas escritos e nunca lidos de propósito.
      if (/\.test\.(ts|tsx)$/.test(nome) || /(^|\/)src\/test\//.test(caminho)) continue;
      saida.push(caminho);
    }
  };
  for (const raiz of raizes) {
    try {
      andar(raiz);
    } catch {
      // Raiz que não existe neste checkout não é achado; quem cobra que ela
      // exista é o piso da guarda.
    }
  }
  return saida.sort();
}

export function fonteDe(arquivo: string, texto?: string): ts.SourceFile {
  return ts.createSourceFile(
    arquivo,
    texto ?? readFileSync(arquivo, "utf8"),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX
      : arquivo.endsWith(".mjs") || arquivo.endsWith(".js") ? ts.ScriptKind.JS
        : ts.ScriptKind.TS,
  );
}

/** Classifica uma ocorrência do identificador: escrita, leitura ou homonímia. */
function classificar(no: ts.Identifier): "escrita" | "leitura" | "nada" {
  const pai = no.parent;
  if (!pai) return "leitura";

  // Homonímia: chave de objeto, nome de propriedade, outra ligação.
  if (ts.isPropertyAssignment(pai) && pai.name === no) return "nada";
  if (ts.isPropertyAccessExpression(pai) && pai.name === no) return "nada";
  if (ts.isPropertySignature(pai) && pai.name === no) return "nada";
  if (ts.isBindingElement(pai) && pai.propertyName === no) return "nada";
  if (ts.isVariableDeclaration(pai) && pai.name === no) return "nada";
  if (ts.isParameter(pai) && pai.name === no) return "nada";

  // `x = …`, `x += …`, `x ??= …`
  if (
    ts.isBinaryExpression(pai) && pai.left === no &&
    pai.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    pai.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  ) return "escrita";

  // `x++`, `--x`
  if (
    (ts.isPostfixUnaryExpression(pai) || ts.isPrefixUnaryExpression(pai)) &&
    pai.operand === no &&
    (pai.operator === ts.SyntaxKind.PlusPlusToken || pai.operator === ts.SyntaxKind.MinusMinusToken)
  ) return "escrita";

  // `x[k] = …`  /  `x.k = …`
  if (
    (ts.isElementAccessExpression(pai) || ts.isPropertyAccessExpression(pai)) &&
    pai.expression === no &&
    ts.isBinaryExpression(pai.parent) && pai.parent.left === pai &&
    pai.parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    pai.parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  ) return "escrita";

  // `x.push(…)` e amigos
  if (
    ts.isPropertyAccessExpression(pai) && pai.expression === no &&
    MUTADORES.has(pai.name.text) &&
    ts.isCallExpression(pai.parent) && pai.parent.expression === pai
  ) return "escrita";

  return "leitura";
}

/** Declarações do arquivo que recebem valor e nunca são lidas. */
export function escritosNuncaLidos(arquivo: string, fonte: ts.SourceFile): EscritoNuncaLido[] {
  const declaracoes: ts.VariableDeclaration[] = [];
  const colher = (no: ts.Node) => {
    if (ts.isVariableDeclaration(no) && ts.isIdentifier(no.name)) declaracoes.push(no);
    ts.forEachChild(no, colher);
  };
  colher(fonte);

  const achados: EscritoNuncaLido[] = [];
  for (const decl of declaracoes) {
    const nome = (decl.name as ts.Identifier).text;
    let leituras = 0;
    let escritas = 0;
    const olhar = (no: ts.Node) => {
      if (ts.isIdentifier(no) && no.text === nome && no !== decl.name) {
        const q = classificar(no);
        if (q === "escrita") escritas++;
        else if (q === "leitura") leituras++;
      }
      ts.forEachChild(no, olhar);
    };
    olhar(fonte);

    if (leituras === 0 && escritas > 0) {
      achados.push({
        arquivo, nome, escritas,
        linha: fonte.getLineAndCharacterOfPosition(decl.getStart(fonte)).line + 1,
      });
    }
  }
  return achados;
}
