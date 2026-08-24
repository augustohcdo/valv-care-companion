#!/usr/bin/env node
/**
 * Importa o recorte cardiovascular da base pública CNES (DATASUS).
 *
 *   SUPABASE_ACCESS_TOKEN=... node scripts/cnes-import.mjs --competencia 202606
 *   SUPABASE_ACCESS_TOKEN=... node scripts/cnes-import.mjs --limpar
 *
 * É script local, e não edge function, por medida: o ZIP tem ~730 MB e os dois
 * CSV que interessam somam ~1,8 GB descomprimidos. Está muito além do tempo e
 * da memória de uma function — e a leitura é em fluxo justamente para não
 * carregar nada disso de uma vez.
 *
 * **Não existe API aberta de CRM.** O portal do CFM é protegido por reCAPTCHA e
 * a API de dados abertos do SUS não expõe profissionais (87 rotas, conferidas).
 * O CNES é o que existe — e o número de registro dele é **declarado pelo
 * estabelecimento**, não validado pelo conselho. Corrobora; não autentica.
 */
import { createWriteStream, existsSync, statSync, unlinkSync } from "node:fs";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { spawn } from "node:child_process";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("Falta SUPABASE_ACCESS_TOKEN no ambiente.");
  process.exit(1);
}
const REF = readFileSync(resolve(raiz, "supabase/config.toml"), "utf8")
  .match(/project_id\s*=\s*"([^"]+)"/)?.[1];
const URL_BASE = `https://${REF}.supabase.co`;

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

/**
 * Os CBOs da família cardiovascular.
 *
 * Cardiologista, cirurgião cardiovascular e o intervencionista são os que o
 * produto pediu. Vascular e torácico entram porque compõem a mesma equipe em
 * doença valvar — e porque a diferença entre a lista curta e a longa é de
 * 30 mil para 36 mil linhas, sem custo relevante.
 */
const CBOS = {
  "225120": "Cardiologista",
  "225210": "Cirurgião cardiovascular",
  "225355": "Radiologista intervencionista",
  "225203": "Cirurgião vascular",
  "225240": "Cirurgião torácico",
};

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`SQL falhou (${r.status}): ${texto.slice(0, 300)}`);
  return JSON.parse(texto);
}

let SERVICE_ROLE;
async function chaves() {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  SERVICE_ROLE = (await r.json()).find((k) => k.name === "service_role").api_key;
}

async function baixar(competencia, destino) {
  if (existsSync(destino) && statSync(destino).size > 100_000_000) {
    console.log(`Já baixado: ${destino} (${(statSync(destino).size / 1e6).toFixed(0)} MB)`);
    return;
  }
  const url = `https://cnes.datasus.gov.br/EstatisticasServlet?path=BASE_DE_DADOS_CNES_${competencia}.ZIP`;
  console.log(`Baixando ${url} ...`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download falhou (${r.status}) — confira a competência`);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(destino));
  console.log(`  ${(statSync(destino).size / 1e6).toFixed(0)} MB`);
}

/**
 * Lê um arquivo de dentro do ZIP em fluxo, sem descomprimir tudo em disco.
 *
 * `unzip -p` porque o `zlib` do Node não lê o formato de container do ZIP, e
 * carregar 956 MB na memória para usar 36 mil linhas seria desperdício.
 */
function linhasDoZip(zip, arquivo, aoLer) {
  return new Promise((ok, falha) => {
    const proc = spawn("unzip", ["-p", zip, arquivo]);
    let erro = "";
    proc.stderr.on("data", (d) => { erro += String(d); });
    const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });
    let primeira = true;
    let linhas = 0;
    rl.on("line", (l) => {
      if (primeira) { primeira = false; return; }   // cabeçalho
      linhas++; aoLer(l);
    });
    rl.on("close", () => {
      // Zero linha não é "arquivo vazio": é o nome errado dentro do ZIP, e
      // seguir em silêncio produziria uma importação de zero registros com
      // cara de sucesso.
      if (linhas === 0) return falha(new Error(`${arquivo} não devolveu linha nenhuma. ${erro.slice(0, 200)}`));
      ok(linhas);
    });
    proc.on("error", falha);
  });
}

async function importar(competencia) {
  const zip = join(tmpdir(), `cnes_${competencia}.zip`);
  await baixar(competencia, zip);

  const porProfissional = new Map();
  console.log("Varrendo vínculos (tbCargaHorariaSus)...");
  await linhasDoZip(zip, `tbCargaHorariaSus${competencia}.csv`, (linha) => {
    const p = linha.split(";");
    if (p.length < 10) return;
    const cbo = p[2].replaceAll('"', "");
    if (!CBOS[cbo]) return;
    const id = p[1].replaceAll('"', "");
    let r = porProfissional.get(id);
    if (!r) { r = { cbos: new Set(), crms: new Set() }; porProfissional.set(id, r); }
    r.cbos.add(cbo);
    const registro = p[8].replaceAll('"', "");
    const uf = p[9].replaceAll('"', "");
    if (registro) r.crms.add(`${registro}|${uf}`);
  });
  console.log(`  ${porProfissional.size.toLocaleString("pt-BR")} profissionais na família cardiovascular`);

  console.log("Resolvendo nomes (tbDadosProfissionalSus)...");
  let comNome = 0;
  await linhasDoZip(zip, `tbDadosProfissionalSus${competencia}.csv`, (linha) => {
    const p = linha.split(";");
    const id = (p[0] ?? "").replaceAll('"', "");
    const r = porProfissional.get(id);
    if (!r) return;
    r.nome = (p[2] ?? "").replaceAll('"', "").trim();
    if (r.nome) comNome++;
  });
  console.log(`  ${comNome.toLocaleString("pt-BR")} com nome resolvido`);

  const linhas = [];
  for (const [id, r] of porProfissional) {
    if (!r.nome) continue;
    // O profissional pode ter mais de um registro (estabelecimentos em UFs
    // diferentes). Guardo o primeiro que veio com UF — é o que a conferência
    // usa.
    const comUf = [...r.crms].map((c) => c.split("|")).find(([, uf]) => uf);
    const qualquer = [...r.crms][0]?.split("|");
    const [crm, crmUf] = comUf ?? qualquer ?? [null, null];
    linhas.push({
      co_profissional: id, nome: r.nome,
      crm: crm || null, crm_uf: crmUf || null,
      cbos: [...r.cbos], especialidades: [...r.cbos].map((c) => CBOS[c]),
      competencia,
    });
  }
  console.log(`Enviando ${linhas.length.toLocaleString("pt-BR")} linhas...`);

  await sql("delete from public.cnes_profissionais");
  const LOTE = 500;
  for (let i = 0; i < linhas.length; i += LOTE) {
    const r = await fetch(`${URL_BASE}/rest/v1/cnes_profissionais`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json", Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(linhas.slice(i, i + LOTE)),
    });
    if (!r.ok) throw new Error(`lote ${i} falhou (${r.status}): ${(await r.text()).slice(0, 300)}`);
    if (i % 5000 === 0) process.stdout.write(`  ${i}/${linhas.length}\r`);
  }

  const [{ total }] = await sql("select count(*)::int total from public.cnes_profissionais");
  console.log(`\nNo banco: ${Number(total).toLocaleString("pt-BR")} profissionais (competência ${competencia}).`);
  unlinkSync(zip);
}

await chaves();
if (args.includes("--limpar")) {
  await sql("delete from public.cnes_profissionais");
  console.log("Base CNES removida.");
} else {
  await importar(flag("--competencia") ?? "202606");
}
