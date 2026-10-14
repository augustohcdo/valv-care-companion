/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  origemDaMedida, textoDeFechamento, textoDoComentario,
} from "../../.github/scripts/avisoPorIssue.mjs";

/**
 * Todo texto que o aviso publica diz ONDE mediu — e o JS do workflow é JS.
 *
 * ## O primeiro defeito, que aconteceu duas vezes
 *
 * Em 2026-10-05 eu disparei a agenda diária à mão, do ramo de trabalho, ela
 * passou, e eu reportei "agenda verde". Era verdade do ramo e falso da agenda:
 * as execuções agendadas rodam em `main`, e lá reprovava todo dia. O conserto
 * foi pôr `ramo` e `evento` no CORPO da issue.
 *
 * Em 2026-10-14 aconteceu de novo, uma camada fora. Disparei a agenda do ramo
 * de trabalho para conferir uma hipótese, ela passou, e o passo de aviso FECHOU
 * a issue #5 com:
 *
 *     Voltou a passar.
 *
 *     Execução: <link>
 *
 * `main` reprovava havia dez dias. Quem abrisse a issue fechada leria "voltou a
 * passar" sem nada que dissesse de onde — e o corpo, que diria, tinha sido
 * substituído pelo da execução do ramo.
 *
 * O conserto anterior cobriu o corpo e deixou os comentários. O de fechamento é
 * o que afirma mais forte, e era o único escrito solto dentro do `script:` do
 * YAML — onde nenhum teste alcança.
 *
 * ## O segundo defeito: o JS do workflow não era conferido por nada
 *
 * Os dois passos de aviso levam ~70 linhas de JavaScript dentro de `script: |`.
 * Erro de sintaxe ali só aparece em tempo de execução, **no passo cujo trabalho
 * é relatar falha** — o alarme que morre calado. Nem `tsc`, nem `lint`, nem a
 * suíte olhavam aquele texto como código.
 *
 * Esta guarda extrai cada bloco, troca as expressões `${{ … }}` do GitHub por um
 * literal (elas são substituídas antes de o script rodar) e confere a sintaxe.
 */

const DIARIA = ".github/workflows/verificacoes-periodicas.yml";
const SEMANAL = ".github/workflows/rotas-autenticadas.yml";
const MODULO = ".github/scripts/avisoPorIssue.mjs";

const ler = (p: string) => readFileSync(p, "utf8");

/** Os corpos de cada `script: |` de um workflow, desindentados. */
function blocosDeScript(caminho: string): string[] {
  const linhas = ler(caminho).split("\n");
  const blocos: string[] = [];
  for (let i = 0; i < linhas.length; i++) {
    if (!/^\s*script: \|\s*$/.test(linhas[i])) continue;
    const base = linhas[i].length - linhas[i].trimStart().length;
    const corpo: string[] = [];
    let j = i + 1;
    for (; j < linhas.length; j++) {
      if (linhas[j].trim() === "") { corpo.push(""); continue; }
      const ind = linhas[j].length - linhas[j].trimStart().length;
      if (ind <= base) break;
      corpo.push(linhas[j].slice(base + 2));
    }
    blocos.push(corpo.join("\n"));
    i = j - 1;
  }
  return blocos;
}

