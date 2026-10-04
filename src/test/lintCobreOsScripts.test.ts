/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { ESLint } from "eslint";
import { readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

/**
 * O lint dizia "0 erros" sobre 29 arquivos que ele não abria.
 *
 * ## Como apareceu
 *
 * A agenda diária reprovou a conferência das calculadoras com:
 *
 *     ReferenceError: opcoesDoChromium is not defined
 *         at scripts/ferramentas-verificar.mjs:125:34
 *
 * Eu tinha movido a decisão do caminho do Chromium para `scripts/lib/chromium.mjs`
 * e trocado o corpo dos três scripts que sobem navegador pela chamada ao helper
 * — **sem acrescentar o `import` em nenhum dos três**. Os três estavam mortos.
 *
 * Nada pegou:
 *
 *  · `node --check` passa. Nome não resolvido é erro de execução, não de sintaxe.
 *  · A guarda que eu tinha escrito (`chromiumDosScripts.test.ts`) conferia a
 *    AUSÊNCIA de `executablePath:` no arquivo — e um script que nem carrega
 *    também não tem `executablePath:`. Guarda que só sabe dizer "não vi a coisa
 *    errada" aprova o arquivo que não faz coisa nenhuma.
 *  · `npm run lint` roda em toda CI e vinha dizendo **0 erros**. Verdade sobre os
 *    arquivos que ele olhava; silêncio sobre os 29 que ele não olhava, porque o
 *    único bloco do `eslint.config.js` valia para `**\/*.{ts,tsx}` e mais nada.
 *  · E o `rotas-renderizam.mjs`, igualmente quebrado, aparecia verde na agenda:
 *    o rótulo "Rotas do site publicado (smoke)" roda `smoke.mjs`, outro arquivo.
 *
 * Quatro camadas relatando sucesso sem ter feito o trabalho — que é o tema desta
 * sessão inteira, aqui dentro das próprias ferramentas de conferência.
 *
 * ## O que este arquivo garante
 *
 * Não que os scripts estejam certos: que o lint **olhe** para eles, e com a
 * regra que pega esta classe (`no-undef`). E não lendo o `eslint.config.js` com
 * expressão regular — perguntando ao ESLint, e mandando-o lintar texto de
 * verdade. Configuração conferida por leitura é a mesma aposta que falhou aqui.
 */

const CAMINHO_DE_SCRIPT = "scripts/inventado-pelo-teste.mjs";

/** Lint de verdade sobre um trecho, no lugar onde os scripts moram. */
async function lintar(codigo: string, caminho = CAMINHO_DE_SCRIPT) {
  const eslint = new ESLint({});
  const [resultado] = await eslint.lintText(codigo, { filePath: caminho });
  return resultado.messages;
}

describe("o lint cobre os scripts de `scripts/`", () => {
  it("reprova nome usado sem definir — o defeito exato que a agenda acusou", async () => {
    // A forma é a do `ferramentas-verificar.mjs` no dia em que quebrou: a
    // chamada ao helper sem o `import` que a traz.
    const mensagens = await lintar(
      'const { chromium } = await import("playwright");\n' +
        "const navegador = await chromium.launch(opcoesDoChromium());\n" +
        "await navegador.close();\n",
    );
    const undef = mensagens.filter((m) => m.ruleId === "no-undef");
    expect(
      undef.map((m) => m.message),
      "o lint não viu a chamada sem import — foi assim que três scripts mortos\n" +
        "passaram por uma CI que anunciava `0 erros`",
    ).toContain("'opcoesDoChromium' is not defined.");
    expect(undef[0]?.severity, "achou, mas como aviso — aviso não reprova CI").toBe(2);
  });

  it("os globais do navegador NÃO viram falso vermelho", async () => {
    /**
     * Estes scripts passam funções para `page.evaluate()`, que roda dentro da
     * página. `document`, `window` e `location` são legítimos ali, e sem os
     * globais de navegador o `no-undef` acusaria 17 linhas corretas.
     *
     * Falso vermelho importa tanto quanto falso verde: guarda que pune quem fez
     * certo é guarda que alguém desliga — e uma guarda desligada não protege de
     * nada. Está conferido nos dois sentidos, não só no de reprovar.
     */
    const mensagens = await lintar(
      "export function medir() {\n" +
        "  const largura = document.documentElement.clientWidth;\n" +
        "  return { largura, alt: window.innerHeight, onde: location.pathname };\n" +
        "}\n",
    );
    expect(mensagens, `acusou código correto: ${JSON.stringify(mensagens)}`).toEqual([]);
  });

  it("`catch {}` vazio com comentário continua permitido", async () => {
    // Todo carregador de Playwright daqui tenta três caminhos e engole a falha
    // dos dois primeiros de propósito, com o motivo escrito ao lado. Proibir
    // isso seria reescrever seis arquivos corretos para agradar a uma regra.
    const mensagens = await lintar(
      'try { await import("playwright"); } catch { /* tenta o próximo */ }\n',
    );
    expect(mensagens).toEqual([]);
  });

  it("nenhum arquivo executável VERSIONADO fica de fora do lint", async () => {
    /**
     * A regra sobre a classe, e a classe é o repositório — não a pasta.
     *
     * A primeira versão varria `scripts/`, porque foi ali que os três scripts
     * mortos estavam. Regra amarrada ao diretório onde o defeito apareceu é o
     * próprio defeito, e esta sessão já pagou por isso três vezes: o caminho do
     * Chromium (dois de três arquivos), o `.shot-tmp.mjs` na raiz (invisível
     * para o lint E para a guarda, porque os dois olhavam só `scripts/`), e a
     * varredura do terceiro estado presa a `pages/app/`.
     *
     * Quem acendeu a luz desta vez foi `.github/scripts/avisoPorIssue.mjs`:
     * código executável num diretório novo, dentro do alcance do ESLint e fora
     * do alcance desta guarda.
     *
     * `git ls-files` em vez de varrer o disco: é o conjunto do que está
     * commitado, e deixa `node_modules` e `dist` de fora sem lista de exceção.
     */
    const eslint = new ESLint({});
    const executaveis = execFileSync("git", ["ls-files"], { encoding: "utf8" })
      .trim().split("\n")
      .filter((f) => /\.(mjs|js|cjs|ts|tsx)$/.test(f));

    /**
     * Os dois arquivos de configuração da raiz, com motivo.
     *
     * Não são código do produto: são a configuração das próprias ferramentas, e
     * cada um reprova em voz alta quando quebra — `eslint.config.js` derruba o
     * `npm run lint` inteiro, `postcss.config.js` derruba o build. Não há
     * silêncio possível neles, que é a razão de a regra existir.
     */
    const CONFIG_DA_RAIZ: Record<string, string> = {
      "eslint.config.js":
        "é o próprio config do ESLint; quebrado, o `npm run lint` não roda e ninguém " +
        "confunde isso com 'nenhum problema encontrado'",
      "postcss.config.js":
        "configuração do build; quebrada, o `npm run build` reprova na hora",
    };

    const foraDoLint: string[] = [];
    for (const arquivo of executaveis) {
      if (arquivo in CONFIG_DA_RAIZ) continue;
      if (await eslint.isPathIgnored(arquivo)) {
        foraDoLint.push(`  · ${arquivo} — ignorado pelo ESLint`);
        continue;
      }
      const config = await eslint.calculateConfigForFile(arquivo);
      if (Object.keys(config.rules ?? {}).length === 0) {
        foraDoLint.push(`  · ${arquivo} — nenhum bloco do config o alcança`);
      }
    }

    expect(
      executaveis.length,
      "a varredura não achou arquivo nenhum — estaria conferindo nada",
    ).toBeGreaterThanOrEqual(400);
    /**
     * O piso que importa: a varredura NÃO é presa a um diretório.
     *
     * A primeira tentativa deste piso exigia um arquivo em `.github/` — e
     * reprovou, porque o arquivo que motivou a mudança ainda não estava no
     * índice do git. Piso que depende de um arquivo específico existir é piso
     * que reprova quem apagou aquele arquivo por um motivo legítimo. O que se
     * quer garantir é a propriedade, não a amostra.
     */
    const raizes = new Set(executaveis.map((f) => f.split("/")[0]));
    expect(
      [...raizes].sort(),
      "a varredura cobre um diretório só — era exatamente o defeito da versão anterior",
    ).not.toHaveLength(1);
    expect(raizes.size, "poucos diretórios de topo para o tamanho desta base")
      .toBeGreaterThanOrEqual(3);
    expect(
      foraDoLint,
      `\n${foraDoLint.join("\n")}\n\n` +
        "`npm run lint` é `eslint .` e roda em toda CI. Arquivo que ele não\n" +
        "alcança não aparece como problema: aparece como ausência de problema,\n" +
        "que é indistinguível de estar certo — e foi exatamente assim que três\n" +
        "scripts que não carregavam ficaram verdes por uma semana.",
    ).toEqual([]);
    /**
     * Prazo declarado porque este bloco sobe `git ls-files`.
     * `prazoDeSubprocesso.test.ts` cobrou na hora — e com razão: o padrão do
     * Vitest são 5 s, e numa máquina de CI disputada isso já produziu vermelho
     * sem causa nesta base.
     */
  }, 30_000);

  it("`no-undef` está ligado onde ele é a única rede", async () => {
    /**
     * Nos `.ts` o `typescript-eslint` desliga o `no-undef` de propósito — quem
     * pega nome inexistente lá é o compilador, em `npm run typecheck`. Nos
     * `.mjs` não há compilador nenhum: sem esta regra, ninguém olha.
     */
    const eslint = new ESLint({});
    const doScript = await eslint.calculateConfigForFile("scripts/mobile.mjs");
    const gravidade = (r: unknown) => (Array.isArray(r) ? r[0] : r);
    expect(gravidade(doScript.rules?.["no-undef"]), "`no-undef` precisa reprovar, não avisar")
      .toBe(2);
  });
});
