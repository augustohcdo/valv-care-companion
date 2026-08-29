#!/usr/bin/env node
/**
 * Conserta as `reference_url` que o `conferir-links.mjs` achou mortas.
 *
 * São sete, e cada uma tem um motivo diferente de ter morrido:
 *
 * **Corcym (5).** O site deles não tem mais nenhuma página de produto — o
 * sitemap inteiro não lista uma sequer. O que existe é uma *media library* por
 * posição valvar, e ela nomeia os produtos: a de aórtica cita Perceval e Solo
 * Smart, a de mitral cita Memo 3D e Memo 4D. Essas quatro vão para lá.
 *
 * A **Crown PRT** não é citada em nenhuma das duas. Fica com `null`: apontar
 * para uma página que não fala dela seria trocar um link quebrado por um link
 * enganoso, o que é pior — o primeiro o médico percebe, o segundo não.
 *
 * **Abbott Portico.** A URL antiga dá 404 e a nova redireciona para a listagem
 * de transcateter. A listagem é o que existe, e é para lá que a Navitor já
 * aponta. Detalhe importante: a Portico **continua no portfólio da Abbott** —
 * nossa nota dizia que tinha sido substituída pela Navitor, e isso está errado.
 *
 * **Abbott Trifecta GT.** 404, e a página de válvulas cirúrgicas da Abbott não
 * menciona a Trifecta em lugar nenhum — foi retirada do mercado em 2023. Fica
 * com `null`. A informação que importa nessa linha já está no alerta, que tem
 * a carta ao cliente da própria Abbott como fonte.
 *
 * Uso: SUPABASE_SERVICE_ROLE_KEY=... node scripts/catalogo/corrigir-links.mjs [--seco]
 */
const BASE = "https://qwiojyfxzvdcfbbexyxg.supabase.co";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!SR) { console.error("Falta SUPABASE_SERVICE_ROLE_KEY no ambiente."); process.exit(1); }
const seco = process.argv.includes("--seco");
const cab = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };

const AORTICA = "https://www.corcym.com/media-library/aortic-solutions";
const MITRAL = "https://www.corcym.com/media-library/mitral-solutions";
const ABBOTT_TAVI = "https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/transcatheter-valve-solutions.html";

const CORRECOES = [
  { fab: "Corcym", modelo: "Perceval Plus", url: AORTICA, porque: "a media library de aórtica cita a Perceval" },
  { fab: "Corcym", modelo: "Solo Smart", url: AORTICA, porque: "a media library de aórtica cita a Solo Smart" },
  { fab: "Corcym", modelo: "Memo 3D", url: MITRAL, porque: "a media library de mitral cita a Memo 3D" },
  { fab: "Corcym", modelo: "Memo 4D", url: MITRAL, porque: "a media library de mitral cita a Memo 4D" },
  { fab: "Corcym", modelo: "Crown PRT", url: null, porque: "não é citada em nenhuma página viva da Corcym" },
  { fab: "Abbott", modelo: "Portico", url: ABBOTT_TAVI, porque: "a página própria saiu; a listagem de transcateter continua e ainda lista a Portico" },
  { fab: "Abbott", modelo: "Trifecta GT", url: null, porque: "retirada do mercado; a Abbott não a menciona em página nenhuma. O alerta já carrega a fonte" },
];

let feitas = 0;
for (const c of CORRECOES) {
  const alvo =
    `${BASE}/rest/v1/prosthesis_catalog?manufacturer=eq.${encodeURIComponent(c.fab)}` +
    `&model_name=eq.${encodeURIComponent(c.modelo)}`;
  console.log(`${c.url ? "→" : "∅"} ${`${c.fab} ${c.modelo}`.padEnd(24)} ${c.porque}`);
  feitas++;
  if (seco) continue;
  const r = await fetch(alvo, {
    method: "PATCH", headers: { ...cab, Prefer: "return=minimal" },
    body: JSON.stringify({ reference_url: c.url }),
  });
  if (!r.ok) console.error(`  FALHOU: ${r.status} ${(await r.text()).slice(0, 140)}`);
}
console.log(`\n${feitas} família(s) ajustada(s)${seco ? " (simulação)" : ""}`);
