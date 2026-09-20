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
 * Tira comentários preservando as LINHAS.
 *
 * Trocar um bloco de comentário por vazio faz tudo abaixo subir, e a guarda
 * passa a apontar uma linha que não é a do defeito. Já aconteceu nesta sessão:
 * a inversão dizia 150 com o defeito na 158. Por isso cada bloco vira o mesmo
 * número de quebras de linha que ocupava.
 */
export function semComentarios(texto: string): string {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => "\n".repeat((bloco.match(/\n/g) ?? []).length))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

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
export function chamadasDescartadas(original: string, nomes: string[]): ChamadaDescartada[] {
  const limpo = semComentarios(original).split("\n");
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
export function totalDeChamadas(original: string, nomes: string[]): number {
  const padrao = new RegExp(`\\b(?:${nomes.map(escapar).join("|")})\\s*\\(`);
  return semComentarios(original).split("\n").filter((l) => padrao.test(l)).length;
}
