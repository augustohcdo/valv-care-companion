/**
 * Grava no catálogo a EOA de referência e o gradiente médio da ASE 2024.
 *
 * Os valores saem de `dados_ase2024.json`, que foi decodificado À MÃO do texto
 * do PDF — o parser por regex errava (o Freestyle 19 mm reporta gradiente e não
 * EOA, e a heurística "último par é a EOA" o transformava numa EOA de 13 cm²).
 *
 * Escreve pelo PostgREST com a `service_role`, porque a Management API está
 * devolvendo 401 e não dá para rodar DDL. Por isso o gradiente de referência
 * entra numa frase demarcada dentro de `description`: a coluna própria está
 * escrita na migration e entra quando o token voltar.
 */
import { readFileSync } from "node:fs";

const BASE = "https://qwiojyfxzvdcfbbexyxg.supabase.co";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!SR) {
  console.error("Falta SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(1);
}
const dados = JSON.parse(readFileSync(new URL("./eoa-ase-2024.json", import.meta.url), "utf8"));

const FONTE_URL = dados._fonte.url;
const PMID = "https://pubmed.ncbi.nlm.nih.gov/38182282/";
const seco = process.argv.includes("--seco");

/** A frase que carrega o gradiente até existir coluna para ele. */
const MARCA = "Gradiente médio de referência:";

const cabecalho = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };

async function linhas() {
  const r = await fetch(
    `${BASE}/rest/v1/prosthesis_catalog?select=id,manufacturer,model_name,type,valve_position,size,description`,
    { headers: cabecalho },
  );
  if (!r.ok) throw new Error(`leitura falhou: ${r.status}`);
  return r.json();
}

const num = (s) => (s == null ? null : Number(s));
const pt = (n) => String(n).replace(".", ",");

/**
 * A posição valvar faz parte da chave — e isto não é detalhe.
 *
 * O ensaio a seco pegou: a Hancock II existe em 25, 27 e 29 mm **na aórtica e
 * na mitral**, com EOA diferentes (aórtica 25 mm = 1,6 cm²; mitral 25 mm =
 * 1,42 cm²). Sem a posição na chave, a entrada mitral sobrescrevia a aórtica e
 * a linha aórtica do catálogo receberia o número da mitral — dado clínico
 * errado, gravado em silêncio.
 */
const grupos = [
  ["aortica_tabela_A4", "aortica", "Tabela A4 (próteses aórticas cirúrgicas)"],
  ["mitral_tabela_A5", "mitral", "Tabela A5 (próteses mitrais cirúrgicas)"],
  ["tavi_tabelas_A1_A2", "aortica", "Tabelas A1/A2 (válvulas transcateter)"],
];

const alvo = new Map(); // "fab|modelo|tamanho" -> {eoa, dp, grad, dpGrad, rotulo}
for (const [chave, posicao, nomeTabela] of grupos) {
  for (const [modelo, valores] of Object.entries(dados[chave])) {
    if (modelo.startsWith("_")) continue;
    const [fab, nome] = modelo.split("|");
    for (const [tam, eoa, dp, grad, dpGrad] of valores) {
      const k = `${fab}|${nome}|${posicao}|${tam}`;
      if (alvo.has(k)) throw new Error(`chave repetida na fonte: ${k}`);
      alvo.set(k, {
        eoa, dp, grad, dpGrad,
        rotulo: `ASE 2024 — ${nomeTabela}`,
      });
    }
  }
}
console.log(`${alvo.size} pares modelo×tamanho a gravar\n`);

const todas = await linhas();
let gravadas = 0, semCorrespondencia = 0;
const naoEncontrados = new Set(alvo.keys());

for (const linha of todas) {
  const chave = `${linha.manufacturer}|${linha.model_name}|${linha.valve_position}|${num(linha.size)}`;
  const v = alvo.get(chave);
  if (!v) { semCorrespondencia++; continue; }
  naoEncontrados.delete(chave);

  // A descrição perde a frase antiga do gradiente antes de ganhar a nova, para
  // não empilhar a cada execução.
  const limpa = (linha.description || "").split(MARCA)[0].trim();
  const frase = v.grad != null
    ? ` ${MARCA} ${pt(v.grad)} ± ${pt(v.dpGrad)} mmHg (ASE 2024).`
    : "";

  const corpo = {
    effective_orifice_area: v.eoa,
    eoa_reference_sd: v.dp,
    eoa_source_label: v.rotulo,
    eoa_source_url: PMID,
    description: (limpa + frase).trim(),
  };

  if (seco) {
    console.log(`  [seco] ${chave} -> EOA ${v.eoa}±${v.dp}${v.grad ? `, grad ${v.grad}` : ""}`);
    gravadas++;
    continue;
  }

  const r = await fetch(`${BASE}/rest/v1/prosthesis_catalog?id=eq.${linha.id}`, {
    method: "PATCH",
    headers: { ...cabecalho, Prefer: "return=minimal" },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) {
    console.error(`  FALHOU ${chave}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    continue;
  }
  gravadas++;
}

console.log(`\n${gravadas} linhas gravadas${seco ? " (simulação)" : ""}`);
console.log(`${semCorrespondencia} linhas do catálogo sem dado publicado nesta fonte`);
if (naoEncontrados.size) {
  console.log(`\nATENÇÃO — ${naoEncontrados.size} par(es) da fonte NÃO acharam linha no catálogo:`);
  for (const k of naoEncontrados) console.log("   ", k);
}
