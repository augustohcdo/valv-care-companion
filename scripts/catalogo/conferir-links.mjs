#!/usr/bin/env node
/**
 * Confere se cada `reference_url` do catálogo ainda entrega a página do produto.
 *
 * ## Duas armadilhas que este script existe para não cair
 *
 * **1. Status HTTP não basta.** A primeira versão desta checagem, noutra rodada,
 * olhava só o código. Passou seis URLs da Medtronic como vivas: elas devolvem
 * **200 com 1.105 bytes** e o texto "Incorrect Browser" — um bloqueio de robô
 * servido com status de sucesso. O médico que clicasse chegava numa página de
 * erro e o relatório dizia que estava tudo certo.
 *
 * **2. Redirecionar para a home é morte disfarçada.** A Abbott responde 301 nas
 * URLs de produto que ela aposentou, e o 301 leva para `.../home.html`. Com
 * `-L` isso vira 200 e parece saudável. O cirurgião clica em "página do
 * fabricante" da Portico e cai na home institucional.
 *
 * Por isso o veredito olha o corpo E o destino final.
 *
 * Foi assim que os cinco links da Corcym apareceram: 404 havia meses, e nada
 * gritava.
 *
 * Uso: SUPABASE_SERVICE_ROLE_KEY=... node scripts/catalogo/conferir-links.mjs
 * Fora do `vitest` de propósito — depende de rede, e a CI não deve quebrar
 * porque o site de um fabricante saiu do ar.
 */
const BASE = "https://qwiojyfxzvdcfbbexyxg.supabase.co";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!SR) { console.error("Falta SUPABASE_SERVICE_ROLE_KEY no ambiente."); process.exit(1); }
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

/** Sinais de que o corpo é uma parede ou um erro, e não a página do produto. */
const PAREDES = [
  /incorrect browser/i, /access denied/i, /are you a robot/i,
  /enable javascript to continue/i, /request unsuccessful/i,
  /cf-browser-verification|challenge-platform/i,
];
/** Destinos que significam "esta página não existe mais". */
const DESVIO_MORTO = [/\/home\.html$/i, /\/index\.html$/i, /\.(com|br)\/?$/i];

const resp = await fetch(
  `${BASE}/rest/v1/prosthesis_catalog?select=manufacturer,model_name,reference_url,active&reference_url=not.is.null`,
  { headers: { apikey: SR, Authorization: `Bearer ${SR}` } },
);
if (!resp.ok) { console.error(`leitura falhou: ${resp.status}`); process.exit(1); }

const porUrl = new Map();
for (const l of await resp.json()) {
  if (l.active === false) continue;
  if (!porUrl.has(l.reference_url)) porUrl.set(l.reference_url, new Set());
  porUrl.get(l.reference_url).add(`${l.manufacturer} ${l.model_name}`);
}
console.log(`${porUrl.size} URLs distintas no catálogo ativo\n`);

const ruins = [];
for (const [url, modelos] of porUrl) {
  let veredito = "ok", detalhe = "";
  try {
    const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA } });
    const corpo = await r.text();
    const destino = r.url;
    if (!r.ok) veredito = `HTTP ${r.status}`;
    else if (PAREDES.some((p) => p.test(corpo))) { veredito = "PAREDE DE ROBÔ"; detalhe = `${corpo.length} b`; }
    else if (destino !== url && DESVIO_MORTO.some((p) => p.test(destino))) {
      veredito = "DESVIADA PARA A HOME"; detalhe = destino.slice(0, 60);
    } else if (corpo.length < 4000) { veredito = "corpo curto demais"; detalhe = `${corpo.length} b`; }
    else detalhe = `${Math.round(corpo.length / 1024)} kB`;
  } catch (e) {
    veredito = `erro: ${String(e.cause?.code || e.message).slice(0, 28)}`;
  }
  console.log(`${veredito === "ok" ? "✓" : "✗"} ${veredito.padEnd(21)} ${detalhe.padEnd(12)} ${url.slice(0, 78)}`);
  if (veredito !== "ok") ruins.push({ url, veredito, modelos: [...modelos] });
}

/**
 * Parede de robô **não é link morto**, e confundir os dois faria eu "consertar"
 * link bom: o médico, que não está atrás do egresso deste contêiner, abre as
 * páginas da Medtronic normalmente. O que a parede diz é "não dá para conferir
 * daqui" — não "está quebrado". Só o que está de fato morto reprova.
 */
const mortos = ruins.filter((r) => !/PAREDE DE ROBÔ/.test(r.veredito));
const naoConferiveis = ruins.filter((r) => /PAREDE DE ROBÔ/.test(r.veredito));

console.log(`\n${porUrl.size - ruins.length} de ${porUrl.size} conferidas e entregando a página`);
if (naoConferiveis.length) {
  console.log(
    `\n${naoConferiveis.length} não dá para conferir daqui (parede de robô, não link morto —\n` +
    "o navegador do médico abre; este contêiner é que é barrado):",
  );
  for (const r of naoConferiveis) console.log(`  · ${r.modelos.join(", ")}`);
}
if (mortos.length) {
  console.log("\nMORTAS — link que não abre é pior do que link nenhum:");
  for (const r of mortos) console.log(`  [${r.veredito}] ${r.modelos.join(", ")}`);
}
process.exit(mortos.length ? 1 : 0);
