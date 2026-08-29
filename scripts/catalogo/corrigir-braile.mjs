#!/usr/bin/env node
/**
 * Corrige o catálogo da Braile contra os catálogos oficiais do fabricante.
 *
 * ## O erro que motivou
 *
 * O catálogo trazia **"Braile Biocor"**, aórtica e mitral. A Braile não vende, e
 * nunca vendeu, nada chamado Biocor: Biocor era a *Biocor Indústria e Pesquisas*,
 * comprada pela St. Jude Medical, hoje a linha **Epic da Abbott**. Ou seja, um
 * produto brasileiro estava catalogado com o nome comercial de outro fabricante
 * — e o mesmo catálogo lista a Epic da Abbott logo acima, com esse nome.
 *
 * Não é erro de digitação. Para o cirurgião, dois nomes diferentes apontando
 * para a mesma linhagem, e um deles no fabricante errado, é confusão em cima da
 * escolha da prótese.
 *
 * ## E os tamanhos também estavam errados
 *
 * Ao trocar o nome fui conferir os tamanhos no catálogo do próprio fabricante
 * (código 261904, revisão 03), e a tabela de especificações mostra que a
 * aórtica vai até **29 mm** e a mitral até **35 mm**. Aqui parava em 27 e 33.
 * Faltavam quatro tamanhos que a Braile vende.
 *
 * ## O que este script faz
 *
 * 1. Renomeia `Biocor` para o nome de catálogo do fabricante e grava as
 *    dimensões oficiais na descrição de cada tamanho.
 * 2. Cria os tamanhos que faltavam (aórtica 29, mitral 35).
 * 3. Renomeia `Inovare` para **Inovare Alpha**, que é como o produto se chama.
 * 4. Cria a família **Vivere**, que a Braile vende e não estava aqui.
 * 5. Cria os dois anéis de anuloplastia (Braile e Gregori), com os tamanhos do
 *    catálogo de cada um.
 * 6. Aplica as fotos oficiais — todas abertas e olhadas antes.
 *
 * ## O que este script NÃO faz
 *
 * Não grava a EOA das tabelas do fabricante em `effective_orifice_area`. São
 * números de ficha de produto, sem coorte, sem n e sem desvio; o catálogo irmão
 * da mesma empresa (Vivere) traz tabela idêntica em formato com "*Resultados in
 * vitro*" escrito embaixo, e desvio de ±0,01 cm² — precisão que ensaio clínico
 * não tem. Alimentar o recomendador com isso faria a ferramenta projetar
 * mismatch a partir de bancada. Os valores ficam registrados em
 * `braile-catalogo-oficial.json`, com a ressalva.
 *
 * Uso: SUPABASE_SERVICE_ROLE_KEY=... node scripts/catalogo/corrigir-braile.mjs [--seco]
 */
import { readFileSync } from "node:fs";

const BASE = "https://qwiojyfxzvdcfbbexyxg.supabase.co";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!SR) {
  console.error("Falta SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(1);
}
const seco = process.argv.includes("--seco");
const cab = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };

const oficial = JSON.parse(
  readFileSync(new URL("./braile-catalogo-oficial.json", import.meta.url), "utf8"),
);

const PAGINA = {
  pericardio: "https://braile.com.br/produto/protese-valvular-organica-biologica-de-pericardio-bovino/",
  vivere: "https://braile.com.br/produto/vivere/",
  inovare: "https://braile.com.br/produto/inovare-alpha/",
  anelBraile: "https://braile.com.br/produto/anel-para-anuloplastia-valvar-rigido-braile/",
  anelGregori: "https://braile.com.br/produto/anel-para-anuloplastia-valvar-rigido-gregori/",
};

/**
 * Fotos oficiais, cada uma aberta e conferida à vista antes de entrar aqui.
 * O que cada uma mostra está escrito, porque nome de arquivo já enganou antes.
 */
