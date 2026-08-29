#!/usr/bin/env node
/**
 * Dirige as três ferramentas num navegador de verdade e confere o que a tela
 * mostra contra o valor calculado à parte.
 *
 * Por que num navegador, se as bibliotecas já têm 763 testes:
 *
 * Os testes de unidade provam que `euroscore2.ts` e `mismatch.ts` calculam
 * certo. Não provam que a **tela** entrega esse número ao médico. Entre a
 * função e o olho dele há o formulário, o estado do React, o formato pt-BR, a
 * consulta ao Supabase e o roteador — e é exatamente aí que mora a família de
 * defeito que esta sessão persegue: a tela que afirma algo que o cálculo não
 * disse. Já apareceu duas vezes neste projeto (o "risco de 72%" que era
 * pontuação, e a "EOA publicada em 0 de 0 tamanhos" durante o carregamento).
 *
 * O valor esperado é calculado aqui, por fora, a partir da fórmula na fonte —
 * não importado de `src/`. Importar a mesma função que a tela usa faria o teste
 * comparar o código consigo mesmo e passar mesmo se a fórmula estivesse errada.
 *
 * ## O que este script já provou que pega
 *
 * Um verificador que sempre passa é a pior espécie de verde. Quatro mutações,
 * cada uma no código de produção, com `npm run build` e nova rodada:
 *
 *   1. expoente da altura em DuBois (0,725 → 0,735) — pega, 2 conferências
 *   2. constante do EuroSCORE II (−5,324537 → −5,224537) — pega
 *   3. continuidade com o raio sem elevar ao quadrado — pega, 2 conferências
 *   4. DVI invertido entre aórtica e mitral — pega
 *
 * A mutação 3 **escapou na primeira tentativa**, e o motivo vale registro: o
 * caso usava VSVE de 20 mm, que dá raio de exatamente 1 cm, e aí r × r = r. O
 * caso passou a ser 22 mm.
 *
 * Uso:
 *   npm run build && npx vite preview --port 4173 --host 127.0.0.1
 *   node scripts/ferramentas-verificar.mjs http://127.0.0.1:4173
 *
 * Precisa de `VITE_SUPABASE_PUBLISHABLE_KEY` no ambiente para a parte 3.
 *
 * **Contra produção, das partes 1 e 2, só fora deste contêiner.** Aqui o
 * Chromium recebe `ERR_CONNECTION_RESET` até no HTML de valvepath.com.br — o
 * egresso deste ambiente não o alcança. A parte 3 funciona de qualquer lugar,
 * porque fala com o RPC de produção por `fetch` do Node, que passa pelo proxy.
 * Quem quiser medir a tela publicada roda isto de uma máquina com internet;
 * daqui, o que cobre produção é `npm run smoke` (as 61 rotas) e a leitura dos
 * chunks que ela serve.
 */
import { execSync } from "node:child_process";

async function carregarPlaywright() {
  for (const alvo of ["playwright", "@playwright/test"]) {
    try { return await import(alvo); } catch { /* tenta o próximo */ }
  }
  try {
    return await import(`${execSync("npm root -g", { encoding: "utf8" }).trim()}/playwright/index.mjs`);
  } catch { /* cai no erro abaixo */ }
  console.error("Playwright não encontrado. `npm i -g playwright`.");
  process.exit(2);
}

const { chromium } = await carregarPlaywright();
const BASE = (process.argv[2] || "https://valvepath.com.br").replace(/\/$/, "");

// ---------------------------------------------------------------------------
// Os valores esperados, calculados aqui, a partir da fonte
// ---------------------------------------------------------------------------

/** DuBois: 0,007184 × altura^0,725 × peso^0,425, com altura em cm e peso em kg. */
const bsaDuBois = (cm, kg) => 0.007184 * cm ** 0.725 * kg ** 0.425;

/**
 * EuroSCORE II para o caso mínimo: só idade e sexo, tudo o mais na categoria de
 * referência. Coeficientes da Tabela 6 de Nashef 2012 (PMID 22378855).
 * y = constante + βidade·x + βsexo ; mortalidade = e^y / (1 + e^y).
 */
function euroscoreMinimo(idade, feminino) {
  const y = -5.324537 + 0.0285181 * (idade <= 60 ? 1 : idade - 59) + (feminino ? 0.2196434 : 0);
  return (100 * Math.exp(y)) / (1 + Math.exp(y));
}

