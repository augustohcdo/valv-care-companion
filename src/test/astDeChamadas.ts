/// <reference types="node" />
import ts from "typescript";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Detector por AST: o resultado da chamada ao banco não se perde.
 *
 * ## Por que um detector por AST, se já existem quatro por expressão regular
 *
 * `detectorDeChamadasCegas.ts` varre escritas, leituras, `storage` e `auth` por
 * texto, e faz isso bem. Mas ele tem um limite ESCRITO no próprio arquivo que o
 * usa, em `readErrors.test.ts`:
 *
 *   > "O detector cobra que o `error` seja DESESTRUTURADO junto da chamada —
 *   >  observado —, não que alguém faça algo com ele. Tirar a ação e deixar a
 *   >  observação passa."
 *
 * Esse é o vão: `const { data, error } = await …;` com o `error` nunca mais
 * mencionado tem a CARA de conferido e não confere nada. O lint não acusa —
 * `@typescript-eslint/no-unused-vars` está desligado neste repositório, de
 * propósito, porque "não usado é estilo". Aqui não é estilo: é a diferença
 * entre uma recusa de RLS vista e uma engolida.
 *
 * Por texto isso não se decide — exige saber quais identificadores são o MESMO
 * nome e quais são chave de objeto (`return { error: null }` não é uso de
 * `error`) ou nome de propriedade (`outro.error` não é). É análise de escopo, e
 * é exatamente o que a AST dá de graça.
 *
 * ## A segunda razão: um método independente
 *
 * Esta sessão tropeçou nove vezes no mesmo defeito de analisador — regex
 * parando num delimitador que estava DENTRO do que ela devia capturar: o `]` de
 * `"[data-carregando]"`, o primeiro backtick de um rótulo concatenado em três,
 * o `{` de um padrão de desestruturação, o `\(` dentro de um literal de regex.
 * Toda vez o sintoma foi o mesmo: a varredura relatou um número e o número
 * estava errado para baixo.
 *
 * Um segundo detector, que não divide o analisador com o primeiro, mede a mesma
 * garantia por outro caminho. Quando os dois dão zero, o zero vale mais; quando
 * divergem, a divergência aponta o bug de um dos dois — que é informação que
 * nenhum dos dois produz sozinho.
 *
 * O que ele NÃO faz: decidir se o tratamento do erro é adequado. `if (error)
 * return;` conta como uso. Separar "tratou" de "viu e seguiu" exige entender a
 * intenção, e detector que tenta isso erra dos dois lados — defeito que estes
 * testes já tiveram. Esta medida é o piso: quantas vezes o erro não é nem
 * mencionado.
 */

/** Uma ocorrência, com arquivo, linha e o trecho que a provoca. */
export interface Achado {
  arquivo: string;
  linha: number;
  nome: string;
  trecho: string;
}

export function formatar(a: Achado): string {
  return `  · ${a.arquivo}:${a.linha}  [${a.nome}]  ${a.trecho}`;
}

/** Arquivos `.ts`/`.tsx` de código — testes e dependências ficam fora. */
export function arquivosDeCodigo(raizes: string[]): string[] {
  const saida: string[] = [];
  const andar = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      if (nome === "node_modules" || nome === "dist" || nome.startsWith(".")) continue;
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) {
        andar(caminho);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(nome)) continue;
      /**
       * `src/test/` fica fora de propósito, e não por preguiça: os detectores
       * deste diretório carregam material plantado — chamadas que engolem o
       * erro, escritas sem `.select()` — para provar que acusam. Varrer o
       * próprio material de prova acusaria a prova.
       */
      if (/\.test\.(ts|tsx)$/.test(nome) || /(^|\/)src\/test\//.test(caminho)) continue;
      saida.push(caminho);
    }
  };
  for (const raiz of raizes) andar(raiz);
  return saida.sort();
}

