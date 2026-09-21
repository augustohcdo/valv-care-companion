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

  it("nenhum script sobe navegador com caminho cravado", () => {
    /**
     * A regra sobre a classe, não sobre os dois arquivos onde o defeito
     * apareceu. O próximo script que subir navegador entra sozinho.
     */
    const ruins: string[] = [];
    let comLaunch = 0;

    const varrer = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        const full = join(dir, nome);
        if (statSync(full).isDirectory()) { varrer(full); continue; }
        if (!/\.mjs$/.test(nome)) continue;
        const texto = readFileSync(full, "utf8");
        if (!/chromium\.launch\s*\(/.test(texto)) continue;
        comLaunch++;
        // O helper é a exceção: é ele que decide, e tem teste próprio acima.
        if (full.endsWith("lib/chromium.mjs")) continue;
        if (/executablePath\s*:/.test(texto)) {
          ruins.push(`  · ${full} — decide o caminho por conta própria`);
        }
      }
    };
    varrer("scripts");

    expect(comLaunch, "nenhum script sobe navegador — a varredura conferiu nada")
      .toBeGreaterThanOrEqual(3);
    expect(
      ruins,
      `\n${ruins.join("\n")}\n\n` +
        "O caminho do Chromium mora em `scripts/lib/chromium.mjs`, que só o passa\n" +
        "quando o arquivo existe. Três cópias de uma regra garantem que uma divirja\n" +
        "— e foi assim que dois dos três scripts ficaram sem a correção que o\n" +
        "terceiro já tinha, com o motivo escrito no comentário dele.",
    ).toEqual([]);
  });
});
