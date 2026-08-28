/**
 * Grava a foto oficial e a página viva do fabricante.
 *
 * A lista abaixo é o resultado do rastreio **conferido à mão**, arquivo por
 * arquivo. Das 22 candidatas que o rastreador achou, 4 foram recusadas por
 * serem outro produto — e é por isso que esta lista existe em vez de o script
 * gravar direto o que o rastreio devolveu:
 *
 *   · Perimount recebeu `magna-ease-aortic-valve.jpg`. A Edwards vende a Magna
 *     Ease como "Carpentier-Edwards PERIMOUNT Magna Ease", então o nome casou —
 *     mas Perimount e Magna Ease são gerações diferentes no nosso catálogo.
 *   · Sapien 3 e Sapien 3 Ultra receberam `Sapien-3-ultra-thumbnail-02.png`,
 *     cujo texto alternativo diz "SAPIEN 3 Ultra RESILIA". Só a Ultra RESILIA
 *     fica com ela.
 *   · Epic recebeu `epic-max-av-side-flip-fnl.png` — a Epic **Max** é outra
 *     válvula, mais nova.
 *
 * Mostrar a válvula errada a um cirurgião é pior do que não mostrar nenhuma.
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

const rastreio = JSON.parse(readFileSync(new URL("./imagens-rastreadas.json", import.meta.url), "utf8"));

/** fabricante|modelo -> aceito? (com o motivo, quando não) */
const VEREDITO = {
  "Edwards|Magna Ease": true,
  "Edwards|Perimount": "é a foto da Magna Ease, outra geração",
  "Edwards|Mitris Resilia": true,
  "Edwards|Sapien 3": "a foto é da Sapien 3 Ultra RESILIA",
  "Edwards|Sapien 3 Ultra": "a foto é da Sapien 3 Ultra RESILIA",
  "Edwards|Sapien 3 Ultra RESILIA": true,
  "Edwards|Inspiris Resilia": true,
  "Edwards|Konect Resilia": true,
  "Edwards|Physio Flex (5300)": true,
  "Edwards|Intuity Elite": true,
  "Edwards|Magna Mitral Ease": true,
  "Edwards|Physio II (5200)": true,
  "Edwards|Cosgrove-Edwards Band (4600)": true,
  "Edwards|MC3 Tricuspid (4900)": true,
  "Abbott|Navitor": true,
  "Abbott|Epic": "a foto é da Epic Max, outra válvula",
  "Abbott|St. Jude Regent": true,
  "Abbott|St. Jude Masters HP": true,
  "Meril|Dafodil": true,
  "Meril|Myval": true,
  "Meril|Miltonia": true,
};

/** A imagem responde mesmo, e é imagem? */
async function ehImagem(url) {
  try {
    const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
    const tipo = r.headers.get("content-type") || "";
    return r.ok && tipo.startsWith("image/") ? { ok: true, tipo } : { ok: false, motivo: `${r.status} ${tipo}` };
  } catch (e) { return { ok: false, motivo: String(e.cause?.code || e.message).slice(0, 40) }; }
}

let aplicadas = 0, recusadas = 0;
for (const [fab, modelos] of Object.entries(rastreio)) {
  for (const [modelo, v] of Object.entries(modelos)) {
    const chave = `${fab}|${modelo}`;
    const veredito = VEREDITO[chave];
    if (veredito !== true) {
      console.log(`✗ ${chave.padEnd(38)} recusada: ${veredito ?? "não conferida à mão"}`);
      recusadas++;
      continue;
    }
    const conf = await ehImagem(v.imagem);
    if (!conf.ok) {
      console.log(`✗ ${chave.padEnd(38)} a URL não devolve imagem (${conf.motivo})`);
      recusadas++;
      continue;
    }
    const corpo = { image_url: v.imagem, reference_url: v.pagina };
    if (!seco) {
      const r = await fetch(
        `${BASE}/rest/v1/prosthesis_catalog?manufacturer=eq.${encodeURIComponent(fab)}&model_name=eq.${encodeURIComponent(modelo)}`,
        { method: "PATCH", headers: { ...cab, Prefer: "return=minimal" }, body: JSON.stringify(corpo) },
      );
      if (!r.ok) { console.log(`✗ ${chave} gravação falhou: ${r.status}`); recusadas++; continue; }
    }
    console.log(`✓ ${chave.padEnd(38)} ${conf.tipo}`);
    aplicadas++;
  }
}
console.log(`\n${aplicadas} famílias com foto${seco ? " (simulação)" : ""} · ${recusadas} recusadas`);
