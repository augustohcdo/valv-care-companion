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
 * ## Os quatro estados, e por que o 403 não é 404
 *
 *   · **ok** — 2xx (redirecionamento seguido);
 *   · **MORTA** (saída 1) — 404 ou 410. A página não existe mais;
 *   · **NÃO CONFERIDO** (saída 2) — 403, 429, 5xx, tempo esgotado. Não deu
 *     para olhar;
 *   · **não alcançado** — `fetch failed`: ninguém falou com o host. Reprova
 *     como NÃO CONFERIDO, e é estado separado porque num 403 o host RESPONDEU
 *     e recusou. Só é dispensado se o host estiver em `FORA_DE_ALCANCE` —
 *     que hoje está **vazia**, e o cabeçalho dela diz por quê.
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

/**
 * Estamos no executor do GitHub Actions?
 *
 * É o ambiente que `FORA_DE_ALCANCE` nomeia, e por isso o único em que a
 * dispensa vale. `GITHUB_ACTIONS` é a variável que o próprio runner define.
 */
const NO_EXECUTOR_DO_GITHUB = !!process.env["GITHUB_ACTIONS"];

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

/**
 * Hosts que ESTE executor não alcança — com o motivo e as medições.
 *
 * ## Está vazia, e foi uma medição que a esvaziou
 *
 * Ela nasceu com dois hosts. Primeira execução do job na CI: **68 ok, 0 mortas,
 * 14 não conferidas**, e as 14 eram `fetch failed` em `braile.com.br` e
 * `medicicor.com.br`, só nesses dois. `fetch failed` é falha de REDE — o
 * executor não chegou a falar com o host —, e do contêiner de desenvolvimento,
 * no mesmo dia, os dois respondiam HTTP 200. Daí eu concluí: as fontes estão
 * vivas, quem não alcança é o runner nos Estados Unidos.
 *
 * A execução seguinte, em `main`, devolveu **82 de 82 ok** — e, junto, o aviso
 * de que os dois hosts declarados fora de alcance tinham respondido ao próprio
 * runner. As 14 falhas foram **passageiras**, não estruturais.
 *
 * O defeito não foi a medição; foi o que eu afirmei com ela. Eu tinha UMA
 * observação e escrevi aqui uma exceção permanente, com a frase "sai 2 toda
 * semana, para sempre, pelas mesmas 14 URLs". Esse "para sempre" era
 * **previsão, não medição** — exatamente o defeito que esta base passou a
 * sessão inteira caçando, uma camada acima: declarar sem medir, e com tanta
 * segurança que o leitor não pensa em conferir. Uma indisponibilidade
 * passageira — o caso que o cabeçalho deste arquivo já nomeava, três
 * parágrafos acima — virou limite declarado do ambiente.
 *
 * O que salvou foi a outra metade do mecanismo: o detector de lista
 * envelhecida, escrito no mesmo comando que a lista justamente porque dispensa
 * que sobrevive ao motivo esconde a próxima falha. Ele me desmentiu na primeira
 * execução em que pôde. É o argumento inteiro a favor de guardas que cobram a
 * garantia e não a intenção de quem as escreveu: esta apanhou o seu autor.
 *
 * ## O que fica, com a lista vazia
 *
 * O mecanismo todo — e não por apego. Com a lista vazia, `fetch failed` volta a
 * reprovar como NÃO CONFERIDO (saída 2), que é o veredito correto para falha de
 * rede: "não sei" não é "está tudo bem". Se as 14 voltarem e PERSISTIREM,
 * haverá então o que a primeira versão não teve — mais de uma observação —, e
 * `motivoDaDispensaBasta` passou a cobrar isso de quem for escrever a próxima
 * entrada.
 *
 * E o que a lista nunca fez, se algum dia voltar a ter entrada: declarar URL
 * conferida. Declara que **não foi conferida aqui**, e o relatório diz isso com
 * o denominador à vista.
 */
export const FORA_DE_ALCANCE = {};

/**
 * O motivo escrito basta para sustentar uma dispensa?
 *
 * Isto era uma regra dentro do teste, varrendo as entradas da lista. Com a
 * lista vazia o laço não roda, e a guarda viraria verde sem olhar nada —
 * cobertura não é garantia, é garantia só sobre o que a guarda olha. Virando
 * função, a regra é conferível com entradas sintéticas e aplicável às reais,
 * haja uma ou nenhuma.
 *
 * As três primeiras exigências já estavam lá. A quarta — **duas datas
 * distintas** — é a lição da lista anterior: ela foi escrita com uma única
 * observação, e uma observação não distingue limite de ambiente de
 * indisponibilidade passageira. Nada aqui prova que a segunda medição é
 * honesta; o que a regra faz é obrigar quem dispensa a ter voltado a medir, em
 * outro dia, e a dizer quando.
 */
