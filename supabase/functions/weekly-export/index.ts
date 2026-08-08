// Weekly export of critical clinical tables to a private storage bucket.
// Triggered by pg_cron (see migration) or manually by admins.
// Writes one NDJSON file per table under exports/YYYY-MM-DD/<table>.ndjson
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { logError } from "../_shared/logError.ts";
import { recordJobRun, quemDisparou } from "../_shared/jobRun.ts";

const JOB = "weekly-export";

// A lista é escrita à mão e por isso envelhece mal: uma migration que cria
// tabela nova não a atualiza, e o export segue relatando sucesso porque nunca
// soube que deveria copiar mais. Foi assim que 15 tabelas ficaram de fora, entre
// elas a trilha de auditoria e a de papéis. `src/test/backupCoverage.test.ts`
// compara esta lista com o schema real e quebra o CI quando alguma escapa.
//
// Fora daqui, de propósito: `internal_secrets` — segredos de cron e URL base,
// sem dado clínico ou de usuário, recriáveis por migration; copiá-los para um
// arquivo num bucket só ampliaria a exposição.
const TABLES = [
  "clinical_cases",
  "case_events",
  "case_exams",
  "case_documents",
  "case_messages",
  "case_comments",
  "patient_documents",
  "appointments",
  "medications",
  "medication_logs",
  "symptom_entries",
  "user_consents",
  "consent_audit_log",
  "integration_audit_log",
  "data_access_grants",
  "data_access_requests",
  "dpo_requests",
  "fhir_resources_inbound",
  "fhir_resources_outbound",
  "profiles",
  "doctors",
  "patients",
  // Faltavam desde sempre.
  "audit_logs",            // trilha de auditoria clínica
  "user_roles",            // quem é admin: sem isto a restauração é ingovernável
  "case_collaborators",    // permissão de acesso a caso
  "prosthesis_catalog",    // catálogo, com a correção de valve_position
  "knowledge_chunks",      // base do RAG, com embeddings
  "knowledge_sources",     // procedência do conteúdo do RAG
  "content_review_status",
  "hospitals",
  "hospital_members",
  "hospital_api_keys",
  "notifications",
  "saved_filters",
  "client_errors",
  "job_runs",
  "watched_jobs",          // quem é vigiado e com que prazo
  "page_views",            // audiência agregada por dia; não identifica ninguém
  "retention_policies",    // o que é expurgado e com que prazo
];

// O que não é tabela de `public`. Fica numa lista à parte porque vem de RPC —
// `auth` e `storage` não são expostos pelo PostgREST. A guarda de cobertura compara
// `TABLES` com o schema real e quebraria se um nome daqui entrasse lá.
//
// Sem isto o backup não restaura um sistema: `profiles`, `doctors`, `patients`
// e `user_roles` têm chave estrangeira para `auth.users`, então numa
// restauração essas quatro nem carregariam — e ninguém conseguiria entrar.
//
// As funções devolvem identidade, nunca credencial: sem hash de senha e sem
// token de recuperação. Ver o motivo em
// supabase/migrations/20260803170000_auth_identity_export.sql.
const RPC_EXPORTS: Array<{ arquivo: string; rpc: string }> = [
  { arquivo: "auth_users", rpc: "auth_users_export" },
  { arquivo: "auth_identities", rpc: "auth_identities_export" },
  // Os bytes dos exames NÃO entram no backup: copiá-los toda semana
  // multiplicaria o armazenamento sem cobrir perda do projeto, que só uma cópia
  // externa cobre (ver RECOVERY.md). O que entra é a lista do que deveria
  // existir — barata, e é ela que permite a uma restauração saber o que trazer
  // e a um alarme perceber que um documento vivo perdeu o arquivo.
  { arquivo: "storage_inventory", rpc: "storage_inventory" },
];

const BUCKET = "clinical-exports";

