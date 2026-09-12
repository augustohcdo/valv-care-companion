#!/usr/bin/env node
/**
 * Abre CADA rota do app num navegador de verdade e falha nas que não renderizam.
 *
 * ## O buraco que isto fecha
 *
 * O `npm run smoke` confere que cada rota devolve o **shell** do app — e é
 * honesto sobre isso: nasceu para pegar o fallback de SPA que faltava no
 * `vercel.json`. Mas o shell é o mesmo `index.html` para as 61 rotas. Uma tela
 * que estoura ao montar devolve exatamente esse shell, com HTTP 200, e o smoke
 * passa.
 *
 * O resto da rede de segurança também não pega: os testes de unidade cobrem
 * funções e alguns componentes isolados, e o `ferramentas-verificar` dirige
 * DUAS rotas. As outras 59 nunca são abertas por nada automático. Quer dizer
 * que hoje dá para quebrar uma tela inteira com CI verde, smoke verde e 967
 * testes passando.
 *
 * Isso não é hipótese confortável: eu mexi hoje em nove telas, e a única prova
 * de que continuam abrindo seria alguém abrir uma por uma.
 *
 * ## O que conta como "renderizou"
 *
 * Quatro reprovações distintas, porque cada uma aponta para uma causa:
 *
 *   1. **exceção não tratada** — o React estourou;
 *   2. **o error boundary global apareceu** — estourou e foi capturado, o que é
 *      pior de detectar: a tela fica bonita, com um texto educado, e o HTTP
 *      continua 200;
 *   3. **`#root` vazio** — o app montou nada;
 *   4. **erro de rede num recurso nosso** — chunk que não carregou. O filtro
 *      deixa passar fonte do Google e Supabase, que não respondem neste
 *      ambiente e contaminariam tudo.
 *
 * ## Redirecionada NÃO é a mesma coisa que renderizada
 *
 * A primeira versão marcava ✓ em toda rota que não quebrasse — inclusive nas 40
 * e tantas de `/app/*`, que sem sessão param todas em `/auth/login`. Ela abria a
 * tela de login dezenas de vezes e relatava "61 de 61 renderizaram", e eu
 * cheguei a dizer ao usuário que aquilo provava que as telas que eu tinha
 * mexido no dia continuavam abrindo. Não provava: nenhuma delas chegou a montar.
 *
 * Um verificador construído para pegar "sucesso relatado sem o trabalho feito"
 * fazendo exatamente isso. O redirecionamento É o app funcionando — mas o que
 * renderizou foi o LOGIN, e o relatório tem de dizer qual das duas coisas
 * aconteceu.
 *
 * Agora são três estados, e o resumo traz os três: renderizou a rota pedida,
 * redirecionou (com o destino à vista), ou quebrou. Só o primeiro é prova sobre
 * aquela tela.
 *
 * ## O que NÃO deu certo: sessão sintética
 *
 * Tentei cobrir as rotas de `/app/` plantando uma sessão inventada no
 * `localStorage`. O redirecionamento parava, e o relatório passou a dizer
 * "60 de 61 renderizaram" — mas a inversão não reprovava: pus um `throw` no topo
 * de `MedicoHome`, conferi que a quebra estava no bundle SERVIDO, e a rota levou
 * ✓ assim mesmo.
 *
 * Medindo com a tela íntegra: `/app/medico` fica DEZ SEGUNDOS no spinner e nunca
 * mostra "Área médica". O cliente do Supabase não consegue resolver a sessão
 * inventada, `useAuth.loading` nunca vira falso, o `ProtectedRoute` segura o
 * spinner, e a tela protegida não chega a montar. As 39 "renderizadas" eram 39
 * spinners.
 *
 * O modo foi removido. Ele parava o redirecionamento sem entregar a tela — e um
 * verde que vem de não ter olhado é pior que um vermelho.
 *
 * ## O que dá certo: sessão DE VERDADE
 *
 * `ROTAS_SESSAO` recebe o JSON de uma sessão emitida pelo próprio servidor de
 * autenticação — token assinado por ele, renovável por ele. É a diferença que
 * fazia a tentativa anterior falhar: não é uma sessão parecida, é uma sessão.
 *
 * Ela é escrita no `localStorage` sob a chave que o `supabase-js` monta a partir
 * da URL do projeto (`sb-<ref>-auth-token`). Isso é uma suposição sobre a
 * biblioteca, e suposição merece conferência — por isso, antes de varrer coisa
 * alguma, este script ABRE uma rota protegida e exige não ter sido mandado para
 * o login. Se a chave estiver errada, se o token tiver expirado, se o tipo de
 * conta não bater: sai **2**, não conferido. Nunca 0.
 *
 * Sem essa prova, um formato de chave errado devolveria 39 redirecionamentos
 * silenciosos — e o relatório diria "0 quebraram", que é verdade e não é
 * resposta.
 *
 * O captcha do login NÃO é contornado: quem emite a sessão é a API de
 * administração, pelo `scripts/conta-de-verificacao.mjs`.
 *
 * ## A lista de rotas vem do `smoke.mjs`, não daqui
 *
 * Lista paralela envelhece em silêncio; já aconteceu neste projeto com a lista
 * de tabelas do backup, que cobria 22 de 37 e dizia estar completa. O
 * `smoke.mjs` deriva as rotas do `App.tsx` e agora exporta essa função.
 *
 * ## Códigos de saída
 *
 *   0 — nenhuma quebrou (as redirecionadas são listadas, não reprovadas: o
 *       redirecionamento é comportamento correto, só não é prova sobre a tela)
 *   1 — alguma quebrou, com o motivo e a rota
 *   2 — **não foi possível conferir**: sem Playwright, ou o servidor não
 *       respondeu. Distinto do 1 de propósito: "não olhei" não é "está certo",
 *       e é a mesma convenção do `conferir-migrations` e do
 *       `ferramentas-verificar`.
 *
 * Uso:
 *   npm run build && npx vite preview --port 4173 --host 127.0.0.1
 *   node scripts/rotas-renderizam.mjs http://127.0.0.1:4173
 *
 * Com sessão (as rotas de `/app/`):
 *   ROTAS_SESSAO="$(cat sessao.json)" \
 *   ROTAS_SUPABASE_URL=https://<ref>.supabase.co \
 *   node scripts/rotas-renderizam.mjs http://127.0.0.1:4173
 */
