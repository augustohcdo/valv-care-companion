#!/usr/bin/env -S deno run --allow-all
/**
 * Cada edge function CARREGA? Não "tipa" — carrega.
 *
 * ## O buraco que isto fecha, e o preço que ele cobrou
 *
 * A CI roda `deno check` sobre o `index.ts` de cada function e ficava verde. A
 * `turnstile-config` importava `npm:@supabase/supabase-js@2/cors` — subcaminho
 * que não existe na versão travada — e em produção respondia:
 *
 *     {"code":"BOOT_ERROR","message":"Function failed to start"}   HTTP 503
 *
 * O efeito era total e silencioso: o `TurnstileWidget` chama essa função para
 * pegar a site key, não consegue, mostra "Não foi possível carregar a
 * verificação de segurança" — e o botão Entrar fica DESABILITADO, porque
 * depende de `captchaToken`. Ninguém entrava com e-mail e senha.
 *
 * ## Por que `deno check` não pega
 *
 * Conferido sobre o arquivo quebrado: `deno check turnstile-config/index.ts`
 * sai 0. Para especificador `npm:`, checar tipo não é resolver módulo — o tipo
 * vira `any` e a checagem segue. Só o carregamento de verdade cobra a
 * resolução.
 *
 * ## A parte que quase me enganou: esta guarda também dá falso verde
 *
 * Na primeira execução, com o defeito de volta no lugar, este script disse
 * **18 de 18 carregam**. A inversão falhou, e o motivo é a lição:
 *
 *   · rodando a partir da raiz do repositório, o Deno não acha o
 *     `supabase/functions/deno.json` nem o `deno.lock`, e resolve
 *     `npm:@supabase/supabase-js@2` livre, pegando a 2.112.4 — que TEM `/cors`;
 *   · o `deno.lock` das functions trava esse mesmo especificador em **2.45.0**,
 *     cujo `package.json` não tem mapa `exports` — e portanto não tem `/cors`.
 *
 * Ou seja: o import quebrado passava, porque a guarda estava resolvendo um
 * grafo de módulos DIFERENTE do que o deploy usa. Guarda que roda fora da
 * resolução real é decoração.
 *
 * Por isso o script se recusa a rodar sem o config e o lock das functions — e
 * essa recusa é 2 (NÃO CONFERIDO), não 0. Ver `exigirResolucaoTravada()`.
 *
 * ## Por que o `Deno.serve` é neutralizado
 *
 * Importar o módulo executa o topo dele, e todo arquivo aqui termina em
 * `Deno.serve(handler)` — o que subiria dezoito servidores disputando porta.
 * Trocar `Deno.serve` por uma função que não faz nada deixa o import ser o que
 * ele precisa ser: a prova de que o grafo de módulos resolve.
 *
 * Isto NÃO executa o handler nem chama o banco. É carregamento, não teste de
 * comportamento — e está escrito assim para ninguém ler "18/18 carregam" como
 * se as funções estivessem testadas.
 *
 * ## Saídas
 *
 *   0 — todas carregam
 *   1 — alguma não carrega, com o erro e o nome
 *   2 — NÃO CONFERIDO: não achei as functions, achei pasta de function sem
 *       `index.ts`, ou a resolução não está travada pelo lock. Distinto do 1 de
 *       propósito, como no resto dos scripts deste projeto.
 *
 * Uso (os flags NÃO são opcionais — ver acima):
 *
 *   deno run --allow-all \
 *     --config supabase/functions/deno.json \
 *     --lock supabase/functions/deno.lock \
 *     scripts/functions-carregam.ts
 *
 * ou, mais curto, `npm run functions:carregam`.
 */

const RAIZ = "supabase/functions";
const LOCK = `${RAIZ}/deno.lock`;

/**
 * Recusa rodar fora da resolução que o deploy usa.
 *
 * `import.meta.resolve` é o discriminador exato, conferido nos dois sentidos:
 *
 *   · sem o config/lock das functions, devolve o especificador cru
 *     (`npm:@supabase/supabase-js@2`) — nada foi resolvido;
 *   · com eles, devolve um `file://` dentro de `node_modules/.deno` carregando
 *     a versão do lock (`@supabase+supabase-js@2.45.0`).
 *
 * Comparar contra o que o lock diz — e não contra uma versão escrita aqui —
 * mantém a guarda válida quando o lock for atualizado.
 */
