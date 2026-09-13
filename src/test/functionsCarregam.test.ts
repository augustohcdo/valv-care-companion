// Este teste lê o disco; tsconfig.app.json restringe `types`, daí a referência.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

/**
 * A guarda que carrega as edge functions — e por que ela não pode sumir.
 *
 * ## O que aconteceu
 *
 * A `turnstile-config` importava `npm:@supabase/supabase-js@2/cors`. O
 * `deno.lock` destas functions trava `npm:@supabase/supabase-js@2` em
 * **2.45.0**, e o `package.json` da 2.45.0 não tem mapa `exports` — logo, não
 * tem `./cors`. Em produção:
 *
 *     {"code":"BOOT_ERROR","message":"Function failed to start"}   HTTP 503
 *
 * O `TurnstileWidget` chama essa função para pegar a site key, não consegue,
 * escreve "Não foi possível carregar a verificação de segurança", e o botão
 * Entrar fica desabilitado — `disabled={submitting || lockMs > 0 ||
 * !captchaToken}`. Ninguém entrava com e-mail e senha. Por dias.
 *
 * E a CI verde o tempo todo: `deno check` sai 0 sobre o arquivo quebrado
 * (conferido). Para especificador `npm:`, checar tipo não é resolver módulo.
 *
 * ## O que este teste cobra, e por quê
 *
 * O conserto do arquivo não impede o próximo import quebrado. A guarda que
 * impede é o `scripts/functions-carregam.ts`, que IMPORTA cada function. Um
 * passo de YAML some sem barulho nenhum numa refatoração, e o sintoma de ele
 * ter sumido não aparece em teste nem em log: aparece no login de todo mundo.
 *
 * A exigência do `--lock` tem história própria. Na primeira execução da guarda,
 * com o defeito de volta no lugar, ela disse **18 de 18 carregam** — porque
 * rodando da raiz do repositório o Deno resolvia `@2` livre e pegava a 2.112.4,
 * que TEM `/cors`. Guarda que resolve um grafo de módulos diferente do que o
 * deploy usa é decoração. É por isso que os flags são cobrados aqui e não
 * deixados à memória de quem editar o workflow.
 */

const SCRIPT = "scripts/functions-carregam.ts";
const CI = ".github/workflows/ci.yml";
const DEPLOY = ".github/workflows/deploy-functions.yml";
const RAIZ_FUNCTIONS = "supabase/functions";

const ler = (caminho: string) => (existsSync(caminho) ? readFileSync(caminho, "utf8") : "");

