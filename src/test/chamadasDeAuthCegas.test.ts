/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  encontrarAuthCegas,
  clientesCriadosNoArquivo,
  walk,
} from "./detectorDeChamadasCegas";

/**
 * Roda o detector sobre um arquivo sintético, numa pasta descartável.
 *
 * As fixtures ficam em arquivo, e não em string passada ao detector, porque é
 * assim que ele é usado de verdade: varrendo disco. Uma contraprova que não
 * passa pelo `walk` não prova que o `walk` continua achando alguma coisa.
 */
function varrerFixture(linhas: string[]): string[] {
  const dir = mkdtempSync(join(tmpdir(), "authcegas-"));
  try {
    writeFileSync(join(dir, "index.ts"), linhas.join("\n"));
    return encontrarAuthCegas({ raiz: dir, nomesDoCliente: clientesCriadosNoArquivo });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const CLIENTE = [
  'import { createClient } from "npm:@supabase/supabase-js@2.45.0";',
  "const admin = createClient(URL, SERVICE);",
];

/**
 * As chamadas à API de `auth` que descartam o erro — a terceira família.
 *
 * ## Por que ela existia inteira, sem ninguém ter sido desleixado
 *
 * Duas varreduras já cobravam isto nas edge functions: `leiturasCegasNas
 * Functions` e `escritasCegasNasFunctions`. As duas selecionam o statement por
 * `.select(`, `.rpc(`, `.insert(`, `.update(`, `.upsert(` ou `.delete(` — o que
 * passa pelo PostgREST.
 *
 * A API de `auth` não passa por ali. `createUser`, `updateUserById`,
 * `generateLink`, `listUsers`, `signOut` e `getUser` falam com o GoTrue por
 * outro caminho, e **nenhuma das duas varreduras podia vê-las, nem em
 * princípio**. Não foi esquecimento de quem escreveu: foi o recorte do
 * detector. Quando esta terceira rodou pela primeira vez: **10 chamadas cegas**
 * nas edge functions, 0 em `src`.
 *
 * ## A que justificava a varredura inteira
 *
 * `account-close` — encerramento de conta, LGPD art. 18, VI — fazia:
 *
 *     await admin.auth.admin.signOut(token, "global").catch(() => {});
 *
 * e seguia para `return json({ ok: true })`. Duas coisas erradas na mesma
 * linha, e a segunda é pior que a primeira:
 *
 * 1. **o erro era descartado duas vezes.** O `.catch` era o único catch vazio
 *    do repositório — e nem pegava o caso que importa, porque `signOut`
 *    devolve `{ error }` em vez de lançar. O erro morria antes, no `await` sem
 *    destino;
 *
 * 2. **derrubava a sessão da pessoa errada.** `signOut(jwt, …)` manda
 *    `POST /logout` com aquele jwt no `Authorization` — conferido no fonte do
 *    `auth-js`. Quem cai é o dono do token, e `token` ali é o de QUEM CHAMOU.
 *    O `AdminDPO` monta o `EncerrarContaDialog` passando `user_id`, então no
 *    caminho formal do art. 18 a linha derrubava as sessões **do
 *    administrador** e deixava as do titular vivas. O comentário logo acima
 *    dela dizia: "sem isto a sessão viva continuaria valendo até expirar, e
 *    'encerrada' seria só uma palavra".
 *
 * ## A regra aqui é mais dura, e a diferença é de propósito
 *
 * `encontrarCegas` absolve quem descarta o resultado — `if (!alvo) continue`,
 * comentado como "fire-and-forget". Para uma leitura isso se defende: quem
 * joga o resultado fora não vai agir sobre ele.
 *
 * Para `auth` não se defende, e o caso acima é a prova: **o resultado
 * descartado ERA o defeito**. Aqui, descartar conta como cegueira.
 */

const FUNCTIONS = "supabase/functions";
const SRC = "src";

/**
 * Em `src` ninguém chama `createClient`: todos importam o singleton de
 * `@/integrations/supabase/client`, sempre com o nome `supabase`. É o mesmo
 * seletor que o `readErrors.test.ts` usa, e por não tê-lo usado aqui eu
 * commitei uma varredura de `src` que conferia nada.
 */
const CLIENTES_DE_SRC = () => ["supabase"];

describe("chamadas à API de auth que descartam o erro", () => {
  it("nas edge functions: zero", () => {
    const cegas = encontrarAuthCegas({
      raiz: FUNCTIONS,
      nomesDoCliente: clientesCriadosNoArquivo,
    });
    expect(
      cegas,
      `\n${cegas.map((c) => `  · ${c}`).join("\n")}\n\n` +
        "Uma chamada de `auth` cujo `error` ninguém olha decide errado em silêncio:\n" +
        "  · `getUser` falhando vira 401, e quem investiga procura um problema de\n" +
        "    permissão que não existe;\n" +
        "  · `signOut` falhando deixa a sessão de pé embaixo de um `ok: true`;\n" +
        "  · `listUsers` falhando vira \"a conta não existe\".\n\n" +
        "Descartar o resultado inteiro conta como cegueira — foi assim que o\n" +
        "`account-close` derrubava a sessão da pessoa errada sem ninguém saber.",
    ).toEqual([]);
  });

  it("em src: zero", () => {
    // `clientesCriadosNoArquivo` procura `createClient` — e em `src` NINGUÉM
    // cria cliente: todos importam o singleton de
    // `@/integrations/supabase/client`. Passando aquele seletor aqui, a
    // varredura não achava cliente em arquivo nenhum, pulava tudo e devolvia
    // zero. Foi o que eu commitei da primeira vez: um "zero" que era "não
    // olhei", do mesmo formato que esta sessão inteira persegue, dentro da
    // guarda contra ele.
    //
    // `readErrors.test.ts` já fazia certo: `() => ["supabase"]`. Com o seletor
    // correto, a mesma varredura acusou NOVE chamadas cegas em `src`.
    const cegas = encontrarAuthCegas({ raiz: SRC, nomesDoCliente: CLIENTES_DE_SRC });
    expect(cegas, `\n${cegas.map((c) => `  · ${c}`).join("\n")}`).toEqual([]);
  });

  it("a varredura de src de fato alcança os arquivos", () => {
    // O sanity check que faltava da primeira vez, e que teria pego o engano na
    // hora: se o seletor não casar, isto acusa em vez de dar zero satisfeito.
    const comCliente = walk(SRC)
      .filter((f) => !/\.test\.tsx?$/.test(f))
      .filter((f) => /\bsupabase\s*\.\s*auth\b/.test(readFileSync(f, "utf8")));
    expect(
      comCliente.length,
      "nenhum arquivo de src fala com `supabase.auth` — a varredura acima conferiu nada",
    ).toBeGreaterThanOrEqual(5);
  });

  /**
   * As contraprovas. Sem elas, um detector que parou de casar com qualquer
   * coisa passaria as duas asserções acima com louvor — que é a forma mais
   * fácil de uma varredura virar enfeite.
   */

  it("acusa o resultado descartado — o caso do account-close", () => {
    const cegas = varrerFixture([
      ...CLIENTE,
      'await admin.auth.admin.signOut(token, "global").catch(() => {});',
      "return json({ ok: true });",
    ]);
    expect(cegas.length, "não viu o `signOut` descartado").toBe(1);
    expect(cegas[0], "apontou a linha errada").toMatch(/:3$/);
  });

  it("acusa o `{ data }` sem `error`", () => {
    const cegas = varrerFixture([
      ...CLIENTE,
      "const { data: userData } = await admin.auth.getUser(token);",
      'if (!userData?.user) return json({ error: "unauthorized" }, 401);',
    ]);
    expect(cegas.length, "não viu o `error` faltando na desestruturação").toBe(1);
  });

  it("aprova quem observa o `error` — não pune quem fez certo", () => {
    const cegas = varrerFixture([
      ...CLIENTE,
      "const { data: userData, error: erroSessao } = await admin.auth.getUser(token);",
      'if (erroSessao) return json({ error: "auth_check_failed" }, 503);',
      "const r = await admin.auth.admin.signOut(token);",
      "if (r.error) console.error(r.error.message);",
    ]);
    expect(cegas, "reprovou as duas formas corretas de observar o erro").toEqual([]);
  });

  it("não confunde menção em comentário com chamada", () => {
    const cegas = varrerFixture([
      ...CLIENTE,
      '// era `await admin.auth.admin.signOut(token, "global")` sem olhar nada',
      "const { error } = await admin.auth.admin.signOut(token);",
      "if (error) console.error(error.message);",
    ]);
    expect(cegas, "acusou a menção dentro do comentário").toEqual([]);
  });

  it("a varredura de fato alcança as edge functions", () => {
    // O sanity check é sobre o DETECTOR, não sobre o resultado: se o seletor
    // de clientes parar de casar, as duas asserções de cima passam com zero
    // porque nada foi olhado — e ninguém percebe.
    //
    // O piso são 10 arquivos com cliente declarado. São 20 functions hoje;
    // dez é folga suficiente para apagar algumas sem falso vermelho, e ainda
    // pega o caso que importa, que é o detector cair para zero.
    const comCliente = walk(FUNCTIONS)
      .filter((f) => !/\/node_modules\//.test(f.replace(/\\/g, "/")))
      .filter((f) => clientesCriadosNoArquivo(readFileSync(f, "utf8")).length > 0);

    expect(
      comCliente.length,
      "o seletor de clientes parou de casar — a varredura acima conferiu nada",
    ).toBeGreaterThanOrEqual(10);
  });
});