const FOTO = {
  pericardio: {
    url: "https://braile.com.br/wp-content/uploads/2026/02/Frame-491.avif",
    vi: "bioprótese de pericárdio bovino em corte, cúspides creme sobre anel de sutura branco com marcadores pretos",
  },
  vivere: {
    url: "https://braile.com.br/wp-content/uploads/2026/02/valvula_vivere_v2_2-scaled.avif",
    vi: "prótese de pericárdio bovino de perfil baixo, vista de cima, com anel de sutura estriado",
  },
  inovare: {
    url: "https://braile.com.br/wp-content/uploads/2026/06/BRAILE_INOVARE_STILL_03_v01fio-sem-ponto-scaled.avif",
    vi: "válvula transcateter montada e crimpada sobre o balão de liberação",
  },
  anelBraile: {
    url: "https://braile.com.br/wp-content/uploads/2026/02/Anel-rigido-Braile.avif",
    vi: "anel completo e fechado, em D, revestido de poliéster",
  },
  anelGregori: {
    url: "https://braile.com.br/wp-content/uploads/2026/02/anel-para-anuloplastia-valvar-rigido-gregori.avif",
    vi: "banda posterior aberta, em C — bate com a descrição de semicírculo do catálogo",
  },
};

const pt = (n) => String(n).replace(".", ",");

/** A frase de dimensões que vai na descrição de cada tamanho. */
function dimensoes([tam, a, b, c, d, e]) {
  return (
    `Diâmetro interno ${pt(a)} mm · externo ${pt(b)} mm · anel de sutura ${pt(c)} mm · ` +
    `altura da haste ${pt(d)} mm · altura total ${pt(e)} mm.`
  );
}

const linhasNovas = [];
const renomear = [];

// ---------------------------------------------------------------------------
// 1 e 2. Pericárdio bovino: nome certo, dimensões, tamanhos que faltavam
// ---------------------------------------------------------------------------
const NOME_PERICARDIO = "Prótese de Pericárdio Bovino";
const NOTA_NOME =
  "Nome de catálogo do fabricante: Prótese Valvular Orgânica Biológica de Pericárdio Bovino " +
  "(ANVISA 10159030026). Encurtado aqui para caber no cartão.";

renomear.push({
  de: "Biocor",
  para: NOME_PERICARDIO,
  motivo: "Biocor é a linhagem St. Jude → Abbott, não um produto da Braile",
});

for (const posicao of ["aortica", "mitral"]) {
  const tipo = posicao === "aortica" ? "biologica_aortica" : "biologica_mitral";
  for (const linha of oficial.pericardio_bovino[posicao]) {
    linhasNovas.push({
      manufacturer: "Braile", model_name: NOME_PERICARDIO, valve_position: posicao, type: tipo,
      size: linha[0], display_order: posicao === "aortica" ? 71 : 72,
      description: `${NOTA_NOME} ${dimensoes(linha)}`,
      reference_url: PAGINA.pericardio, image_url: FOTO.pericardio.url,
    });
  }
}

// ---------------------------------------------------------------------------
// 3. Inovare -> Inovare Alpha
// ---------------------------------------------------------------------------
renomear.push({ de: "Inovare", para: "Inovare Alpha", motivo: "é como o produto se chama hoje" });

// ---------------------------------------------------------------------------
// 4. Vivere
// ---------------------------------------------------------------------------
for (const posicao of ["aortica", "mitral"]) {
  const tipo = posicao === "aortica" ? "biologica_aortica" : "biologica_mitral";
  for (const linha of oficial.vivere[posicao]) {
    linhasNovas.push({
      manufacturer: "Braile", model_name: "Vivere", valve_position: posicao, type: tipo,
      size: linha[0], display_order: posicao === "aortica" ? 73 : 74,
      description:
        "Prótese de pericárdio bovino com tratamento anticalcificante REALOG® (ANVISA 10159030107). " +
        dimensoes(linha),
      reference_url: PAGINA.vivere, image_url: FOTO.vivere.url,
    });
  }
}

// ---------------------------------------------------------------------------
// 5. Os dois anéis
// ---------------------------------------------------------------------------
const [anelBraile, anelGregori] = oficial.aneis;
for (const t of anelBraile.tamanhos) {
  linhasNovas.push({
    manufacturer: "Braile", model_name: "Anel Rígido Braile", valve_position: "mitral",
    type: "anel_anuloplastia", size: t[0], display_order: 75,
    description:
      `Anel rígido completo para anuloplastia mitral, aço inoxidável em tubo de silicone revestido ` +
      `de poliéster (ANVISA 10159030076). Área do orifício ${t[5]} mm².`,
    reference_url: PAGINA.anelBraile, image_url: FOTO.anelBraile.url,
  });
}
for (const t of anelGregori.tamanhos) {
  linhasNovas.push({
    manufacturer: "Braile", model_name: "Anel Rígido Gregori", valve_position: "mitral",
    type: "anel_anuloplastia", size: t[0], display_order: 76,
    description:
      "Anel rígido aberto para anuloplastia mitral, em semicírculo com trecho retificado que " +
      "corresponde à comissura póstero-medial; aberto para permitir crescimento do anel " +
      `(ANVISA 10159030076). Comprimento ${pt(t[1])} mm · largura ${pt(t[2])} mm.`,
    reference_url: PAGINA.anelGregori, image_url: FOTO.anelGregori.url,
  });
}

