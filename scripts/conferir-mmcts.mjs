#!/usr/bin/env node
/**
 * Confere, contra o próprio MMCTS, cada tutorial que o aplicativo linka.
 *
 * ## Por que existe
 *
 * É a terceira vez que este projeto aprende a mesma lição por um caminho
 * diferente:
 *
 *   · fotos de prótese que mostravam outro produto, radiografia de peça ou
 *     quadro de vídeo cirúrgico — pegas porque cada uma foi aberta e olhada;
 *   · links da Corcym que devolviam 404 depois de o site ser reorganizado;
 *   · três PMIDs que eu escrevi e que apontavam para artigos sem relação — um
 *     deles sobre o genoma de uma lesma.
 *
 * Link de vídeo tem a mesma fragilidade e um agravante: ele parece certo até
 * alguém clicar. E quem clica é um cirurgião procurando a técnica de uma
 * operação que vai fazer.
 *
 * ## O que ele compara
 *
 * O título gravado em `src/data/mmcts.ts` contra o `<title>` que a página
 * devolve hoje. Espaços são normalizados dos dois lados — o MMCTS serve alguns
 * títulos com espaço duplo, e isso não é divergência de conteúdo.
 *
 * Ao montar a lista, quatro tutoriais que a busca apresentou com título e tudo
 * devolveram página SEM título. Confiar no resultado de busca teria colocado
 * quatro links quebrados com cara de conferidos.
 *
 * ## Códigos de saída
 *
 *   0 — conferido, tudo bate
 *   1 — algum título divergiu, ou a página não tem título
 *   2 — NÃO CONFERIDO: a rede não respondeu, e isso não é o mesmo que "está certo"
 *
 * Fica FORA da CI de propósito, como o `conferir-pmids.mjs`: depende de um site
 * de terceiro, e a CI não deve quebrar porque o servidor da EACTS caiu.
 */
import { readFileSync } from "node:fs";

const ARQUIVO = "src/data/mmcts.ts";
const fonte = readFileSync(ARQUIVO, "utf8");

/**
 * Lê os pares id/título do arquivo de dados.
 *
 * Regex e não import: o arquivo é TypeScript, e trazer um transpilador para uma
 * leitura de duas colunas seria peso sem ganho. A forma é fixa e o próprio teste
 * de contagem abaixo pega se ela mudar.
 */
const entradas = [...fonte.matchAll(/\{\s*\n\s*id:\s*(\d+),\s*\n\s*titulo:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g)]
  .map((m) => ({ id: Number(m[1]), titulo: m[2].replace(/\\"/g, '"') }));

/**
 * Quantas entradas o arquivo TEM, contadas por um marcador diferente.
 *
 * `entradas.length === 0` sozinho não bastava, e a inversão provou: renomear
 * `id:` numa única entrada fazia a varredura pular aquele tutorial e ainda sair
 * com 0 — "16 conferem" onde havia 17, sem uma palavra sobre o que sumiu.
 * Varredura que não sabe quantos itens deveria ter é varredura que encolhe em
 * silêncio, e foi exatamente esse defeito que esta sessão perseguiu a rodada
 * inteira.
 *
 * `topico:` aparece uma vez por entrada e é independente de `id:`. Os dois
 * números têm de bater.
 */
const declarados = (fonte.match(/^\s*topico:\s*"/gm) ?? []).length;

if (entradas.length === 0 || entradas.length !== declarados) {
  console.error(
    `NÃO CONFERIDO: li ${entradas.length} tutorial(is) de ${ARQUIVO}, mas o ` +
    `arquivo declara ${declarados}.\n` +
    "A forma do arquivo mudou e esta varredura ficou cega em parte dele — que é\n" +
    "pior do que reprovar, porque passaria em silêncio.",
  );
  process.exit(2);
}

const normalizar = (s) => s.replace(/\s+/g, " ").trim();

let divergentes = 0;
let naoConferidos = 0;
let conferidos = 0;

for (const { id, titulo } of entradas) {
  const url = `https://mmcts.org/tutorial/${id}`;
  let html;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) {
      console.error(`✗ ${id}  HTTP ${r.status} — a página não responde mais`);
      divergentes++;
      continue;
    }
    html = await r.text();
  } catch (e) {
    console.error(`? ${id}  não deu para buscar (${e.message})`);
    naoConferidos++;
    continue;
  }

  const bruto = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const naPagina = normalizar(bruto.replace(/\s*\|\s*MMCTS\s*$/i, ""));

  if (!naPagina) {
    console.error(`✗ ${id}  a página não tem título — foi assim que 4 candidatos caíram`);
    divergentes++;
  } else if (naPagina !== normalizar(titulo)) {
    console.error(`✗ ${id}  título divergente`);
    console.error(`     gravado: ${normalizar(titulo)}`);
    console.error(`     hoje:    ${naPagina}`);
    divergentes++;
  } else {
    console.log(`✓ ${id}  ${naPagina.slice(0, 78)}`);
    conferidos++;
  }
}

console.log(`\n${conferidos} conferem · ${divergentes} divergem · ${naoConferidos} não conferidos`);

if (divergentes > 0) {
  console.error(
    "\nUm tutorial mudou de título ou saiu do ar. Abra a página, veja o que ela é\n" +
    "hoje, e corrija `src/data/mmcts.ts` — ou tire o link. Link que aponta para\n" +
    "outra coisa é pior que link nenhum: o cirurgião confia nele.",
  );
  process.exit(1);
}
if (naoConferidos > 0) {
  console.error(
    `\nNÃO CONFERIDO: ${naoConferidos} tutorial(is) não puderam ser buscados.\n` +
    "Isto NÃO quer dizer que estejam certos — quer dizer que não deu para olhar.\n" +
    "Código 2, distinto do 1, pela mesma convenção do `mobile.mjs`.",
  );
  process.exit(2);
}
