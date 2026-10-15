#!/usr/bin/env node
/**
 * Confere, contra o PubMed, cada PMID citado no código.
 *
 * ## Por que isto existe
 *
 * **Três vezes nesta base eu escrevi um PMID que não era do artigo citado.**
 * Não são erros de digitação: são números que pareciam certos e não eram.
 *
 *   · `31142451` — eu queria a crítica à projeção de mismatch. O número aponta
 *     para "An endoscopist with a painful finger".
 *   · `38182611` — eu queria a diretriz da ASE 2024. O número aponta para o
 *     genoma de uma lesma.
 *   · `32279340` — eu queria o estudo da bioprótese Vivere da Braile. O número
 *     aponta para expressão de PD-L1 em carcinoma cutâneo.
 *
 * As três passariam por qualquer revisão humana: o formato está certo, o link
 * abre, e a página que abre é um artigo de verdade — só que outro. Quem clica é
 * um médico conferindo a procedência de um número clínico, e encontra um artigo
 * sem relação nenhuma. É pior do que não citar.
 *
 * A única defesa que funciona é perguntar ao PubMed. É o que este script faz:
 * para cada PMID citado, busca o título e compara com a citação escrita ao lado.
 *
 * ## O que conta como divergência
 *
 * Não exijo título idêntico — a citação é abreviada e o título do PubMed não.
 * Exijo que as palavras de conteúdo da citação apareçam no título de verdade.
 * Nos três casos acima a sobreposição foi zero.
 *
 * Uso: node scripts/conferir-pmids.mjs
 * Fica fora do `vitest` de propósito: depende de rede, e a CI não deve quebrar
 * porque o NCBI está fora do ar. Roda junto do `ferramentas:verificar`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("../src/", import.meta.url).pathname;

/**
 * Todos os .ts/.tsx sob src/, **menos os de teste**.
 *
 * Arquivo de teste tem PMID dentro de fixture, sem citação ao lado — a primeira
 * versão desta guarda reprovou dois deles comparando código de fixture com
 * título de artigo. Guarda que grita onde não há defeito é guarda que ninguém
 * lê depois da terceira vez.
 */
function arquivos(dir) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivos(caminho));
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

/**
 * Acha a citação que acompanha cada `pubmed.ncbi.nlm.nih.gov/<pmid>`.
 *
 * **Junta TODOS os literais da janela anterior**, e não só o último. A primeira
 * versão pegava o último, e as citações longas deste projeto são escritas com
 * `+` entre pedaços — o último literal costumava ser só o rabo ("Eur J
 * Cardiothorac Surg 2012;41(4):734-745."), sem nenhuma palavra do título. Quatro
 * dos seis "erros" da primeira rodada eram isso.
 *
 * E os literais saem de uma varredura do **arquivo inteiro**, não de uma fatia.
 * Duas tentativas erradas antes desta, e as duas ensinam a mesma coisa:
 *
 *   · /"([^"]{12,})"/ casava o CÓDIGO ENTRE dois literais — `",\n      url: "`
 *     tem 14 caracteres e passava. O relatório saiu com `, url: , }, },` no
 *     lugar da citação.
 *   · fatiar 900 caracteres e separar por paridade de aspas quebra quando a
 *     fatia começa no meio de uma string: a partir dali toda aspa inverte, e o
 *     que era literal vira código e vice-versa. Passou de 0 para 10 divergências
 *     falsas de uma vez.
 *
 * Varrendo do começo do arquivo a paridade é sempre a de verdade. Depois é só
 * ficar com os literais que terminam perto da URL.
 */
function literaisComPosicao(texto) {
  const saida = [];
  let dentro = false, inicio = 0;
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] !== '"' || texto[i - 1] === "\\") continue;
    if (!dentro) { dentro = true; inicio = i + 1; }
    else {
      dentro = false;
      const s = texto.slice(inicio, i);
      if (s.length >= 12 && !s.includes("://")) saida.push({ fim: i, texto: s });
    }
  }
  return saida;
}