async function exigirResolucaoTravada(): Promise<void> {
  let travadas: Record<string, string>;
  try {
    const lock = JSON.parse(await Deno.readTextFile(LOCK));
    travadas = lock.specifiers ?? {};
  } catch (e) {
    console.error(
      `NÃO CONFERIDO: não consegui ler ${LOCK} — ${String(e)}\n` +
        "Sem o lock não dá para saber que versão o deploy resolve, e carregar\n" +
        "outra versão não prova nada sobre produção.",
    );
    Deno.exit(2);
  }

  const especificador = Object.keys(travadas).find((k) => k.startsWith("npm:"));
  if (!especificador) {
    console.error(
      `NÃO CONFERIDO: ${LOCK} não lista nenhum especificador npm:.\n` +
        "Sem um para conferir, não consigo provar que a resolução está travada.",
    );
    Deno.exit(2);
  }

  const versao = travadas[especificador];
  const resolvido = import.meta.resolve(especificador);
  if (!resolvido.startsWith("file:") || !resolvido.includes(versao)) {
    console.error(
      "NÃO CONFERIDO: a resolução de módulos aqui NÃO é a que o deploy usa.\n\n" +
        `  ${especificador}\n` +
        `    lock diz .......... ${versao}\n` +
        `    aqui resolveu para  ${resolvido}\n\n` +
        "Rodando assim, um import quebrado pode carregar de uma versão mais nova\n" +
        "do pacote e a guarda dá verde — foi exatamente o que aconteceu com a\n" +
        "`turnstile-config`. Rode com:\n\n" +
        "  deno run --allow-all --config supabase/functions/deno.json \\\n" +
        "    --lock supabase/functions/deno.lock scripts/functions-carregam.ts\n\n" +
        "ou `npm run functions:carregam`.",
    );
    Deno.exit(2);
  }
}

await exigirResolucaoTravada();

// `Deno.serve` vira um no-op ANTES de qualquer import. Sem isto o primeiro
// módulo sobe um servidor e o processo nunca termina.
(Deno as unknown as { serve: () => unknown }).serve = () => ({
  finished: Promise.resolve(),
  shutdown: () => Promise.resolve(),
  ref: () => {},
  unref: () => {},
});

let alvos: string[] = [];
const semEntrada: string[] = [];
try {
  for await (const entrada of Deno.readDir(RAIZ)) {
    if (!entrada.isDirectory || entrada.name.startsWith("_") || entrada.name === "node_modules") {
      continue;
    }
    const arquivo = `${RAIZ}/${entrada.name}/index.ts`;
    try {
      const info = await Deno.stat(arquivo);
      if (info.isFile) alvos.push(arquivo);
      else semEntrada.push(entrada.name);
    } catch {
      semEntrada.push(entrada.name);
    }
  }
} catch (e) {
  console.error(`NÃO CONFERIDO: não consegui listar ${RAIZ} — ${String(e)}`);
  Deno.exit(2);
}

alvos = alvos.sort();
if (alvos.length === 0) {
  console.error(
    `NÃO CONFERIDO: nenhuma function encontrada em ${RAIZ}.\n` +
      "Rode a partir da raiz do repositório.",
  );
  Deno.exit(2);
}

// Pasta de function sem `index.ts` não é "não é function": é function que esta
// guarda não conferiu. Pular calado seria a própria falha que o script existe
// para achar — relatar sucesso sobre o que não se olhou.
if (semEntrada.length) {
  console.error(
    `NÃO CONFERIDO: pasta(s) em ${RAIZ} sem index.ts — ${semEntrada.join(", ")}.\n` +
      "O runtime das edge functions entra pelo index.ts; sem ele não sei o que\n" +
      "carregar, e não vou dizer que está tudo certo sobre o que não olhei.",
  );
  Deno.exit(2);
}

const quebradas: { arquivo: string; erro: string }[] = [];

for (const arquivo of alvos) {
  try {
    await import(`${Deno.cwd()}/${arquivo}`);
    console.log(`✓ ${arquivo}`);
  } catch (e) {
    const erro = String((e as Error)?.message ?? e).split("\n")[0];
    quebradas.push({ arquivo, erro });
    console.log(`✗ ${arquivo}`);
    console.log(`    ${erro.slice(0, 200)}`);
  }
}

console.log(`\n${alvos.length - quebradas.length} de ${alvos.length} edge functions carregam.`);

if (quebradas.length) {
  console.error("\nNÃO CARREGAM — em produção isto é BOOT_ERROR e HTTP 503:");
  for (const q of quebradas) console.error(`  · ${q.arquivo} — ${q.erro.slice(0, 200)}`);
  console.error(
    "\n`deno check` fica verde sobre isto: para especificador `npm:`, checar tipo\n" +
      "não é resolver módulo. Foi assim que a `turnstile-config` derrubou o login\n" +
      "inteiro com a CI verde.",
  );
  Deno.exit(1);
}
