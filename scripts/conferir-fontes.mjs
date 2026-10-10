#!/usr/bin/env node
/**
 * Confere se as URLs de fonte do catálogo de próteses ainda RESOLVEM.
 *
 * ## Por que existe
 *
 * A conferência periódica tinha uma linha chamada "catálogo: nenhuma EOA
 * gravada sem fonte citável", e o que ela media era `!l.eoa_source_url` — o
 * campo está preenchido ou não. Uma URL que devolve 404 passava por "citável".
 *
 * Isto não é defeito hipotético nesta base. O cabeçalho do `conferir-mmcts.mjs`
 * registra, entre as três vezes em que o projeto aprendeu a mesma lição:
 *
 *   > "links da Corcym que devolviam 404 depois de o site ser reorganizado"
 *
 * São 82 URLs únicas de fonte, em 16 domínios, quase todas de fabricante. Quem
 * clica é um cardiologista conferindo a procedência de um número clínico — a
 * área efetiva de orifício que ele usa para decidir tamanho de prótese. Fonte
 * que não abre é pior do que fonte nenhuma: a primeira afirma uma procedência
 * que não existe, a segunda só não afirma nada.
 *
 * ## Os três estados, e por que o 403 não é 404
 *
 *   · **ok** — 2xx (redirecionamento seguido);
 *   · **MORTA** (saída 1) — 404 ou 410. A página não existe mais;
 *   · **NÃO CONFERIDO** (saída 2) — 403, 429, 5xx, erro de rede, tempo
 *     esgotado. Não deu para olhar.
 *
 * Página protegida NÃO é página morta, e contorná-la está fora de questão: este
 * projeto já topou com o desafio do Cloudflare da ANVISA e com a parede de
 * navegador da Medtronic, e a decisão registrada nas duas vezes foi a mesma —
 * não se contorna, e a ausência de resposta é relatada como ausência de
 * resposta. "Não sei" não é "está tudo bem", e também não é "está quebrado".
 *
 * ## Por que semanal, e não diária
 *
 * São 82 requisições a sites de terceiros. Diariamente seria incômodo para
 * eles e inútil para nós: link de fabricante apodrece em reorganização de site,
 * que acontece em meses, não em horas. E uma indisponibilidade passageira
 * viraria ⚠️ todo dia, que é como se ensina alguém a ignorar o aviso.
 *
 * Uso:
 *   node scripts/conferir-fontes.mjs
 *   node scripts/conferir-fontes.mjs --limite 10     # amostra, para depurar
 */

import { pathToFileURL } from "node:url";

const SUPABASE = process.env["VITE_SUPABASE_URL"];
const CHAVE = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

/** Os campos do catálogo que carregam URL de procedência. */
const CAMPOS = ["eoa_source_url", "reference_url", "image_url", "advisory_url", "mercado_br_fonte"];

/** Quanto esperar por resposta antes de desistir e dizer "não conferido". */
const LIMITE_MS = 20_000;

/** Pausa entre requisições. Não é otimização: é cortesia com sites de terceiros. */
const PAUSA_MS = 150;

/**
 * Identificação de navegador comum.
 *
 * Não é disfarce para furar proteção — um 403 continua sendo relatado como NÃO
 * CONFERIDO, sem segunda tentativa. É só que vários destes sites devolvem erro
 * para requisição sem `User-Agent`, e aí o veredito falaria do cabeçalho em vez
 * de falar do link.
 */
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const argumentos = process.argv.slice(2);
const limite = (() => {
  const i = argumentos.indexOf("--limite");
  return i >= 0 ? Number(argumentos[i + 1]) : Infinity;
})();

