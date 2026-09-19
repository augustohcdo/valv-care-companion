/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Nenhum `fetch` tem o resultado inteiramente descartado.
 *
 * ## A sétima família, e o que ela tem de diferente
 *
 * As outras seis eram sobre o `{ error }` do SDK do Supabase. Esta é sobre o
 * `fetch` cru, que **não tem `error` nenhum**: ele resolve normalmente com um
 * `Response` de status 500, e só rejeita quando a conexão em si falha. Quem
 * escreve `await fetch(...)` e segue em frente acha que mandou; o que sabe se
 * chegou é o `r.ok`.
 *
 * Varridas 70 chamadas em `supabase/functions`, `scripts` e `src`. Quatro
 * defeitos reais, e os três piores têm a mesma assinatura — **contar a
 * intenção e imprimir como efeito**:
 *
 * · `scripts/catalogo/corrigir-braile.mjs` mandava o PATCH e imprimia
 *   `"+ Inovare Alpha: foto e página do fabricante"` **incondicionalmente**,
 *   fora do `if`. O servidor recusando, a saída do script dizia o mesmo;
 *
 * · `scripts/catalogo/corrigir-meril.mjs` fazia `desativadas++` **antes** do
 *   PATCH e descartava o resultado. O total no fim contava o que ele quis
 *   fazer. Uma linha recusada saía como desativada — e o catálogo seguia
 *   oferecendo uma prótese fora de linha;
 *
 * · `scripts/demo-seed.mjs` apagava os objetos do bucket num laço sem olhar
 *   nada e imprimia "Removidos: … N arquivo(s)", com N = quantos objetos
 *   EXISTIAM. Número que parece conferência e é contagem da lista de entrada.
 *   O que sobra no bucket é exatamente o que o painel conta como órfão;
 *
 * · `job-watchdog` mandava o batimento para o vigia externo com `try/catch`,
 *   que pega só falha de REDE. Um 404 — a URL do monitor mudou — passava em
 *   silêncio, e o vigia externo alertava que a função tinha parado. Alarme
 *   certo pelo motivo errado, sem como distinguir na investigação.
 *
 * ## Duas coisas que a regra NÃO cobra, de propósito
 *
 * 1. **`r.ok` não é a única forma de conferir.** `conta-de-verificacao.mjs` e
 *    `demo-seed.mjs` olham um campo obrigatório do corpo (`!criado?.id`) e
 *    saem com o código certo. É conferência de verdade, e exigir a palavra
 *    `.ok` reprovaria quem fez certo — o erro que esta base já cometeu meia
 *    dúzia de vezes. Por isso a regra é sobre o resultado ser **usado**, não
 *    sobre o nome do campo;
 *
 * 2. **um `fetch` de efeito colateral puro** — se algum dia houver um — pode
 *    declarar-se com um comentário `// resultado descartado:` na mesma linha
 *    ou na anterior, dizendo por quê. Hoje não há nenhum, e a contagem abaixo
 *    prova isso.
 */

const RAIZES = ["supabase/functions", "scripts", "src"];
const IGNORAR = new Set(["node_modules", "dist", "coverage", ".git"]);