describe("a guarda que carrega as edge functions", () => {
  it("o script existe", () => {
    expect(
      existsSync(SCRIPT),
      "sem ele, a única checagem das functions volta a ser `deno check` — que ficou\n" +
        "verde sobre a função que derrubou o login",
    ).toBe(true);
  });

  const script = ler(SCRIPT);
  const pkg = JSON.parse(ler("package.json") || "{}");
  const comando: string = pkg.scripts?.["functions:carregam"] ?? "";

  it("`npm run functions:carregam` existe e chama o script", () => {
    expect(comando, "o atalho que a CI e o deploy usam").toContain(SCRIPT);
  });

  it("o comando roda sob o config E o lock das functions", () => {
    // Os dois, e não um. Sem o lock, `npm:@supabase/supabase-js@2` resolve para
    // a mais nova publicada — outra árvore de módulos, outro resultado, e um
    // verde que não vale nada. Foi assim que a primeira inversão desta guarda
    // FALHOU: ela disse 18 de 18 com o import quebrado no lugar.
    expect(comando, "falta --config supabase/functions/deno.json").toContain(
      "--config supabase/functions/deno.json",
    );
    expect(comando, "falta --lock supabase/functions/deno.lock").toContain(
      "--lock supabase/functions/deno.lock",
    );
  });

  it("o lock existe — é ele que define a versão que o deploy carrega", () => {
    expect(existsSync(`${RAIZ_FUNCTIONS}/deno.lock`)).toBe(true);
    expect(existsSync(`${RAIZ_FUNCTIONS}/deno.json`)).toBe(true);
  });

  it("o script se RECUSA a rodar fora da resolução travada, com saída 2", () => {
    // A recusa é o que transforma "rodei e deu verde" em "rodei do jeito certo
    // e deu verde". Sem ela a guarda é silenciosamente desarmada por quem rodar
    // `deno run scripts/functions-carregam.ts` direto — que é o jeito óbvio.
    //
    // Este teste EXECUTA o script sem os flags, em vez de procurar as palavras
    // dentro dele. A primeira versão fazia o contrário — exigia que os textos
    // `import.meta.resolve` e `Deno.exit(2)` aparecessem no arquivo — e a
    // inversão mostrou o buraco na hora: comentar a CHAMADA
    // `await exigirResolucaoTravada();` deixava a definição inteira no arquivo,
    // as duas palavras no lugar, e o teste passando com a recusa desligada.
    // Guarda tem de cobrar a garantia, não o vocabulário.
    //
    // Roda offline e em milissegundos: o caminho da recusa lê o lock e chama
    // `import.meta.resolve`, e sai antes de importar function nenhuma.
    // `--no-lock` porque, sem ele, rodar o Deno a partir da raiz faz ele
    // gravar no `deno.lock` da raiz — um teste que suja a árvore de trabalho.
    // Não muda o que está sendo conferido: a recusa lê o lock DAS FUNCTIONS
    // pelo caminho, e o que ela compara é a resolução, que aqui segue livre.
    const r = spawnSync("deno", ["run", "--allow-all", "--no-lock", SCRIPT], {
      encoding: "utf8",
      timeout: 60_000,
    });

    expect(
      r.error === undefined,
      "não consegui executar `deno` — ele é dependência declarada deste repositório\n" +
        "(`npm run typecheck:functions` também precisa dele) e a CI o instala.\n" +
        "Instale em https://deno.land — pular este teste seria desligar a guarda\n" +
        "que existe justamente para a guarda não ficar desligada.",
    ).toBe(true);

    expect(
      r.status,
      "rodando sem --config/--lock o script TEM de sair 2 (NÃO CONFERIDO).\n" +
        `Saiu ${r.status}.\n\n` +
        "Saída 0 aqui significa que ele resolveu outra árvore de módulos e disse\n" +
        "que está tudo bem — foi exatamente assim que a primeira execução desta\n" +
        "guarda deu 18 de 18 com o import quebrado no lugar.\n\n" +
        (r.stderr ?? "").slice(0, 400),
    ).toBe(2);
  });

  it("o script realmente IMPORTA as functions — não as tipa", () => {
    expect(
      script,
      "o ponto inteiro é resolver o grafo de módulos, coisa que `deno check` não faz",
    ).toMatch(/await import\(/);
  });

  for (const [nome, caminho] of [["CI", CI], ["deploy", DEPLOY]] as const) {
    it(`o workflow de ${nome} roda a guarda`, () => {
      const yml = ler(caminho);
      expect(yml, `${caminho} não existe`).not.toBe("");
      expect(
        yml,
        `${caminho} não roda \`npm run functions:carregam\`.\n\n` +
          "Sem este passo, uma function pode ir para o ar sem carregar — que é o\n" +
          "estado em que a `turnstile-config` ficou, com o login fechado para todo\n" +
          "mundo e a CI verde.",
      ).toContain("npm run functions:carregam");
    });
  }

  it("a guarda da CI vem junto do `deno check`, não no lugar dele", () => {
    // Os dois pegam coisas diferentes: o check pega erro de tipo, o carregamento
    // pega import que não resolve. Trocar um pelo outro perde metade.
    const yml = ler(CI);
    expect(yml).toContain("npm run typecheck:functions");
    expect(yml).toContain("npm run functions:carregam");
  });

  it("a função do captcha não depende de import externo nenhum", () => {
    // Ela é a porta de entrada do site: se ela não sobe, ninguém entra. Toda
    // dependência externa dela é uma forma nova de o login inteiro cair, e o
    // que ela faz — devolver uma string de ambiente — não precisa de nenhuma.
    const fn = ler(`${RAIZ_FUNCTIONS}/turnstile-config/index.ts`);
    expect(fn, "turnstile-config/index.ts não existe").not.toBe("");
    const imports = fn
      .split("\n")
      .filter((l) => /^\s*import\s/.test(l) && !/^\s*\/\//.test(l));
    expect(
      imports,
      "o login inteiro depende desta função subir; ela não deve importar nada",
    ).toEqual([]);
  });

  it("toda pasta de function tem index.ts — senão a guarda não a confere", () => {
    // O runtime entra pelo index.ts. Uma pasta sem ele seria pulada em silêncio
    // pela varredura, e "18 de 18 carregam" passaria a esconder uma função que
    // ninguém olhou. O script sai 2 nesse caso; aqui o caso é evitado.
    const semEntrada = readdirSync(RAIZ_FUNCTIONS)
      .filter((nome) => {
        if (nome.startsWith("_") || nome === "node_modules") return false;
        try {
          return statSync(`${RAIZ_FUNCTIONS}/${nome}`).isDirectory();
        } catch {
          return false;
        }
      })
      .filter((nome) => !existsSync(`${RAIZ_FUNCTIONS}/${nome}/index.ts`));

    expect(semEntrada, `pasta(s) de function sem index.ts: ${semEntrada.join(", ")}`).toEqual([]);
  });
});
