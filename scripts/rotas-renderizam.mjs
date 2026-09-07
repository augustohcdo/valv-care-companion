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
 * Cobrir as 39 exige sessão de verdade: um usuário no banco e um login pelo
 * fluxo normal. Fica anotado como o que falta, e não disfarçado de feito.
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

const PROXY = process.env["HTTPS_PROXY"] || process.env["https_proxy"];
const navegador = await chromium.launch({
  executablePath: process.env["PW_CHROMIUM"] || "/opt/pw-browsers/chromium",
  ...(PROXY ? { proxy: { server: PROXY, bypass: "127.0.0.1,localhost" } } : {}),
});

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
let excecoes = [];
let recursos = [];
pagina.on("pageerror", (e) => excecoes.push(String(e).split("\n")[0]));
pagina.on("requestfailed", (r) => {
  if (!RUIDO.test(r.url())) recursos.push(`${r.failure()?.errorText} ${r.url()}`);
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
    const limite = Date.now() + 8000;
    for (;;) {
      const carregando = await pagina.evaluate(
        () => !!document.querySelector(".animate-spin"),
      );
      const jaQuebrou = await pagina.evaluate(
        (marcador) => document.body.innerText.includes(marcador),
        TEXTO_DO_BOUNDARY,
      );
      if (!carregando || jaQuebrou) { aindaCarregando = carregando && !jaQuebrou; break; }
      if (Date.now() > limite) { aindaCarregando = true; break; }
      await pagina.waitForTimeout(250);
    }
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
    "Sem sessão, tudo sob /app/ para no login. Estas rotas continuam SEM prova\n" +
    "de que suas telas montam:",
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