export function motivoDaDispensaBasta(motivo) {
  const texto = typeof motivo === "string" ? motivo : "";
  const datas = new Set(texto.match(/\d{4}-\d{2}-\d{2}/g) ?? []);
  const faltas = [];
  if (texto.length < 60) faltas.push("motivo escrito");
  if (!/não alcança|fetch failed/i.test(texto)) faltas.push("dizer que o executor não alcança");
  if (!/HTTP 200/.test(texto)) faltas.push("dizer o que a medição de fora achou");
  if (datas.size < 2) faltas.push("duas datas distintas — uma observação não faz limite");
  return { basta: faltas.length === 0, faltas };
}

/**
 * As entradas cuja dispensa não se sustenta — para o script dizer isso e parar.
 *
 * A regra só valia dentro de um teste, e teste é onde a regra vale para quem
 * roda a suíte. Quem acrescentar uma entrada e rodar o script direto merece
 * ouvir a mesma coisa, no lugar onde a dispensa seria usada.
 */
export function dispensasSemMotivo(lista = FORA_DE_ALCANCE) {
  return Object.entries(lista)
    .map(([host, motivo]) => ({ host, faltas: motivoDaDispensaBasta(motivo).faltas }))
    .filter((d) => d.faltas.length > 0);
}

/**
 * A dispensa vale NESTE ambiente?
 *
 * O motivo escrito em `FORA_DE_ALCANCE` tem de nomear o ambiente — "o executor
 * do GitHub Actions não alcança este host" —, e por isso a dispensa só pode
 * valer lá. De qualquer outra rede, as URLs são conferidas normalmente.
 *
 * Isto saiu de uma execução de verdade: rodado do contêiner de
 * desenvolvimento — que alcança o Brasil —, o script entrou no ramo "a lista
 * envelheceu" e saiu 2 por dois hosts que o runner do GitHub, naquele dia, de
 * fato não alcançava. Limite de ambiente que não diz de qual ambiente é vira
 * alarme no ambiente errado. (A execução seguinte mostrou que o runner também
 * os alcançava, e aí a lista saiu inteira — ver o cabeçalho dela.)
 *
 * `lista` é parâmetro para o teste poder exercer a dispensa com entradas
 * sintéticas: com a lista real vazia, uma guarda que só falasse de hosts reais
 * não teria o que afirmar.
 *
 * E a dispensa depende do motivo BASTAR, não de o host estar escrito: é o
 * motivo que a sustenta, e um host anotado sem motivo suficiente é
 * esquecimento com cara de decisão. Falha fechada — a URL volta a reprovar como
 * NÃO CONFERIDO, que é o pior veredito dos dois e o certo quando não se sabe.
 */
export function dispensaVale({ host, noExecutorDoGitHub, lista = FORA_DE_ALCANCE }) {
  if (!noExecutorDoGitHub || host === null || !(host in lista)) return false;
  return motivoDaDispensaBasta(lista[host]).basta;
}

