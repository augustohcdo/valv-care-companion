/// <reference types="node" />
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Chamadas cujo resultado é jogado fora por inteiro.
 *
 * ## A regra, e por que ela é esta e não outra
 *
 * Havia uma versão anterior que perseguia o destino: `const r = await fetch(`
 * e depois um uso de `r`. Ela deu **cinco falsos vermelhos**, cada um por um
 * buraco diferente, e os cinco eram código correto:
 *
 *   · `const r = await cliente(cfg).fetch(url, …)` — o cliente assinado do S3.
 *     A exclusão de `algo.fetch(` exigia letra ou ponto antes do ponto, e ali
 *     vem `)`;
 *   · `const [a, b] = await Promise.all([fetch(x), fetch(y)])` — o destino
 *     está na linha de CIMA e as chamadas ficam dentro de um array;
 *   · `resposta = await fetch(…)` sobre um `let resposta;` declarado antes.
 *
 * Perseguir o destino é perseguir sintaxe. O que interessa é mais simples e
 * não tem essas bordas: **alguém recebe o resultado, ou ninguém recebe?** Uma
 * chamada cujo statement começa com `await algo(` e termina sem ninguém pegar
 * nada é o defeito; qualquer atribuição, `return`, encadeamento ou posição
 * dentro de uma expressão já significa que o resultado foi para algum lugar.
 *
 * Perde-se com isso o caso "recebeu e não olhou" — e está certo perder: era
 * ele que produzia os falsos vermelhos, porque "olhar" tem formas demais
 * (`r.ok`, `r.status`, um campo obrigatório do corpo, `envio.sent`). Guarda que
 * pune quem fez certo é guarda que alguém desliga.
 */

const IGNORAR = new Set(["node_modules", "dist", "coverage", ".git"]);

export function varrerFontes(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue;
    const full = join(dir, nome);
    if (statSync(full).isDirectory()) varrerFontes(full, out);
    else if (/\.(ts|tsx|mjs)$/.test(nome) && !/\.test\.tsx?$/.test(nome)) {
      out.push(full.replace(/\\/g, "/"));
    }
  }
  return out;
}

/**
 * Reexportado de `semComentariosDeCodigo.ts`, que faz isto pelo PARSER.
 *
 * Aqui havia uma das oito cópias. Esta trocava o bloco de comentário pelo mesmo
 * número de QUEBRAS DE LINHA — o motivo estava escrito e continua valendo ("a
 * inversão dizia 150 com o defeito na 158") —, e a canônica vai além:
 * preserva caractere a caractere, então coluna e índice também batem.
 *
 * O reexport fica porque `okDeJobRunEhMedido.test.ts` importa daqui.
 */
import { semComentariosDeCodigo as semComentarios } from "./semComentariosDeCodigo";
export { semComentarios };

export interface ChamadaDescartada {
  linha: number;
  /** O nome da função chamada, como aparece no código. */
  nome: string;
}

/** A dispensa declarada, com motivo: `// resultado descartado: <por quê>`. */
const DISPENSA = /\/\/\s*resultado descartado:/;

