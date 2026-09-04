#!/usr/bin/env node
/**
 * Gera a página de revisão das mudanças da biblioteca clínica.
 *
 * ## Por que gerada, e não escrita
 *
 * A revisão existe para um cardiologista conferir, uma a uma, as afirmações que
 * mudaram quando a biblioteca passou de ESC/EACTS 2021 para 2025. Se eu
 * redigitasse esse texto num HTML, a página passaria a ser uma TERCEIRA versão
 * do conteúdo — que diverge do código no primeiro ajuste, e diverge em silêncio.
 * O revisor aprovaria uma redação e o aplicativo mostraria outra.
 *
 * Então os dois lados saem do próprio repositório: a versão anterior vem de
 * `git show <commit>:src/data/clinicalLibrary.ts`, a atual vem do arquivo em
 * disco, e as duas são transpiladas e importadas de verdade. Nenhuma frase desta
 * página foi digitada por mim.
 *
 * ## O que ela mostra
 *
 * Por tópico: as afirmações que saíram, as que entraram, e as referências novas
 * com o link do PubMed. Afirmação idêntica nos dois lados não aparece — a
 * revisão é do que mudou.
 *
 * Uso: node scripts/gerar-revisao-biblioteca.mjs [--saida <arquivo.html>]
 *
 * Saída de processo: 0 = gerou; 2 = NÃO GEROU (não achou o commit anterior, ou
 * a transpilação falhou). O 2 é o mesmo código dos outros scripts do projeto:
 * "não conferido" nunca pode ser lido como "conferido e ok".
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** O commit imediatamente ANTERIOR à atualização da biblioteca para 2025. */
const ANTES = "1f933de";
const ARQUIVO = "src/data/clinicalLibrary.ts";

const argv = process.argv.slice(2);
const saida = argv.includes("--saida") ? argv[argv.indexOf("--saida") + 1] : "revisao-biblioteca.html";

function morrer(mensagem) {
  console.error(`NÃO GEROU: ${mensagem}`);
  process.exit(2);
}

const tmp = mkdtempSync(join(tmpdir(), "revisao-"));
let antiga, nova;
try {
  const fonteAntiga = execFileSync("git", ["show", `${ANTES}:${ARQUIVO}`], { encoding: "utf8" });
  writeFileSync(join(tmp, "antiga.ts"), fonteAntiga);
  writeFileSync(join(tmp, "nova.ts"), readFileSync(ARQUIVO, "utf8"));
  execFileSync("npx", [
    "tsc", "--target", "es2022", "--module", "esnext", "--moduleResolution", "bundler",
    "--outDir", join(tmp, "out"), join(tmp, "antiga.ts"), join(tmp, "nova.ts"),
  ], { stdio: "pipe" });
  antiga = (await import(pathToFileURL(join(tmp, "out", "antiga.js")).href)).clinicalLibrary;
  nova = (await import(pathToFileURL(join(tmp, "out", "nova.js")).href)).clinicalLibrary;
} catch (e) {
  morrer(`${e.message?.split("\n")[0] ?? e}`);
}

if (!Array.isArray(antiga) || !Array.isArray(nova) || antiga.length === 0) {
  morrer("uma das versões veio vazia — o formato do arquivo mudou");
}

/** Todas as frases de um tópico, venham de onde vierem. */
function afirmacoes(t) {
  return [
    ...(t.keyPoints ?? []),
    ...(t.sections ?? []).flatMap((s) => [s.body, ...(s.bullets ?? [])]),
  ].filter((x) => typeof x === "string" && x.trim().length > 0);
}

/** Referência de qualquer uma das duas versões: antes era string, hoje é objeto. */
const citacaoDe = (r) => (typeof r === "string" ? r : r.citacao);
const urlDe = (r) => (typeof r === "string" ? null : (r.url ?? null));
const notaDe = (r) => (typeof r === "string" ? null : (r.nota ?? null));

