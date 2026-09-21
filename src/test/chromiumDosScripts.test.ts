/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
// O módulo é `.mjs` sem tipos. O `typecheck:strict` resolve o import sozinho,
// então um `@ts-expect-error` aqui seria uma diretiva não usada — e ele reprova
// justamente por isso, o que está certo: supressão que não suprime nada é
// ruído que ensina a ignorar supressão.
import {
  caminhoDoChromium, opcoesDoChromium, pareceVazia, motivoDeTelaVazia,
} from "../../scripts/lib/chromium.mjs";

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
  }, PRAZO_COM_SUBPROCESSO);

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
  }, PRAZO_COM_SUBPROCESSO);

  it("todo script de navegador PERGUNTA se o app montou", () => {
    /**
     * ## O defeito, e o que esta regra promete
     *
     * O build da CI sai sem `VITE_SUPABASE_URL` — a variável ainda não está
     * configurada no repositório. O cliente do Supabase estoura
     * `supabaseUrl is required` na carga do módulo, o React nunca monta, e o
     * `#root` fica com ZERO elementos.
     *
     * O `ferramentas-verificar.mjs` esperava 15 s por um campo do formulário,
     * estourava com `TimeoutError` não tratado e saía **1 — DIVERGE**: dizia
     * que a calculadora está errada sobre uma tela onde nada foi medido, e
     * mandava o próximo leitor investigar o EuroSCORE em vez da variável.
     *
     * A regra é sobre `#root` porque `#root` é o ponto de montagem deste app
     * — está no `index.html` —, e não uma palavra escolhida por mim. Um script
     * que dirige navegador e nunca pergunta por ele está afirmando sobre uma
     * tela que pode estar em branco.
     *
     * **O que ela NÃO promete:** que a resposta seja tratada direito. Ela
     * confere que a pergunta é feita. Quem quiser o resto executa o script —
     * foi assim que este defeito foi confirmado e o conserto conferido nas duas
     * direções, contra um build sem chaves e contra um com.
     */
    const cegos: string[] = [];
    for (const full of scriptsQueSobemNavegador()) {
      const texto = semComentarios(readFileSync(full, "utf8"));
      const pergunta = /getElementById\(\s*["']root["']\s*\)/.test(texto)
        || /\bpareceVazia\b/.test(texto);
      if (!pergunta) cegos.push(`  · ${full} — afirma sobre a tela sem conferir se ela montou`);
    }
    expect(
      cegos,
      `\n${cegos.join("\n")}\n\n` +
        "Página em branco nunca reprova, e é o pior estado possível: um build\n" +
        "sem as chaves públicas derruba o app no boot e deixa `#root` vazio.\n" +
        "Quem afirma sobre essa tela está relatando medida que não fez.",
    ).toEqual([]);
  }, PRAZO_COM_SUBPROCESSO);
});

describe("a tela vazia", () => {
  it("é reconhecida por poucos elementos OU pouco texto", () => {
    // O shell do HTML sem app nenhum. Qualquer tela real deste app passa
    // folgado dos dois limiares.
    expect(pareceVazia({ elementos: 0, texto: 0 }), "o caso da CI").toBe(true);
    expect(pareceVazia({ elementos: 400, texto: 12 }), "montou e não escreveu nada").toBe(true);
    expect(pareceVazia({ elementos: 3, texto: 900 }), "texto sem app").toBe(true);
    expect(pareceVazia({}), "sem medida nenhuma não é 'está tudo bem'").toBe(true);
  });

  it("NÃO acusa uma tela que renderizou — falso vermelho custa igual", () => {
    // A calculadora do EuroSCORE, medida de verdade contra o preview local.
    expect(pareceVazia({ elementos: 512, texto: 2400 })).toBe(false);
  });

  it("o diagnóstico nomeia a causa provável, e não só o sintoma", () => {
    /**
     * "A página não renderizou" manda procurar no lugar errado. O que resolve é
     * a linha seguinte: falta a variável. Foi por isso que a execução da agenda
     * apontou para a calculadora durante uma rodada inteira.
     */
    const texto = motivoDeTelaVazia({
      elementos: 0, texto: 0, erros: ["Error: supabaseUrl is required."],
    });
    expect(texto, "sem o número, quem lê não sabe se foi quase ou foi nada").toContain("0 elemento(s)");
    expect(texto, "o erro real da página é a pista mais curta").toContain("supabaseUrl is required");
    expect(texto).toContain("VITE_SUPABASE_URL");
    expect(texto, "chave pública vai em Variables; dizer isso evita o erro seguinte")
      .toMatch(/Variables/);
    expect(texto, "isto não é divergência, e o texto precisa dizer")
      .toMatch(/ausência de medida, não divergência/);
  });
});

/**
 * O prazo das duas regras acima, que sobem um `git` pela varredura.
 *
 * `prazoDeSubprocesso.test.ts` exige que todo bloco que sobe processo externo
 * declare o próprio prazo — o padrão do Vitest são 5 000 ms, e numa máquina de
 * CI disputada isso já produziu vermelho sem causa. Aqui é `git ls-files`, de
 * milissegundos, não um `deno` subindo; o piso é folga, não necessidade.
 *
 * ## Um buraco daquela guarda, registrado onde ele aparece
 *
 * Ela NÃO teria cobrado isto: o detector procura `execFileSync(` dentro do
 * corpo do bloco, e aqui a chamada mora em `scriptsQueSobemNavegador()`, fora
 * dele. Subprocesso atrás de um helper escapa — e a guarda passa em silêncio,
 * que é a forma exata de defeito que esta sessão persegue.
 *
 * Fica registrado em vez de consertado, e por um motivo: seguir identificadores
 * até a função que os define é trabalho de analisador sintático, e esta sessão
 * já descartou um detector por ser frágil demais nesse ponto. O prazo declarado
 * aqui resolve o caso concreto; quem for fechar o buraco geral lê este parágrafo.
 */
const PRAZO_COM_SUBPROCESSO = 30_000;

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
  /**
   * A varredura é o repositório VERSIONADO inteiro, não a pasta `scripts/`.
   *
   * Enquanto ela olhava só `scripts/`, havia um `.shot-tmp.mjs` na raiz —
   * descartável de captura de tela, commitado sem querer, que ninguém chamava e
   * que cravava `/opt/pw-browsers/chromium`. A guarda existia justamente contra
   * aquilo e passava ao lado, porque estava amarrada ao diretório onde o defeito
   * tinha aparecido da primeira vez. Regra presa ao lugar do defeito é o defeito.
   *
   * `git ls-files` em vez de varrer o disco: é o conjunto do que está commitado,
   * e deixa de fora `node_modules` e `dist` sem precisar de lista de exceção.
   */
  const achados = execFileSync("git", ["ls-files", "*.mjs"], { encoding: "utf8" })
    .trim().split("\n").filter(Boolean)
    // O helper é a exceção: é ele que decide, e tem teste próprio acima.
    .filter((f) => !f.endsWith("lib/chromium.mjs"))
    .filter((f) => /chromium\.launch\s*\(/.test(readFileSync(f, "utf8")));

  expect(achados.length, "nenhum script sobe navegador — a varredura conferiu nada")
    .toBeGreaterThanOrEqual(3);
  return achados;
}
