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
 *
 * ## Segunda varredura
 *
 * Quatro das recusas acima foram resolvidas indo à fonte certa. O site da
 * Edwards é renderizado no navegador e a página HTML não traz as fotos — mas a
 * API de entrega do CMS deles (Kontent.ai, `deliver.kontent.ai`, leitura
 * pública sem autenticação, a mesma que o site consome) traz **4.876 assets**
 * com o nome do item que usa cada um. Foi de lá que saíram:
 *
 *   · **Sapien 3** — item "SAPIEN 3 valve - side view". Aberta e olhada: armação
 *     hexagonal com saia externa curta, que é a Sapien 3. A Ultra tem a saia
 *     alta, e é outra imagem.
 *   · **Sapien 3 Ultra** — item "SAPIEN 3 Ultra valve", com a saia alta.
 *   · **Magna Mitral Ease** — item "Model 7300TFX Image". 7300TFX é o código da
 *     Magna Mitral Ease; é a única das quatro em que o próprio nome do item
 *     carrega o número do modelo.
 *   · **Epic** — página da Epic no site da Abbott, imagens do DAM deles. Aórtica
 *     e mitral são fotos **diferentes**, e é por isso que este script passou a
 *     aceitar imagem por posição valvar.
 *
 * Continuam sem foto, e o motivo está registrado em `buscaDeFontes.ts`:
 *
 *   · **Edwards Perimount** (a clássica). Os dois candidatos do CMS são
 *     radiografia de peça — o segundo traz "Procedure: SPECIMEN IMAGING"
 *     escrito na própria imagem. A Edwards só divulga foto de produto da
 *     geração Magna Ease.
 *   · **Todas as oito famílias da Medtronic.** `medtronic.com` devolve 1.104
 *     bytes com "Incorrect Browser" para tudo — página, imagem, site regional,
 *     asset direto. É proteção contra robô e não se contorna.
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
  "Edwards|Perimount": "as duas candidatas são radiografia de peça, não foto de produto",
  "Edwards|Mitris Resilia": true,
  "Edwards|Sapien 3": true,
  "Edwards|Sapien 3 Ultra": true,
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
  "Abbott|Epic": true,
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

/**
 * Uma entrada do rastreio vira uma ou mais gravações.
 *
 * O caso normal é uma foto para a família inteira. A Epic quebra isso: a
 * aórtica e a mitral são válvulas com formato diferente e a Abbott publica foto
 * de cada uma. Gravar a mesma nas duas mostraria a válvula errada em metade das
 * linhas — o defeito que este arquivo inteiro existe para evitar.
 */
function gravacoes(v) {
  const porPosicao = ["aortica", "mitral", "tricuspide"].filter((p) => v[p]?.imagem);
  if (porPosicao.length) {
    return porPosicao.map((p) => ({ posicao: p, imagem: v[p].imagem, pagina: v.pagina }));
  }
  return [{ posicao: null, imagem: v.imagem, pagina: v.pagina }];
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
    for (const g of gravacoes(v)) {
      const rotulo = g.posicao ? `${chave} (${g.posicao})` : chave;
      const conf = await ehImagem(g.imagem);
      if (!conf.ok) {
        console.log(`✗ ${rotulo.padEnd(38)} a URL não devolve imagem (${conf.motivo})`);
        recusadas++;
        continue;
      }
      const filtro =
        `manufacturer=eq.${encodeURIComponent(fab)}&model_name=eq.${encodeURIComponent(modelo)}` +
        (g.posicao ? `&valve_position=eq.${g.posicao}` : "");
      if (!seco) {
        const r = await fetch(`${BASE}/rest/v1/prosthesis_catalog?${filtro}`, {
          method: "PATCH",
          headers: { ...cab, Prefer: "return=minimal" },
          body: JSON.stringify({ image_url: g.imagem, reference_url: g.pagina }),
        });
        if (!r.ok) { console.log(`✗ ${rotulo} gravação falhou: ${r.status}`); recusadas++; continue; }
      }
      console.log(`✓ ${rotulo.padEnd(38)} ${conf.tipo}`);
      aplicadas++;
    }
  }
}
console.log(`\n${aplicadas} gravação(ões) de foto${seco ? " (simulação)" : ""} · ${recusadas} recusadas`);
