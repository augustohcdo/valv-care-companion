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
 * A partir da cópia externa, quando o projeto de origem não existe mais:
 *   SUPABASE_ACCESS_TOKEN=sbp_...
 *   OFFSITE_ENDPOINT=... OFFSITE_REGION=... OFFSITE_BUCKET=...
 *   OFFSITE_KEY_ID=... OFFSITE_SECRET=...
 *   node scripts/restore.mjs --offsite --para <ref-alvo> --data 2026-08-03 [--limpar]
 *
 * O que ele NÃO faz, e está no RECOVERY.md: criar o projeto, aplicar as
 * migrations, publicar as edge functions, gravar segredos, recriar os
 * agendamentos do pg_cron e reapontar a Vercel. Este script cuida só dos dados.
 *
 * O veredito do fim é a parte que importa, e mora em
 * `lib/veredito-restauracao.mjs` — separado para poder ser exercitado por teste,
 * porque este script roda uma vez na vida, sob pressão. Saída 0 é "bateu com o
 * manifesto", 1 é "divergiu" e 2 é "não deu para conferir".
 */
import { argv, env, exit } from "node:process";
import { webcrypto } from "node:crypto";
import {
  INVENTARIO,
  NAO_SAO_TABELAS,
  marcaDoEstado,
  vereditoDaRestauracao,
} from "./lib/veredito-restauracao.mjs";

/** Hashes do `_offsite_manifest.json`, preenchidos no início de `main()`. */
let offsiteHashes = null;

const arg = (nome, obrigatorio = true) => {
  const i = argv.indexOf(`--${nome}`);
  const v = i > -1 ? argv[i + 1] : undefined;
  if (!v && obrigatorio) {
    console.error(`Falta --${nome}`);
    exit(1);
  }
  return v;
};

/**
 * `--offsite` lê a cópia externa em vez do bucket do Supabase.
 *
 * Não é um extra: é o único modo que serve ao cenário que justifica a cópia
 * externa. Se o projeto de origem sumiu, `ORIGEM_SERVICE_KEY` e `--de` não
 * existem mais — exigi-los aqui travaria a restauração exatamente no dia em que
 * ela é a última coisa que resta.
 */
const OFFSITE = argv.includes("--offsite");

/**
 * Se esta execução vai copiar os anexos dos exames.
 *
 * Uma const, e não três `argv.includes` espalhados: é ela que decide se o
 * veredito cobra o inventário, e a decisão não pode ser lida de um jeito num
 * lugar e de outro em outro.
 */
const COM_ARQUIVOS = argv.includes("--com-arquivos");

const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const ORIGEM_KEY = env.ORIGEM_SERVICE_KEY;
if (!TOKEN || (!ORIGEM_KEY && !OFFSITE)) {
  console.error("Defina SUPABASE_ACCESS_TOKEN e ORIGEM_SERVICE_KEY (ou use --offsite).");
  exit(1);
}

const OFF = OFFSITE
  ? {
      endpoint: (env.OFFSITE_ENDPOINT ?? "").replace(/\/+$/, ""),
      region: env.OFFSITE_REGION,
      bucket: env.OFFSITE_BUCKET,
      keyId: env.OFFSITE_KEY_ID,
      secret: env.OFFSITE_SECRET,
    }
  : null;
if (OFFSITE && Object.values(OFF).some((v) => !v)) {
  console.error(
    "Com --offsite, defina OFFSITE_ENDPOINT, OFFSITE_REGION, OFFSITE_BUCKET, " +
      "OFFSITE_KEY_ID e OFFSITE_SECRET.",
  );
  exit(1);
}

const DE = arg("de", !OFFSITE);
const PARA = arg("para");
const DATA = arg("data");
const BUCKET = "clinical-exports";

if (OFFSITE && COM_ARQUIVOS) {
  // A cópia externa leva as linhas do banco, não os anexos dos exames — está
  // escrito no RECOVERY.md. Aceitar a combinação em silêncio faria a
  // restauração parecer completa quando não é.
  console.error("--com-arquivos não vale com --offsite: a cópia externa não leva os anexos.");
  exit(1);
}

// `--com-arquivos` sem a chave do alvo era a receita do falso verde: todo POST
// de upload volta 401, nenhum exame chega, e — antes do veredito cobrir os
// anexos — a última linha era "Tudo bateu com o manifesto.". Recusar aqui é
// melhor que detectar no fim: o operador descobre em um segundo, não depois de
// carregar 38 tabelas.
if (COM_ARQUIVOS && !env.ALVO_SERVICE_KEY) {
  console.error("Com --com-arquivos, defina ALVO_SERVICE_KEY (service_role do projeto novo).");
  exit(1);
}

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

