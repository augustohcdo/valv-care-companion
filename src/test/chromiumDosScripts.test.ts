/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
// O módulo é `.mjs` sem tipos. O `typecheck:strict` resolve o import sozinho,
// então um `@ts-expect-error` aqui seria uma diretiva não usada — e ele reprova
// justamente por isso, o que está certo: supressão que não suprime nada é
// ruído que ensina a ignorar supressão.
import { caminhoDoChromium, opcoesDoChromium } from "../../scripts/lib/chromium.mjs";

/**
 * O Chromium dos scripts, e o defeito que a agenda diária achou.
 *
 * ## Como apareceu
 *
 * Na primeira vez que o workflow `verificacoes-periodicas` conseguiu rodar as
 * seis conferências — depois de dois portões de dois estados removidos —, a das
 * calculadoras reprovou com:
 *
 *     browserType.launch: Failed to launch chromium because executable
 *     doesn't exist at /opt/pw-browsers/chromium
 *
 * `/opt/pw-browsers` é o caminho do contêiner de desenvolvimento. Num executor
 * de CI o Playwright guarda o binário em outro lugar, e resolve sozinho quando
 * ninguém lhe dá um caminho.
 *
 * ## O que torna este caso instrutivo
 *
 * Dos três scripts que sobem navegador, **um já fazia certo** —
 * `rotas-renderizam.mjs` só passava `executablePath` quando o arquivo existia —
 * e o comentário dele descrevia este defeito com todas as letras:
 *
 *   > "Cravar o caminho fazia o script funcionar aqui e falhar lá — com um erro
 *   >  de 'executable doesn't exist' que não diz nada sobre rota nenhuma."
 *
 * A lição foi aprendida neste repositório, escrita, aplicada a um script, e os
 * outros dois ficaram sem. É a mesma forma da marcação que existia no
 * `ClinicalAIPanel` e faltava no `DocumentGenerator`.
 *
 * E não apareceu antes porque a única coisa que rodaria os três — a agenda
 * diária — estava quebrada desde o primeiro dia.
 */

