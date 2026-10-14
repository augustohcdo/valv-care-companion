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
/**
 * O corpo da issue — e o que ele passou a dizer.
 *
 * ## Por que o RAMO e o EVENTO entraram aqui
 *
 * Em 2026-10-05 eu disparei esta agenda à mão, do ramo de trabalho, e ela
 * passou. Reportei "agenda verde, issue fechada". Era verdade **do ramo** e
 * falso da agenda: as execuções AGENDADAS rodam em `main`, e lá ela reprovou
 * naquele mesmo dia e nos dois seguintes.
 *
 * Nada no relatório dizia qual das duas coisas havia sido medida. O link da
 * execução carrega o ramo, mas quem lê a tabela não abre o link — foi
 * exatamente o que eu não fiz.
 *
 * É a mesma classe de defeito que esta sessão perseguiu no prefixo `tela:` da
 * conferência de ferramentas: o relatório não dizia a origem do número, e a
 * leitura errada virou afirmação. Aqui o custo foi eu afirmar ao usuário que a
 * agenda dele estava verde enquanto ela reprovava todo dia.
 *
 * `ramo` e `evento` são opcionais de propósito: uma issue criada antes desta
 * mudança não tem como tê-los, e inventar "main" por omissão seria repetir o
 * defeito em outra forma.
 */
/**
 * Os três pedaços de prosa que variam entre as agendas que usam este módulo.
 *
 * Parametrizados, e não copiados: a varredura SEMANAL das rotas autenticadas
 * passou a avisar pelo mesmo caminho, e duplicar esta função seria a terceira
 * cópia de uma decisão — o que esta base avisa, por escrito, ser onde a decisão
 * começa a divergir. Os padrões são os da agenda diária, para os chamadores
 * antigos não mudarem de comportamento.
 */
const TEXTO_PADRAO = {
  intro: "As verificações periódicas do que está no ar reprovaram.",
  agenda: "A agenda diária roda em `main`",
  periodo: "dia",
};

export function corpoDaIssue({ assinatura, link, tabela, ramo, evento, texto }) {
  const { intro, agenda, periodo } = { ...TEXTO_PADRAO, ...(texto ?? {}) };
  const origem = [
    ramo ? `ramo \`${ramo}\`` : null,
    evento ? `disparo \`${evento}\`` : null,
  ].filter(Boolean).join(", ");
  return [
    intro,
    "",
    `Última execução: ${link}`,
    origem
      ? `Medido no ${origem}. **${agenda}** — veredito de ` +
        "outro ramo não diz nada sobre o que está no ar."
      : "",
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
    `só aparece quando o conjunto de vereditos muda — ${periodo} igual ao anterior`,
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

/**
 * Onde a execução mediu, em uma linha — ou nada, se não souber.
 *
 * ## O defeito que isto conserta, e ele é o MESMO de antes
 *
 * O `corpoDaIssue` ganhou `ramo` e `evento` porque eu havia reportado "agenda
 * verde" sobre um disparo manual do ramo de trabalho enquanto a agendada
 * reprovava em `main`. A docstring de lá conta a história inteira.
 *
 * Os COMENTÁRIOS ficaram de fora, e o de fechamento é o que afirma mais:
 *
 *     Voltou a passar.
 *
 * Em 2026-10-14 isso aconteceu de verdade. Disparei a agenda do ramo de
 * trabalho, ela passou, e a issue #5 fechou com essa frase — enquanto `main`
 * continuava reprovando havia dez dias. Quem abrisse a issue fechada leria
 * "voltou a passar" sem nada que dissesse de onde.
 *
 * Mesma classe, uma camada fora do conserto anterior: o corpo passou a dizer a
 * origem, e o comentário que anuncia o desfecho não. É o terceiro lugar nesta
 * sessão em que um relatório afirma sem dizer sobre o que mediu.
 */
export function origemDaMedida({ ramo, evento }) {
  const partes = [
    ramo ? `ramo \`${ramo}\`` : null,
    evento ? `disparo \`${evento}\`` : null,
  ].filter(Boolean);
  return partes.length ? `Medido no ${partes.join(", ")}.` : "";
}

/** O texto do comentário, quando há um a fazer. */
export function textoDoComentario({ mudancas, primeiraVez, link, ramo, evento }) {
  const origem = origemDaMedida({ ramo, evento });
  if (primeiraVez) {
    return [
      "Continua reprovando. A partir de agora este comentário só aparece quando o",
      "conjunto de vereditos mudar — dia igual ao anterior atualiza o corpo da",
      "issue e fica calado.",
      "",
      `Execução: ${link}`,
      origem,
    ].filter(Boolean).join("\n");
  }
  return [
    "**Mudou o que está reprovando:**",
    "",
    ...mudancas,
    "",
    `Execução: ${link}`,
    origem,
  ].filter(Boolean).join("\n");
}

/**
 * O texto que fecha a issue.
 *
 * Mora aqui, e não solto no `script:` do workflow, por duas razões que são a
 * mesma: nenhum teste alcança string escrita dentro de YAML, e as duas agendas
 * tinham a sua própria versão da frase — "Voltou a passar." numa, "Voltou a
 * passar. Fechando." na outra. Divergência pequena hoje, e o lugar onde a
 * próxima mudança só chega a uma delas.
 *
 * E a frase passou a dizer ONDE passou. Sem isso, ela afirma o desfecho mais
 * forte do fluxo sem dizer sobre o que mediu — ver `origemDaMedida`.
 */
export function textoDeFechamento({ link, ramo, evento, agenda }) {
  const origem = origemDaMedida({ ramo, evento });
  const ressalva = origem && agenda
    ? `${origem} **${agenda}** — veredito de outro ramo não diz nada sobre o que está no ar.`
    : origem;
  return [
    "Voltou a passar. Fechando.",
    "",
    `Execução: ${link}`,
    ressalva,
  ].filter(Boolean).join("\n");
}