/** Cliente assinado do provedor externo, criado só quando `--offsite`. */
let awsClient = null;
async function clienteOffsite() {
  if (!awsClient) {
    // A mesma `aws4fetch` que a edge function usa para escrever. Uma
    // implementação de assinatura só: duas divergiriam, e a que menos roda
    // seria justamente a do dia do desastre.
    const { AwsClient } = await import("aws4fetch");
    awsClient = new AwsClient({
      accessKeyId: OFF.keyId,
      secretAccessKey: OFF.secret,
      service: "s3",
      region: OFF.region,
    });
  }
  return awsClient;
}

/** Um arquivo do export da origem. `null` quando não existe. */
async function baixar(nome) {
  const caminho = `exports/${DATA}/${nome}`;

  if (OFFSITE) {
    const aws = await clienteOffsite();
    const r = await aws.fetch(`${OFF.endpoint}/${OFF.bucket}/${caminho}`, { method: "GET" });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`download externo de ${nome} falhou (${r.status})`);
    const bytes = new Uint8Array(await r.arrayBuffer());

    // Conferência de integridade contra o manifesto da cópia. A gravação já
    // releu cada objeto na hora de copiar; isto cobre o que pode ter acontecido
    // **depois** — corrupção silenciosa, truncamento, arquivo trocado. Carregar
    // um NDJSON corrompido produziria uma restauração parcial com cara de
    // completa, que é o pior desfecho possível aqui.
    const esperado = offsiteHashes?.[nome]?.sha256;
    if (esperado) {
      const hash = Buffer.from(
        await webcrypto.subtle.digest("SHA-256", bytes),
      ).toString("hex");
      if (hash !== esperado) {
        throw new Error(
          `integridade falhou em ${nome}: manifesto diz ${esperado.slice(0, 12)}…, ` +
            `arquivo baixado é ${hash.slice(0, 12)}…`,
        );
      }
    }
    return new TextDecoder().decode(bytes);
  }

  const url = `https://${DE}.supabase.co/storage/v1/object/${BUCKET}/${caminho}`;
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
  const origem = OFFSITE ? `cópia externa em ${OFF.bucket}` : `projeto ${DE}`;
  console.log(`Restaurando o export de ${DATA} (${origem}) em ${PARA}\n`);

  if (OFFSITE) {
    // Precisa vir antes de qualquer outro download: é ele que permite conferir
    // o hash de cada arquivo enquanto baixa.
    const off = JSON.parse((await baixar("_offsite_manifest.json")) ?? "null");
    if (!off?.arquivos) {
      throw new Error(
        `não achei _offsite_manifest.json em ${DATA} — sem ele não dá para ` +
          "conferir a integridade do que foi copiado.",
      );
    }
    offsiteHashes = off.arquivos;
    console.log(
      `Manifesto da cópia externa: ${Object.keys(off.arquivos).length} arquivo(s), ` +
        `copiados em ${off.copiado_em}.`,
    );
    if (Object.keys(off.falhas ?? {}).length) {
      console.warn(`ATENÇÃO: a cópia registrou falhas em: ${Object.keys(off.falhas).join(", ")}`);
    }
  }

  const manifesto = JSON.parse((await baixar("_manifest.json")) ?? "null");
  if (!manifesto) throw new Error(`não achei o manifesto de ${DATA}`);
  console.log(`Manifesto gerado em ${manifesto.generated_at}, ${Object.keys(manifesto.tables).length} arquivos.\n`);

  // `NAO_SAO_TABELAS` vem de `lib/veredito-restauracao.mjs`. Sem esta lista o
  // carregador tentaria `select count(*) from public.storage_inventory` e
  // quebraria a restauração inteira num nome que nunca foi tabela.
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

  // `erroDeCarga` guarda o MOTIVO. A versão anterior gravava a mensagem num
  // mapa `carregado` que ninguém lia depois: a conferência mostrava "esperado
  // 50, no alvo 0" e o `insert` tinha dito exatamente por quê, numa string que
  // o script jogou fora. Às três da manhã, o motivo é a metade útil.
  const erroDeCarga = {};
  for (const tabela of ordem) {
    const linhas = ndjson(await baixar(`${tabela}.ndjson`));
    try {
      await inserir(`public.${tabela}`, linhas, DERIVADAS_DO_GATILHO[tabela] ?? null);
    } catch (e) {
      erroDeCarga[tabela] = e.message.slice(0, 200);
    }
  }

  // ---- 2b. Os arquivos ---------------------------------------------------
  // Os bytes não estão no backup: duplicá-los toda semana multiplicaria o
  // armazenamento sem cobrir o caso que importa (perda do projeto), que só uma
  // cópia externa cobre. O que o backup guarda é o inventário — e o
  // procedimento já pressupõe a origem de pé, então dá para copiar direto de
  // lá na hora da restauração.
  const arquivos = { copiados: 0, ausentesNaOrigem: 0, falhaAoSubir: 0 };
  if (COM_ARQUIVOS) {
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
        arquivos.ausentesNaOrigem++;
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
        arquivos.falhaAoSubir++;
      }
    }
    // Os dois motivos separados de propósito: "ausente na origem" é dado que já
    // tinha sumido antes de a restauração começar — é o que o alarme de
    // "documento no prontuário sem arquivo" existe para pegar — e "falha ao
    // subir" é falha desta execução. Os dois deixam o alvo incompleto, e pedem
    // providências diferentes.
    console.log(
      `Arquivos: ${arquivos.copiados} copiados, ` +
      `${arquivos.ausentesNaOrigem} ausente(s) na origem, ` +
      `${arquivos.falhaAoSubir} falha(s) ao subir.`,
    );
  }

  // ---- 3. Conferência ----------------------------------------------------
  //
  // Sem comparar com o manifesto, este script "funciona" do mesmo jeito que o
  // backup "funcionava": relatando sucesso sem responder quanto voltou.
  //
  // E a conferência tem de cobrir TUDO o que esta execução se propôs a fazer.
  // Ela cobria as tabelas de `public` e mais nada: os vínculos de login não
  // apareciam, as contas eram comparadas com o próprio arquivo baixado
  // (`contas === usuarios.length` — zero contra zero sempre bate) e os anexos
  // copiados com `--com-arquivos` não entravam no veredito nem no código de
  // saída. O porquê e a prova de cada um estão em
  // `lib/veredito-restauracao.mjs` e em `src/test/vereditoDaRestauracao.test.ts`.
  const medido = {};
  for (const tabela of ordem) {
    const [{ n }] = await sql(`select count(*)::int as n from public.${tabela};`);
    medido[tabela] = n;
  }
  const [{ n: contas }] = await sql("select count(*)::int as n from auth.users;");
  medido.auth_users = contas;
  const [{ n: vinculos }] = await sql("select count(*)::int as n from auth.identities;");
  medido.auth_identities = vinculos;
  if (COM_ARQUIVOS) medido[INVENTARIO] = arquivos.copiados;

  const veredito = vereditoDaRestauracao({
    manifesto, medido, pediuArquivos: COM_ARQUIVOS,
  });

  console.log("  artefato                 no backup    no alvo");
  for (const l of veredito.linhas) {
    console.log(
      `${marcaDoEstado(l.estado)} ${l.nome.padEnd(24)} ` +
      `${String(l.esperado).padStart(9)} ${(l.obtido === null ? "—" : String(l.obtido)).padStart(10)}` +
      (l.estado === "nao-pedido" ? "   (não pedido nesta execução)" : "") +
      (l.detalhe ? `   ${l.detalhe}` : ""),
    );
  }

  // O motivo, logo abaixo do número que ele explica.
  const comErro = Object.keys(erroDeCarga);
  if (comErro.length) {
    console.log("\nTabelas que recusaram a carga, e por quê:");
    for (const t of comErro) console.log(`  · ${t}: ${erroDeCarga[t]}`);
  }

  if (COM_ARQUIVOS && (arquivos.ausentesNaOrigem || arquivos.falhaAoSubir)) {
    console.log(
      `\nAnexos: ${arquivos.ausentesNaOrigem} ausente(s) na origem e ` +
      `${arquivos.falhaAoSubir} falha(s) ao subir — o alvo está incompleto nos exames.`,
    );
  }

  if (veredito.divergentes) {
    console.log(`\n${veredito.divergentes} divergência(s) — investigue antes de considerar restaurado.`);
  }
  if (veredito.naoConferidos) {
    console.log(
      `\n${veredito.naoConferidos} artefato(s) que NÃO DÁ PARA CONFERIR — veja as linhas com "?".` +
      "\nNão é o mesmo que bater: é não saber. Onde o manifesto registra erro do" +
      "\nexport, o dado não existe nem no backup, e zero no alvo não prova nada.",
    );
  }
  if (!veredito.divergentes && !veredito.naoConferidos) {
    console.log("\nTudo bateu com o manifesto.");
  }
  exit(veredito.codigo);
}

main().catch((e) => {
  console.error("\nRestauração interrompida:", e.message);
  exit(1);
});
