#!/usr/bin/env node
/**
 * Os arquivos de trabalho: subir, listar, baixar e apagar.
 *
 *   SUPABASE_ACCESS_TOKEN=... node scripts/workspace.mjs --listar
 *   SUPABASE_ACCESS_TOKEN=... node scripts/workspace.mjs --subir notas.md --titulo "Notas da rodada"
 *   SUPABASE_ACCESS_TOKEN=... node scripts/workspace.mjs --baixar notas.md
 *   SUPABASE_ACCESS_TOKEN=... node scripts/workspace.mjs --apagar notas.md
 *
 * Existe porque o pedido foi "um lugar onde **você** grave e salve coisas", e
 * uma tela de administrador atende só à metade humana disso. Sem este script o
 * bucket seria mais um formulário para alguém preencher à mão.
 *
 * O contêiner onde este assistente roda é efêmero: reinicia e apaga tudo o que
 * não estiver versionado ou aqui. É por isso que o destino é um bucket privado
 * no Supabase, e não uma pasta em disco — pasta em disco pareceria
 * armazenamento sem ser.
 *
 * **Nada de credencial vai para cá.** Segredo continua indo só pela API de
 * secrets do Supabase.
 */
import { readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { resolve, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("Falta SUPABASE_ACCESS_TOKEN no ambiente.");
  process.exit(1);
}
const REF = readFileSync(resolve(raiz, "supabase/config.toml"), "utf8")
  .match(/project_id\s*=\s*"([^"]+)"/)?.[1];
const URL_BASE = `https://${REF}.supabase.co`;
const BUCKET = "workspace";

/** Teto da plataforma, não desta ferramenta: `fileSizeLimit` da config de storage. */
const MAX_BYTES = 50 * 1024 * 1024;

/** A mesma allowlist da migration. Divergir daqui daria erro só no servidor. */
const TIPOS = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".log": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".zip": "application/zip",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

let SERVICE_ROLE;
async function chaves() {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!r.ok) throw new Error(`não consegui ler as chaves do projeto (${r.status})`);
  const achada = (await r.json()).find((k) => k.name === "service_role");
  if (!achada) throw new Error("o projeto não devolveu chave service_role");
  SERVICE_ROLE = achada.api_key;
}

const auth = () => ({ apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` });

async function rest(caminho, init = {}) {
  const r = await fetch(`${URL_BASE}/rest/v1/${caminho}`, {
    ...init,
    headers: { ...auth(), "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`REST ${caminho} falhou (${r.status}): ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto) : null;
}

const tamanho = (b) =>
  b == null ? "—" : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} kB`;

// ---------------------------------------------------------------------------

async function listar() {
  const linhas = await rest("workspace_files?select=*&order=created_at.desc");
  if (!linhas.length) {
    console.log("Nenhum arquivo guardado ainda.");
    return;
  }
  console.log(`${linhas.length} arquivo(s):\n`);
  for (const l of linhas) {
    const quando = new Date(l.created_at).toISOString().slice(0, 16).replace("T", " ");
    console.log(`  ${l.storage_path}`);
    console.log(`    ${l.titulo}  ·  ${tamanho(l.file_bytes)}  ·  ${l.origem}  ·  ${quando}`);
    if (l.descricao) console.log(`    ${l.descricao}`);
  }
}

async function subir(arquivo) {
  if (!existsSync(arquivo)) throw new Error(`arquivo não existe: ${arquivo}`);
  const bytes = statSync(arquivo).size;
  if (bytes > MAX_BYTES) {
    // Dizer o motivo em vez de deixar o servidor devolver 413: o teto é do
    // plano do Supabase, e nenhuma mudança neste script o levanta.
    throw new Error(
      `${arquivo} tem ${tamanho(bytes)} e o teto da plataforma é 50 MB por arquivo. ` +
      "Divida o arquivo ou comprima antes.",
    );
  }
  const nome = flag("--como") || basename(arquivo);
  const ext = extname(nome).toLowerCase();
  const tipo = TIPOS[ext];
  if (!tipo) {
    throw new Error(
      `extensão ${ext || "(nenhuma)"} não está na allowlist do bucket. ` +
      `Aceitas: ${Object.keys(TIPOS).join(" ")}`,
    );
  }

  const corpo = readFileSync(arquivo);
  const r = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${encodeURIComponent(nome)}`, {
    method: "POST",
    headers: { ...auth(), "Content-Type": tipo, "x-upsert": "true" },
    body: corpo,
  });
  if (!r.ok) throw new Error(`upload falhou (${r.status}): ${(await r.text()).slice(0, 300)}`);

  // O índice depois do arquivo: linha sem objeto seria pior que objeto sem
  // linha — a tela ofereceria um download que devolve 404.
  await rest("workspace_files?on_conflict=storage_path", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      storage_path: nome,
      titulo: flag("--titulo") || nome,
      descricao: flag("--descricao") || null,
      mime_type: tipo,
      file_bytes: bytes,
      origem: "assistente",
    }),
  });
  console.log(`✓ ${nome} — ${tamanho(bytes)}`);
}

async function baixar(nome) {
  const r = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${encodeURIComponent(nome)}`, {
    headers: auth(),
  });
  if (!r.ok) throw new Error(`download falhou (${r.status}): ${(await r.text()).slice(0, 200)}`);
  const destino = flag("--para") || nome;
  writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
  console.log(`✓ ${destino} — ${tamanho(statSync(destino).size)}`);
}

async function apagar(nome) {
  const r = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${encodeURIComponent(nome)}`, {
    method: "DELETE",
    headers: auth(),
  });
  // O storage devolve 200 mesmo para objeto inexistente; a checagem que importa
  // é a de erro real, não a de "existia".
  if (!r.ok) throw new Error(`exclusão falhou (${r.status}): ${(await r.text()).slice(0, 200)}`);
  await rest(`workspace_files?storage_path=eq.${encodeURIComponent(nome)}`, { method: "DELETE" });
  console.log(`✓ ${nome} removido do bucket e do índice`);
}

// ---------------------------------------------------------------------------

const acoes = [
  ["--listar", () => listar()],
  ["--subir", (v) => subir(v)],
  ["--baixar", (v) => baixar(v)],
  ["--apagar", (v) => apagar(v)],
];

const escolhida = acoes.find(([nome]) => args.includes(nome));
if (!escolhida) {
  console.error(
    "Uso: workspace.mjs --listar | --subir <arquivo> [--como nome] [--titulo t] [--descricao d]\n" +
    "                   | --baixar <nome> [--para caminho] | --apagar <nome>",
  );
  process.exit(1);
}

await chaves();
try {
  await escolhida[1](flag(escolhida[0]));
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