const casos = [];
const falhas = [];
function conferir(nome, obtido, esperado, tolerancia = 0) {
  const ok = typeof esperado === "number"
    ? Math.abs(obtido - esperado) <= tolerancia
    : esperado.test(String(obtido));
  casos.push({ nome, obtido, esperado: String(esperado), ok });
  if (!ok) falhas.push(nome);
  console.log(`${ok ? "✓" : "✗"} ${nome}\n     tela: ${obtido}\n     esperado: ${esperado}`);
}

/**
 * Duas configurações que não são detalhe:
 *
 *  · **proxy** — o navegador deste contêiner só alcança a internet pelo proxy
 *    da sessão. Sem isto o Supabase não responde, o catálogo fica vazio e as
 *    conferências passam a medir uma tela em branco.
 *  · **`domcontentloaded` em vez de `networkidle`** — a fonte do Google não
 *    carrega aqui, então a rede nunca fica ociosa e o `networkidle` gastava os
 *    30 s de espera antes de olhar qualquer coisa.
 */
const PROXY = process.env["HTTPS_PROXY"] || process.env["https_proxy"];
const navegador = await chromium.launch({
  executablePath: process.env["PW_CHROMIUM"] || "/opt/pw-browsers/chromium",
  ...(PROXY ? { proxy: { server: PROXY, bypass: "127.0.0.1,localhost" } } : {}),
});
const pagina = await navegador.newPage({ viewport: { width: 1280, height: 1400 } });

/**
 * Erros da página. O texto do console não traz a URL ("Failed to load
 * resource: net::ERR_CONNECTION_RESET" e nada mais), então quem filtra é o
 * evento `requestfailed`, que traz a URL — senão a fonte do Google, que não
 * carrega neste contêiner, contaminaria o resultado para sempre.
 */
const erros = [];
const IGNORAR = /fonts\.(googleapis|gstatic)|favicon|manifest|supabase\.co/;
pagina.on("pageerror", (e) => erros.push(String(e)));
pagina.on("requestfailed", (r) => {
  if (!IGNORAR.test(r.url())) erros.push(`${r.failure()?.errorText} ${r.url()}`);
});

/** Preenche um campo pelo rótulo visível. */
async function preencher(rotulo, valor) {
  const campo = pagina.getByLabel(rotulo, { exact: false }).first();
  await campo.waitFor({ state: "visible", timeout: 15000 });
  await campo.fill(String(valor));
}

// ===========================================================================
// 1. EuroSCORE II
// ===========================================================================
console.log("\n=== EuroSCORE II ===");
await pagina.goto(`${BASE}/ferramentas/euroscore-ii`, { waitUntil: "domcontentloaded" });

const IDADE = 72, FEMININO = true;
await preencher("Idade (anos)", IDADE);
// O sexo é um seletor, não um campo de texto.
await pagina.getByRole("combobox").first().click();
await pagina.getByRole("option", { name: /feminino/i }).click();
await pagina.waitForTimeout(400);

const textoEuro = await pagina.locator("main").innerText();
const casada = textoEuro.match(/(\d+,\d+)\s*%/);
conferir(
  "EuroSCORE II: mortalidade prevista de mulher de 72 anos, resto na referência",
  casada ? Number(casada[1].replace(",", ".")) : NaN,
  euroscoreMinimo(IDADE, FEMININO),
  0.05,
);
conferir(
  "EuroSCORE II: a tela diz que o resultado é faixa enquanto faltam variáveis",
  textoEuro.replace(/\s+/g, " "),
  /faixa|melhor caso|pior caso|faltam|não informad/i,
);

// ===========================================================================
// 2. Gradiente e mismatch
// ===========================================================================
console.log("\n=== Gradiente e mismatch ===");
await pagina.goto(`${BASE}/ferramentas/mismatch`, { waitUntil: "domcontentloaded" });

const ALTURA = 165, PESO = 62;
await preencher("Altura (cm)", ALTURA);
await preencher("Peso (kg)", PESO);
const bsa = bsaDuBois(ALTURA, PESO);

// A superfície corporal aparece na própria tela: confere contra DuBois, que é
// recalculado aqui a partir da fórmula e não importado de `src/bsa.ts`.
const textoBsa = await pagina.locator("main").innerText();
const casadaBsa = textoBsa.match(/(\d,\d{2})\s*m²/);
conferir(
  `superfície corporal de ${ALTURA} cm / ${PESO} kg pela fórmula de DuBois`,
  casadaBsa ? Number(casadaBsa[1].replace(",", ".")) : NaN,
  bsa,
  0.006,
);