/** A citação que acompanha uma URL, montada da janela anterior a ela. */
function citacaoAntesDe(literais, alvo) {
  return literais
    .filter((l) => l.fim < alvo && alvo - l.fim <= 900)
    .map((l) => l.texto)
    .join(" ");
}

function citacoes(texto, arquivo) {
  const literais = literaisComPosicao(texto);
  const achados = [];
  const re = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)\//g;
  let m;
  while ((m = re.exec(texto))) {
    achados.push({ pmid: m[1], citacao: citacaoAntesDe(literais, m.index), arquivo });
  }
  return achados;
}

/**
 * O mesmo, para DOI — e por que isto precisou existir.
 *
 * A Diretriz Brasileira de Valvopatias 2026 não é indexada no PubMed com este
 * título: não tem PMID, tem DOI. Guardá-la com um link fora do alcance deste
 * script seria guardar um link que nenhuma conferência visita — exatamente o
 * que a guarda `todo link é do PubMed` existe para impedir.
 *
 * A defesa é a mesma, com outro balcão: perguntar ao registro do DOI qual é o
 * título do artigo e comparar com a citação escrita ao lado. O Crossref é quem
 * responde por `10.36660` (SBC) e pela maioria dos periódicos.
 *
 * Mesma armadilha que a dos PMIDs, e é por isso que vale: um DOI com formato
 * certo que aponta para outro artigo passa por qualquer revisão humana.
 */
function doisCitados(texto, arquivo) {
  const literais = literaisComPosicao(texto);
  const achados = [];
  const re = /doi\.org\/(10\.\d{4,}\/[^\s"'`)]+)/g;
  let m;
  while ((m = re.exec(texto))) {
    achados.push({ doi: m[1], citacao: citacaoAntesDe(literais, m.index), arquivo });
  }
  return achados;
}

const PARADAS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "using", "into", "over",
  "after", "before", "their", "study", "trial", "patients", "results", "outcomes",
  "clinical", "evaluation", "assessment", "report", "american", "european", "society",
  "association", "journal", "recommendations", "guidelines", "valve", "valves",
  "heart", "cardiac", "aortic", "mitral", "prosthetic", "prosthesis", "year",
  "years", "month", "months", "data", "analysis", "imaging", "function",
]);

const palavras = (s) =>
  new Set(
    s.toLowerCase().replace(/[^a-zà-ú0-9 ]/g, " ").split(/\s+/)
      .filter((p) => p.length >= 5 && !PARADAS.has(p)),
  );

const todos = [];
const todosDoi = [];
for (const f of arquivos(RAIZ)) {
  const texto = readFileSync(f, "utf8");
  todos.push(...citacoes(texto, f.slice(RAIZ.length)));
  todosDoi.push(...doisCitados(texto, f.slice(RAIZ.length)));
}

const porPmid = new Map();
for (const c of todos) if (!porPmid.has(c.pmid)) porPmid.set(c.pmid, c);
console.log(`${porPmid.size} PMID distintos citados em src/\n`);

const ids = [...porPmid.keys()].join(",");
const resp = await fetch(
  `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids}&retmode=json`,
);
if (!resp.ok) { console.error(`PubMed respondeu ${resp.status}`); process.exit(2); }
const resultado = (await resp.json()).result ?? {};