import { execSync } from "node:child_process";
import { rotasDoApp } from "./smoke.mjs";

async function carregarPlaywright() {
  for (const alvo of ["playwright", "@playwright/test"]) {
    try { return await import(alvo); } catch { /* tenta o próximo */ }
  }
  try {
    return await import(`${execSync("npm root -g", { encoding: "utf8" }).trim()}/playwright/index.mjs`);
  } catch { /* cai no erro abaixo */ }
  console.error("NÃO CONFERIDO: Playwright não encontrado. `npm i -g playwright`.");
  process.exit(2);
}

const { chromium } = await carregarPlaywright();
const BASE = (process.argv[2] || "http://127.0.0.1:4173").replace(/\/$/, "");


/** Texto do error boundary global, em `src/main.tsx`. */
const TEXTO_DO_BOUNDARY = "Não foi possível carregar o ValvePath";

/**
 * O que não conta como falha de recurso.
 *
 * A fonte do Google e o Supabase não respondem de dentro deste contêiner. Sem
 * este filtro, TODAS as rotas reprovariam por um motivo que não é do app — e um
 * verificador que reprova tudo é tão inútil quanto um que aprova tudo, com o
 * agravante de alguém desligá-lo.
 */
const RUIDO = /fonts\.(googleapis|gstatic)|favicon|manifest|supabase\.co|\/~flock/;

/**
 * Cancelamento não é falha.
 *
 * A aba é reaproveitada entre as rotas, e o app faz prefetch dos chunks que
 * provavelmente vêm a seguir. Navegar para a próxima rota CANCELA o prefetch em
 * voo, e o `requestfailed` chega depois do reset do coletor — contabilizado na
 * rota errada.
 *
 * Isto não é teoria: a varredura reprovou `/aprender/faq` por um
 * `net::ERR_ABORTED` em `Glossario-*.js`, que é o chunk de OUTRA rota. As
 * quatro rotas acusadas foram abertas uma a uma em aba limpa e renderizaram
 * sem exceção e sem recurso faltando.
 *
 * E filtrar isto não cega o verificador para um chunk que realmente sumiu.
 * Conferido apagando `Glossario-*.js` do `dist` e abrindo `/aprender/glossario`:
 * a rota continuou reprovando. Mas **não** pelo caminho que eu tinha suposto —
 * não houve `pageerror` nenhum. Arquivo ausente devolve 404, que é RESPOSTA e
 * não `requestfailed`; o import dinâmico falha dentro do React, e quem aparece
 * é o ERROR BOUNDARY global, que este script já procura pelo texto.
 *
 * Fica escrito qual dos quatro critérios pega este caso, e não o que parecia
 * pegar: a diferença entre os dois é a próxima pessoa mexer no critério errado.
 *
 * Falso vermelho importa tanto quanto falso verde: este mesmo arquivo já diz
 * que "guarda que pune quem fez certo é guarda que alguém desliga".
 */
