#!/usr/bin/env node
/**
 * Corrige o catálogo da Meril contra os folhetos do próprio fabricante.
 *
 * ## O que estava errado
 *
 * Nas duas direções, que é o que torna o caso interessante:
 *
 * **Faltando.** A Dafodil vai a 29 mm na aórtica e começa em 23 mm na mitral
 * (modelos DDL29A e DDL23M). Aqui parava em 27 e começava em 25. A Miltonia
 * mitral vai de 23 a 33; aqui só havia 29 e 31 — quatro tamanhos ausentes.
 *
 * **Sobrando.** A Miltonia aórtica tinha um **17 mm que não existe**. A tabela
 * de pedido do fabricante não tem 17: a linha para anel pequeno é a série
 * *Advanced Performance*, com catálogo MLT16AP, MLT18AP e MLT20AP e anel
 * tecidual de 16,2 / 18,2 / 20,2 mm. Alguém inventou um 17 no meio do caminho, e
 * ele estava sendo oferecido a quem escolhe prótese para anel estreito — que é
 * exatamente o paciente em que errar o tamanho custa caro.
 *
 * ## O que este script faz com o 17 mm
 *
 * `active = false`, não apagar. A linha some do RPC público e do recomendador,
 * e a descrição passa a dizer por quê. Diferente do caso da Trifecta, aqui
 * desativar é o certo: a Trifecta existe e há pacientes com ela implantada; o
 * 17 mm da Miltonia nunca existiu, então não há paciente para consultar.
 *
 * ## O que NÃO entra
 *
 * A coluna de área do folheto da Miltonia é **Geometric Orifice Area** — área do
 * desenho da válvula, não do jato no paciente. É sempre maior que a EOA efetiva.
 * Fica na descrição, com o nome certo, e longe de `effective_orifice_area`.
 *
 * Dafodil Neo e Flomero, que a Meril vende e não estão no catálogo, ficam de
 * fora com o motivo registrado em `meril-catalogo-oficial.json`: a Neo não tem
 * folheto próprio (o link serve o da Dafodil comum) e o da Flomero está marcado
 * DRAFT. Rascunho do fabricante não é fonte.
 *
 * Uso: SUPABASE_SERVICE_ROLE_KEY=... node scripts/catalogo/corrigir-meril.mjs [--seco]
 */
import { readFileSync } from "node:fs";

const BASE = "https://qwiojyfxzvdcfbbexyxg.supabase.co";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!SR) { console.error("Falta SUPABASE_SERVICE_ROLE_KEY no ambiente."); process.exit(1); }
const seco = process.argv.includes("--seco");
const cab = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };

const oficial = JSON.parse(
  readFileSync(new URL("./meril-catalogo-oficial.json", import.meta.url), "utf8"),
);

const PAGINA = {
  dafodil: "https://www.merillife.com/our-products/cardiac-surgery/dafodil-pericardial-bioprosthesis",
  miltonia: "https://www.merillife.com/our-products/cardiac-surgery/miltonia",
};
/** Foto oficial, aberta e olhada antes de entrar. */
const FOTO = {
  dafodil: "https://strapi.merillife.com/uploads/Dafodil_Pericardial_Bioprosthesis_1_967fa8ffc0.png",
  miltonia: "https://strapi.merillife.com/uploads/Miltonia_9491014410.png",
};

const pt = (n) => String(n).replace(".", ",");
const linhas = [];

// --- Dafodil ---------------------------------------------------------------
for (const [i, l] of oficial.dafodil.aortica.linhas.entries()) {
  const [tam, anel, interno, sutura, altura] = l;
  linhas.push({
    manufacturer: "Meril", model_name: "Dafodil", valve_position: "aortica",
    type: "biologica_aortica", size: tam, display_order: 27,
    description:
      `Bioprótese pericárdica bovina aórtica com stent, tecido tratado com AntiCa+ ` +
      `(modelo ${oficial.dafodil.aortica.modelos[i]}). Anel tecidual ${pt(anel)} mm · ` +
      `diâmetro interno do stent ${pt(interno)} mm · anel de sutura ${pt(sutura)} mm · ` +
      `altura total ${pt(altura)} mm.`,
    reference_url: PAGINA.dafodil, image_url: FOTO.dafodil,
  });
}
for (const [i, l] of oficial.dafodil.mitral.linhas.entries()) {
  linhas.push({
    manufacturer: "Meril", model_name: "Dafodil", valve_position: "mitral",
    type: "biologica_mitral", size: l[0], display_order: 28,
    description:
      `Bioprótese pericárdica bovina mitral com stent, tecido tratado com AntiCa+ ` +
      `(modelo ${oficial.dafodil.mitral.modelos[i]}). Diâmetro do stent ${pt(l[1])} mm.`,
    reference_url: PAGINA.dafodil, image_url: FOTO.dafodil,
  });
}