describe("o Chromium dos scripts", () => {
  it("usa o caminho fixado quando ele EXISTE", () => {
    const opcoes = opcoesDoChromium({
      env: { PW_CHROMIUM: "/opt/pw-browsers/chromium" },
      existe: (c: string) => c === "/opt/pw-browsers/chromium",
    });
    expect(opcoes.executablePath).toBe("/opt/pw-browsers/chromium");
  });

  it("NÃO passa caminho quando o arquivo não existe — o defeito da CI", () => {
    // Sem `executablePath`, o Playwright resolve o binário que ele mesmo
    // baixou. Passando um caminho que não existe, ele estoura com um erro que
    // fala de executável quando o assunto era a calculadora de risco.
    const opcoes = opcoesDoChromium({ env: {}, existe: () => false });
    expect(
      "executablePath" in opcoes,
      "cravou um caminho que não existe — é o erro que reprovou na CI",
    ).toBe(false);
  });

  it("um `PW_CHROMIUM` digitado errado não vira erro de lançamento", () => {
    // A saída de escape também é conferida: caminho errado vira "deixa o
    // Playwright resolver", e não uma falha que aponta para o lugar errado.
    const caminho = caminhoDoChromium({
      env: { PW_CHROMIUM: "/caminho/que/nao/existe" },
      existe: (c: string) => c === "/opt/pw-browsers/chromium",
    });
    expect(caminho, "caiu para o caminho do contêiner, que existe").toBe(
      "/opt/pw-browsers/chromium",
    );
    expect(
      caminhoDoChromium({ env: { PW_CHROMIUM: "/nao/existe" }, existe: () => false }),
    ).toBeNull();
  });

  it("o proxy entra só quando há um configurado", () => {
    // Sem proxy no contêiner de desenvolvimento, o Supabase não responde e a
    // tela fica vazia — a conferência passaria a medir uma página em branco.
    const com = opcoesDoChromium({ env: { HTTPS_PROXY: "http://p:8080" }, existe: () => false });
    expect(com.proxy).toEqual({ server: "http://p:8080", bypass: "127.0.0.1,localhost" });
    expect("proxy" in opcoesDoChromium({ env: {}, existe: () => false })).toBe(false);
  });

  /**
   * ## O que esta varredura NÃO promete — e o dia em que eu achei que prometia
   *
   * As duas regras abaixo leem o TEXTO dos scripts. Elas dizem "nenhum script
   * crava caminho" e "todos buscam a decisão no mesmo lugar". Não dizem que os
   * scripts *funcionam*, e eu tratei uma pela outra.
   *
   * O conserto que este arquivo acompanha trocou o corpo de três scripts pela
   * chamada `opcoesDoChromium()` — **sem o `import`** em nenhum dos três. Os
   * três morriam com `ReferenceError` antes de abrir uma aba. A varredura
   * aprovou os três: ela procurava a AUSÊNCIA de `executablePath:`, e um
   * arquivo que não carrega também não tem `executablePath:`.
   *
   * Guarda cujo nome promete mais do que ela confere é pior do que nenhuma,
   * porque compra confiança que não sustenta. Quem pega "o script não roda" é
   * o `no-undef` do lint, ligado em `eslint.config.js` para `scripts/**\/*.mjs`
   * e conferido em `lintCobreOsScripts.test.ts` — até aquele conserto, o lint
   * não olhava nenhum destes 29 arquivos e anunciava `0 erros` em toda CI.
   */

  it("nenhum script sobe navegador com caminho cravado", () => {
    /**
     * A regra sobre a classe, não sobre os dois arquivos onde o defeito
     * apareceu. O próximo script que subir navegador entra sozinho.
     */
    const ruins: string[] = [];
    for (const full of scriptsQueSobemNavegador()) {
      if (/executablePath\s*:/.test(semComentarios(readFileSync(full, "utf8")))) {
        ruins.push(`  · ${full} — decide o caminho por conta própria`);
      }
    }
    expect(
      ruins,
      `\n${ruins.join("\n")}\n\n` +
        "O caminho do Chromium mora em `scripts/lib/chromium.mjs`, que só o passa\n" +
        "quando o arquivo existe. Três cópias de uma regra garantem que uma divirja\n" +
        "— e foi assim que dois dos três scripts ficaram sem a correção que o\n" +
        "terceiro já tinha, com o motivo escrito no comentário dele.",
    ).toEqual([]);
  });

  it("todo script de navegador busca a decisão no helper, e não uma cópia sua", () => {
    /**
     * A regra acima confere que ninguém escreve o caminho errado. Esta confere
     * que todos leem o CERTO — do mesmo arquivo.
     *
     * A diferença não é acadêmica: um script pode declarar o próprio
     * `opcoesDoChromium` local, passar no `no-undef`, passar na regra de cima,
     * e divergir do helper na primeira vez que o helper mudar. Foi exatamente
     * assim que o `rotas-renderizam.mjs` ficou certo e os outros dois errados
     * — cada um com sua cópia da mesma decisão.
     */
    const semHelper: string[] = [];
    for (const full of scriptsQueSobemNavegador()) {
      const texto = readFileSync(full, "utf8");
      const importa = /^\s*import\s*\{[^}]*\bopcoesDoChromium\b[^}]*\}\s*from\s*["'][^"']*lib\/chromium\.mjs["']/m
        .test(texto);
      if (!importa) {
        semHelper.push(`  · ${full} — sobe navegador sem importar de lib/chromium.mjs`);
      }
    }
    expect(
      semHelper,
      `\n${semHelper.join("\n")}\n\n` +
        "Quem sobe navegador pega as opções em `scripts/lib/chromium.mjs`. Uma\n" +
        "regra que mora num arquivo só não tem como divergir de si mesma.",
    ).toEqual([]);
  });
});

/**
 * O código sem os comentários, com as linhas preservadas.
 *
 * A regra do caminho cravado procura `executablePath:` no arquivo. Sem esta
 * limpeza, o primeiro comentário que EXPLICASSE a regra — escrevendo o nome do
 * campo seguido de dois pontos, como faz o cabeçalho do `mobile.mjs` — derrubaria
 * a guarda. Guarda que pune quem documentou é guarda que alguém desliga.
 *
 * As quebras de linha são mantidas de propósito: uma versão anterior deste
 * truque, noutro detector desta base, colapsava os comentários de bloco e fazia
 * a varredura apontar a linha 150 para um defeito que estava na 158.
 */
function semComentarios(texto: string): string {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * Os scripts que sobem navegador — a varredura das duas regras acima.
 *
 * O piso está aqui, e não em cada regra, porque é ele que impede a varredura de
 * aprovar por não ter achado nada: uma lista vazia satisfaz qualquer `toEqual([])`.
 */
function scriptsQueSobemNavegador(): string[] {
  const achados: string[] = [];
  const varrer = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const full = join(dir, nome);
      if (statSync(full).isDirectory()) { varrer(full); continue; }
      if (!/\.mjs$/.test(nome)) continue;
      // O helper é a exceção: é ele que decide, e tem teste próprio acima.
      if (full.endsWith("lib/chromium.mjs")) continue;
      if (/chromium\.launch\s*\(/.test(readFileSync(full, "utf8"))) achados.push(full);
    }
  };
  varrer("scripts");

  expect(achados.length, "nenhum script sobe navegador — a varredura conferiu nada")
    .toBeGreaterThanOrEqual(3);
  return achados;
}
