#!/usr/bin/env node
/**
 * Grava as fotos da Medtronic — só as que foram **abertas e conferidas**.
 *
 * A lista vem de `medtronic-imagens.json`, que tem duas seções: `conferidas` e
 * `pendentes`. Este script só olha para `conferidas`. Mover uma família de
 * `pendentes` para `conferidas` exige abrir a imagem e escrever o que se viu no
 * campo `o_que_eu_vi` — e o script **recusa** entrada sem esse campo.
 *
 * Por que essa cerimônia toda para uma foto: nesta base já entraram, ou quase
 * entraram, a foto da Magna Ease na Perimount, a da Ultra RESILIA em duas
 * Sapien diferentes, a da Epic Max na Epic, oito quadros de vídeo cirúrgico da
 * Corcym e quatro cateteres-balão cujo arquivo se chamava "Myval_view". O nome
 * do arquivo acerta na maioria das vezes, e é justamente por isso que ele
 * engana: quem confia nele não desconfia da exceção.
 *
 * ## A URL gravada é a da medtronic.com, não a do arquivo
 *
 * `medtronic.com` bloqueia este contêiner, mas não bloqueia o navegador do
 * médico. O arquivo da web serve para descobrir a URL canônica e para eu poder
 * ver a imagem; o que fica no banco é o endereço do fabricante.
 *
 * Uso: SUPABASE_SERVICE_ROLE_KEY=... node scripts/catalogo/aplicar-imagens-medtronic.mjs [--seco]
 */
import { readFileSync } from "node:fs";

const BASE = "https://qwiojyfxzvdcfbbexyxg.supabase.co";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!SR) { console.error("Falta SUPABASE_SERVICE_ROLE_KEY no ambiente."); process.exit(1); }
const seco = process.argv.includes("--seco");
const cab = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };

const dados = JSON.parse(readFileSync(new URL("./medtronic-imagens.json", import.meta.url), "utf8"));

let gravadas = 0;
for (const c of dados.conferidas) {
  // A cerimônia: sem relato do que foi visto, não grava. Um campo em branco aqui
  // significa "ninguém abriu esta imagem", e é exatamente o caso que o resto do
  // arquivo existe para impedir.
  if (!c.o_que_eu_vi || c.o_que_eu_vi.length < 40) {
    console.error(`✗ ${c.familia}: entrada em "conferidas" sem relato do que foi visto. Não gravo.`);
    process.exitCode = 1;
    continue;
  }
  const [fab, modelo] = c.familia.split("|");
  console.log(`✓ ${c.familia.padEnd(26)} ${c.o_que_eu_vi.slice(0, 90)}…`);
  gravadas++;
  if (seco) continue;
  const r = await fetch(
    `${BASE}/rest/v1/prosthesis_catalog?manufacturer=eq.${encodeURIComponent(fab)}` +
    `&model_name=eq.${encodeURIComponent(modelo)}`,
    { method: "PATCH", headers: { ...cab, Prefer: "return=minimal" },
      body: JSON.stringify({ image_url: c.url }) },
  );
  if (!r.ok) console.error(`  FALHOU: ${r.status} ${(await r.text()).slice(0, 140)}`);
}

console.log(`\n${gravadas} família(s) com foto${seco ? " (simulação)" : ""}`);
console.log(`${dados.pendentes.length} ainda pendente(s) — URL achada, imagem não aberta:`);
for (const p of dados.pendentes) console.log(`  · ${p.familia}`);