function varrer(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue;
    const full = join(dir, nome);
    if (statSync(full).isDirectory()) varrer(full, out);
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

export interface ChamadaDeFetch {
  linha: number;
  /** O resultado é jogado fora por inteiro? */
  descartado: boolean;
}

/** Aceita a dispensa declarada: `// resultado descartado: <motivo>`. */
const DISPENSA = /\/\/\s*resultado descartado:/;

/**
 * Um `fetch` cujo resultado é jogado fora por inteiro.
 *
 * ## Por que a regra é esta, e não "confere o `r.ok`"
 *
 * A primeira versão procurava `const r = await fetch(` e depois exigia um uso
 * de `r`. Ela deu **cinco falsos vermelhos**, cada um por um buraco diferente,
 * e os cinco eram código correto:
 *
 *   · `const r = await cliente(cfg).fetch(url, …)` — o `fetch` do cliente
 *     assinado do S3. Minha exclusão de `algo.fetch(` exigia letra ou ponto
 *     antes do ponto, e ali vem `)`;
 *   · `const [a, b] = await Promise.all([fetch(x), fetch(y)])` — o destino
 *     está na linha de CIMA, e as chamadas ficam dentro de um array;
 *   · `resposta = await fetch(…)` sobre um `let resposta;` declarado antes —
 *     sem `const|let|var` na linha da chamada.
 *
 * Três formas legítimas que o detector não conhecia. Perseguir o destino da
 * variável é perseguir sintaxe; o que interessa é mais simples e não tem essas
 * bordas: **alguém recebe o resultado, ou ninguém recebe?** Um `fetch` cujo
 * statement começa com `await fetch(` e termina sem ninguém pegar nada é o
 * defeito; qualquer atribuição, `return`, encadeamento ou posição dentro de
 * uma expressão já significa que o resultado foi para algum lugar.
 *
 * Perde-se com isso o caso "recebeu e não olhou" — e está certo perder: era
 * justamente ele que produzia os cinco falsos vermelhos, porque "olhar" tem
 * formas demais (`r.ok`, `r.status`, um campo obrigatório do corpo). Guarda
 * que pune quem fez certo é guarda que alguém desliga.
 */
export function chamadasDeFetch(original: string): ChamadaDeFetch[] {
  const limpo = semComentarios(original).split("\n");
  const cru = original.split("\n");
  const achadas: ChamadaDeFetch[] = [];

  for (let i = 0; i < limpo.length; i++) {
    // Início de statement: só espaços, ou depois de `{`, `try {`, `else {`.
    const inicio = limpo[i].replace(/^\s*(?:\}?\s*(?:try|else|do)?\s*\{)?\s*/, "");
    if (!/^(?:await\s+)?fetch\s*\(/.test(inicio)) continue;

    // ...MAS uma linha que é ELEMENTO de uma lista não é statement. As duas
    // chamadas do `pesquisaExterna` ficam dentro de um `Promise.all([`, cada
    // uma na sua linha, e o destino está na linha de cima:
    //
    //     const [resumoResp, textoResp] = await Promise.all([
    //       fetch(`${EUTILS}/esummary.fcgi…`, { headers }),
    //       fetch(`${EUTILS}/efetch.fcgi…`,  { headers }),
    //     ]);
    //
    // A linha anterior terminando em `[`, `(`, `,` ou operador diz que a
    // expressão continua — o resultado vai para algum lugar.
    let anterior = i - 1;
    while (anterior >= 0 && limpo[anterior].trim() === "") anterior--;
    if (anterior >= 0 && /[[(,=?:]|&&|\|\||=>\s*$/.test(limpo[anterior].trimEnd().slice(-2))) {
      continue;
    }

    if (DISPENSA.test(cru[i] ?? "") || DISPENSA.test(cru[i - 1] ?? "")) continue;

    // Encadeou ali mesmo (`fetch(x).then(…)`) — o resultado foi usado.
    const statement = limpo.slice(i, Math.min(limpo.length, i + 6)).join("\n");
    const encadeou = /\)\s*\.\s*(then|catch|finally|json|text|ok|status|arrayBuffer|blob)\b/
      .test(statement);

    achadas.push({ linha: i + 1, descartado: !encadeou });
  }
  return achadas;
}

/** Toda chamada a `fetch`, para o sanity check da varredura. */
export function totalDeFetches(original: string): number {
  return semComentarios(original)
    .split("\n")
    .filter((l) => /\bfetch\s*\(/.test(l)).length;
}

describe("todo fetch tem o resultado olhado", () => {
  const arquivos = RAIZES.flatMap((r) => varrer(r));

  it("nenhuma chamada descarta o `Response` inteiro", () => {
    const ruins: string[] = [];
    let total = 0;

    for (const arquivo of arquivos) {
      const original = readFileSync(arquivo, "utf8");
      total += totalDeFetches(original);
      for (const c of chamadasDeFetch(original)) {
        if (c.descartado) ruins.push(`  · ${arquivo}:${c.linha}`);
      }
    }

    // São 70 hoje. O piso é 40: apagar um script não pode virar falso
    // vermelho, mas um detector que parou de casar cai muito abaixo disso.
    expect(total, "a varredura encolheu — poucas chamadas de `fetch` encontradas")
      .toBeGreaterThanOrEqual(40);
    expect(
      ruins,
      `\n${ruins.join("\n")}\n\n` +
        "`fetch` não tem `error`: ele resolve normalmente com um 500 e só rejeita\n" +
        "quando a conexão falha. Quem descarta o `Response` acha que mandou — e é\n" +
        "assim que um script conta a INTENÇÃO e imprime como efeito.\n\n" +
        "Guarde o resultado e olhe o `r.ok`, ou um campo obrigatório do corpo.\n" +
        "Para um efeito colateral que dispensa conferência mesmo, escreva\n" +
        "`// resultado descartado: <motivo>` na linha de cima.",
    ).toEqual([]);
  });

  /** As contraprovas, em arquivo, porque é assim que o detector é usado. */
  const varrerFixture = (linhas: string[]) => {
    const dir = mkdtempSync(join(tmpdir(), "fetchok-"));
    try {
      const caminho = join(dir, "x.mjs");
      writeFileSync(caminho, linhas.join("\n"));
      return chamadasDeFetch(readFileSync(caminho, "utf8"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it("acusa o resultado descartado — o caso do corrigir-braile", () => {
    const c = varrerFixture([
      "await fetch(`${BASE}/rest/v1/catalogo?id=eq.1`, { method: 'PATCH', body: corpo });",
      "console.log('+ Inovare Alpha: foto e página do fabricante');",
    ]);
    expect(c.length).toBe(1);
    expect(c[0].descartado, "não viu o `fetch` descartado").toBe(true);
  });

  it("aprova quem confere o `r.ok`", () => {
    const c = varrerFixture([
      "const r = await fetch(url, { method: 'DELETE' });",
      "if (!r.ok) { process.exitCode = 1; return; }",
    ]);
    expect(c.length, "acusou uma chamada cujo resultado alguém recebeu").toBe(0);
  });

  it("aprova quem confere um campo obrigatório do corpo", () => {
    // `conta-de-verificacao.mjs` faz isto, e sai 2 (NÃO CONFERIDO) quando o
    // campo não vem. Exigir a palavra `.ok` reprovaria quem fez certo.
    const c = varrerFixture([
      "const r = await fetch(url, { method: 'POST', body: corpo });",
      "const criado = await r.json().catch(() => null);",
      "if (!criado?.id) { process.exit(2); }",
    ]);
    expect(c.length, "reprovou a conferência pelo corpo").toBe(0);
  });

  it("aceita a dispensa declarada, com motivo", () => {
    const c = varrerFixture([
      "// resultado descartado: é um beacon, e a própria ausência dele é o sinal",
      "await fetch(url, { method: 'POST', keepalive: true });",
    ]);
    expect(c.length, "a dispensa declarada não foi respeitada").toBe(0);
  });

  it("não acusa as três formas que produziram falso vermelho", () => {
    // As três que a primeira versão reprovou, todas corretas. Sem este teste
    // o conserto se perde na próxima vez que alguém mexer no detector.
    expect(
      varrerFixture(["const r = await cliente(cfg).fetch(url, { method: 'PUT' });"]).length,
      "o `fetch` do cliente assinado do S3",
    ).toBe(0);
    expect(
      varrerFixture([
        "const [resumoResp, textoResp] = await Promise.all([",
        "  fetch(`${EUTILS}/esummary.fcgi`, { headers }),",
        "  fetch(`${EUTILS}/efetch.fcgi`, { headers }),",
        "]);",
        "if (!resumoResp.ok) return { artigos: [] };",
      ]).length,
      "as duas chamadas dentro de um Promise.all",
    ).toBe(0);
    expect(
      varrerFixture(["let resposta;", "resposta = await fetch(alvo, { method: 'POST' });"]).length,
      "atribuição a variável declarada antes",
    ).toBe(0);
  });

  it("menção em comentário não é chamada", () => {
    const c = varrerFixture([
      "// antes era `await fetch(url)` sem olhar nada",
      "const r = await fetch(url);",
      "if (!r.ok) throw new Error(String(r.status));",
    ]);
    expect(c.length, "a menção no comentário virou chamada").toBe(0);
  });
});