// --- Miltonia --------------------------------------------------------------
const descMiltonia = (mod, [, anel, sutura, orificio, area, altura], extra = "") =>
  `Válvula mecânica bivalvular de carbono pirolítico (modelo ${mod})${extra}. ` +
  `Anel tecidual ${pt(anel)} mm · anel de sutura ${pt(sutura)} mm · ` +
  `orifício interno ${pt(orificio)} mm · altura ${pt(altura)} mm. ` +
  `Área GEOMÉTRICA do orifício ${pt(area)} cm² — é medida do desenho da válvula, ` +
  `não a EOA efetiva medida no paciente, que é sempre menor.`;

for (const [i, l] of oficial.miltonia.aortica_padrao.linhas.entries()) {
  linhas.push({
    manufacturer: "Meril", model_name: "Miltonia", valve_position: "aortica",
    type: "mecanica", size: l[0], display_order: 29,
    description: descMiltonia(oficial.miltonia.aortica_padrao.modelos[i], l),
    reference_url: PAGINA.miltonia, image_url: FOTO.miltonia,
  });
}
for (const [i, l] of oficial.miltonia.aortica_ap.linhas.entries()) {
  linhas.push({
    manufacturer: "Meril", model_name: "Miltonia AP", valve_position: "aortica",
    type: "mecanica", size: l[0], display_order: 30,
    description: descMiltonia(
      oficial.miltonia.aortica_ap.modelos[i], l,
      ", série Advanced Performance: mesmo anel de sutura da padrão um número acima, para anel tecidual menor",
    ),
    reference_url: PAGINA.miltonia, image_url: FOTO.miltonia,
  });
}
for (const [i, l] of oficial.miltonia.mitral.linhas.entries()) {
  linhas.push({
    manufacturer: "Meril", model_name: "Miltonia", valve_position: "mitral",
    type: "mecanica", size: l[0], display_order: 29,
    description: descMiltonia(oficial.miltonia.mitral.modelos[i], l),
    reference_url: PAGINA.miltonia, image_url: FOTO.miltonia,
  });
}

/** Tamanhos que estão no catálogo e não existem na tabela do fabricante. */
const INEXISTENTES = [
  {
    model_name: "Miltonia", valve_position: "aortica", size: 17,
    motivo:
      "Este tamanho não existe. A tabela de pedido da Meril não lista 17 mm: a linha para anel " +
      "pequeno é a série Advanced Performance (MLT16AP, MLT18AP, MLT20AP), com anel tecidual de " +
      "16,2, 18,2 e 20,2 mm. Desativado em vez de apagado, para o erro ficar rastreável.",
  },
];

// ===========================================================================
const atual = await fetch(
  `${BASE}/rest/v1/prosthesis_catalog?select=id,model_name,valve_position,size&manufacturer=eq.Meril`,
  { headers: cab },
);
if (!atual.ok) { console.error(`leitura falhou: ${atual.status}`); process.exit(1); }
const existentes = await atual.json();
const porChave = new Map(
  existentes.map((x) => [`${x.model_name}|${x.valve_position}|${Number(x.size)}`, x.id]),
);
console.log(`Meril hoje: ${existentes.length} linhas\n`);

let criadas = 0, atualizadas = 0, desativadas = 0;
for (const nova of linhas) {
  const chave = `${nova.model_name}|${nova.valve_position}|${nova.size}`;
  const id = porChave.get(chave);
  if (seco) { console.log(`  [seco] ${id ? "atualiza" : "CRIA    "} ${chave}`); id ? atualizadas++ : criadas++; continue; }
  const resp = await fetch(
    id ? `${BASE}/rest/v1/prosthesis_catalog?id=eq.${id}` : `${BASE}/rest/v1/prosthesis_catalog`,
    { method: id ? "PATCH" : "POST", headers: { ...cab, Prefer: "return=minimal" },
      body: JSON.stringify(id ? { ...nova, manufacturer: undefined } : { ...nova, active: true }) },
  );
  if (!resp.ok) { console.error(`  FALHOU ${chave}: ${resp.status} ${(await resp.text()).slice(0, 160)}`); continue; }
  id ? atualizadas++ : criadas++;
}

for (const x of INEXISTENTES) {
  const chave = `${x.model_name}|${x.valve_position}|${x.size}`;
  const id = porChave.get(chave);
  if (!id) { console.log(`= ${chave} já não está no catálogo`); continue; }
  console.log(`✗ ${chave} DESATIVADO — ${x.motivo.slice(0, 80)}…`);
  desativadas++;
  if (seco) continue;
  await fetch(`${BASE}/rest/v1/prosthesis_catalog?id=eq.${id}`, {
    method: "PATCH", headers: { ...cab, Prefer: "return=minimal" },
    body: JSON.stringify({ active: false, description: x.motivo }),
  });
}

console.log(
  `\n${criadas} criada(s) · ${atualizadas} atualizada(s) · ${desativadas} desativada(s)` +
  `${seco ? " (simulação)" : ""}`,
);
