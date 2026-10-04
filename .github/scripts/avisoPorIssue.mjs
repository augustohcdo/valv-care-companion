/**
 * Quando avisar, e quando ficar calado.
 *
 * ## O defeito que isto fecha
 *
 * A agenda diária reprovou oito dias seguidos pela mesma causa — duas
 * *Variables* do repositório que ninguém configurou ainda — e o passo de aviso
 * comentou na issue **todos os dias**:
 *
 *     2026-10-02  "Reprovou de novo."
 *     2026-10-03  "Reprovou de novo."
 *     2026-10-04  "Reprovou de novo."
 *
 * Dezoito comentários idênticos, e nenhum deles diz O QUE reprovou. Quem quer
 * saber se algo NOVO quebrou precisa abrir cada execução.
 *
 * O cabeçalho do próprio workflow já tinha escrito o princípio, ao decidir
 * reaproveitar a mesma issue em vez de abrir uma por dia:
 *
 *   > "uma pilha de seis issues idênticas é outro jeito de não avisar"
 *
 * É a mesma frase, em forma de comentário. Aviso que se repete sem informação
 * nova treina quem o recebe a ignorá-lo — e quando a divergência de verdade
 * aparecer, ninguém vai olhar. A base já diz isso de outras maneiras: "guarda
 * intermitente ensina quem a vê a rodar de novo até passar", "issue que fica
 * aberta depois de consertado ensina a ignorar issue".
 *
 * ## A regra
 *
 * A issue aberta continua significando "está quebrado AGORA" — isso não muda, e
 * é o que faz dela um sinal. O que muda é o comentário: ele só sai quando o
 * CONJUNTO de vereditos muda, e então diz o que mudou, nome por nome.
 *
 * Dia igual ao anterior: o corpo da issue é atualizado (para apontar para a
 * execução de hoje) e nenhum comentário é criado. Nada de novo a dizer, nada
 * dito.
 *
 * ## Por que num arquivo, e não no YAML
 *
 * Estava como texto dentro de `script: |`, onde nenhum teste alcança. A decisão
 * mora aqui e é pura; o passo do workflow fica só com a chamada à API. Mesmo
 * desenho do caminho do Chromium e do limiar de tela vazia, pelo mesmo motivo:
 * o que não se consegue executar num teste não se consegue conferir.
 */

/** O marcador que guarda a assinatura dentro do corpo da issue. */
const MARCADOR = /<!--\s*assinatura:\s*([\s\S]*?)\s*-->/;

/**
 * Lê a assinatura gravada no corpo da issue.
 *
 * `null` quando não há marcador — é o caso da issue criada antes desta mudança,
 * e ele precisa ser distinguível de "assinatura vazia": sem marcador não se sabe
 * o que havia, e não saber não é "era igual".
 */
export function assinaturaDoCorpo(corpo) {
  const m = MARCADOR.exec(corpo ?? "");
  return m ? m[1].trim() : null;
}

/** `"rótulo=estado"` por linha → mapa. Linha malformada é ignorada. */
function comoMapa(assinatura) {
  const mapa = new Map();
  for (const linha of (assinatura ?? "").split("\n")) {
    const i = linha.lastIndexOf("=");
    if (i <= 0) continue;
    mapa.set(linha.slice(0, i).trim(), linha.slice(i + 1).trim());
  }
  return mapa;
}

const NOME_DO_ESTADO = { 0: "✅ ok", 2: "⚠️ NÃO CONFERIDO" };
const nomeDoEstado = (e) => NOME_DO_ESTADO[e] ?? `❌ DIVERGE (saída ${e})`;

/**
 * O que mudou entre duas assinaturas, em texto para o comentário.
 *
 * Conferência que SAIU da lista também é mudança: uma linha que desaparece
 * porque alguém tirou a conferência do workflow é informação, e sumir em
 * silêncio seria a pilha de avisos idênticos ao contrário.
 */
export function diferencas(antes, depois) {
  const a = comoMapa(antes);
  const d = comoMapa(depois);
  const linhas = [];
  for (const [rotulo, estado] of d) {
    const anterior = a.get(rotulo);
    if (anterior === estado) continue;
    linhas.push(
      anterior === undefined
        ? `- **${rotulo}** — nova nesta execução: ${nomeDoEstado(estado)}`
        : `- **${rotulo}** — era ${nomeDoEstado(anterior)}, agora ${nomeDoEstado(estado)}`,
    );
  }
  for (const rotulo of a.keys()) {
    if (!d.has(rotulo)) linhas.push(`- **${rotulo}** — saiu da lista de conferências`);
  }
  return linhas;
}

/** O corpo da issue: a tabela de hoje, o link, e a assinatura escondida. */
export function corpoDaIssue({ assinatura, link, tabela }) {
  return [
    "As verificações periódicas do que está no ar reprovaram.",
    "",
    `Última execução: ${link}`,
    "",
    tabela?.trim() ? "| Verificação | Estado |\n| --- | --- |\n" + tabela.trim() : "",
    "",
    "Três estados, e os dois últimos reprovam por motivos diferentes:",
    "",
    "- ✅ **ok** — conferido e bate;",
    "- ❌ **DIVERGE** — o que está no ar não é o que o repositório diz;",
    "- ⚠️ **NÃO CONFERIDO** — não deu para olhar (fonte fora do ar, credencial ausente).",
    '  Não é divergência: é ausência de resposta. Reprova porque "não sei" não é "está tudo bem".',
    "",
    "Esta issue fecha sozinha na primeira execução que passar. **Comentário novo**",
    "só aparece quando o conjunto de vereditos muda — dia igual ao anterior",
    "atualiza este corpo e fica calado, porque aviso repetido sem informação nova",
    "ensina a ignorar o aviso.",
    "",
    `<!-- assinatura: ${assinatura} -->`,
  ].join("\n");
}

/**
 * A decisão.
 *
 * `issue` é `{ number, body }` da issue aberta, ou `null` quando não há.
 */
export function decidirAviso({ falhou, assinatura, issue }) {
  if (!falhou) {
    // Voltou a passar. A issue aberta precisa fechar AGORA, senão ela passa a
    // significar "esteve quebrado um dia" em vez de "está quebrado agora".
    return issue ? { acao: "fechar", numero: issue.number } : { acao: "nada" };
  }

  if (!issue) return { acao: "criar" };

  const anterior = assinaturaDoCorpo(issue.body);

  // Sem marcador: issue de antes desta mudança. Comentar UMA vez é o certo —
  // não se sabe o que havia, e tratar "não sei" como "era igual" seria engolir
  // a primeira mudança depois da atualização.
  if (anterior === null) {
    return { acao: "comentar", numero: issue.number, mudancas: [], primeiraVez: true };
  }

  if (anterior === assinatura) return { acao: "atualizar", numero: issue.number };

  return {
    acao: "comentar",
    numero: issue.number,
    mudancas: diferencas(anterior, assinatura),
    primeiraVez: false,
  };
}

/** O texto do comentário, quando há um a fazer. */
export function textoDoComentario({ mudancas, primeiraVez, link }) {
  if (primeiraVez) {
    return [
      "Continua reprovando. A partir de agora este comentário só aparece quando o",
      "conjunto de vereditos mudar — dia igual ao anterior atualiza o corpo da",
      "issue e fica calado.",
      "",
      `Execução: ${link}`,
    ].join("\n");
  }
  return [
    "**Mudou o que está reprovando:**",
    "",
    ...mudancas,
    "",
    `Execução: ${link}`,
  ].join("\n");
}
