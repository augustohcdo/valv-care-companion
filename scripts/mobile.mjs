#!/usr/bin/env node
/**
 * Abre as páginas em viewport de celular e falha listando quem ultrapassa a
 * largura da tela.
 *
 * Por que isto existe: `index.css` tinha `overflow-x: hidden` em `html, body`
 * com o comentário "bloqueia scroll horizontal — evita vazamento de layout".
 * Isso não conserta vazamento nenhum: **converte um layout largo demais em
 * texto apagado**. No iPhone as linhas terminavam cortadas no meio da palavra,
 * e como não havia barra de rolagem para denunciar, o defeito atravessou
 * semanas sem ninguém ver.
 *
 * A medição desliga esse disfarce em tempo de execução antes de medir — senão
 * ela herdaria o próprio problema que existe para detectar.
 *
 * Uso:
 *   npm run mobile                             # produção
 *   npm run mobile -- http://127.0.0.1:4173    # preview local
 */
import { execSync } from "node:child_process";

/**
 * O Playwright não é dependência do projeto — seria peso grande para um script
 * sob demanda. Procura no projeto e, se não achar, na instalação global.
 */
async function carregarPlaywright() {
  for (const alvo of ["playwright", "@playwright/test"]) {
    try { return await import(alvo); } catch { /* tenta o próximo */ }
  }
  try {
    const raizGlobal = execSync("npm root -g", { encoding: "utf8" }).trim();
    return await import(`${raizGlobal}/playwright/index.mjs`);
  } catch { /* cai no erro abaixo */ }
  console.error(
    "Playwright não encontrado. Instale com `npm i -g playwright` ou " +
    "`npm i -D @playwright/test` antes de rodar esta medição.",
  );
  process.exit(2);
}

const { chromium, devices } = await carregarPlaywright();

const BASE = (process.argv[2] || process.env["MOBILE_BASE_URL"] || "https://valvepath.com.br")
  .replace(/\/$/, "");

/** Páginas com risco de layout largo: texto longo, tabela, cartão, formulário. */
const PAGINAS = [
  "/",
  "/aprender",
  "/aprender/estenose-aortica",
  "/referencias",
  "/auth/login",
  "/auth/cadastro",
  // Formulário longo com selects lado a lado — a página com maior risco de
  // transbordar no celular entre as públicas. `/acesso-profissional` agora
  // redireciona para cá, então medir as duas mediria a mesma tela.
  "/medicos",
  "/dpo",
];

const IPHONE = devices["iPhone 14"];

/**
 * Roda dentro da página: desliga o `overflow-x: hidden` e devolve todo elemento
 * cujo lado direito passa da largura da tela.
 */
function medir() {
  // Sem isto, o `overflow-x: hidden` esconde o transbordo de quem o causou e a
  // medição não acha ninguém.
  const style = document.createElement("style");
  style.textContent = "html, body { overflow-x: visible !important; max-width: none !important; }";
  document.head.appendChild(style);

  const largura = document.documentElement.clientWidth;
  const culpados = [];

  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const excesso = Math.round(r.right - largura);
    if (excesso <= 1) continue;

    culpados.push({
      tag: el.tagName.toLowerCase(),
      classes: (typeof el.className === "string" ? el.className : "").slice(0, 90),
      largura: Math.round(r.width),
      excesso,
      // Um filho transbordando arrasta o pai; o mais interno é quem interessa.
      profundidade: (() => { let n = 0, p = el; while ((p = p.parentElement)) n++; return n; })(),
    });
  }

  const raiz = document.getElementById("root");

  return {
    largura,
    scrollWidth: document.documentElement.scrollWidth,
    culpados: culpados.sort((a, b) => b.profundidade - a.profundidade).slice(0, 12),
    // Prova de que havia o que medir. Uma página em branco nunca transborda,
    // então sem isto o script aprova justamente o pior estado possível.
    elementos: raiz ? raiz.querySelectorAll("*").length : 0,
    texto: (document.body.innerText || "").trim().length,
  };
}

const navegador = await chromium.launch();
const contexto = await navegador.newContext({ ...IPHONE });
let falhou = false;
let medidas = 0;
const naoMedidas = [];

console.log(`Medindo ${PAGINAS.length} páginas em ${IPHONE.viewport.width}px — ${BASE}\n`);

for (const caminho of PAGINAS) {
  const pagina = await contexto.newPage();
  try {
    await pagina.goto(BASE + caminho, { waitUntil: "networkidle", timeout: 30_000 });
    // As seções entram por animação de scroll; sem isso a medição pega a página
    // pela metade.
    await pagina.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await pagina.waitForTimeout(700);
    await pagina.evaluate(() => window.scrollTo(0, 0));

    const r = await pagina.evaluate(medir);

    // Página que não renderizou não é página sem transbordo — é página que não
    // foi medida. Aconteceu de verdade: um build local sem
    // `VITE_SUPABASE_URL` quebrava o app no boot, o `#root` ficava vazio, e
    // este script aprovava as oito páginas em branco uma por uma.
    if (r.elementos < 10 || r.texto < 50) {
      const motivo =
        `a página não renderizou (${r.elementos} elementos, ${r.texto} caracteres) — ` +
        "veja o console do navegador; num build local costuma ser variável de ambiente faltando";
      naoMedidas.push({ caminho, motivo });
      console.log(`? ${caminho} — não deu para medir: ${motivo}`);
      continue;
    }

    const transborda = r.scrollWidth > r.largura + 1;

    medidas++;
    if (!transborda) {
      console.log(`✓ ${caminho} — ${r.largura}px, sem transbordo`);
    } else {
      falhou = true;
      console.log(`✗ ${caminho} — conteúdo tem ${r.scrollWidth}px numa tela de ${r.largura}px`);
      for (const c of r.culpados) {
        console.log(`    +${c.excesso}px  <${c.tag}> larg=${c.largura}  ${c.classes}`);
      }
    }
  } catch (e) {
    // Não conseguir abrir a página não é o mesmo que medir e achar transbordo.
    // Confundir os dois faz o resumo afirmar "há conteúdo mais largo que a
    // tela" quando na verdade nada foi medido — que é exatamente o tipo de
    // relatório que este projeto passou a sessão inteira eliminando.
    naoMedidas.push({ caminho, motivo: e instanceof Error ? e.message.split("\n")[0] : String(e) });
    console.log(`? ${caminho} — não deu para medir: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
  } finally {
    await pagina.close();
  }
}

await navegador.close();

if (falhou) {
  console.error("\nHá conteúdo mais largo que a tela. No celular isso aparece como texto cortado.");
  process.exit(1);
}
if (naoMedidas.length) {
  console.error(
    `\n${naoMedidas.length} de ${naoMedidas.length + medidas} página(s) não puderam ser medidas — ` +
    "o navegador não alcançou o alvo. Isto NÃO é um resultado de layout: nada foi conferido nelas.",
  );
  console.error(`Primeiro motivo: ${naoMedidas[0].motivo}`);
  // Código 2, distinto do 1 (transbordo real), para quem automatizar saber a
  // diferença entre "está errado" e "não deu para olhar".
  process.exit(2);
}
console.log(`\n✓ ${medidas} página(s) medidas, nenhuma transborda a largura da tela.`);