const CANCELADO = /ERR_ABORTED/;

const PROXY = process.env["HTTPS_PROXY"] || process.env["https_proxy"];

/**
 * Onde está o Chromium.
 *
 * Este ambiente traz um pronto em `/opt/pw-browsers/chromium`; um executor de
 * CI tem o que o `playwright install` baixou, em outro lugar. Cravar o caminho
 * fazia o script funcionar aqui e falhar lá — com um erro de "executable
 * doesn't exist" que não diz nada sobre rota nenhuma.
 *
 * Então: usa o caminho só quando ele EXISTE, e no resto das vezes deixa o
 * Playwright achar o dele.
 */
const { existsSync } = await import("node:fs");
const CAMINHO = process.env["PW_CHROMIUM"] || "/opt/pw-browsers/chromium";
const navegador = await chromium.launch({
  ...(existsSync(CAMINHO) ? { executablePath: CAMINHO } : {}),
  ...(PROXY ? { proxy: { server: PROXY, bypass: "127.0.0.1,localhost" } } : {}),
});

// ---------------------------------------------------------------- sessão

/**
 * A sessão a plantar, e a chave sob a qual o `supabase-js` a procura.
 *
 * A chave é `sb-<primeiro rótulo do host>-auth-token`, montada pela própria
 * biblioteca a partir da URL do projeto. Está reproduzida aqui porque não é
 * exportada — e é justamente por ser uma suposição que existe a conferência
 * mais abaixo, em vez de um comentário dizendo "deve funcionar".
 */
const SESSAO_BRUTA = process.env["ROTAS_SESSAO"];
const URL_SUPABASE = process.env["ROTAS_SUPABASE_URL"];
let sessao = null;
let chaveDaSessao = null;

if (SESSAO_BRUTA) {
  if (!URL_SUPABASE) {
    console.error("NÃO CONFERIDO: veio ROTAS_SESSAO sem ROTAS_SUPABASE_URL — sem a URL não dá para montar a chave do localStorage.");
    await navegador.close();
    process.exit(2);
  }
  try {
    sessao = JSON.parse(SESSAO_BRUTA);
  } catch (e) {
    console.error(`NÃO CONFERIDO: ROTAS_SESSAO não é JSON válido (${String(e.message).slice(0, 80)}).`);
    await navegador.close();
    process.exit(2);
  }
  if (!sessao?.access_token || !sessao?.refresh_token) {
    console.error("NÃO CONFERIDO: a sessão veio sem access_token ou refresh_token.");
    await navegador.close();
    process.exit(2);
  }
  chaveDaSessao = `sb-${new URL(URL_SUPABASE).hostname.split(".")[0]}-auth-token`;
}

/** Planta a sessão antes de qualquer script da página rodar. */
async function prepararContexto(pagina) {
  if (!sessao) return;
  await pagina.addInitScript(
    ([chave, valor]) => {
      try { window.localStorage.setItem(chave, valor); } catch { /* sem storage */ }
    },
    [chaveDaSessao, JSON.stringify(sessao)],
  );
}

const rotas = rotasDoApp();
if (rotas.length === 0) {
  console.error("NÃO CONFERIDO: nenhuma rota saiu de src/App.tsx — o parser quebrou, não o site.");
  await navegador.close();
  process.exit(2);
}

const quebradas = [];
const redirecionadas = [];
const renderizadas = [];
let conferidas = 0;

// Uma aba só, reaproveitada. Abrir uma por rota custava caro o bastante para a
// varredura das 61 não terminar em tempo razoável — e o objetivo é que ela seja
// rodada, não que seja elegante. Os coletores são zerados a cada rota, que é o
// que o isolamento exigia de verdade.
const pagina = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
await prepararContexto(pagina);

/**
 * Espera o carregamento SAIR da tela (sem `.animate-spin`), com teto.
 *
 * Extraída para ser a mesma nos dois lugares que dela precisam — a prova de
 * sessão e a varredura. Duas cópias divergiriam, e a divergência aqui seria
 * invisível: uma das duas mediria spinner de novo.
 */