// A EOA de referência vem do catálogo, que este navegador não consegue baixar
// (ver a nota da parte 3). Mas a aba "Depois" não depende dele: ela trabalha
// com as medidas do eco digitadas, e é onde mora a equação de continuidade.
await pagina.getByRole("tab", { name: /Depois/ }).click();

// 22 mm, e não 20: com 20 mm o raio dá exatamente 1 cm, e aí r × r = r — uma
// mutação que trocasse o quadrado por multiplicação simples passaria batida.
// Foi o que aconteceu na primeira versão deste arquivo.
const D_VSVE = 22, VTI_VSVE = 22, VTI_PROT = 60, GRAD = 24, VEL = 3.2;
await preencher("Diâmetro da VSVE (mm)", D_VSVE);
await preencher("VTI da VSVE (cm)", VTI_VSVE);
await preencher("VTI da prótese (cm)", VTI_PROT);
await preencher("Gradiente médio (mmHg)", GRAD);
await preencher("Velocidade de pico (m/s)", VEL);
await pagina.waitForTimeout(500);

// Continuidade: EOA = (π/4 · d²) · VTI_VSVE ÷ VTI_prótese, com d em cm.
const areaVsve = Math.PI / 4 * (D_VSVE / 10) ** 2;
const eoaContinuidade = areaVsve * VTI_VSVE / VTI_PROT;
const textoDepois = await pagina.locator("main").innerText();
const casadaCont = textoDepois.match(/continuidade: (\d+,\d+) cm²/);
conferir(
  `continuidade: VSVE ${D_VSVE} mm, VTI ${VTI_VSVE} → ${VTI_PROT} cm`,
  casadaCont ? Number(casadaCont[1].replace(",", ".")) : NaN,
  eoaContinuidade,
  0.006,
);
// DVI aórtica = VTI_VSVE ÷ VTI_prótese. 22/60 = 0,367 — abaixo de 0,25 seria
// obstrução provável; entre 0,25 e 0,29, possível. Aqui está acima dos dois.
conferir(
  "DVI aórtica calculada como VTI da VSVE dividido pelo da prótese",
  (textoDepois.match(/DVI calculado \(VTI VSVE ÷ VTI prótese\):\s*(\d+,\d+)/) ?? [null, "(não achou)"])[1],
  new RegExp(`^${(VTI_VSVE / VTI_PROT).toFixed(2).replace(".", ",")}$`),
);
// iEOA medida = EOA da continuidade ÷ superfície corporal.
const casadaMedida = textoDepois.match(/(\d,\d{2})\s*cm²\/m²/);
conferir(
  "mismatch medido: iEOA é a EOA da continuidade indexada pela superfície corporal",
  casadaMedida ? Number(casadaMedida[1].replace(",", ".")) : NaN,
  eoaContinuidade / bsa,
  0.006,
);

// ===========================================================================
// 3. Catálogo e recomendador — pelos dados que produção realmente serve
// ===========================================================================
//
// Por que esta parte NÃO passa pelo navegador: o Chromium deste contêiner
// recebe `ERR_CONNECTION_RESET` na resposta do RPC do catálogo (~150 kB), e a
// tela fica em "Carregando o catálogo…" para sempre. É limitação do egresso
// daqui, não da página — em produção a mesma chamada responde 200. Fingir que
// mediu isso num navegador que não alcança o banco seria justamente o verde
// vazio que este script existe para impedir.
//
// O que se faz então: pega o mesmo RPC público que a tela consome e recalcula,
// por fora, o que a tela deveria mostrar. As regras são reescritas aqui a
// partir da fonte — se importasse `recomendacaoProtese.ts`, a conferência
// compararia o código consigo mesmo.
console.log("\n=== Catálogo e recomendador (contra o RPC público) ===");

