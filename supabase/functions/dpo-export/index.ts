// Gera um export dos dados pessoais de um titular para uma solicitação
// LGPD de acesso/portabilidade (dpo_requests.right_type IN ('acesso','portabilidade')).
// Requer admin autenticado. NÃO executa eliminação — só exportação.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { logError } from "../_shared/logError.ts";

// Tabelas cujo `patient_id` referencia `patients.id` (não auth.users.id).
const PATIENT_ID_TABLES = ["clinical_cases", "patient_documents", "symptom_entries", "medications", "medication_logs"];

// Tabelas cujo `patient_id` referencia auth.users.id diretamente (convenção
// diferente — RLS usa `patient_id = auth.uid()`, não um join via `patients`).
const USER_AS_PATIENT_ID_TABLES = [
  "data_access_requests", "data_access_grants",
  "fhir_resources_inbound", "fhir_resources_outbound", "integration_audit_log",
];

const USER_ID_TABLES = [
  "profiles", "doctors", "patients", "user_consents", "consent_audit_log",
  "notifications", "saved_filters", "dpo_requests",
];

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims?.sub) return json({ error: "unauthorized" }, 401);
    const adminUserId = claims.claims.sub;

    const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: adminUserId, _role: "admin" });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
    const { dpo_request_id } = body ?? {};
    if (!dpo_request_id) return json({ error: "missing_dpo_request_id" }, 400);

    const { data: reqRow, error: reqErr } = await admin
      .from("dpo_requests")
      .select("id, user_id, right_type")
      .eq("id", dpo_request_id)
      .maybeSingle();
    if (reqErr || !reqRow) return json({ error: "not_found" }, 404);
    if (!["acesso", "portabilidade"].includes(reqRow.right_type)) {
      return json({ error: "unsupported_right_type" }, 400);
    }
    const targetUserId = reqRow.user_id as string;

    const { data: patientRow } = await admin.from("patients").select("id").eq("user_id", targetUserId).maybeSingle();
    const { data: doctorRow } = await admin.from("doctors").select("id").eq("user_id", targetUserId).maybeSingle();
    const patientId = patientRow?.id ?? null;
    const doctorId = doctorRow?.id ?? null;

    const gathered: Record<string, unknown[]> = {};

    for (const table of USER_ID_TABLES) {
      const { data } = await admin.from(table).select("*").eq("user_id", targetUserId);
      gathered[table] = data ?? [];
    }

    for (const table of PATIENT_ID_TABLES) {
      gathered[table] = patientId
        ? (await admin.from(table).select("*").eq("patient_id", patientId)).data ?? []
        : [];
    }

    for (const table of USER_AS_PATIENT_ID_TABLES) {
      const { data } = await admin.from(table).select("*").eq("patient_id", targetUserId);
      gathered[table] = data ?? [];
    }

    gathered["case_collaborators"] = doctorId
      ? (await admin.from("case_collaborators").select("*").eq("doctor_id", doctorId)).data ?? []
      : [];
    gathered["case_comments"] = doctorId
      ? (await admin.from("case_comments").select("*").eq("author_doctor_id", doctorId)).data ?? []
      : [];
    gathered["clinical_cases_as_doctor"] = doctorId
      ? (await admin.from("clinical_cases").select("*").eq("doctor_id", doctorId)).data ?? []
      : [];

    // Segunda ordem: tabelas filhas de clinical_cases (só relevantes se o
    // titular tem casos como paciente ou como médico responsável).
    const caseIds = [
      ...((gathered["clinical_cases"] as any[]) ?? []).map((c) => c.id),
      ...((gathered["clinical_cases_as_doctor"] as any[]) ?? []).map((c) => c.id),
    ];
    for (const table of ["case_events", "case_exams", "case_messages", "case_documents"]) {
      gathered[table] = caseIds.length
        ? (await admin.from(table).select("*").in("case_id", caseIds)).data ?? []
        : [];
    }

    const doc = {
      generated_at: new Date().toISOString(),
      dpo_request_id,
      right_type: reqRow.right_type,
      subject_user_id: targetUserId,
      data: gathered,
    };
    const path = `dpo-exports/${dpo_request_id}-${Date.now()}.json`;
    const { error: upErr } = await admin.storage.from("clinical-exports").upload(
      path,
      new TextEncoder().encode(JSON.stringify(doc, null, 2)),
      { contentType: "application/json", upsert: false },
    );
    if (upErr) return json({ error: upErr.message }, 500);

    const { data: signed, error: signErr } = await admin.storage
      .from("clinical-exports")
      .createSignedUrl(path, 60 * 30);
    if (signErr || !signed) return json({ error: signErr?.message ?? "sign_failed" }, 500);

    await admin.from("audit_logs").insert({
      user_id: adminUserId,
      action: "dpo_export_generated",
      target_table: "dpo_requests",
      target_id: dpo_request_id,
      metadata: { tables: Object.keys(gathered), right_type: reqRow.right_type },
    });

    return json({ url: signed.signedUrl, path, generated_at: doc.generated_at }, 200);
  } catch (e) {
    await logError({
      source: "edge_function", context: "dpo-export",
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack ?? null : null,
    });
    return json({ error: "internal_error" }, 500);
  }
});