async function esperarATela(pagina, limiteMs = 8000) {
  const limite = Date.now() + limiteMs;
  for (;;) {
    const carregando = await pagina.evaluate(() => !!document.querySelector(".animate-spin"));
    const jaQuebrou = await pagina.evaluate(
      (marcador) => document.body.innerText.includes(marcador), TEXTO_DO_BOUNDARY,
    );
    if (!carregando || jaQuebrou) return carregando && !jaQuebrou;
    if (Date.now() > limite) return true;
    await pagina.waitForTimeout(250);
  }
}

/**
 * A sessão pegou? Isto roda ANTES da varredura e é o que separa este script da
 * versão que relatou "60 de 61 renderizaram" sem ter aberto tela nenhuma.
 *
 * A pergunta não é "o localStorage foi escrito" — isso sempre dá certo, mesmo
 * com a chave errada. É "o app reconheceu a sessão e deixou passar", e a única
 * resposta que vale é uma rota protegida que NÃO devolveu o login.
 */
if (sessao) {
  const prova = process.env["ROTAS_PROVA"] || "/app/medico";
  let falha = null;
  try {
    await pagina.goto(BASE + prova, { waitUntil: "domcontentloaded", timeout: 20000 });
    const presoNoSpinner = await esperarATela(pagina, 15000);
    const parouEm = await pagina.evaluate(() => location.pathname);
    if (presoNoSpinner) {
      falha = `${prova} ficou 15s no spinner — o cliente não resolveu a sessão`;
    } else if (parouEm !== prova) {
      falha = `${prova} foi redirecionada para ${parouEm}`;
    }
  } catch (e) {
    falha = `${prova} não abriu: ${String(e?.message ?? e).split("\n")[0].slice(0, 120)}`;
  }

  if (falha) {
    console.error(
      `\nNÃO CONFERIDO — a sessão não foi aceita pelo app.\n` +
      `  ${falha}\n\n` +
      "Causas possíveis, em ordem de probabilidade:\n" +
      `  · a chave do localStorage mudou de formato (esperada: ${chaveDaSessao});\n` +
      "  · o access_token já expirou (a sessão dura pouco — cunhe e use na hora);\n" +
      `  · o tipo da conta não bate com a rota de prova (${prova}).\n\n` +
      "Sem sessão aceita, varrer as rotas de /app/ só produziria 39\n" +
      "redirecionamentos e um '0 quebraram' que não afirma nada sobre as telas.\n",
    );
    await navegador.close();
    process.exit(2);
  }
  console.log(`Sessão aceita: ${prova} abriu sem redirecionar.\n`);
}

let excecoes = [];
let recursos = [];
pagina.on("pageerror", (e) => excecoes.push(String(e).split("\n")[0]));
pagina.on("requestfailed", (r) => {
  const erro = r.failure()?.errorText ?? "";
  if (RUIDO.test(r.url()) || CANCELADO.test(erro)) return;
  recursos.push(`${erro} ${r.url()}`);
});

