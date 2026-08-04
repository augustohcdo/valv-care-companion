#!/usr/bin/env node
/**
 * Restaura um export do ValvePath num projeto Supabase vazio.
 *
 * Existe porque exportar não é restaurar. O `weekly-export` roda toda segunda e
 * grava 40 arquivos no bucket; até este script existir, ninguém tinha provado
 * que aqueles arquivos voltam a ser um sistema. "Backup que nunca foi
 * restaurado" é hipótese, não rede de segurança.
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=sbp_...           # token da Management API
 *   ORIGEM_SERVICE_KEY=eyJ...               # service_role do projeto de ORIGEM
 *   ALVO_SERVICE_KEY=eyJ...                 # só com --com-arquivos
 *   node scripts/restore.mjs --de <ref-origem> --para <ref-alvo> --data 2026-08-03 \
 *     [--limpar] [--com-arquivos]
 *
 * O que ele NÃO faz, e está no RECOVERY.md: criar o projeto, aplicar as
 * migrations, publicar as edge functions, gravar segredos, recriar os
 * agendamentos do pg_cron e reapontar a Vercel. Este script cuida só dos dados.
 */
import { argv, env, exit } from "node:process";

const arg = (nome, obrigatorio = true) => {
  const i = argv.indexOf(`--${nome}`);
  const v = i > -1 ? argv[i + 1] : undefined;
  if (!v && obrigatorio) {
    console.error(`Falta --${nome}`);
    exit(1);
  }
  return v;
};

const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const ORIGEM_KEY = env.ORIGEM_SERVICE_KEY;
if (!TOKEN || !ORIGEM_KEY) {
  console.error("Defina SUPABASE_ACCESS_TOKEN e ORIGEM_SERVICE_KEY.");
  exit(1);
}
const DE = arg("de");
const PARA = arg("para");
const DATA = arg("data");
const BUCKET = "clinical-exports";

/** SQL no projeto alvo, pela Management API. */
async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PARA}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`SQL falhou (${r.status}): ${texto.slice(0, 400)}`);
  return JSON.parse(texto);
}

/** Um arquivo do export da origem. `null` quando não existe. */
async function baixar(nome) {
  const url = `https://${DE}.supabase.co/storage/v1/object/${BUCKET}/exports/${DATA}/${nome}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${ORIGEM_KEY}` } });
  if (r.status === 404 || r.status === 400) return null;
  if (!r.ok) throw new Error(`download de ${nome} falhou (${r.status})`);
  return await r.text();
}

const ndjson = (texto) =>
  (texto ?? "").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));

