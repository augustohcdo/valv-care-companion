/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chamadasDescartadas, totalDeChamadas, varrerFontes } from "./resultadoDescartado";

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

/**
 * As chamadas em que descartar o resultado é defeito, e o motivo de cada uma.
 *
 * A lista é curta de propósito: são as funções que dizem "fiz o trabalho lá
 * fora" e cujo retorno é a ÚNICA forma de saber se fizeram.
 */
const OBRIGATORIAS: Record<string, string> = {
  fetch:
    "não tem `error`: resolve normalmente com um 500 e só rejeita se a conexão falhar",
  sendEmail:
    "devolve `{ sent, reason }` e nunca lança — um e-mail que não saiu é indistinguível de um que saiu",
  sendAlert:
    "o mesmo, e é o grito que avisa que a camada de baixo falhou",
};
const NOMES = Object.keys(OBRIGATORIAS);

describe("nenhuma chamada joga o resultado fora", () => {
  const arquivos = RAIZES.flatMap((r) => varrerFontes(r));

  it("nenhuma chamada descarta o resultado inteiro", () => {
    const ruins: string[] = [];
    let total = 0;

    for (const arquivo of arquivos) {
      const original = readFileSync(arquivo, "utf8");
      total += totalDeChamadas(original, NOMES);
      for (const c of chamadasDescartadas(original, NOMES)) {
        ruins.push(`  · ${arquivo}:${c.linha} — \`${c.nome}\`: ${OBRIGATORIAS[c.nome]}`);
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

  it("cada nome da lista é de fato exercido pela varredura", () => {
    // Uma lista ampliada que nunca casa passa sobre nada — e "passou" é
    // exatamente o que esta sessão inteira desconfia. Se alguém acrescentar um
    // nome aqui e a base não tiver chamada nenhuma a ele, isto acusa em vez de
    // ficar verde por vacuidade.
    const contagem: Record<string, number> = Object.fromEntries(NOMES.map((n) => [n, 0]));
    for (const arquivo of arquivos) {
      const texto = readFileSync(arquivo, "utf8");
      for (const nome of NOMES) contagem[nome] += totalDeChamadas(texto, [nome]);
    }
    const semNenhuma = NOMES.filter((n) => contagem[n] === 0);
    expect(
      semNenhuma,
      `\nNomes cobrados sem nenhuma chamada na base: ${semNenhuma.join(", ")}.\n` +
        "Ou a função sumiu (e o nome sai da lista), ou o detector parou de casar.\n" +
        `Contagem: ${JSON.stringify(contagem)}`,
    ).toEqual([]);
  });

  /** As contraprovas, em arquivo, porque é assim que o detector é usado. */
  const varrerFixture = (linhas: string[]) => {
    const dir = mkdtempSync(join(tmpdir(), "fetchok-"));
    try {
      const caminho = join(dir, "x.mjs");
      writeFileSync(caminho, linhas.join("\n"));
      return chamadasDescartadas(readFileSync(caminho, "utf8"), NOMES);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it("acusa o resultado descartado — o caso do corrigir-braile", () => {
    const c = varrerFixture([
      "await fetch(`${BASE}/rest/v1/catalogo?id=eq.1`, { method: 'PATCH', body: corpo });",
      "console.log('+ Inovare Alpha: foto e página do fabricante');",
    ]);
    expect(c.length, "não viu o `fetch` descartado").toBe(1);
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
