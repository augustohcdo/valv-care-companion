/// <reference types="node" />
import ts from "typescript";

/**
 * Tirar comentário de código TypeScript/JavaScript — pelo PARSER.
 *
 * ## Por que não mais uma expressão regular
 *
 * Porque havia OITO cópias disto espalhadas pelas guardas deste repositório, em
 * duas famílias, e nenhuma das duas está correta:
 *
 *   · a família regex (`resultadoDescartado.ts`, `grantsDeColuna`,
 *     `marcasDeCarregamento`, `trilhaDeIntegracao`, `chromiumDosScripts`,
 *     `escritasCegasNasFunctions`) faz
 *     `.replace(/(^|[^:])\/\/.*$/gm, "$1")`. O `[^:]` existe para não decapitar
 *     `https://…`, e é tudo o que ela sabe sobre contexto: um `//` DENTRO de um
 *     literal de texto é apagado como se fosse comentário;
 *
 *   · a família varredor (`aplicarComSelect`) percorre caractere a caractere e
 *     rastreia aspas — melhor, e ainda assim quebra em literal de REGEX. Em
 *     `/\/\*[\s\S]*?\*\//g`, a sequência `\/` seguida de `/` é lida como início
 *     de comentário de linha e ela apaga o resto da linha. Esse literal existe
 *     neste repositório: é o próprio limpador por regex, citado dentro de um
 *     teste.
 *
 * Quer dizer: as guardas que existem para não ler comentário como código usam
 * limpadores que leem literal como comentário. É a décima primeira vez nesta
 * sessão que um analisador por texto se perde num delimitador, e a lição já
 * tinha nome: **isto não se mede com expressão regular.**
 *
 * ## Como esta funciona
 *
 * O TypeScript já resolve o problema inteiro — ele distingue literal de texto,
 * template, literal de regex e comentário, porque precisa. Então: parseia, marca
 * os intervalos de todo TOKEN (as folhas da árvore) e apaga o que sobrou que não
 * seja espaço. O que fica entre tokens e não é espaço é, por definição,
 * comentário.
 *
 * As POSIÇÕES são preservadas caractere a caractere: cada byte de comentário
 * vira um espaço, e cada quebra de linha fica. Guardas desta base relatam
 * `arquivo:linha` e algumas classificam a ocorrência pelo índice dela — um
 * limpador que encurta o texto faz a acusação apontar a linha errada, e isso já
 * aconteceu aqui (a inversão dizia 150 com o defeito na 158).
 */
export function semComentariosDeCodigo(texto: string, arquivo = "codigo.ts"): string {
  const fonte = ts.createSourceFile(
    arquivo,
    texto,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX
      : arquivo.endsWith(".mjs") || arquivo.endsWith(".js") ? ts.ScriptKind.JS
        : ts.ScriptKind.TS,
  );

  // 1 = este caractere pertence a um token, logo NÃO é comentário.
  const deToken = new Uint8Array(texto.length);
  const anda = (no: ts.Node) => {
    /**
     * O JSDoc entra na ÁRVORE, e isso derrubou a primeira versão desta função.
     *
     * O TypeScript parseia `/** … *\/` para dentro do AST — ele usa a anotação
     * para inferir tipo — e o nó resultante é uma FOLHA que cobre o texto do
     * comentário:
     *
     *     FirstStatement [11,23)
     *       JSDocComment [0,10)   ← folha, jsdoc=true
     *       VariableDeclarationList [11,22)
     *
     * Marcando folhas como "token", o JSDoc era preservado e a função não
     * apagava nenhum comentário de documentação — que é a forma de 100% dos
     * comentários explicativos desta base. Um `/* nota *\/` solto, que não fica
     * em posição de JSDoc, era apagado direito; por isso a primeira
     * contraprova, com seis casos, passou: nenhum dos seis tinha JSDoc.
     *
     * Medido: `rotas-renderizam.mjs` saiu com os 11 blocos `/**` intactos, e
     * duas guardas reprovaram ao serem ligadas nesta função. Foram elas que
     * contaram.
     */
    if (no.kind >= ts.SyntaxKind.FirstJSDocNode && no.kind <= ts.SyntaxKind.LastJSDocNode) {
      return;
    }
    const filhos = no.getChildren(fonte);
    if (filhos.length === 0) {
      // `getStart` pula a trivia à esquerda, que é justamente onde o
      // comentário mora. O token em si vai de `getStart` a `getEnd`.
      for (let i = no.getStart(fonte); i < no.getEnd(); i++) deToken[i] = 1;
      return;
    }
    for (const f of filhos) anda(f);
  };
  anda(fonte);

  let fora = "";
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (deToken[i] || c === "\n" || c === "\r" || c === " " || c === "\t") fora += c;
    else fora += " ";
  }
  return fora;
}
