/**
 * Cria linhas de catálogo para tamanhos que o fabricante vende e a fonte
 * publica, mas que o catálogo não tinha.
 *
 * De onde veio a lista: a segunda leitura das Tabelas A4 e A5 da ASE 2024 (ver
 * `eoa-ase-2024.json`, chave `_segunda_leitura`) devolveu sete pares
 * modelo×tamanho com dado publicado e **sem linha correspondente aqui**. O
 * `aplicar-eoa.mjs` avisa desses casos em vez de os descartar em silêncio — foi
 * esse aviso que gerou este script.
 *
 * As três famílias:
 *
 *   · **Abbott Epic aórtica 29 mm** — a Abbott vende o 29; o catálogo parava no
 *     27. A tabela A4 traz EOA 2,4 ± 1,1 cm².
 *   · **Abbott Epic mitral 33 mm** — mesma coisa na mitral, que vai de 25 a 33.
 *   · **Edwards Perimount mitral 25 a 33 mm** — a Perimount mitral (modelo
 *     6900) existia só na aórtica aqui. É a linha 'Carpentier-Edwards
 *     Perimount, stented pericardial' da A5, com EOA em todos os cinco
 *     tamanhos. NÃO é a Magna Mitral Ease (7300TFX), que é a geração seguinte e
 *     não está na tabela — por isso entra como família própria, e não como
 *     valor emprestado para a Magna.
 *
 * Idempotente: confere antes se a linha já existe, pela chave
 * fabricante+modelo+posição+tamanho.
 *
 * Uso: SUPABASE_SERVICE_ROLE_KEY=... node scripts/catalogo/criar-linhas-faltantes.mjs [--seco]
 */
const BASE = "https://qwiojyfxzvdcfbbexyxg.supabase.co";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!SR) {
  console.error("Falta SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(1);
}
const seco = process.argv.includes("--seco");
const cab = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };

/**
 * A EOA NÃO entra aqui. Estas linhas nascem vazias e o `aplicar-eoa.mjs` as
 * preenche a partir da fonte, como todas as outras — assim existe um único
 * lugar que grava dado clínico, com um único rótulo de procedência.
 */
const NOVAS = [
  {
    manufacturer: "Abbott", model_name: "Epic", valve_position: "aortica",
    type: "biologica_aortica", size: 29, display_order: 21,
    description: "Bioprótese porcina aórtica com stent, tecido tratado com Linx AC.",
    reference_url: "https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valve-solutions.html",
  },
  {
    manufacturer: "Abbott", model_name: "Epic", valve_position: "mitral",
    type: "biologica_mitral", size: 33, display_order: 22,
    description: "Bioprótese porcina mitral com stent, tecido tratado com Linx AC.",
    reference_url: "https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valve-solutions.html",
  },
  ...[25, 27, 29, 31, 33].map((size) => ({
    manufacturer: "Edwards", model_name: "Perimount", valve_position: "mitral",
    type: "biologica_mitral", size, display_order: 13,
    description:
      "Bioprótese pericárdica bovina mitral Carpentier-Edwards Perimount (modelo 6900). " +
      "Geração anterior à Magna Mitral Ease.",
    reference_url: "https://www.edwards.com/healthcare-professionals/products-services/surgical-heart/mitral",
  })),
];

const r = await fetch(
  `${BASE}/rest/v1/prosthesis_catalog?select=manufacturer,model_name,valve_position,size`,
  { headers: cab },
);
if (!r.ok) { console.error(`leitura falhou: ${r.status}`); process.exit(1); }
const existentes = new Set(
  (await r.json()).map((x) => `${x.manufacturer}|${x.model_name}|${x.valve_position}|${Number(x.size)}`),
);

let criadas = 0, jaExistiam = 0;
for (const nova of NOVAS) {
  const chave = `${nova.manufacturer}|${nova.model_name}|${nova.valve_position}|${nova.size}`;
  if (existentes.has(chave)) { console.log(`= ${chave} já existe`); jaExistiam++; continue; }
  if (seco) { console.log(`+ [seco] ${chave}`); criadas++; continue; }
  const ins = await fetch(`${BASE}/rest/v1/prosthesis_catalog`, {
    method: "POST",
    headers: { ...cab, Prefer: "return=minimal" },
    body: JSON.stringify({ ...nova, active: true }),
  });
  if (!ins.ok) { console.error(`✗ ${chave}: ${ins.status} ${(await ins.text()).slice(0, 200)}`); continue; }
  console.log(`+ ${chave}`);
  criadas++;
}
console.log(`\n${criadas} linha(s) criada(s)${seco ? " (simulação)" : ""} · ${jaExistiam} já existiam`);