// ===========================================================================
// Execução
// ===========================================================================
const atual = await fetch(
  `${BASE}/rest/v1/prosthesis_catalog?select=id,model_name,valve_position,size&manufacturer=eq.Braile`,
  { headers: cab },
);
if (!atual.ok) { console.error(`leitura falhou: ${atual.status}`); process.exit(1); }
const existentes = await atual.json();
const porChave = new Map(
  existentes.map((x) => [`${x.model_name}|${x.valve_position}|${Number(x.size)}`, x.id]),
);

console.log(`Braile hoje: ${existentes.length} linhas\n`);

// --- renomeações -----------------------------------------------------------
for (const r of renomear) {
  const alvo = existentes.filter((x) => x.model_name === r.de);
  if (!alvo.length) { console.log(`= "${r.de}" já não existe`); continue; }
  console.log(`~ "${r.de}" -> "${r.para}" (${alvo.length} linhas) — ${r.motivo}`);
  if (!seco) {
    const resp = await fetch(
      `${BASE}/rest/v1/prosthesis_catalog?manufacturer=eq.Braile&model_name=eq.${encodeURIComponent(r.de)}`,
      { method: "PATCH", headers: { ...cab, Prefer: "return=minimal" }, body: JSON.stringify({ model_name: r.para }) },
    );
    if (!resp.ok) console.error(`  FALHOU: ${resp.status} ${(await resp.text()).slice(0, 160)}`);
  }
  // O mapa é atualizado TAMBÉM no ensaio a seco. Sem isto, a simulação anunciava
  // "CRIA Prótese de Pericárdio Bovino|aortica|19" para uma linha que já existe
  // sob o nome antigo — e o relatório do ensaio mentia sobre o que a execução
  // real faria. Ensaio que não simula o próprio efeito não é ensaio.
  for (const x of alvo) x.model_name = r.para;
  porChave.clear();
  for (const x of existentes) porChave.set(`${x.model_name}|${x.valve_position}|${Number(x.size)}`, x.id);
}

// --- Inovare Alpha: página e foto -----------------------------------------
if (!seco) {
  await fetch(
    `${BASE}/rest/v1/prosthesis_catalog?manufacturer=eq.Braile&model_name=eq.Inovare%20Alpha`,
    { method: "PATCH", headers: { ...cab, Prefer: "return=minimal" },
      body: JSON.stringify({ reference_url: PAGINA.inovare, image_url: FOTO.inovare.url }) },
  );
}
console.log(`+ Inovare Alpha: foto e página do fabricante`);

// --- linhas: cria o que falta, atualiza o que existe ------------------------
let criadas = 0, atualizadas = 0;
for (const nova of linhasNovas) {
  const chave = `${nova.model_name}|${nova.valve_position}|${nova.size}`;
  const id = porChave.get(chave);
  if (seco) { console.log(`  [seco] ${id ? "atualiza" : "CRIA"} ${chave}`); id ? atualizadas++ : criadas++; continue; }
  const alvo = id
    ? `${BASE}/rest/v1/prosthesis_catalog?id=eq.${id}`
    : `${BASE}/rest/v1/prosthesis_catalog`;
  const resp = await fetch(alvo, {
    method: id ? "PATCH" : "POST",
    headers: { ...cab, Prefer: "return=minimal" },
    body: JSON.stringify(id ? { ...nova, manufacturer: undefined } : { ...nova, active: true }),
  });
  if (!resp.ok) { console.error(`  FALHOU ${chave}: ${resp.status} ${(await resp.text()).slice(0, 160)}`); continue; }
  id ? atualizadas++ : criadas++;
}

console.log(`\n${criadas} criada(s) · ${atualizadas} atualizada(s)${seco ? " (simulação)" : ""}`);
console.log("\nFotos aplicadas, todas conferidas à vista:");
for (const [k, v] of Object.entries(FOTO)) console.log(`  ${k.padEnd(12)} ${v.vi}`);