describe("o aviso diz onde mediu", () => {
  it("a origem sai quando se sabe, e some quando não se sabe", () => {
    /**
     * Omitir é deliberado: inventar "main" por padrão repetiria o defeito em
     * outra forma — afirmaria uma origem que ninguém mediu. Uma issue criada
     * antes desta mudança não tem como ter o dado.
     */
    expect(origemDaMedida({ ramo: "main", evento: "schedule" }))
      .toBe("Medido no ramo `main`, disparo `schedule`.");
    expect(origemDaMedida({ ramo: "refs/heads/trabalho", evento: null }))
      .toBe("Medido no ramo `refs/heads/trabalho`.");
    expect(origemDaMedida({ ramo: null, evento: "workflow_dispatch" }))
      .toBe("Medido no disparo `workflow_dispatch`.");
    expect(origemDaMedida({ ramo: null, evento: null }), "inventou uma origem").toBe("");
  });

  it("O DEFEITO: o fechamento diz em que ramo passou", () => {
    const texto = textoDeFechamento({
      link: "https://exemplo/run/1", ramo: "refs/heads/trabalho",
      evento: "workflow_dispatch", agenda: "A agenda diária roda em `main`",
    });
    expect(texto, "o fechamento não diz onde mediu").toMatch(/Medido no ramo `refs\/heads\/trabalho`/);
    expect(texto, "o fechamento não ressalva que a agenda roda em outro ramo")
      .toMatch(/A agenda diária roda em `main`/);
    expect(texto, "o fechamento não diz que veredito de outro ramo não vale pelo que está no ar")
      .toMatch(/não diz nada sobre o que está no ar/);
    expect(texto).toMatch(/Voltou a passar/);
    expect(texto).toContain("https://exemplo/run/1");
  });

  it("sem saber a origem, o fechamento não afirma nenhuma", () => {
    const texto = textoDeFechamento({ link: "https://exemplo/run/1" });
    expect(texto).toMatch(/Voltou a passar/);
    expect(texto, "inventou uma origem no fechamento").not.toMatch(/Medido no/);
  });

  it("os comentários de mudança e de primeira vez também dizem a origem", () => {
    const comuns = { link: "https://exemplo/run/2", ramo: "main", evento: "schedule" };
    const mudou = textoDoComentario({ ...comuns, mudancas: ["- **X** — era ✅ ok, agora ❌ DIVERGE"], primeiraVez: false });
    expect(mudou, "o comentário de mudança não diz a origem").toMatch(/Medido no ramo `main`/);
    expect(mudou).toMatch(/Mudou o que está reprovando/);

    const primeira = textoDoComentario({ ...comuns, mudancas: [], primeiraVez: true });
    expect(primeira, "o comentário de primeira vez não diz a origem").toMatch(/Medido no ramo `main`/);
    expect(primeira).toMatch(/Continua reprovando/);
  });

  it("nenhum workflow escreve o texto de fechamento à mão", () => {
    /**
     * As duas agendas tinham a sua própria frase — "Voltou a passar." numa,
     * "Voltou a passar. Fechando." na outra. Divergência pequena, e o lugar
     * onde a próxima mudança chega só a uma delas. Agora as duas chamam o
     * módulo, que um teste alcança.
     */
    for (const w of [DIARIA, SEMANAL]) {
      const y = ler(w);
      expect(y, `${w} voltou a escrever o fechamento dentro do YAML`)
        .not.toMatch(/body: `Voltou a passar/);
      expect(y, `${w} não usa o texto de fechamento do módulo`)
        .toMatch(/textoDeFechamento\(\{/);
      expect(y, `${w} não passa o ramo ao comentário de mudança`)
        .toMatch(/textoDoComentario\(\{[^}]*ramo, evento/);
    }
  });

  it("o JS dentro de `script:` é JS válido", () => {
    /**
     * Nem `tsc`, nem `lint`, nem a suíte olhavam esse texto. Erro de sintaxe
     * ali só apareceria em tempo de execução — no passo cujo trabalho é
     * relatar falha.
     *
     * `${{ … }}` é expressão do GitHub, substituída antes de o script rodar;
     * aqui ela vira um literal para a sintaxe fechar. E o corpo é embrulhado em
     * função assíncrona porque usa `await` no topo, que é o que
     * `actions/github-script` permite.
     */
    const blocos = [...blocosDeScript(DIARIA), ...blocosDeScript(SEMANAL)];
    expect(blocos.length, "não achei os blocos de `script:`").toBeGreaterThanOrEqual(2);
    for (const bloco of blocos) {
      expect(bloco.length, "um bloco de `script:` saiu vazio da extração").toBeGreaterThan(200);
      const js = bloco.replace(/\$\{\{[^}]*\}\}/g, "false");
      expect(
        () => new Function(`return (async () => {\n${js}\n})`),
        `erro de sintaxe no JS de um passo de aviso:\n${js.slice(0, 200)}…`,
      ).not.toThrow();
    }
  });

  it("o módulo do aviso exporta o que os workflows chamam", () => {
    // O outro lado do mesmo contrato: o `import` dentro do `script:` é
    // resolvido em tempo de execução, então um nome errado só apareceria lá.
    const modulo = ler(MODULO);
    for (const w of [DIARIA, SEMANAL]) {
      const y = ler(w);
      /**
       * Ancorado na DESESTRUTURAÇÃO, não na primeira menção ao arquivo: o
       * comentário acima do import também cita `avisoPorIssue.mjs`, e cortar
       * 400 caracteres antes dele pegava texto que não tem nome nenhum. Foi o
       * primeiro resultado desta regra — zero nomes lidos.
       */
      const m = /const \{([\s\S]*?)\} = await import\([^)]*avisoPorIssue\.mjs[^)]*\)/.exec(y);
      expect(m, `não achei o import do módulo em ${w}`).toBeTruthy();
      const nomes = m![1].split(",").map((n) => n.trim()).filter(Boolean);
      expect(nomes.length, `não li os nomes importados em ${w}`).toBeGreaterThan(2);
      for (const nome of new Set(nomes)) {
        expect(modulo, `${w} importa \`${nome}\`, que o módulo não exporta`)
          .toMatch(new RegExp(`export function ${nome}\\b`));
      }
    }
  });
});