let ok = 0;
const suspeitos = [];
for (const [pmid, c] of porPmid) {
  const reg = resultado[pmid];
  if (!reg || reg.error) { suspeitos.push({ ...c, titulo: "(PMID não existe no PubMed)", comuns: [] }); continue; }
  const titulo = String(reg.title ?? "");
  /**
   * O lado do PubMed é título + primeiro autor + periódico. Uma citação
   * traduzida — as diretrizes europeias aparecem aqui em português — não
   * compartilha palavra nenhuma com o título em inglês, mas compartilha o
   * sobrenome do autor e o nome do periódico. Sem isso a guarda reprovava a
   * citação da ESC/EACTS 2021, que está certa.
   */
  const autor = String(reg.sortfirstauthor ?? reg.authors?.[0]?.name ?? "");
  const ladoPubmed = `${titulo} ${autor} ${reg.fulljournalname ?? ""} ${reg.source ?? ""}`;
  const daCitacao = palavras(c.citacao);
  const doPubmed = palavras(ladoPubmed);
  const comuns = [...daCitacao].filter((p) => doPubmed.has(p));
  if (comuns.length >= 2) { ok++; continue; }
  suspeitos.push({ ...c, titulo, comuns });
}

console.log(`${ok} conferem · ${suspeitos.length} divergem\n`);
for (const s of suspeitos) {
  console.log(`✗ PMID ${s.pmid}  (${s.arquivo})`);
  console.log(`    citação : ${s.citacao.slice(0, 110)}`);
  console.log(`    PubMed  : ${s.titulo.slice(0, 110)}`);
  console.log(`    palavras em comum: ${s.comuns.join(", ") || "NENHUMA"}\n`);
}

// ---------------------------------------------------------------------------
// E os DOIs, pelo mesmo critério — ver `doisCitados`.
// ---------------------------------------------------------------------------

const porDoi = new Map();
for (const c of todosDoi) if (!porDoi.has(c.doi)) porDoi.set(c.doi, c);
console.log(`${porDoi.size} DOI distintos citados em src/\n`);

let okDoi = 0;
const suspeitosDoi = [];
for (const [doi, c] of porDoi) {
  let titulo = "";
  let registro = null;
  try {
    const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { Accept: "application/json" },
    });
    // 404 do Crossref é informação: o DOI não existe. Qualquer outro código é
    // "não deu para conferir", e os dois não podem sair iguais — mesma regra
    // dos três estados que este projeto usa em toda conferência.
    if (r.status === 404) {
      suspeitosDoi.push({ ...c, titulo: "(DOI não existe no Crossref)", comuns: [] });
      continue;
    }
    if (!r.ok) {
      console.error(`NÃO CONFERIDO: Crossref respondeu ${r.status} para ${doi}`);
      process.exit(2);
    }
    registro = (await r.json()).message ?? {};
    titulo = String(registro.title?.[0] ?? "");
  } catch (e) {
    console.error(`NÃO CONFERIDO: não foi possível falar com o Crossref (${e instanceof Error ? e.message : e})`);
    process.exit(2);
  }

  // O lado do Crossref: título, periódico e primeiro autor — igual ao do
  // PubMed, e pelo mesmo motivo (citação em português contra título em inglês).
  const autor = String(registro.author?.[0]?.family ?? "");
  const periodico = String(registro["container-title"]?.[0] ?? "");
  const comuns = [...palavras(c.citacao)].filter((p) => palavras(`${titulo} ${autor} ${periodico}`).has(p));
  if (comuns.length >= 2) { okDoi++; continue; }
  suspeitosDoi.push({ ...c, titulo, comuns });
}

console.log(`${okDoi} conferem · ${suspeitosDoi.length} divergem\n`);
for (const s of suspeitosDoi) {
  console.log(`✗ DOI ${s.doi}  (${s.arquivo})`);
  // O FIM da janela, não o começo: a janela junta até 900 caracteres de
  // literais anteriores, e os mais próximos da URL é que são a citação dela.
  // Imprimindo o começo, o relatório mostrava a citação da entrada de cima — o
  // leitor concluiria que o detector pegou o par errado.
  console.log(`    citação  : …${s.citacao.slice(-110)}`);
  console.log(`    Crossref : ${s.titulo.slice(0, 110)}`);
  console.log(`    palavras em comum: ${s.comuns.join(", ") || "NENHUMA"}\n`);
}

process.exit(suspeitos.length || suspeitosDoi.length ? 1 : 0);
