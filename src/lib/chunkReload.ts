/**
 * Recarga automática quando um pedaço do aplicativo não carrega.
 *
 * O aplicativo é dividido em arquivos com hash no nome. Depois de um deploy os
 * nomes mudam, e a aba que ficou aberta pede um arquivo que não existe mais.
 * A cura é recarregar a página uma vez — o difícil é **reconhecer** o problema,
 * porque cada navegador o descreve de um jeito.
 *
 * Isto morava dentro de `main.tsx` e a lista estava incompleta. O que aconteceu
 * em produção em 08/08, com usuário logado num iPhone:
 *
 *     'text/html' is not a valid JavaScript MIME type.
 *
 * Nenhum dos padrões antigos casava com essa frase, então a recarga não
 * disparou e a pessoa ficou com a tela quebrada — o mecanismo que existe
 * exatamente para isso ficou parado enquanto acontecia.
 *
 * A causa raiz foi corrigida no `vercel.json` (arquivo ausente sob `/assets/`
 * volta a devolver 404 em vez do `index.html`), e esta lista é a segunda
 * camada: navegador é diverso, e a mensagem de amanhã pode ser outra.
 */

/**
 * Cada grupo é uma forma real de o navegador relatar o mesmo problema.
 *
 * Os três últimos são a família "recebi HTML onde esperava JavaScript": o
 * servidor respondeu 200 com uma página, e o navegador reclama do tipo ou
 * engasga no `<` da primeira linha do HTML.
 */
const PADROES = [
  /Importing a module script failed/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Loading chunk \d+ failed/i,
  /ChunkLoadError/i,
  /is not a valid JavaScript MIME type/i,
  /Unexpected token '<'/i,
  /expected expression, got '<'/i,
];

export function isChunkLoadError(msg: string): boolean {
  return !!msg && PADROES.some((p) => p.test(msg));
}

/**
 * A trava que impede laço de recarga.
 *
 * Se a recarga também falhar, não adianta recarregar de novo — melhor a tela de
 * erro que uma aba piscando para sempre.
 */
export const RELOAD_KEY = "vp:chunk-reloaded";

/** Devolve `true` quando a recarga foi disparada. */
export function recarregarUmaVez(
  storage: Pick<Storage, "getItem" | "setItem">,
  recarregar: () => void,
): boolean {
  if (storage.getItem(RELOAD_KEY)) return false;
  storage.setItem(RELOAD_KEY, "1");
  recarregar();
  return true;
}

/**
 * Limpa a trava depois que o aplicativo montou.
 *
 * Antes, a chave ficava na sessão para sempre: a primeira falha se curava e
 * qualquer outra, horas depois na mesma aba, não se curava mais. Se o app
 * chegou a montar, a recarga anterior funcionou e a trava já cumpriu o papel.
 */
export function liberarRecarga(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(RELOAD_KEY);
}