/** Literal SQL seguro para qualquer valor vindo do NDJSON. */
function valor(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

/**
 * Ordem de carga derivada do grafo de chaves estrangeiras DO ALVO, em tempo de
 * execução. Uma ordem fixa no código envelheceria exatamente como a lista de
 * tabelas do backup envelheceu — e a falha só apareceria durante um desastre.
 */
async function ordemPorDependencia(tabelas) {
  const arestas = await sql(`
    select c.conrelid::regclass::text as filho,
           c.confrelid::regclass::text as pai
    from pg_constraint c
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and c.conrelid <> c.confrelid`);

  const conjunto = new Set(tabelas);
  const pais = new Map(tabelas.map((t) => [t, new Set()]));
  for (const { filho, pai } of arestas) {
    const f = filho.replace(/^public\./, "");
    const p = pai.replace(/^public\./, "");
    if (conjunto.has(f) && conjunto.has(p)) pais.get(f).add(p);
  }

  const ordem = [];
  const feitas = new Set();
  while (ordem.length < tabelas.length) {
    const prontas = tabelas.filter(
      (t) => !feitas.has(t) && [...pais.get(t)].every((p) => feitas.has(p)),
    );
    if (!prontas.length) {
      // Ciclo entre tabelas: carrega o que sobrou junto e deixa o banco
      // reclamar com nome e sobrenome, em vez de travar em silêncio.
      const restantes = tabelas.filter((t) => !feitas.has(t));
      console.warn(`  ciclo de dependência entre: ${restantes.join(", ")}`);
      ordem.push(...restantes);
      break;
    }
    for (const t of prontas) { ordem.push(t); feitas.add(t); }
  }
  return ordem;
}

/**
 * Insere em lotes, deixando o Postgres converter cada coluna.
 *
 * A primeira versão montava os literais à mão e quebrou no ensaio: `symptoms`
 * e `comorbidities` são `text[]`, e eu os escrevia como `::jsonb`; o caso
 * clínico — a tabela mais importante do sistema — não carregou. `vector` e os
 * enums teriam o mesmo problema.
 *
 * `jsonb_populate_recordset` resolve a família inteira de uma vez: a conversão
 * passa a ser responsabilidade do banco, que conhece o tipo real de cada
 * coluna. Menos código e imune a tipo novo aparecer amanhã.
 */
async function inserir(tabela, linhas, chaveConflito = null) {
  if (!linhas.length) return 0;
  const colunas = Object.keys(linhas[0]);
  const lote = 100;
  let total = 0;
  for (let i = 0; i < linhas.length; i += lote) {
    const fatia = linhas.slice(i, i + lote);
    const json = JSON.stringify(fatia).replace(/'/g, "''");
    const chaves = chaveConflito ? chaveConflito.split(",").map((c) => c.trim()) : [];
    const conflito = chaveConflito
      ? `on conflict (${chaveConflito}) do update set ${colunas
          .filter((c) => !chaves.includes(c))
          .map((c) => `${c} = excluded.${c}`)
          .join(", ")}`
      : "on conflict do nothing";
    await sql(
      `insert into ${tabela} (${colunas.join(", ")})\n` +
        `select ${colunas.join(", ")}\n` +
        `from jsonb_populate_recordset(null::${tabela}, '${json}'::jsonb)\n` +
        `${conflito};`,
    );
    total += fatia.length;
  }
  return total;
}

/**
 * Esvazia o alvo antes de carregar.
 *
 * Não é zelo excessivo: as migrations semeiam dado próprio — o catálogo de
 * próteses nasce com 246 linhas só de aplicar o schema. Sem limpar, o ensaio
 * terminou com 492, e uma restauração de verdade entregaria um catálogo
 * duplicado sem ninguém notar, porque "carregou tudo" continuaria verdadeiro.
 */
async function limparAlvo(tabelas) {
  const lista = tabelas.map((t) => `public.${t}`).join(", ");
  await sql(`truncate table ${lista} cascade;`);
  await sql("delete from auth.identities; delete from auth.users;");
}

async function main() {
  console.log(`Restaurando o export de ${DATA} (projeto ${DE}) em ${PARA}\n`);

  const manifesto = JSON.parse((await baixar("_manifest.json")) ?? "null");
  if (!manifesto) throw new Error(`não achei o manifesto de ${DATA}`);
  console.log(`Manifesto gerado em ${manifesto.generated_at}, ${Object.keys(manifesto.tables).length} arquivos.\n`);

  // Arquivos do manifesto que NÃO são tabela de `public`. Sem esta lista o
  // carregador tentaria `select count(*) from public.storage_inventory` e
  // quebraria a restauração inteira num nome que nunca foi tabela.
  const NAO_SAO_TABELAS = new Set(["auth_users", "auth_identities", "storage_inventory"]);
  const tabelasAlvo = Object.keys(manifesto.tables).filter((t) => !NAO_SAO_TABELAS.has(t));

  if (argv.includes("--limpar")) {
    console.log("Esvaziando o alvo antes de carregar.\n");
    await limparAlvo(tabelasAlvo);
  } else {
    const [{ n }] = await sql(
      `select coalesce(sum(c), 0)::int as n from (
         ${tabelasAlvo.map((t) => `select count(*) c from public.${t}`).join(" union all ")}
       ) x;`,
    );
    if (n > 0) {
      console.error(
        `O alvo já tem ${n} linha(s) — as migrations semeiam dado próprio (o catálogo de\n` +
          `próteses, por exemplo). Carregar por cima duplicaria. Rode com --limpar.`,
      );
      exit(1);
    }
  }

  // ---- 1. As contas ------------------------------------------------------
  // Vêm primeiro porque profiles/doctors/patients/user_roles apontam para cá.
  // O id é preservado: sem isso nenhuma chave estrangeira fecha, e o Admin API
  // não deixa escolher o id — daí a inserção ser por SQL direto.
  //
  // `encrypted_password` fica nulo de propósito: o backup leva identidade, não
  // credencial. Ninguém entra por senha até redefini-la — está no RECOVERY.md.
  const usuarios = ndjson(await baixar("auth_users.ndjson"));
  console.log(`Contas: ${usuarios.length}`);
  for (const u of usuarios) {
    await sql(`
      insert into auth.users (
        instance_id, id, aud, role, email, phone,
        email_confirmed_at, phone_confirmed_at, created_at, updated_at,
        last_sign_in_at, banned_until,
        raw_user_meta_data, raw_app_meta_data, is_anonymous,
        -- Estas quatro não têm default e o GoTrue lê como texto, não como
        -- nulo: deixá-las nulas faz TODA operação de conta responder
        -- "Database error loading user" — descoberto no ensaio, ao tentar
        -- entrar com uma conta restaurada. Não são credenciais; são
        -- marcadores de "nada pendente", e vazio é o estado certo.
        confirmation_token, recovery_token, email_change, email_change_token_new
      ) values (
        '00000000-0000-0000-0000-000000000000', ${valor(u.id)}, 'authenticated', 'authenticated',
        ${valor(u.email)}, ${valor(u.phone || null)},
        ${valor(u.email_confirmed_at)}, ${valor(u.phone_confirmed_at)},
        ${valor(u.created_at)}, now(),
        ${valor(u.last_sign_in_at)}, ${valor(u.banned_until)},
        ${valor(u.raw_user_meta_data)}, ${valor(u.raw_app_meta_data)}, ${valor(u.is_anonymous ?? false)},
        '', '', '', ''
      ) on conflict (id) do nothing;`);
  }

  const identidades = ndjson(await baixar("auth_identities.ndjson"));
  console.log(`Vínculos de login: ${identidades.length}`);
  for (const i of identidades) {
    await sql(`
      insert into auth.identities (
        provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at
      ) values (
        ${valor(i.provider_id)}, ${valor(i.user_id)}, ${valor(i.identity_data)},
        ${valor(i.provider)}, ${valor(i.created_at)}, now(), ${valor(i.last_sign_in_at)}
      ) on conflict (provider_id, provider) do nothing;`);
  }

  // ---- 2. As tabelas de public ------------------------------------------
  // O gatilho `on_auth_user_created` já criou perfil, papel e registro clínico
  // para cada conta inserida acima. Não dá para desligá-lo daqui (a Management
  // API não é dona de auth.users), então em vez de brigar com ele o carregador
  // sobrescreve o esqueleto pelo dado real: `on conflict (user_id) do update`.
  const DERIVADAS_DO_GATILHO = {
    profiles: "user_id",
    doctors: "user_id",
    patients: "user_id",
    user_roles: "user_id, role",
  };

  const ordem = await ordemPorDependencia(tabelasAlvo);
  console.log(`\nCarregando ${ordem.length} tabelas na ordem das dependências.\n`);

  const carregado = {};
  for (const tabela of ordem) {
    const linhas = ndjson(await baixar(`${tabela}.ndjson`));
    try {
      carregado[tabela] = await inserir(
        `public.${tabela}`,
        linhas,
        DERIVADAS_DO_GATILHO[tabela] ?? null,
      );
    } catch (e) {
      carregado[tabela] = `ERRO: ${e.message.slice(0, 120)}`;
    }
  }

  // ---- 2b. Os arquivos ---------------------------------------------------
  // Os bytes não estão no backup: duplicá-los toda semana multiplicaria o
  // armazenamento sem cobrir o caso que importa (perda do projeto), que só uma
  // cópia externa cobre. O que o backup guarda é o inventário — e o
  // procedimento já pressupõe a origem de pé, então dá para copiar direto de
  // lá na hora da restauração.
  let arquivos = { copiados: 0, faltando: 0 };
  if (argv.includes("--com-arquivos")) {
    const inventario = ndjson(await baixar("storage_inventory.ndjson"));
    console.log(`\nCopiando ${inventario.length} arquivo(s) da origem.`);
    for (const item of inventario) {
      const origem = `https://${DE}.supabase.co/storage/v1/object/${item.bucket_id}/${item.name}`;
      const r = await fetch(origem, { headers: { Authorization: `Bearer ${ORIGEM_KEY}` } });
      if (!r.ok) {
        // Arquivo listado no inventário e ausente na origem é exatamente o que
        // o alarme de "documento sem arquivo" existe para pegar. Aqui ele
        // aparece de novo, e precisa aparecer alto.
        console.warn(`  ausente na origem: ${item.bucket_id}/${item.name}`);
        arquivos.faltando++;
        continue;
      }
      const bytes = new Uint8Array(await r.arrayBuffer());
      const destino = `https://${PARA}.supabase.co/storage/v1/object/${item.bucket_id}/${item.name}`;
      const up = await fetch(destino, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.ALVO_SERVICE_KEY ?? ""}`,
          "Content-Type": item.mime_type || "application/octet-stream",
          "x-upsert": "true",
        },
        body: bytes,
      });
      if (up.ok) arquivos.copiados++;
      else {
        console.warn(`  falha ao subir ${item.name}: ${up.status}`);
        arquivos.faltando++;
      }
    }
    console.log(`Arquivos: ${arquivos.copiados} copiados, ${arquivos.faltando} com problema.`);
  }

  // ---- 3. Conferência ----------------------------------------------------
  // Sem comparar com o manifesto, este script "funciona" do mesmo jeito que o
  // backup "funcionava": relatando sucesso sem responder quanto voltou.
  console.log("Tabela                    esperado  no alvo");
  let divergentes = 0;
  for (const tabela of ordem) {
    const esperado = manifesto.tables[tabela]?.rows ?? 0;
    const [{ n }] = await sql(`select count(*)::int as n from public.${tabela};`);
    const marca = n === esperado ? " " : "!";
    if (n !== esperado) divergentes++;
    console.log(`${marca} ${tabela.padEnd(24)} ${String(esperado).padStart(8)} ${String(n).padStart(8)}`);
  }
  const [{ n: contas }] = await sql("select count(*)::int as n from auth.users;");
  const marcaContas = contas === usuarios.length ? " " : "!";
  if (contas !== usuarios.length) divergentes++;
  console.log(`${marcaContas} ${"auth.users".padEnd(24)} ${String(usuarios.length).padStart(8)} ${String(contas).padStart(8)}`);

  console.log(
    divergentes === 0
      ? "\nTudo bateu com o manifesto."
      : `\n${divergentes} divergência(s) — investigue antes de considerar restaurado.`,
  );
  exit(divergentes === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\nRestauração interrompida:", e.message);
  exit(1);
});