/** O host de uma URL, sem `www.`, ou `null` se não der para ler. */
export function hostDe(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Traduz a resposta num dos QUATRO estados.
 *
 * `naoAlcancado` saiu de dentro de `naoConferido`, e a diferença é de fato, não
 * de grau: num 403 o host RESPONDEU e recusou; num `fetch failed` ninguém
 * falou com ele. Confundir os dois fazia a lista de "não conferidas" misturar
 * "o site me barrou" com "não cheguei no site" — e só o segundo é propriedade
 * do executor, não da fonte.
 */
export function estadoDaResposta({ status, erro }) {
  if (erro) return { estado: "naoAlcancado", detalhe: erro };
  if (status >= 200 && status < 300) return { estado: "ok", detalhe: String(status) };
  if (status === 404 || status === 410) return { estado: "morta", detalhe: String(status) };
  // 403/429 é proteção; 5xx é problema do outro lado. Nenhum dos dois diz que
  // a página deixou de existir, e nenhum dos dois se contorna.
  return { estado: "naoConferido", detalhe: `HTTP ${status}` };
}

/**
 * O veredito final, a partir das contagens. Puro.
 *
 * `foraDeAlcance` NÃO reprova, e é a única concessão: é limite declarado, com
 * motivo escrito e medição, não resultado desconhecido. A ordem dos outros é a
 * de sempre — morta (1) é pior que não conferida (2).
 */
export function vereditoDasFontes({ mortas, naoConferidas, foraDeAlcance, voltaramAoAlcance }) {
  if (mortas > 0) return { codigo: 1, motivo: "morta" };
  if (naoConferidas > 0) return { codigo: 2, motivo: "naoConferido" };
  if (voltaramAoAlcance > 0) return { codigo: 2, motivo: "listaEnvelhecida" };
  return { codigo: 0, motivo: foraDeAlcance > 0 ? "okComLimite" : "ok" };
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

  // Antes de conferir URL nenhuma: a lista de dispensas se sustenta? Entrada
  // sem motivo suficiente não é dispensada (falha fechada), e isso tem de ser
  // dito em voz alta — dispensa que não se justifica, calada, é o defeito desta
  // sessão inteira.
  const semMotivo = dispensasSemMotivo();
  if (semMotivo.length) {
    console.error("NÃO CONFERIDO: há dispensa em FORA_DE_ALCANCE que o motivo escrito não sustenta:");
    for (const d of semMotivo) console.error(`  · ${d.host} — falta ${d.faltas.join("; ")}`);
    process.exit(2);
  }

  const linhas = await catalogo();
  const urls = urlsDoCatalogo(linhas);
  const alvos = [...urls.keys()].sort().slice(0, limite);

  console.log(`Conferindo ${alvos.length} URL(s) de fonte do catálogo (${linhas.length} linhas)\n`);

  const mortas = [];
  const naoConferidas = [];
  const foraDeAlcance = [];
  /** Host DECLARADO fora de alcance que respondeu: a declaração envelheceu. */
  const voltaramAoAlcance = new Set();
  let ok = 0;

  for (const url of alvos) {
    const { estado, detalhe } = await sondar(url);
    const { campos, familias } = urls.get(url);
    const resumo = `[${[...campos].join("+")}] ${url}`;
    const host = hostDe(url);
    const declarado = dispensaVale({ host, noExecutorDoGitHub: NO_EXECUTOR_DO_GITHUB });

    if (estado === "ok") {
      ok++;
      console.log(`✓ ${resumo}`);
      // Host na lista que respondeu: a lista está errada, e dizer isso é a
      // metade que impede a dispensa de virar permanente por inércia.
      if (declarado) voltaramAoAlcance.add(host);
    } else if (estado === "morta") {
      mortas.push({ url, detalhe, campos: [...campos], familias: [...familias] });
      console.log(`✗ MORTA (${detalhe}) ${resumo}`);
    } else if (estado === "naoAlcancado" && declarado) {
      foraDeAlcance.push({ url, detalhe, host });
      console.log(`· fora de alcance deste executor (${detalhe}) ${resumo}`);
    } else {
      naoConferidas.push({ url, detalhe, campos: [...campos] });
      console.log(`⚠ não conferida (${detalhe}) ${resumo}`);
    }
    if (PAUSA_MS) await new Promise((r) => setTimeout(r, PAUSA_MS));
  }

  // O DENOMINADOR à vista. "68 ok" sozinho é lido como "68 de 68"; são 68 de 82.
  console.log(
    `\n${alvos.length} URL(s) no catálogo: ${ok} ok · ${mortas.length} morta(s) · ` +
    `${naoConferidas.length} não conferida(s) · ${foraDeAlcance.length} fora de alcance deste executor`,
  );

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

  if (foraDeAlcance.length) {
    const hosts = [...new Set(foraDeAlcance.map((f) => f.host))];
    console.log(
      `\nFORA DE ALCANCE DESTE EXECUTOR — ${foraDeAlcance.length} URL(s) em ` +
      `${hosts.length} host(s). NÃO foram conferidas aqui:`,
    );
    for (const h of hosts) console.log(`  · ${h}: ${FORA_DE_ALCANCE[h]}`);
    console.log(
      "\nIsto é limite declarado, não resultado: ninguém falou com esses hosts.\n" +
      "Para cobri-las, rode este script de uma rede que os alcance.",
    );
  }

  if (voltaramAoAlcance.size) {
    console.log(
      `\nA LISTA ENVELHECEU — ${voltaramAoAlcance.size} host(s) declarado(s) fora de ` +
      "alcance responderam:",
    );
    for (const h of voltaramAoAlcance) console.log(`  · ${h} — tire de FORA_DE_ALCANCE`);
    console.log(
      "\nDispensa que sobrevive ao motivo é a que esconde a próxima falha. Sai 2\n" +
      "para alguém mexer, e não 1: não há nada quebrado nas fontes.",
    );
  }

  // A ordem importa: morta é pior que não conferida, e o código de saída tem de
  // dizer a pior coisa que aconteceu. `foraDeAlcance` sozinho NÃO reprova — é
  // limite declarado, com motivo e medição, e o relatório acima o grita.
  const veredito = vereditoDasFontes({
    mortas: mortas.length,
    naoConferidas: naoConferidas.length,
    foraDeAlcance: foraDeAlcance.length,
    voltaramAoAlcance: voltaramAoAlcance.size,
  });
  if (veredito.codigo !== 0) process.exit(veredito.codigo);
  console.log(
    foraDeAlcance.length
      ? `\nTodas as ${ok} fontes alcançáveis daqui resolvem. ${foraDeAlcance.length} não foram conferidas.`
      : "\nTodas as fontes do catálogo resolvem.",
  );
}

// Só quando EXECUTADO, nunca quando importado.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await principal();
}
