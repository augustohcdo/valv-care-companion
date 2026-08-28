/**
 * Grava a EOA de referência vinda de estudos por modelo — as próteses que não
 * estão nas tabelas das diretrizes.
 *
 * Cada valor foi lido no texto do artigo. Só entram tamanhos com n >= 10: um
 * valor de referência derivado de 2 ou 3 casos não é referência, e aqui ele
 * alimentaria o recomendador que diz a um cirurgião qual prótese evita
 * mismatch. Os tamanhos que caíram por essa regra estão nomeados em
 * `eoa-estudos.json`.
 *
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/catalogo/aplicar-estudos.mjs --seco
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/catalogo/aplicar-estudos.mjs
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

const N_MINIMO = 10;
const MARCA = "Gradiente médio de referência:";
const dados = JSON.parse(readFileSync(new URL("./eoa-estudos.json", import.meta.url), "utf8"));

const pt = (n) => String(n).replace(".", ",");
const num = (s) => (s == null ? null : Number(s));

/** chave `fabricante|modelo|posicao|tamanho` -> valores */
const alvo = new Map();
for (const [nome, estudo] of Object.entries(dados.estudos)) {
  for (const [chave, linhas] of Object.entries(estudo.modelos)) {
    const [fab, modelo, posicao] = chave.split("|");
    for (const [tamanho, eoa, dp, grad, dpGrad, n] of linhas) {
      if (n != null && n < N_MINIMO) {
        console.error(`RECUSADO por amostra (n=${n}): ${chave} ${tamanho} mm`);
        continue;
      }
      const k = `${fab}|${modelo}|${posicao}|${tamanho}`;
      if (alvo.has(k)) throw new Error(`chave repetida entre estudos: ${k}`);
      alvo.set(k, { eoa, dp, grad, dpGrad, n, rotulo: estudo.rotulo, url: estudo.url, estudo: nome });
    }
  }
}
console.log(`${alvo.size} pares modelo×tamanho a gravar\n`);

const r = await fetch(
  `${BASE}/rest/v1/prosthesis_catalog?select=id,manufacturer,model_name,valve_position,size,description`,
  { headers: cab },
);
if (!r.ok) throw new Error(`leitura falhou: ${r.status}`);
const todas = await r.json();

let gravadas = 0;
const naoEncontrados = new Set(alvo.keys());

for (const linha of todas) {
  const chave = `${linha.manufacturer}|${linha.model_name}|${linha.valve_position}|${num(linha.size)}`;
  const v = alvo.get(chave);
  if (!v) continue;
  naoEncontrados.delete(chave);

  const limpa = (linha.description || "").split(MARCA)[0].trim();
  const frase = v.grad != null ? ` ${MARCA} ${pt(v.grad)} ± ${pt(v.dpGrad)} mmHg (${v.rotulo}).` : "";

  const corpo = {
    effective_orifice_area: v.eoa,
    eoa_reference_sd: v.dp,
    eoa_source_label: `${v.rotulo}${v.n ? `, n = ${v.n}` : ""}`,
    eoa_source_url: v.url,
    description: (limpa + frase).trim(),
  };

  if (seco) {
    console.log(`  [seco] ${chave} -> EOA ${v.eoa}±${v.dp} (n=${v.n}) · ${v.rotulo}`);
    gravadas++;
    continue;
  }
  const resp = await fetch(`${BASE}/rest/v1/prosthesis_catalog?id=eq.${linha.id}`, {
    method: "PATCH",
    headers: { ...cab, Prefer: "return=minimal" },
    body: JSON.stringify(corpo),
  });
  if (!resp.ok) {
    console.error(`  FALHOU ${chave}: ${resp.status} ${(await resp.text()).slice(0, 200)}`);
    continue;
  }
  console.log(`  ✓ ${chave} -> EOA ${v.eoa}±${v.dp} (n=${v.n})`);
  gravadas++;
}

console.log(`\n${gravadas} linhas gravadas${seco ? " (simulação)" : ""}`);
if (naoEncontrados.size) {
  console.log(`\nATENÇÃO — ${naoEncontrados.size} par(es) sem linha no catálogo:`);
  for (const k of naoEncontrados) console.log("   ", k);
}
