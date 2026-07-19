// Weekly export of critical clinical tables to a private storage bucket.
// Triggered by pg_cron (see migration) or manually by admins.
// Writes one NDJSON file per table under exports/YYYY-MM-DD/<table>.ndjson
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

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
];

const BUCKET = "clinical-exports";
const CRON_SECRET = Deno.env.get("EXPORT_CRON_SECRET");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

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

  // Manifest for the day.
  const manifest = {
    generated_at: new Date().toISOString(),
    stamp,
    tables: results,
  };
  await supabase.storage
    .from(BUCKET)
    .upload(`exports/${stamp}/_manifest.json`, new TextEncoder().encode(JSON.stringify(manifest, null, 2)), {
      contentType: "application/json",
      upsert: true,
    });

  return new Response(JSON.stringify(manifest), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