async function catalogo() {
  const resposta = await fetch(`${SUPABASE}/rest/v1/rpc/catalogo_proteses`, {
    method: "POST",
    headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!resposta.ok) {
    console.error(`NÃO CONFERIDO: o RPC do catálogo respondeu ${resposta.status}.`);
    process.exit(2);
  }
  const linhas = await resposta.json();
  if (!Array.isArray(linhas) || linhas.length === 0) {
    console.error("NÃO CONFERIDO: o RPC do catálogo não devolveu linhas.");
    process.exit(2);
  }
  return linhas;
}

/** URL → quais campos de quais famílias apontam para ela. */
export function urlsDoCatalogo(linhas) {
  const mapa = new Map();
  for (const linha of linhas) {
    for (const campo of CAMPOS) {
      const valor = linha[campo];
      if (typeof valor !== "string" || !/^https?:\/\//.test(valor)) continue;
      if (!mapa.has(valor)) mapa.set(valor, { campos: new Set(), familias: new Set() });
      const entrada = mapa.get(valor);
      entrada.campos.add(campo);
      entrada.familias.add(`${linha.manufacturer} ${linha.model_name}`);
    }
  }
  return mapa;
}

/** Traduz a resposta num dos três estados. */
export function estadoDaResposta({ status, erro }) {
  if (erro) return { estado: "naoConferido", detalhe: erro };
  if (status >= 200 && status < 300) return { estado: "ok", detalhe: String(status) };
  if (status === 404 || status === 410) return { estado: "morta", detalhe: String(status) };
  // 403/429 é proteção; 5xx é problema do outro lado. Nenhum dos dois diz que
  // a página deixou de existir, e nenhum dos dois se contorna.
  return { estado: "naoConferido", detalhe: `HTTP ${status}` };
}

async function sondar(url) {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), LIMITE_MS);
  try {
    const resposta = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "*/*" },
      signal: controle.signal,
    });
    // O corpo não interessa, e baixar megabyte de imagem de fabricante para
    // olhar um status seria falta de educação.
    try { await resposta.body?.cancel(); } catch { /* já consumido ou vazio */ }
    return estadoDaResposta({ status: resposta.status });
  } catch (e) {
    const texto = e instanceof Error ? e.message : String(e);
    return estadoDaResposta({ erro: texto.includes("abort") ? `sem resposta em ${LIMITE_MS / 1000}s` : texto.slice(0, 80) });
  } finally {
    clearTimeout(relogio);
  }
}

/**
 * O fluxo, numa função — e não no topo do módulo.
 *
 * A primeira versão deste arquivo tinha `await` no nível de módulo, e com isso
 * IMPORTAR o script o executava: o teste das funções puras morria no
 * `process.exit(2)` da checagem de credenciais, antes de rodar um caso.
 *
 * É a terceira vez nesta sessão que a mesma separação aparece — os relatores da
 * conferência periódica saíram para `lib/relatar.mjs` e a leitura de tabelas
 * para `tabelasVivasDeSql` pelo mesmo motivo, escrito lá: o que não se consegue
 * executar num teste não se consegue conferir.
 */
async function principal() {
  if (!SUPABASE || !CHAVE) {
    console.error(
      "NÃO CONFERIDO: faltam VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY no ambiente.\n" +
      "São chaves PÚBLICAS — já vão embutidas no pacote que todo visitante baixa.",
    );
    process.exit(2);
  }

  const linhas = await catalogo();
  const urls = urlsDoCatalogo(linhas);
  const alvos = [...urls.keys()].sort().slice(0, limite);

  console.log(`Conferindo ${alvos.length} URL(s) de fonte do catálogo (${linhas.length} linhas)\n`);

  const mortas = [];
  const naoConferidas = [];
  let ok = 0;

  for (const url of alvos) {
    const { estado, detalhe } = await sondar(url);
    const { campos, familias } = urls.get(url);
    const resumo = `[${[...campos].join("+")}] ${url}`;
    if (estado === "ok") {
      ok++;
      console.log(`✓ ${resumo}`);
    } else if (estado === "morta") {
      mortas.push({ url, detalhe, campos: [...campos], familias: [...familias] });
      console.log(`✗ MORTA (${detalhe}) ${resumo}`);
    } else {
      naoConferidas.push({ url, detalhe, campos: [...campos] });
      console.log(`⚠ não conferida (${detalhe}) ${resumo}`);
    }
    if (PAUSA_MS) await new Promise((r) => setTimeout(r, PAUSA_MS));
  }

  console.log(`\n${ok} ok · ${mortas.length} morta(s) · ${naoConferidas.length} não conferida(s)`);

  if (mortas.length) {
    console.log("\nFONTES MORTAS — a procedência que o cardiologista clica não existe mais:");
    for (const m of mortas) {
      console.log(`  · ${m.url}`);
      console.log(`      campo(s): ${m.campos.join(", ")}`);
      console.log(`      família(s): ${m.familias.slice(0, 4).join("; ")}${m.familias.length > 4 ? ` (+${m.familias.length - 4})` : ""}`);
    }
  }

  if (naoConferidas.length) {
    console.log("\nNÃO CONFERIDAS — 403, 5xx, rede ou tempo esgotado. Não é o mesmo que morta,");
    console.log("e proteção de site não se contorna:");
    for (const n of naoConferidas) console.log(`  · (${n.detalhe}) ${n.url}`);
  }

  // A ordem importa: morta é pior que não conferida, e o código de saída tem de
  // dizer a pior coisa que aconteceu.
  if (mortas.length) process.exit(1);
  if (naoConferidas.length) process.exit(2);
  console.log("\nTodas as fontes do catálogo resolvem.");
}

// Só quando EXECUTADO, nunca quando importado.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await principal();
}