const topicos = nova.map((t) => {
  const antes = antiga.find((a) => a.slug === t.slug);
  const frasesAntes = antes ? afirmacoes(antes) : [];
  const frasesDepois = afirmacoes(t);
  const antesSet = new Set(frasesAntes);
  const depoisSet = new Set(frasesDepois);
  const refsAntes = new Set((antes?.references ?? []).map(citacaoDe));
  return {
    slug: t.slug,
    titulo: t.shortTitle ?? t.title ?? t.slug,
    valva: t.valve,
    patologia: t.pathology,
    novo: !antes,
    sairam: frasesAntes.filter((f) => !depoisSet.has(f)),
    entraram: frasesDepois.filter((f) => !antesSet.has(f)),
    referencias: (t.references ?? []).map((r) => ({
      citacao: citacaoDe(r),
      url: urlDe(r),
      nota: notaDe(r),
      nova: !refsAntes.has(citacaoDe(r)),
    })),
  };
});

const sumidos = antiga.filter((a) => !nova.some((t) => t.slug === a.slug)).map((a) => a.slug);

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const totalSairam = topicos.reduce((s, t) => s + t.sairam.length, 0);
const totalEntraram = topicos.reduce((s, t) => s + t.entraram.length, 0);
const comMudanca = topicos.filter((t) => t.sairam.length || t.entraram.length);

const html = `<title>Revisão da Biblioteca Clínica</title>
<style>
  :root {
    --fundo: #fbfaf8; --papel: #ffffff; --texto: #1c1a17; --suave: #6b6560;
    --linha: #e6e1da; --acento: #7a1f2b; --saiu: #8a2b2b; --saiu-fundo: #fdf2f2;
    --entrou: #1f5d3a; --entrou-fundo: #f1f8f3;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --fundo: #16151a; --papel: #1e1d23; --texto: #eceaf0; --suave: #a5a0ab;
      --linha: #33313a; --acento: #e08b98; --saiu: #e69a9a; --saiu-fundo: #2a1c1e;
      --entrou: #8fd3ab; --entrou-fundo: #17251d;
    }
  }
  :root[data-theme="dark"] {
    --fundo: #16151a; --papel: #1e1d23; --texto: #eceaf0; --suave: #a5a0ab;
    --linha: #33313a; --acento: #e08b98; --saiu: #e69a9a; --saiu-fundo: #2a1c1e;
    --entrou: #8fd3ab; --entrou-fundo: #17251d;
  }
  body { background: var(--fundo); color: var(--texto); font: 16px/1.65 Georgia, "Times New Roman", serif; }
  .folha { max-width: 46rem; margin: 0 auto; padding: 3rem 1.25rem 6rem; }
  h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 .5rem; letter-spacing: -.01em; }
  h2 { font-size: 1.25rem; margin: 0 0 .15rem; }
  .sub { color: var(--suave); font-size: .95rem; margin: 0 0 2.5rem; }
  .resumo { background: var(--papel); border: 1px solid var(--linha); border-radius: 10px;
            padding: 1.1rem 1.25rem; margin-bottom: 2.5rem; font-size: .93rem; }
  .resumo p { margin: 0 0 .6rem; } .resumo p:last-child { margin: 0; }
  .numeros { display: flex; gap: 1.5rem; flex-wrap: wrap; margin: .9rem 0 0;
             font-family: ui-sans-serif, system-ui, sans-serif; }
  .numeros b { display: block; font-size: 1.5rem; line-height: 1.1; }
  .numeros span { font-size: .75rem; color: var(--suave); text-transform: uppercase; letter-spacing: .04em; }
  article { background: var(--papel); border: 1px solid var(--linha); border-radius: 10px;
            padding: 1.4rem 1.5rem; margin-bottom: 1.5rem; }
  .rotulo { font-family: ui-sans-serif, system-ui, sans-serif; font-size: .7rem;
            text-transform: uppercase; letter-spacing: .06em; color: var(--suave); }
  .bloco { margin-top: 1.1rem; }
  .bloco > .rotulo { display: block; margin-bottom: .5rem; }
  ul { margin: 0; padding-left: 0; list-style: none; }
  li { margin-bottom: .55rem; padding: .55rem .8rem; border-radius: 7px; font-size: .93rem; }
  .saiu li { background: var(--saiu-fundo); border-left: 3px solid var(--saiu); }
  .entrou li { background: var(--entrou-fundo); border-left: 3px solid var(--entrou); }
  .refs li { background: transparent; border-left: 3px solid var(--linha); font-size: .84rem; color: var(--suave); }
  .refs .nova { border-left-color: var(--acento); }
  a { color: var(--acento); }
  .sem-mudanca { color: var(--suave); font-size: .9rem; font-style: italic; margin: .8rem 0 0; }
  footer { margin-top: 3rem; padding-top: 1.2rem; border-top: 1px solid var(--linha);
           color: var(--suave); font-size: .82rem; }
  code { font-size: .85em; background: var(--fundo); padding: .1em .35em; border-radius: 4px; }
</style>

<div class="folha">
  <h1>Revisão da biblioteca clínica</h1>
  <p class="sub">O que cada tópico dizia, o que passou a dizer, e de onde vem.</p>

  <div class="resumo">
    <p>A biblioteca clínica do ValvePath ficou em <strong>ESC/EACTS 2021 e SBC 2020</strong>
       enquanto o motor de conduta passou para <strong>2025</strong>. O médico via os dois na
       mesma sessão: a ferramenta calculando por uma diretriz e o texto ao lado ensinando outra.</p>
    <p>Esta página existe para essa correção ser <strong>conferida por um cardiologista</strong>,
       afirmação por afirmação. Nada aqui foi redigitado: as duas colunas são lidas do próprio
       repositório — a anterior de <code>git show ${ANTES}</code>, a atual do arquivo em disco —
       por <code>scripts/gerar-revisao-biblioteca.mjs</code>. Frase que não mudou não aparece.</p>
    <div class="numeros">
      <div><b>${comMudanca.length}</b><span>tópicos alterados</span></div>
      <div><b>${totalSairam}</b><span>afirmações retiradas</span></div>
      <div><b>${totalEntraram}</b><span>afirmações novas</span></div>
      <div><b>${nova.length}</b><span>tópicos ao todo</span></div>
    </div>
  </div>

${topicos
  .map(
    (t) => `  <article>
    <span class="rotulo">${esc(t.valva ?? "")}${t.patologia ? " · " + esc(t.patologia) : ""}${t.novo ? " · tópico novo" : ""}</span>
    <h2>${esc(t.titulo)}</h2>