export function lerFonte(arquivo: string, texto?: string): ts.SourceFile {
  return ts.createSourceFile(
    arquivo,
    texto ?? readFileSync(arquivo, "utf8"),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

/**
 * O identificador está sendo USADO, ou só aparece com o mesmo nome?
 *
 * As quatro negativas são as que separam uso de homonímia, e todas aparecem
 * nesta base:
 *
 *   · `return { error: null }`   — chave de objeto literal, não leitura;
 *   · `const { error: e } = …`   — `error` aqui é o nome do campo de origem;
 *   · `resposta.error`           — propriedade de OUTRO objeto;
 *   · outra ligação com o mesmo nome — declaração, não uso.
 *
 * `{ error }` abreviado conta como uso: repassar o erro adiante é tratá-lo.
 */
export function ehUso(no: ts.Identifier): boolean {
  const pai = no.parent;
  if (!pai) return true;
  if (ts.isPropertyAssignment(pai) && pai.name === no) return false;
  if (ts.isBindingElement(pai) && pai.propertyName === no) return false;
  if (ts.isBindingElement(pai) && pai.name === no) return false;
  if (ts.isPropertyAccessExpression(pai) && pai.name === no) return false;
  if (ts.isPropertySignature(pai) && pai.name === no) return false;
  if (ts.isShorthandPropertyAssignment(pai) && pai.name === no) return true;
  return true;
}

/** A função que contém o nó — ou o arquivo, se for nível de módulo. */
function escopoDe(no: ts.Node): ts.Node {
  let atual: ts.Node | undefined = no.parent;
  while (
    atual &&
    !ts.isFunctionDeclaration(atual) &&
    !ts.isFunctionExpression(atual) &&
    !ts.isArrowFunction(atual) &&
    !ts.isMethodDeclaration(atual) &&
    !ts.isSourceFile(atual)
  ) {
    atual = atual.parent;
  }
  return atual ?? no;
}

/**
 * `error` desestruturado e nunca referenciado no escopo onde foi declarado.
 *
 * Devolve também o total de desestruturações vistas, porque um detector que
 * lê zero desestruturações acha zero engolidas — e os dois zeros se parecem.
 */
export function errosEngolidos(fonte: ts.SourceFile): {
  achados: Achado[];
  desestruturacoes: number;
} {
  const achados: Achado[] = [];
  const ligacoes: Array<{ nome: string; no: ts.Identifier; decl: ts.VariableDeclaration }> = [];

  const anda = (no: ts.Node) => {
    if (ts.isVariableDeclaration(no) && ts.isObjectBindingPattern(no.name) && no.initializer) {
      for (const el of no.name.elements) {
        const chave = (el.propertyName ?? el.name).getText(fonte);
        if (chave !== "error") continue;
        if (!ts.isIdentifier(el.name)) continue;
        ligacoes.push({ nome: el.name.text, no: el.name, decl: no });
      }
    }
    ts.forEachChild(no, anda);
  };
  anda(fonte);

  for (const lig of ligacoes) {
    const escopo = escopoDe(lig.no);
    let usos = 0;
    const contar = (no: ts.Node) => {
      if (ts.isIdentifier(no) && no.text === lig.nome && no !== lig.no && ehUso(no)) usos++;
      ts.forEachChild(no, contar);
    };
    contar(escopo);
    if (usos > 0) continue;
    const { line } = fonte.getLineAndCharacterOfPosition(lig.no.getStart(fonte));
    achados.push({
      arquivo: fonte.fileName,
      linha: line + 1,
      nome: lig.nome,
      trecho: lig.decl.getText(fonte).replace(/\s+/g, " ").slice(0, 120),
    });
  }
  return { achados, desestruturacoes: ligacoes.length };
}

/** Nomes que o cliente do Supabase recebe nesta base. */
const CLIENTES = /^(supabase|admin|adminDoc|cliente|db|sb)$/;

/**
 * Métodos cujo retorno carrega `{ error }`. `select` entra junto porque uma
 * leitura descartada por inteiro é o caso mais grave da família: nem o dado
 * nem a falha chegam a existir.
 */
const METODOS_COM_ERRO = new Set([
  "insert", "update", "upsert", "delete", "rpc", "select",
  "upload", "remove", "download", "createSignedUrl", "list",
  "createUser", "updateUserById", "generateLink", "listUsers", "getUserById", "signOut",
]);

function raizDaCadeia(no: ts.Node): string | null {
  let atual: ts.Node = no;
  for (;;) {
    if (ts.isCallExpression(atual) || ts.isAwaitExpression(atual)) { atual = atual.expression; continue; }
    if (ts.isPropertyAccessExpression(atual) || ts.isElementAccessExpression(atual)) { atual = atual.expression; continue; }
    if (ts.isNonNullExpression(atual) || ts.isParenthesizedExpression(atual)) { atual = atual.expression; continue; }
    break;
  }
  return ts.isIdentifier(atual) ? atual.text : null;
}

function metodosDaCadeia(no: ts.Node): string[] {
  const nomes: string[] = [];
  let atual: ts.Node = no;
  for (;;) {
    if (ts.isAwaitExpression(atual)) { atual = atual.expression; continue; }
    if (ts.isCallExpression(atual)) {
      if (ts.isPropertyAccessExpression(atual.expression)) nomes.push(atual.expression.name.text);
      atual = atual.expression;
      continue;
    }
    if (ts.isPropertyAccessExpression(atual)) { nomes.push(atual.name.text); atual = atual.expression; continue; }
    if (ts.isNonNullExpression(atual) || ts.isParenthesizedExpression(atual)) { atual = atual.expression; continue; }
    break;
  }
  return nomes;
}

/**
 * `recordJobRun({ ok: true, … })` com contagem de itens falhados ao lado.
 *
 * ## A contradição que isto procura
 *
 * `job_runs.ok` é o campo que diz se a tarefa agendada fez o trabalho, e os
 * dois leitores dele — `job-watchdog` e o próprio resumo do administrador —
 * filtram por `.eq("ok", true)` sem olhar `items_failed`. O comentário do vigia
 * diz o que ele acha que está garantindo:
 *
 *   > "A última execução BEM SUCEDIDA. Uma tarefa que roda todo dia e falha
 *   >  todo dia não pode passar por saudável só porque rodou."
 *
 * Quem grava `ok: true` literal e `itemsFailed: N` na mesma chamada contou as
 * falhas e gravou sucesso. Não é descuido de quem lê: é a linha de sucesso
 * existindo sobre um trabalho que não foi feito, no campo cuja única função é
 * dizer que foi.
 *
 * O detector é propositalmente estreito: só acusa a CONTRADIÇÃO — `ok` literal
 * `true` junto de um `itemsFailed`. `ok: false` literal é legítimo (é o caminho
 * de falha), `ok` derivado é o que se quer, e uma tarefa sem noção de item não
 * passa `itemsFailed` e não é acusada. Guarda que pune quem fez certo é guarda
 * que alguém desliga.
 */
export function okCravadoComItensFalhados(fonte: ts.SourceFile): {
  achados: Achado[];
  chamadas: number;
} {
  const achados: Achado[] = [];
  let chamadas = 0;
  const anda = (no: ts.Node) => {
    if (
      ts.isCallExpression(no) &&
      ts.isIdentifier(no.expression) &&
      no.expression.text === "recordJobRun"
    ) {
      chamadas++;
      const arg = no.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) {
        const campo = (nome: string) =>
          arg.properties.find(
            (p) =>
              (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) &&
              p.name !== undefined &&
              p.name.getText(fonte) === nome,
          );
        const ok = campo("ok");
        const itens = campo("itemsFailed");
        const cravado =
          ok !== undefined &&
          ts.isPropertyAssignment(ok) &&
          ok.initializer.kind === ts.SyntaxKind.TrueKeyword;
        if (cravado && itens !== undefined) {
          const { line } = fonte.getLineAndCharacterOfPosition(no.getStart(fonte));
          achados.push({
            arquivo: fonte.fileName,
            linha: line + 1,
            nome: "ok: true + itemsFailed",
            trecho: itens.getText(fonte).replace(/\s+/g, " ").slice(0, 100),
          });
        }
      }
    }
    ts.forEachChild(no, anda);
  };
  anda(fonte);
  return { achados, chamadas };
}

/**
 * Chamada ao cliente cujo resultado é jogado fora por inteiro.
 *
 * O critério é sintático e exato: a expressão `await …` é um STATEMENT — não
 * está atribuída a nada, não é devolvida, não é argumento. `void await …`
 * também entra; escrever `void` não muda que ninguém olhou.
 *
 * É a mesma classe que os detectores por texto procuram. Medir por AST tem a
 * vantagem de não se perder em quebra de linha, comentário no meio da cadeia
 * nem literal com parêntese — as três coisas em que os de texto já se
 * perderam nesta base.
 */
export function resultadosDescartados(fonte: ts.SourceFile): Achado[] {
  const achados: Achado[] = [];
  const anda = (no: ts.Node) => {
    if (ts.isExpressionStatement(no)) {
      let expressao: ts.Expression = no.expression;
      if (ts.isVoidExpression(expressao)) expressao = expressao.expression;
      if (ts.isAwaitExpression(expressao)) {
        const alvo = expressao.expression;
        const raiz = raizDaCadeia(alvo);
        const metodos = metodosDaCadeia(alvo);
        if (raiz && CLIENTES.test(raiz) && metodos.some((m) => METODOS_COM_ERRO.has(m))) {
          const { line } = fonte.getLineAndCharacterOfPosition(no.getStart(fonte));
          achados.push({
            arquivo: fonte.fileName,
            linha: line + 1,
            nome: metodos.filter((m) => METODOS_COM_ERRO.has(m)).join("/"),
            trecho: no.getText(fonte).replace(/\s+/g, " ").slice(0, 120),
          });
        }
      }
    }
    ts.forEachChild(no, anda);
  };
  anda(fonte);
  return achados;
}

// ===========================================================================
// Leituras cegas, medidas por AST — a segunda opinião
// ===========================================================================

/**
 * O MESMO fato que `detectorDeChamadasCegas.ts` mede por expressão regular:
 * leitura do cliente do Supabase cujo `error` ninguém recebe.
 *
 * ## Por que medir duas vezes
 *
 * Porque o número do detector por texto é a DÍVIDA DECLARADA do projeto
 * (`DIVIDA_CONHECIDA` em `readErrors.test.ts`), e ele tem fragilidades que se
 * veem a olho nu: trunca o statement em 12 linhas, procura a desestruturação
 * num contexto que inclui COMENTÁRIOS, e caça `<nome>.error` numa janela de 8
 * linhas. Nenhuma dessas é um defeito hipotético — nesta sessão um analisador
 * por expressão regular se perdeu num delimitador dez vezes, duas delas em
 * medidores que eu mesmo escrevi no mesmo dia, e em todas o número saiu errado
 * para baixo.
 *
 * Dois métodos que não dividem analisador medem a mesma garantia por caminhos
 * diferentes. Quando os dois dão zero, o zero vale mais. Quando divergem, a
 * divergência aponta o defeito de um dos dois — informação que nenhum produz
 * sozinho.
 *
 * ## O que foi medido quando isto foi escrito
 *
 * 129 leituras em `src` e 69 em `supabase/functions`, todas com o `error`
 * recebido. **Zero cegas pelos dois métodos.** As duas acusações do detector por
 * texto são as duas chamadas de `AdminUsuarios.tsx` que passam a promessa para
 * o helper `executar` — ele é que faz `const { error } = await chamada`. O
 * `readErrors.test.ts` já as declarava falsos positivos; o que faltava era isso
 * ser medido, e não lido por mim.
 */
export type ClassificacaoDaLeitura =
  /** O `error` chega a quem chamou, em qualquer das formas reconhecidas. */
  | "ok"
  /** Alguém recebe o resultado e o `error` não aparece. */
  | "cega"
  /** O resultado é jogado fora por inteiro (ver `resultadosDescartados`). */
  | "descartada"
  /** Devolvida, ou passada adiante como promessa: o `error` é de outro. */
  | "repassada"
  /** Forma que este detector não sabe ler. Relatada, nunca engolida. */
  | "nao-classificada";

export interface LeituraMedida extends Achado {
  classificacao: ClassificacaoDaLeitura;
}

const LEITURAS = new Set(["select", "rpc"]);
const ESCRITAS_DO_CLIENTE = new Set(["insert", "update", "upsert", "delete"]);

function desembrulhar(no: ts.Node): ts.Node {
  let atual = no;
  for (;;) {
    if (ts.isParenthesizedExpression(atual) || ts.isNonNullExpression(atual) ||
        ts.isAwaitExpression(atual) || ts.isAsExpression(atual)) {
      atual = atual.expression;
      continue;
    }
    return atual;
  }
}

function raizDesembrulhada(no: ts.Node): string | null {
  let atual = desembrulhar(no);
  for (;;) {
    if (ts.isCallExpression(atual)) { atual = desembrulhar(atual.expression); continue; }
    if (ts.isPropertyAccessExpression(atual) || ts.isElementAccessExpression(atual)) {
      atual = desembrulhar(atual.expression);
      continue;
    }
    break;
  }
  return ts.isIdentifier(atual) ? atual.text : null;
}

function metodosDesembrulhados(no: ts.Node): string[] {
  const nomes: string[] = [];
  let atual = desembrulhar(no);
  for (;;) {
    if (ts.isCallExpression(atual)) {
      const e = desembrulhar(atual.expression);
      if (ts.isPropertyAccessExpression(e)) nomes.push(e.name.text);
      atual = e;
      continue;
    }
    if (ts.isPropertyAccessExpression(atual)) {
      nomes.push(atual.name.text);
      atual = desembrulhar(atual.expression);
      continue;
    }
    break;
  }
  return nomes;
}

/** O padrão de desestruturação liga `error`? */
function ligaOErro(padrao: ts.BindingName): boolean {
  return ts.isObjectBindingPattern(padrao) &&
    padrao.elements.some((e) => (e.propertyName ?? e.name).getText() === "error");
}

/** Alguém lê `<nome>.error`, ou desestrutura `error` de `<nome>`, no escopo? */
function alguemOlhaOErroDe(nome: string, escopo: ts.Node): boolean {
  let achou = false;
  const anda = (no: ts.Node) => {
    if (achou) return;
    if (ts.isPropertyAccessExpression(no) && no.name.text === "error" &&
        ts.isIdentifier(no.expression) && no.expression.text === nome) {
      achou = true;
      return;
    }
    if (ts.isVariableDeclaration(no) && ts.isObjectBindingPattern(no.name) && no.initializer) {
      const fonteDoValor = desembrulhar(no.initializer);
      if (ts.isIdentifier(fonteDoValor) && fonteDoValor.text === nome && ligaOErro(no.name)) {
        achou = true;
        return;
      }
    }
    ts.forEachChild(no, anda);
  };
  anda(escopo);
  return achou;
}

/** A função que contém o nó — ou o arquivo. */
function funcaoQueContem(no: ts.Node): ts.Node {
  let atual: ts.Node | undefined = no.parent;
  while (atual && !ts.isFunctionDeclaration(atual) && !ts.isFunctionExpression(atual) &&
         !ts.isArrowFunction(atual) && !ts.isMethodDeclaration(atual) && !ts.isSourceFile(atual)) {
    atual = atual.parent;
  }
  return atual ?? no;
}

/**
 * É a PONTA da cadeia?
 *
 * Sem isto cada cadeia é contada uma vez por elo: para
 * `supabase.from("t").select("id").eq("id", 1)`, as três chamadas têm `select`
 * entre os métodos e a raiz `supabase`.
 */
function ehPontaDaCadeia(no: ts.Node): boolean {
  const pai = no.parent;
  if (!pai) return true;
  if (ts.isPropertyAccessExpression(pai) && pai.expression === no) return false;
  if (ts.isElementAccessExpression(pai) && pai.expression === no) return false;
  if (ts.isNonNullExpression(pai)) return false;
  return true;
}

/** `.then(({ error }) => …)` observa o erro. */
function thenObservaOErro(no: ts.CallExpression): boolean {
  const alvo = desembrulhar(no.expression);
  if (!ts.isPropertyAccessExpression(alvo) || alvo.name.text !== "then") return false;
  const cb = no.arguments[0];
  if (!cb || (!ts.isArrowFunction(cb) && !ts.isFunctionExpression(cb))) return false;
  const p = cb.parameters[0];
  return p !== undefined && ligaOErro(p.name);
}

export function leiturasMedidas(fonte: ts.SourceFile): LeituraMedida[] {
  const medidas: LeituraMedida[] = [];

  const anda = (no: ts.Node) => {
    if (ts.isCallExpression(no) && ehPontaDaCadeia(no)) {
      const raiz = raizDesembrulhada(no);
      const metodos = metodosDesembrulhados(no);
      const ehLeitura = raiz !== null && CLIENTES.test(raiz) &&
        metodos.some((m) => LEITURAS.has(m)) &&
        !metodos.some((m) => ESCRITAS_DO_CLIENTE.has(m));

      if (ehLeitura) {
        const { line } = fonte.getLineAndCharacterOfPosition(no.getStart(fonte));
        const base: Achado = {
          arquivo: fonte.fileName,
          linha: line + 1,
          nome: metodos.filter((m) => LEITURAS.has(m)).join("/"),
          trecho: no.getText(fonte).replace(/\s+/g, " ").slice(0, 110),
        };
        const anotar = (classificacao: ClassificacaoDaLeitura) =>
          medidas.push({ ...base, classificacao });

        if (thenObservaOErro(no)) {
          anotar("ok");
        } else {
          // Sobe por `await`, parênteses e ternário até achar quem recebe: a
          // forma `cond ? await supabase…select(…) : { data: [], error: null }`
          // existe quatro vezes nesta base, e o destino está do lado de fora.
          let atual: ts.Node = no;
          let pai: ts.Node | undefined = no.parent;
          for (;;) {
            if (!pai) break;
            if (ts.isAwaitExpression(pai) || ts.isParenthesizedExpression(pai) ||
                ts.isAsExpression(pai)) {
              atual = pai; pai = pai.parent; continue;
            }
            if (ts.isConditionalExpression(pai) &&
                (pai.whenTrue === atual || pai.whenFalse === atual)) {
              atual = pai; pai = pai.parent; continue;
            }
            break;
          }

          if (pai && ts.isVariableDeclaration(pai)) {
            if (ts.isObjectBindingPattern(pai.name)) anotar(ligaOErro(pai.name) ? "ok" : "cega");
            else if (ts.isIdentifier(pai.name)) {
              anotar(alguemOlhaOErroDe(pai.name.text, funcaoQueContem(no)) ? "ok" : "cega");
            } else anotar("nao-classificada");
          } else if (pai && ts.isExpressionStatement(pai)) {
            anotar("descartada");
          } else if (pai && ts.isArrayLiteralExpression(pai)) {
            // `const [{ data, error }, …] = await Promise.all([…])`: o destino
            // é o padrão de array de fora, e a posição é que liga os dois.
            const chamadaDeFora = pai.parent;
            let topo: ts.Node | undefined =
              ts.isCallExpression(chamadaDeFora) ? chamadaDeFora.parent : undefined;
            while (topo && (ts.isAwaitExpression(topo) || ts.isParenthesizedExpression(topo))) {
              topo = topo.parent;
            }
            const elemento = topo && ts.isVariableDeclaration(topo) &&
              ts.isArrayBindingPattern(topo.name)
              ? topo.name.elements[pai.elements.indexOf(atual as ts.Expression)]
              : undefined;
            if (elemento && ts.isBindingElement(elemento)) {
              if (ts.isObjectBindingPattern(elemento.name)) {
                anotar(ligaOErro(elemento.name) ? "ok" : "cega");
              } else if (ts.isIdentifier(elemento.name)) {
                anotar(alguemOlhaOErroDe(elemento.name.text, funcaoQueContem(no)) ? "ok" : "cega");
              } else anotar("nao-classificada");
            } else anotar("nao-classificada");
          } else if (pai && (ts.isReturnStatement(pai) || ts.isCallExpression(pai) ||
                     ts.isPropertyAssignment(pai) || ts.isArrowFunction(pai) ||
                     ts.isBinaryExpression(pai) || ts.isSpreadElement(pai))) {
            anotar("repassada");
          } else {
            anotar("nao-classificada");
          }
        }
      }
    }
    ts.forEachChild(no, anda);
  };
  anda(fonte);
  return medidas;
}
