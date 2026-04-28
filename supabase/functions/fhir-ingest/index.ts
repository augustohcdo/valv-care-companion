// FHIR Ingest endpoint — hospitais enviam recursos (Observation, DiagnosticReport, etc.)
// Auth: Header X-Api-Key: vp_<prefix>_<secret>
// Aceita FHIR R4 Resource único ou Bundle.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_TYPES = new Set([
  "Observation", "DiagnosticReport", "Condition", "MedicationStatement",
  "Procedure", "Encounter", "AllergyIntolerance", "ImagingStudy",
]);

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const apiKey = req.headers.get("x-api-key") ?? "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = req.headers.get("user-agent") ?? null;

  const m = apiKey.match(/^vp_([a-z0-9]+)_(.+)$/i);
  if (!m) return json({ error: "invalid_api_key_format" }, 401);
  const prefix = m[1];
  const secret = m[2];
  const hash = await sha256Hex(secret);

  const { data: keyRow } = await admin
    .from("hospital_api_keys")
    .select("id, hospital_id, key_hash, scopes, ip_allowlist, revoked_at, expires_at")
    .eq("key_prefix", prefix)
    .maybeSingle();

  if (!keyRow || keyRow.key_hash !== hash) return json({ error: "unauthorized" }, 401);
  if (keyRow.revoked_at) return json({ error: "key_revoked" }, 401);
  if (new Date(keyRow.expires_at) < new Date()) return json({ error: "key_expired" }, 401);
  if (!keyRow.scopes?.includes("fhir.write")) return json({ error: "missing_scope" }, 403);
  if (keyRow.ip_allowlist?.length && ip && !keyRow.ip_allowlist.includes(ip))
    return json({ error: "ip_not_allowed" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const resources: any[] = body?.resourceType === "Bundle"
    ? (body.entry ?? []).map((e: any) => e.resource).filter(Boolean)
    : [body];

  const results: any[] = [];
  for (const r of resources) {
    const rt = r?.resourceType;
    if (!rt || !ALLOWED_TYPES.has(rt)) {
      results.push({ ok: false, error: "unsupported_resource_type", resourceType: rt });
      continue;
    }

    // Identifica paciente: campo subject.identifier.value = patient_user_id (uuid) OU subject.reference="Patient/<uuid>"
    const subjectRef: string | undefined = r.subject?.reference;
    const subjectIdentifier: string | undefined = r.subject?.identifier?.value;
    const patientId = subjectIdentifier ?? (subjectRef?.startsWith("Patient/") ? subjectRef.slice(8) : undefined);
    if (!patientId) { results.push({ ok: false, error: "missing_patient_reference" }); continue; }

    // Verifica grant ativo
    const { data: grant } = await admin
      .from("data_access_grants")
      .select("id, resource_scopes, direction, expires_at, revoked_at")
      .eq("hospital_id", keyRow.hospital_id)
      .eq("patient_id", patientId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!grant) {
      await admin.rpc("log_integration_event", {
        _hospital_id: keyRow.hospital_id, _patient_id: patientId, _actor: null, _api_key: keyRow.id,
        _action: "fhir_ingest_denied", _resource_type: rt, _resource_id: null,
        _success: false, _error: "no_active_grant", _ip: ip, _ua: ua, _meta: { fhir_id: r.id ?? null },
      });
      results.push({ ok: false, error: "no_active_grant", patientId }); continue;
    }
    if (!grant.resource_scopes?.includes(rt)) {
      results.push({ ok: false, error: "resource_not_in_scope", resourceType: rt }); continue;
    }
    if (grant.direction === "outbound") {
      results.push({ ok: false, error: "grant_is_outbound_only" }); continue;
    }

    // Resumo curto
    const summary = r.code?.text ?? r.code?.coding?.[0]?.display ?? r.conclusion ?? rt;

    const { data: inserted, error } = await admin
      .from("fhir_resources_inbound")
      .insert({
        hospital_id: keyRow.hospital_id,
        patient_id: patientId,
        grant_id: grant.id,
        resource_type: rt,
        fhir_id: r.id ?? null,
        payload: r,
        summary: String(summary).slice(0, 500),
      })
      .select("id")
      .single();

    if (error) { results.push({ ok: false, error: error.message }); continue; }

    await admin.rpc("log_integration_event", {
      _hospital_id: keyRow.hospital_id, _patient_id: patientId, _actor: null, _api_key: keyRow.id,
      _action: "fhir_ingest", _resource_type: rt, _resource_id: inserted.id,
      _success: true, _error: null, _ip: ip, _ua: ua, _meta: { fhir_id: r.id ?? null },
    });

    results.push({ ok: true, id: inserted.id, resourceType: rt });
  }

  await admin.from("hospital_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);

  return json({ accepted: results.filter(r => r.ok).length, total: results.length, results }, 200);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