${
  t.sairam.length === 0 && t.entraram.length === 0
    ? `    <p class="sem-mudanca">Nenhuma afirmação mudou neste tópico.</p>`
    : ""
}
${
  t.sairam.length
    ? `    <div class="bloco saiu"><span class="rotulo">Dizia antes (${t.sairam.length})</span>
      <ul>${t.sairam.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>`
    : ""
}
${
  t.entraram.length
    ? `    <div class="bloco entrou"><span class="rotulo">Diz agora (${t.entraram.length})</span>
      <ul>${t.entraram.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>`
    : ""
}
    <div class="bloco refs"><span class="rotulo">Referências</span>
      <ul>${t.referencias
        .map(
          (r) =>
            `<li class="${r.nova ? "nova" : ""}">${esc(r.citacao)}${
              r.url ? ` <a href="${esc(r.url)}" target="_blank" rel="noopener">PubMed</a>` : ""
            }${r.nota && !r.url ? ` <em>(${esc(r.nota)})</em>` : ""}</li>`,
        )
        .join("")}</ul></div>
  </article>`,
  )
  .join("\n")}

${
  sumidos.length
    ? `  <article><span class="rotulo">Atenção</span><h2>Tópicos que sumiram</h2>
    <ul class="saiu">${sumidos.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></article>`
    : ""
}

  <footer>
    <p>Gerado de <code>src/data/clinicalLibrary.ts</code> em ${new Date().toISOString().slice(0, 10)}.
       A comparação é contra o commit <code>${ANTES}</code>, imediatamente anterior à atualização
       para a ESC/EACTS 2025.</p>
    <p>Aprovar esta revisão não marca nada como "revisado por médico" no sistema — esse selo exige
       administrador com registro verificado em <code>doctors</code>, e é gravado com nome, CRM e UF
       lidos do banco. Esta página é o material para a leitura, não o ato de aprovação.</p>
  </footer>
</div>
`;

writeFileSync(saida, html);
rmSync(tmp, { recursive: true, force: true });

console.log(
  `${comMudanca.length} tópicos alterados · ${totalSairam} afirmações saíram · ` +
    `${totalEntraram} entraram · ${nova.length} tópicos ao todo`,
);
if (sumidos.length) console.log(`ATENÇÃO: tópicos que sumiram: ${sumidos.join(", ")}`);
console.log(`escrito em ${saida}`);
