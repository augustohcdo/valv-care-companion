/**
 * Os relatores da conferência periódica — e a origem de cada número.
 *
 * ## O defeito que isto conserta
 *
 * `ferramentas-verificar.mjs` tinha dois relatores: `conferir`, cuja saída diz
 * `tela:`, e `conferirDado`, cuja saída diz `dado:`. O comentário do primeiro
 * já explicava a diferença, e já contava que ela havia sido violada:
 *
 *   > "Havia conferências passando por aqui com valor vindo do RPC, e a saída
 *   >  anunciava 'tela: Medtronic' sobre um número que ninguém tinha lido da
 *   >  página. Rótulo que mente sobre a própria origem é a versão pequena do
 *   >  defeito que este script existe para pegar."
 *
 * A regra estava escrita, o `conferirDado` existia, e foi usado em UMA chamada.
 * Contando pelo analisador de verdade: das 30 chamadas a `conferir`, **24
 * passavam valor vindo de `await resp.json()` ou de um `status` de HTTP**. A
 * agenda diária imprimia vinte e quatro linhas `tela: N` sobre dados que nunca
 * tocaram a página, e fechava com "31 de 31 conferências passaram" — lido de
 * manhã, "o site foi conferido trinta e uma vezes".
 *
 * A rota por `fetch` é deliberada, e o motivo está escrito na parte 3 do
 * script: o Chromium daquele contêiner recebe `ERR_CONNECTION_RESET` no RPC do
 * catálogo (~150 kB) e a tela fica em "Carregando o catálogo…" para sempre. O
 * comentário de lá diz, com todas as letras, que "fingir que mediu isso num
 * navegador que não alcança o banco seria justamente o verde vazio que este
 * script existe para impedir" — e o prefixo `tela:` fazia esse fingimento de
 * todo jeito, trinta linhas acima da frase que o proíbe.
 *
 * Não era defeito da rota. Era defeito do rótulo.
 *
 * ## Por que módulo próprio, e não três linhas no script
 *
 * Duas razões, e as duas são sobre poder provar:
 *
 * 1. A origem deixa de ser confiada e passa a ser ESTRUTURAL — `conferir` só
 *    aceita valor embrulhado por `daTela()` e PARA se receber outro. Regra que
 *    depende de alguém lembrar já foi testada ali, e reprovou 24 vezes.
 * 2. O script tem `await` no topo, abre o Chromium e fala com produção: nada
 *    dele é importável por um teste. Aqui dentro, cada caso é exercitado de
 *    verdade — inclusive o prefixo impresso, que é o ponto do conserto.
 */

const MARCA_DA_TELA = Symbol("lido da tela");

/**
 * Embrulha um valor que SAIU do texto da página.
 *
 * O que ela não faz: provar que saiu. Nenhuma análise de texto segue a
 * procedência de um número até o `innerText()` que o produziu, e detector que
 * tenta isso erra dos dois lados. O que ela faz é obrigar quem escreve a
 * DECLARAR a origem no ponto da chamada, e tornar impossível o caso em que
 * ninguém declarou nada e a saída afirmou `tela:` sozinha — que era o estado
 * de 24 das 30 conferências.
 */
export function daTela(valor) {
  return { [MARCA_DA_TELA]: true, valor };
}

/**
 * Cria um par de relatores com sua própria lista de casos.
 *
 * Fábrica em vez de estado de módulo para que cada teste comece limpo sem
 * precisar de uma função `zerar()` que só existe para teste — e um `zerar()`
 * esquecido entre dois testes é contagem de um vazando no outro.
 *
 * `imprimir` é injetável pelo mesmo motivo: o prefixo impresso É o conserto, e
 * um teste que não o lê não confere o conserto.
 */
export function criarRelator({ imprimir = console.log } = {}) {
  const casos = [];
  const falhas = [];

  const registrar = (nome, obtido, esperado, tolerancia, origem) => {
    const ok = typeof esperado === "number"
      ? Math.abs(obtido - esperado) <= tolerancia
      : esperado.test(String(obtido));
    casos.push({ nome, obtido, esperado: String(esperado), ok, origem });
    if (!ok) falhas.push(nome);
    imprimir(`${ok ? "✓" : "✗"} ${nome}\n     ${origem}: ${obtido}\n     esperado: ${esperado}`);
    return ok;
  };

  /**
   * Confere um valor LIDO DA TELA. O rótulo diz `tela:` e agora não tem como
   * mentir: sem `daTela()` esta função não roda.
   */
  const conferir = (nome, obtido, esperado, tolerancia = 0) => {
    if (obtido === null || typeof obtido !== "object" || obtido[MARCA_DA_TELA] !== true) {
      throw new Error(
        `conferir("${nome}") recebeu um valor que não veio da tela. A saída diria ` +
          "`tela:` sobre um dado que ninguém leu da página. Embrulhe com " +
          "`daTela(...)` se saiu do texto da página, ou use `conferirDado` se foi " +
          "calculado aqui ou lido da API.",
      );
    }
    return registrar(nome, obtido.valor, esperado, tolerancia, "tela");
  };

  /**
   * Confere um valor que NÃO veio da tela: calculado aqui, ou lido da resposta
   * da API. A saída diz `dado:`, e é por isso que ele existe separado.
   */
  const conferirDado = (nome, obtido, esperado, tolerancia = 0) =>
    registrar(nome, obtido, esperado, tolerancia, "dado");

  const quantasDe = (origem) => casos.filter((c) => c.origem === origem).length;

  return { casos, falhas, conferir, conferirDado, quantasDe };
}