const SUPABASE = "https://qwiojyfxzvdcfbbexyxg.supabase.co";
const CHAVE = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
if (!CHAVE) {
  console.log("  (pulado: falta VITE_SUPABASE_PUBLISHABLE_KEY no ambiente)");
} else {
  const resp = await fetch(`${SUPABASE}/rest/v1/rpc/catalogo_proteses`, {
    method: "POST",
    headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json" },
    body: "{}",
  });
  const linhas = await resp.json();
  conferir("catálogo: o RPC público responde sem sessão", resp.status, 200);
  conferir("catálogo: e devolve linhas", Array.isArray(linhas) ? linhas.length : 0, /^[1-9]\d+$/);

  const comEoa = linhas.filter((l) => l.effective_orifice_area != null);
  conferir(
    "catálogo: nenhuma EOA gravada sem fonte citável",
    comEoa.filter((l) => !l.eoa_source_url).length,
    0,
  );
  conferir(
    "catálogo: nenhum tamanho acima de 42 mm",
    linhas.filter((l) => Number(l.size) > 42).length,
    0,
  );
  conferir(
    "catálogo: todo alerta traz link e data",
    linhas.filter((l) => l.advisory && (!l.advisory_url || !l.advisory_date)).length,
    0,
  );

  // O caso que motivou o alerta: mulher de 1,55 m / 60 kg. Antes da correção o
  // recomendador sugeria "Trifecta GT 19 mm" para ela — uma válvula que a
  // Abbott retirou do mercado em 2023 por falhar cedo.
  const bsaCaso = bsaDuBois(155, 60);
  const SUB = new Set(["biologica_aortica", "biologica_mitral", "mecanica", "tavi"]);
  const passam = linhas.filter(
    (l) => SUB.has(l.type) && l.valve_position === "aortica" &&
      l.effective_orifice_area != null && l.effective_orifice_area / bsaCaso > 0.85,
  );
  // A pergunta certa aqui não é "o recomendador exclui a Trifecta?" — isso é
  // teste de unidade, e existe. É "a exclusão ainda é necessária?". Se um dia
  // nenhuma prótese com alerta passasse do limiar, a guarda estaria decorativa
  // e ninguém perceberia que ela parou de proteger de alguma coisa.
  const comAlertaQuePassariam = passam.filter((l) => l.advisory);
  conferir(
    `recomendador: a exclusão por alerta ainda é necessária — ${comAlertaQuePassariam.length} tamanho(s) ` +
      "com alerta passariam do limiar numa paciente de 1,55 m / 60 kg",
    comAlertaQuePassariam.length,
    /^[1-9]/,
  );
  conferir(
    "recomendador: e todos eles estão marcados, com link e data",
    comAlertaQuePassariam.filter((l) => l.advisory_url && l.advisory_date).length,
    comAlertaQuePassariam.length,
  );
  conferir(
    "recomendador: a Trifecta GT segue no catálogo, para quem já a tem implantada",
    linhas.filter((l) => l.model_name === "Trifecta GT" && l.advisory === "retirada_do_mercado").length,
    /^[1-9]/,
  );

  /**
   * Foto e motivo, conferidos nos DOIS sentidos contra o catálogo servido.
   *
   * O sentido óbvio — família sem foto tem de ter motivo escrito — é o que
   * impede o cartão de aparecer vazio sem explicar se ninguém procurou ou se
   * procurou-se e não há.
   *
   * O sentido inverso é o que pega o defeito de verdade, e pegou: a Medtronic
   * Avalus ganhou foto oficial nesta rodada e continuava listada em
   * `BUSCA_DE_FOTOS` com o motivo "medtronic.com responde 'Incorrect Browser'".
   * O motivo não aparecia em lugar nenhum, porque a família tinha foto — ficava
   * ali, invisível e falso, esperando alguém lê-lo como afirmação conferida.
   * Registro que sobrevive ao fato que o gerou é a forma mais silenciosa de
   * mentir de que este projeto trata.
   *
   * Importar o `.ts` direto é seguro aqui porque o que se compara é **dado**
   * declarado contra o catálogo real — não é a mesma fórmula calculando os dois
   * lados, que é o que esta verificação evita em todo o resto.
   */
  const { BUSCA_DE_FOTOS, VARREDURA_DE_ALERTAS } = await import("../src/data/buscaDeFontes.ts");
  const porFamilia = new Map();
  for (const l of linhas) {
    const k = `${l.manufacturer}|${l.model_name}`;
    porFamilia.set(k, (porFamilia.get(k) ?? false) || Boolean(l.image_url));
  }
  const declarados = new Set(BUSCA_DE_FOTOS.map((b) => b.familia));
  const semFotoSemMotivo = [...porFamilia].filter(([k, tem]) => !tem && !declarados.has(k)).map(([k]) => k);
  const comFotoComMotivo = [...porFamilia].filter(([k, tem]) => tem && declarados.has(k)).map(([k]) => k);
  const motivoDeFamiliaInexistente = [...declarados].filter((k) => !porFamilia.has(k));

  conferir(
    `fotos: família sem foto tem motivo registrado${semFotoSemMotivo.length ? ` — falta: ${semFotoSemMotivo.join(", ")}` : ""}`,
    semFotoSemMotivo.length,
    0,
  );
  conferir(
    `fotos: nenhum motivo sobrevive à foto que o desmente${comFotoComMotivo.length ? ` — sobrou: ${comFotoComMotivo.join(", ")}` : ""}`,
    comFotoComMotivo.length,
    0,
  );
  conferir(
    `fotos: nenhum motivo aponta para família fora do catálogo${motivoDeFamiliaInexistente.length ? ` — órfão: ${motivoDeFamiliaInexistente.join(", ")}` : ""}`,
    motivoDeFamiliaInexistente.length,
    0,
  );

  /**
   * A varredura de alerta cobre o catálogo inteiro — conferido pelos nomes.
   *
   * A tela anunciava "1 com alerta; 19 conferidos e sem alerta" enquanto o
   * catálogo tinha 45 famílias: 26 nunca varridas, e a frase não dizia isso.
   * Contar só o que foi feito, sem contar o que falta, é a forma mais comum de
   * um relatório mentir sem escrever nada falso — e num catálogo de próteses o
   * preço disso é uma família recolhida passando por limpa.
   *
   * Por nome, e não por tamanho de lista: se um nome sair da varredura enquanto
   * outro entra no catálogo, a soma continua batendo e a lacuna some.
   */
  const varridas = new Set([
    ...VARREDURA_DE_ALERTAS.comAlerta,
    ...VARREDURA_DE_ALERTAS.achadoSemImpactoNaIndicacao.map((a) => a.familia),
    ...VARREDURA_DE_ALERTAS.semAlerta,
  ]);
  const naoVarridas = [...porFamilia.keys()].filter((k) => !varridas.has(k));
  const varreuFantasma = [...varridas].filter((k) => !porFamilia.has(k));
  const emDuasListas = [...varridas].filter(
    (k) =>
      [VARREDURA_DE_ALERTAS.comAlerta.includes(k),
       VARREDURA_DE_ALERTAS.achadoSemImpactoNaIndicacao.some((a) => a.familia === k),
       VARREDURA_DE_ALERTAS.semAlerta.includes(k)].filter(Boolean).length > 1,
  );

  conferir(
    `alertas: a varredura cobre as ${porFamilia.size} famílias do catálogo${naoVarridas.length ? ` — falta: ${naoVarridas.join(", ")}` : ""}`,
    naoVarridas.length,
    0,
  );
  conferir(
    `alertas: nenhuma família varrida saiu do catálogo${varreuFantasma.length ? ` — fantasma: ${varreuFantasma.join(", ")}` : ""}`,
    varreuFantasma.length,
    0,
  );
  conferir(
    // "Com alerta" e "sem achado" ao mesmo tempo faria a contagem da tela somar
    // mais famílias do que existem, e a tela pareceria conferida demais.
    `alertas: nenhuma família em duas listas ao mesmo tempo${emDuasListas.length ? ` — duplicada: ${emDuasListas.join(", ")}` : ""}`,
    emDuasListas.length,
    0,
  );

  // A ordem dos fabricantes, recalculada da mesma regra escrita na tela.
  const cobertura = new Map();
  for (const l of linhas) {
    if (!SUB.has(l.type) || l.valve_position !== "aortica" || l.effective_orifice_area == null) continue;
    const c = cobertura.get(l.manufacturer) ?? { n: 0, modelos: new Set() };
    c.n++; c.modelos.add(l.model_name);
    cobertura.set(l.manufacturer, c);
  }
  const ordem = [...cobertura].sort(
    (a, b) => b[1].n - a[1].n || b[1].modelos.size - a[1].modelos.size || a[0].localeCompare(b[0], "pt-BR"),
  );
  conferir(
    `ordem por cobertura na aórtica (${ordem.map(([f, c]) => `${f} ${c.n}/${c.modelos.size}`).join(", ")})`,
    ordem[0]?.[0] ?? "(nenhum)",
    /^Edwards$/,
  );
}

console.log("\n=== erros de console ===");
const relevantes = erros;
if (relevantes.length) {
  for (const e of relevantes.slice(0, 10)) console.log("  " + e.slice(0, 200));
  falhas.push("erros de console na página");
} else {
  console.log("  nenhum");
}

await navegador.close();

console.log(`\n${casos.length - falhas.length} de ${casos.length} conferências passaram — ${BASE}`);
if (falhas.length) {
  console.log("\nFALHOU:");
  for (const f of falhas) console.log("  · " + f);
  process.exit(1);
}