for (const rota of rotas) {
  excecoes = [];
  recursos = [];

  // Distinção que a primeira versão deste script errava: ela abortava a
  // varredura INTEIRA com código 2 na primeira rota que não abrisse. Uma rota
  // lenta apagava o resultado das outras sessenta, e o relatório dizia "não
  // conferi" quando sessenta tinham sido conferidas.
  //
  // Agora só o PRIMEIRO caso vale como "não conferi", e por um motivo real: se
  // nem a rota inicial abre, o servidor não está de pé e as sessenta seguintes
  // reprovariam por isso. Depois disso, rota que não abre é falha DELA.
  let naoAbriu = null;
  try {
    await pagina.goto(BASE + rota, { waitUntil: "domcontentloaded", timeout: 15000 });
  } catch (e) {
    naoAbriu = String(e?.message ?? e).split("\n")[0];
    if (conferidas === 0) {
      console.error(
        `\nNÃO CONFERIDO — nem a primeira rota (${rota}) abriu.\n` +
        `  ${naoAbriu}\n\n` +
        "O servidor não está de pé. Suba o preview antes:\n" +
        "  npm run build && npx vite preview --port 4173 --host 127.0.0.1\n",
      );
      await navegador.close();
      process.exit(2);
    }
  }

  // ESPERAR A TELA, E NÃO O SPINNER.
  //
  // A versão anterior esperava 500 ms fixos e olhava. As telas de `/app/` são
  // carregadas em chunk separado (`MedicoHome-*.js` e companhia), então em 500 ms
  // o que estava na página era o fallback de Suspense — um spinner. `#root`
  // tinha conteúdo, não havia error boundary, e a rota levava ✓.
  //
  // Descobri isso porque a inversão não reprovou: pus um `throw` no topo de
  // `MedicoHome`, conferi que a quebra estava no bundle servido, e o
  // verificador aprovou a rota assim mesmo. Ele estava medindo spinner.
  //
  // Agora espera o carregamento SAIR: sem elemento `.animate-spin` na página, ou
  // até 8 s. O spinner é a marca visual do projeto para "carregando" — tanto o
  // fallback de rota quanto o das telas usam a mesma classe.
  let conteudoDoRoot = 0;
  let temBoundary = false;
  let aindaCarregando = false;
  if (!naoAbriu) {
    aindaCarregando = await esperarATela(pagina);
    conteudoDoRoot = await pagina.evaluate(
      () => document.getElementById("root")?.innerText?.trim().length ?? 0,
    );
    temBoundary = await pagina.evaluate(
      (marcador) => document.body.innerText.includes(marcador),
      TEXTO_DO_BOUNDARY,
    );
  }

  // Onde a navegação PAROU. Sem isto, `/app/medico` que caiu no login recebia o
  // mesmo ✓ de `/termos`, que renderizou de verdade.
  const parouEm = naoAbriu
    ? null
    : (await pagina.evaluate(() => location.pathname)) || rota;
  const redirecionou = parouEm !== null && parouEm !== rota;

  const motivos = [];
  if (naoAbriu) motivos.push(`a rota não abriu em 15s: ${naoAbriu.slice(0, 100)}`);
  if (excecoes.length) motivos.push(`exceção: ${excecoes[0].slice(0, 120)}`);
  if (!naoAbriu && temBoundary) motivos.push("o error boundary global apareceu");
  if (!naoAbriu && conteudoDoRoot === 0) motivos.push("#root vazio — o app não montou nada");
  // Oito segundos no spinner não é a tela: é o carregamento que não terminou.
  // Contar isso como renderizada seria repetir o defeito que este bloco corrige.
  if (aindaCarregando) motivos.push("ainda carregando depois de 8s — a tela não chegou a aparecer");
  if (recursos.length) motivos.push(`recurso não carregou: ${recursos[0].slice(0, 120)}`);

  conferidas++;
  if (motivos.length) {
    quebradas.push({ rota, motivos });
    console.log(`✗ ${rota}`);
    for (const m of motivos) console.log(`    ${m}`);
  } else if (redirecionou) {
    redirecionadas.push({ rota, parouEm });
    console.log(`→ ${rota}  (redirecionou para ${parouEm} — esta tela NÃO foi aberta)`);
  } else {
    renderizadas.push(rota);
    console.log(`✓ ${rota}`);
  }

}

await pagina.close();
await navegador.close();

console.log(
  `\n${renderizadas.length} de ${conferidas} rotas renderizaram a tela pedida — ${BASE}\n` +
  `${redirecionadas.length} redirecionaram (a tela pedida NÃO foi aberta)\n` +
  `${quebradas.length} quebraram`,
);

if (redirecionadas.length) {
  console.log(
    "\nREDIRECIONADAS — o app funcionou, mas quem renderizou foi outra tela.\n" +
    (sessao
      // Com sessão, o redirecionamento deixa de ser "não tenho login" e passa a
      // ter dois significados bem diferentes, e o relatório não sabe qual é: o
      // `ProtectedRoute` manda o médico para fora de `/app/paciente/*` de
      // propósito, e manda qualquer um para fora de `/app/admin/*` sem o papel.
      // Ambos corretos. Mas uma rota que redireciona sem motivo desses é bug —
      // por isso a lista vem inteira, para ser LIDA, e não resumida a um número.
      ? "Com sessão ativa, redirecionar é esperado para as rotas do outro tipo de\n" +
        "conta e para as de administração. Qualquer outra aqui merece olhada:\n"
      : "Sem sessão, tudo sob /app/ para no login. Estas rotas continuam SEM prova\n" +
        "de que suas telas montam:\n"),
  );
  for (const r of redirecionadas) console.log(`  · ${r.rota} → ${r.parouEm}`);
}

if (quebradas.length) {
  console.error("\nQUEBRARAM:");
  for (const q of quebradas) console.error(`  · ${q.rota} — ${q.motivos.join("; ")}`);
  console.error(
    "\nHTTP 200 e shell servido não provam que a tela abre. É esta diferença que\n" +
    "este script existe para medir.",
  );
  process.exit(1);
}
