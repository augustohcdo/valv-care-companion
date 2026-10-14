/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { semComentariosDeCodigo } from "./semComentariosDeCodigo";

/**
 * Nenhum script de navegador espera silêncio de rede de terceiro.
 *
 * ## O defeito, medido numa execução de CI
 *
 * `mobile.mjs` era o único dos três scripts de navegador a abrir a página com
 * `waitUntil: "networkidle"`. Na primeira execução dele na CI (run 38572453124,
 * ramo de trabalho), seis das sete conferências da agenda passaram e esta
 * reprovou: duas das onze páginas estouraram os 30 s.
 *
 *     ? /auth/login — não deu para medir: page.goto: Timeout 30000ms exceeded.
 *     ? /medicos    — não deu para medir: page.goto: Timeout 30000ms exceeded.
 *
 * As duas levam o widget do Turnstile, que carrega script de
 * `challenges.cloudflare.com` e mantém a rede conversando. O silêncio que
 * `networkidle` espera **nunca chega** — não porque a página esteja errada, mas
 * porque a condição depende de um terceiro que não precisa cooperar.
 *
 * O script relatou NÃO CONFERIDO, corretamente. E isso é o problema: a agenda
 * diária ficaria vermelha todos os dias por duas páginas que renderizam
 * perfeitamente. Este repositório já escreveu a frase, sobre a periodicidade do
 * conferidor de fontes: "uma indisponibilidade passageira viraria ⚠️ todo dia,
 * que é como se ensina alguém a ignorar o aviso".
 *
 * ## Por que não bastava trocar para `domcontentloaded`
 *
 * `domcontentloaded` dispara antes de o React montar. Medir ali é medir `#root`
 * vazio — e página em branco nunca transborda, então o `mobile.mjs` passaria a
 * APROVAR onze páginas em branco. É o defeito que `pareceVazia` existe para
 * pegar, reintroduzido por outra porta.
 *
 * A abertura e a espera foram para `abrirEEsperarMontar`, em
 * `lib/chromium.mjs`: `domcontentloaded` para não depender de terceiro, e
 * espera ATIVA pela montagem depois. O `ferramentas-verificar.mjs` tinha a sua
 * própria cópia do laço de espera e passou a usar a mesma — quarta vez nesta
 * dupla de arquivos que uma lição aprendida num deles faltava no outro.
 *
 * ## O que esta guarda cobra
 *
 * Que `networkidle` não volte, que os dois scripts usem a espera compartilhada,
 * e que a espera continue sendo as duas metades: abrir sem depender da rede, e
 * não acreditar numa tela vazia.
 */

const LIB = "scripts/lib/chromium.mjs";
const BROWSER = [
  "scripts/mobile.mjs",
  "scripts/ferramentas-verificar.mjs",
  "scripts/rotas-renderizam.mjs",
];

const ler = (p: string) => readFileSync(p, "utf8");
const limpo = (p: string) => semComentariosDeCodigo(ler(p), p);

describe("a espera do navegador não depende de terceiro", () => {
  it("os arquivos varridos são os que sobem navegador", () => {
    /**
     * O piso. Se um script de navegador novo aparecer e não entrar nesta lista,
     * a regra abaixo não o cobre — e passaria por "ninguém usa networkidle".
     */
    for (const f of BROWSER) {
      expect(limpo(f), `${f} não sobe navegador`).toMatch(/opcoesDoChromium|chromium\.launch/);
    }
    const todos = [...ler("package.json").matchAll(/scripts\/([\w-]+\.mjs)/g)].map((m) => m[1]);
    const comNavegador = todos.filter((n) =>
      /opcoesDoChromium|chromium\.launch/.test(
        (() => { try { return ler(`scripts/${n}`); } catch { return ""; } })(),
      ),
    );
    const faltando = comNavegador.filter((n) => !BROWSER.includes(`scripts/${n}`));
    expect(
      faltando,
      `script(s) de navegador fora desta guarda: ${faltando.join(", ")} — acrescente em BROWSER`,
    ).toEqual([]);
  });

  it("nenhum espera `networkidle`", () => {
    /**
     * A regra é sobre a GARANTIA: a conferência não pode depender de um
     * terceiro ficar quieto. `networkidle` é a forma concreta que isso teve
     * aqui; se aparecer outra, o caso de cima (o piso) é que vai ter de crescer.
     */
    const culpados = BROWSER.filter((f) => /networkidle/.test(limpo(f)));
    expect(
      culpados,
      `${culpados.join(", ")} espera \`networkidle\`.\n\n` +
        "Isso faz a conferência depender de um terceiro ficar quieto. O widget do\n" +
        "Turnstile, em `/auth/login` e `/medicos`, mantém a rede conversando — e o\n" +
        "`goto` estourou 30 s na CI por duas páginas que renderizam certo.\n\n" +
        "Use `abrirEEsperarMontar` de `lib/chromium.mjs`: `domcontentloaded` e\n" +
        "espera ativa pela montagem.",
    ).toEqual([]);
    // E a lib também não: ela é quem abre agora.
    expect(limpo(LIB), "a espera compartilhada voltou a usar `networkidle`")
      .not.toMatch(/networkidle/);
  });

  it("os dois que medem a tela usam a espera compartilhada", () => {
    // `rotas-renderizam.mjs` fica de fora de propósito: ele sonda 62 rotas
    // só para ver se o shell do app responde, sem medir conteúdo, e tem o seu
    // próprio laço com limites bem diferentes.
    for (const f of ["scripts/mobile.mjs", "scripts/ferramentas-verificar.mjs"]) {
      expect(limpo(f), `${f} não usa a espera compartilhada`)
        .toMatch(/abrirEEsperarMontar\(/);
    }
  });

  it("a espera compartilhada tem as DUAS metades", () => {
    /**
     * Abrir sem depender da rede é metade. A outra é não acreditar numa tela
     * vazia: sem o laço, `domcontentloaded` entrega `#root` com zero elementos,
     * e página em branco nunca transborda — o `mobile.mjs` aprovaria onze
     * páginas em branco, uma por uma.
     */
    const lib = limpo(LIB);
    const i = lib.indexOf("export async function abrirEEsperarMontar");
    expect(i, "não achei a espera compartilhada").toBeGreaterThan(0);
    const corpo = lib.slice(i);
    expect(corpo, "a abertura deixou de ser `domcontentloaded`")
      .toMatch(/waitUntil:\s*"domcontentloaded"/);
    expect(corpo, "a espera ativa pela montagem desapareceu")
      .toMatch(/while\s*\(pareceVazia\(medida\)/);
    expect(corpo, "a espera não tem prazo — travaria para sempre numa página que nunca monta")
      .toMatch(/Date\.now\(\) < limite/);
  });

  it("quem mede continua recusando a tela vazia", () => {
    /**
     * A espera devolve a medida e não decide nada — de propósito, porque os dois
     * chamadores decidem diferente: um encerra tudo como NÃO CONFERIDO, o outro
     * marca a página e segue. O que nenhum dos dois pode fazer é medir uma tela
     * vazia e chamar de aprovada.
     */
    for (const f of ["scripts/mobile.mjs", "scripts/ferramentas-verificar.mjs"]) {
      expect(limpo(f), `${f} deixou de recusar a tela vazia`).toMatch(/pareceVazia\(/);
    }
  });
});