/** Coisas que podem continuar a expressão na linha de cima. */
const CONTINUA = /[[(,=?:]$|&&$|\|\|$|=>$/;

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * As chamadas a `nomes` cujo resultado ninguém recebe.
 *
 * `nomes` é a lista de funções em que descartar o resultado é defeito — as que
 * dizem "fiz o trabalho lá fora" e só o retorno sabe se fizeram.
 */
export function chamadasDescartadas(
  original: string,
  nomes: string[],
  /** O caminho, para o parser saber se é `.tsx`/`.mjs`. */
  arquivo?: string,
): ChamadaDescartada[] {
  return descartadasEmLinhas(semComentarios(original, arquivo).split("\n"), original, nomes);
}

/**
 * O mesmo, sobre linhas JÁ sem comentário — para quem vai varrer os dois
 * vereditos no mesmo arquivo sem pagar `ts.createSourceFile` duas vezes.
 */
function descartadasEmLinhas(
  limpo: string[],
  original: string,
  nomes: string[],
): ChamadaDescartada[] {
  const cru = original.split("\n");
  const achadas: ChamadaDescartada[] = [];
  const padrao = new RegExp(`^(?:await\\s+)?(${nomes.map(escapar).join("|")})\\s*\\(`);

  for (let i = 0; i < limpo.length; i++) {
    // Início de statement: só espaços, ou depois de `{`, `try {`, `else {`.
    const inicio = limpo[i].replace(/^\s*(?:\}?\s*(?:try|else|do)?\s*\{)?\s*/, "");
    const m = padrao.exec(inicio);
    if (!m) continue;

    // Uma linha que é ELEMENTO de uma lista não é statement: a expressão vem
    // de cima e o resultado vai para algum lugar.
    let anterior = i - 1;
    while (anterior >= 0 && limpo[anterior].trim() === "") anterior--;
    if (anterior >= 0 && CONTINUA.test(limpo[anterior].trimEnd().slice(-2))) continue;

    if (DISPENSA.test(cru[i] ?? "") || DISPENSA.test(cru[i - 1] ?? "")) continue;

    // Encadeou ali mesmo (`algo(x).then(…)`): o resultado foi usado.
    const statement = limpo.slice(i, Math.min(limpo.length, i + 8)).join("\n");
    const encadeou =
      /\)\s*\.\s*(then|catch|finally|json|text|ok|status|arrayBuffer|blob|sent)\b/.test(statement);
    if (encadeou) continue;

    achadas.push({ linha: i + 1, nome: m[1] });
  }
  return achadas;
}

/** Toda menção à chamada, para o sanity check da varredura. */
export function totalDeChamadas(original: string, nomes: string[], arquivo?: string): number {
  return totalEmLinhas(semComentarios(original, arquivo).split("\n"), nomes);
}

function totalEmLinhas(limpo: string[], nomes: string[]): number {
  const padrao = new RegExp(`\\b(?:${nomes.map(escapar).join("|")})\\s*\\(`);
  return limpo.filter((l) => padrao.test(l)).length;
}

/**
 * Os dois vereditos do arquivo — o total e as descartadas — numa passada.
 *
 * A guarda principal chamava `totalDeChamadas` e `chamadasDescartadas` em
 * seguida, e cada uma recomeçava do zero: dois `ts.createSourceFile` por
 * arquivo, sobre ~320 arquivos. Ela estava em 3,7s contra o limite de 5s do
 * vitest, e a irmã dela já havia reprovado por tempo. Guarda que reprova por
 * lentidão ensina a reexecutar até passar, que é a forma mais barata de
 * desaprender a olhar o vermelho.
 */
export function varreduraDeChamadas(
  original: string,
  nomes: string[],
  arquivo?: string,
): { total: number; descartadas: ChamadaDescartada[] } {
  const limpo = semComentarios(original, arquivo).split("\n");
  return {
    total: totalEmLinhas(limpo, nomes),
    descartadas: descartadasEmLinhas(limpo, original, nomes),
  };
}

/**
 * O mesmo, decomposto por nome, numa única passada de AST.
 *
 * A guarda de vacuidade precisa de contagem POR nome e fazia
 * `totalDeChamadas(texto, [nome])` dentro de um laço — três chamadas a
 * `semComentarios` por arquivo, que é a parte caríssima (um
 * `ts.createSourceFile` cada). Sobre ~320 arquivos ela batia em 5,1s contra o
 * limite de 5s do vitest e reprovava por tempo, sem defeito nenhum. Falso
 * vermelho custa o mesmo que falso verde: ensina a reexecutar e ignorar.
 *
 * Mesma garantia, um terço do trabalho — a contagem continua sendo de LINHAS
 * que mencionam o nome, igual à de cima.
 */
export function contagemPorNome(
  original: string,
  nomes: string[],
  arquivo?: string,
): Record<string, number> {
  const linhas = semComentarios(original, arquivo).split("\n");
  const contagem: Record<string, number> = {};
  for (const nome of nomes) {
    const padrao = new RegExp(`\\b${escapar(nome)}\\s*\\(`);
    contagem[nome] = linhas.filter((l) => padrao.test(l)).length;
  }
  return contagem;
}