/** Quantas execuções datadas ficam guardadas. Semanal, dá ~3 meses. */
const MANTER_EXPORTS = 12;

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Fora do try: o catch precisa dos dois para registrar a execução que falhou.
  const startedAt = new Date().toISOString();
  let triggeredBy = "desconhecido";

  try {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Read the shared cron secret from the locked internal_secrets table.
  const { data: secretRow } = await supabase
    .from("internal_secrets")
    .select("value")
    .eq("key", "export_cron_secret")
    .maybeSingle();
  const CRON_SECRET = secretRow?.value ?? null;

  // Auth: allow (a) valid cron secret via header, or (b) authenticated admin JWT.
  const cronHeader = req.headers.get("x-cron-secret");
  let authorized = !!(CRON_SECRET && cronHeader === CRON_SECRET);

  if (!authorized) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabase.auth.getClaims(token);
      const uid = data?.claims?.sub;
      if (uid) {
        const { data: role } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid)
          .eq("role", "admin")
          .maybeSingle();
        authorized = !!role;
      }
    }
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  triggeredBy = quemDisparou(await req.json().catch(() => ({})), !!cronHeader);
  const results: Record<string, { rows: number; bytes: number; error?: string }> = {};

  for (const table of TABLES) {
    try {
      const pageSize = 1000;
      let from = 0;
      const chunks: string[] = [];
      let total = 0;
      // Paginate through the table.
      // service_role bypasses RLS so this reads everything.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        chunks.push(data.map((r) => JSON.stringify(r)).join("\n"));
        total += data.length;
        if (data.length < pageSize) break;
        from += pageSize;
      }
      const body = chunks.join("\n");
      const bytes = new TextEncoder().encode(body);
      const path = `exports/${stamp}/${table}.ndjson`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, {
          contentType: "application/x-ndjson",
          upsert: true,
        });
      if (upErr) throw upErr;
      results[table] = { rows: total, bytes: bytes.byteLength };
    } catch (e) {
      results[table] = { rows: 0, bytes: 0, error: (e as Error).message };
    }
  }

  // As contas, pelo mesmo caminho e no mesmo manifesto: um arquivo que não
  // aparece na contagem é um arquivo que ninguém percebe faltar.
  for (const { arquivo, rpc } of RPC_EXPORTS) {
    try {
      const { data, error } = await supabase.rpc(rpc);
      if (error) throw error;
      const linhas = (data ?? []) as Record<string, unknown>[];
      const body = linhas.map((r) => JSON.stringify(r)).join("\n");
      const bytes = new TextEncoder().encode(body);
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(`exports/${stamp}/${arquivo}.ndjson`, bytes, {
          contentType: "application/x-ndjson",
          upsert: true,
        });
      if (upErr) throw upErr;
      results[arquivo] = { rows: linhas.length, bytes: bytes.byteLength };
    } catch (e) {
      results[arquivo] = { rows: 0, bytes: 0, error: (e as Error).message };
    }
  }

  // Manifest for the day.
  const manifest = {
    generated_at: new Date().toISOString(),
    stamp,
    tables: results,
  };

  // Registro da execução. Sem isto, uma falha do backup é invisível — foi o
  // que deixou o export quebrado por semanas sem ninguém perceber.
  const entries = Object.values(results);
  const failed = entries.filter((r) => r.error);
  await recordJobRun({
    job: JOB,
    startedAt,
    ok: failed.length === 0,
    itemsOk: entries.length - failed.length,
    itemsFailed: failed.length,
    details: {
      total_rows: entries.reduce((a, r) => a + r.rows, 0),
      total_bytes: entries.reduce((a, r) => a + r.bytes, 0),
    },
    error: failed.length ? failed.map((r) => r.error).join("; ") : null,
    triggeredBy,
  });
  await supabase.storage
    .from(BUCKET)
    .upload(`exports/${stamp}/_manifest.json`, new TextEncoder().encode(JSON.stringify(manifest, null, 2)), {
      contentType: "application/json",
      upsert: true,
    });

  // Retenção. O bucket acumulava uma pasta por execução, para sempre: 102
  // objetos já estavam lá quando isto foi escrito, e cada pasta cresce junto
  // com o banco. Não era volume, era ausência de fim.
  //
  // Duas travas, e as duas importam: só roda quando a execução do dia terminou
  // sem nenhuma falha de tabela, e nunca toca nas mais recentes. Uma rotação
  // que apaga backup bom porque o export do dia quebrou é pior que não ter
  // rotação nenhuma.
  const removidas: string[] = [];
  if (failed.length === 0) {
    try {
      const { data: pastas } = await supabase.storage.from(BUCKET).list("exports", { limit: 1000 });
      const datas = (pastas ?? [])
        .map((p) => p.name)
        .filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n))
        .sort()
        .reverse();
      for (const antiga of datas.slice(MANTER_EXPORTS)) {
        const { data: arquivos } = await supabase.storage.from(BUCKET).list(`exports/${antiga}`, { limit: 1000 });
        const caminhos = (arquivos ?? []).map((a) => `exports/${antiga}/${a.name}`);
        if (caminhos.length) await supabase.storage.from(BUCKET).remove(caminhos);
        removidas.push(antiga);
      }
    } catch (e) {
      // Falhar ao limpar não pode manchar um backup que deu certo.
      console.error("retenção do export falhou", e);
    }
  }

  return new Response(JSON.stringify({ ...manifest, retencao_removidas: removidas }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  } catch (e) {
    // Um crash antes do laço das tabelas não gravava linha nenhuma, e a tela de
    // admin não tinha como distinguir isso de "ainda não chegou a hora".
    await recordJobRun({
      job: JOB, startedAt, ok: false,
      error: e instanceof Error ? e.message : String(e),
      triggeredBy,
    });
    await logError({
      source: "edge_function", context: "weekly-export",
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack ?? null : null,
    });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
