// FHIR Read endpoint — hospitais consultam resumo do paciente em FHIR R4
// GET /fhir-read?patient=<uuid>&type=Condition,Observation
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const patientId = url.searchParams.get("patient");
  const types = (url.searchParams.get("type") ?? "Condition,Observation,MedicationStatement")
    .split(",").map(s => s.trim()).filter(Boolean);
  if (!patientId) return json({ error: "missing_patient" }, 400);

  const apiKey = req.headers.get("x-api-key") ?? "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = req.headers.get("user-agent") ?? null;

  const m = apiKey.match(/^vp_([a-z0-9]+)_(.+)$/i);
  if (!m) return json({ error: "invalid_api_key_format" }, 401);
  const hash = await sha256Hex(m[2]);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: keyRow } = await admin
    .from("hospital_api_keys")
    .select("id, hospital_id, key_hash, scopes, ip_allowlist, revoked_at, expires_at")
    .eq("key_prefix", m[1])
    .maybeSingle();

  if (!keyRow || keyRow.key_hash !== hash) return json({ error: "unauthorized" }, 401);
  if (keyRow.revoked_at) return json({ error: "key_revoked" }, 401);
  if (new Date(keyRow.expires_at) < new Date()) return json({ error: "key_expired" }, 401);
  if (!keyRow.scopes?.includes("fhir.read")) return json({ error: "missing_scope" }, 403);
  if (keyRow.ip_allowlist?.length && ip && !keyRow.ip_allowlist.includes(ip))
    return json({ error: "ip_not_allowed" }, 403);

  const { data: grant } = await admin
    .from("data_access_grants")
    .select("id, resource_scopes, direction")
    .eq("hospital_id", keyRow.hospital_id)
    .eq("patient_id", patientId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!grant) {
    await admin.rpc("log_integration_event", {
      _hospital_id: keyRow.hospital_id, _patient_id: patientId, _actor: null, _api_key: keyRow.id,
      _action: "fhir_read_denied", _resource_type: null, _resource_id: null,
      _success: false, _error: "no_active_grant", _ip: ip, _ua: ua, _meta: null,
    });
    return json({ error: "no_active_grant" }, 403);
  }
  if (grant.direction === "inbound") return json({ error: "grant_is_inbound_only" }, 403);

  const allowed = types.filter(t => grant.resource_scopes.includes(t));
  const entries: any[] = [];

  // Patient resource (mínimo)
  const { data: profile } = await admin.from("profiles").select("full_name, birth_date").eq("user_id", patientId).maybeSingle();
  if (profile) {
    entries.push({
      resource: {
        resourceType: "Patient",
        id: patientId,
        name: [{ text: profile.full_name }],
        birthDate: profile.birth_date ?? undefined,
      },
    });
  }

  // Conditions ← clinical_cases
  if (allowed.includes("Condition")) {
    const { data: cases } = await admin
      .from("clinical_cases")
      .select("id, valve_type, valve_disease, severity, status, created_at")
      .eq("patient_id", (await admin.from("patients").select("id").eq("user_id", patientId).maybeSingle()).data?.id ?? "00000000-0000-0000-0000-000000000000");
    for (const c of cases ?? []) {
      entries.push({
        resource: {
          resourceType: "Condition",
          id: c.id,
          subject: { reference: `Patient/${patientId}` },
          code: { text: `${c.valve_type} ${c.valve_disease} (${c.severity})` },
          clinicalStatus: { text: c.status },
          recordedDate: c.created_at,
        },
      });
    }
  }

  // Observations ← symptom_entries (últimos 30)
  if (allowed.includes("Observation")) {
    const patient = (await admin.from("patients").select("id").eq("user_id", patientId).maybeSingle()).data;
    if (patient) {
      const { data: syms } = await admin
        .from("symptom_entries")
        .select("entry_date, dyspnea, fatigue, chest_pain, weight_kg, bp_systolic, bp_diastolic")
        .eq("patient_id", patient.id)
        .order("entry_date", { ascending: false })
        .limit(30);
      for (const s of syms ?? []) {
        entries.push({
          resource: {
            resourceType: "Observation",
            status: "final",
            subject: { reference: `Patient/${patientId}` },
            effectiveDateTime: s.entry_date,
            code: { text: "Diário de sintomas" },
            component: [
              s.dyspnea != null && { code: { text: "Dispneia (0-10)" }, valueQuantity: { value: s.dyspnea } },
              s.fatigue != null && { code: { text: "Fadiga (0-10)" }, valueQuantity: { value: s.fatigue } },
              s.chest_pain != null && { code: { text: "Dor torácica (0-10)" }, valueQuantity: { value: s.chest_pain } },
              s.weight_kg != null && { code: { text: "Peso (kg)" }, valueQuantity: { value: s.weight_kg, unit: "kg" } },
              s.bp_systolic != null && { code: { text: "PA sistólica" }, valueQuantity: { value: s.bp_systolic, unit: "mmHg" } },
              s.bp_diastolic != null && { code: { text: "PA diastólica" }, valueQuantity: { value: s.bp_diastolic, unit: "mmHg" } },
            ].filter(Boolean),
          },
        });
      }
    }
  }

  // MedicationStatement ← medications ativas
  if (allowed.includes("MedicationStatement")) {
    const patient = (await admin.from("patients").select("id").eq("user_id", patientId).maybeSingle()).data;
    if (patient) {
      const { data: meds } = await admin
        .from("medications")
        .select("name, dose, frequency, start_date, active")
        .eq("patient_id", patient.id)
        .eq("active", true);
      for (const m of meds ?? []) {
        entries.push({
          resource: {
            resourceType: "MedicationStatement",
            status: "active",
            subject: { reference: `Patient/${patientId}` },
            medicationCodeableConcept: { text: m.name },
            dosage: [{ text: `${m.dose ?? ""} ${m.frequency ?? ""}`.trim() }],
            effectivePeriod: { start: m.start_date },
          },
        });
      }
    }
  }

  const bundle = {
    resourceType: "Bundle",
    type: "searchset",
    timestamp: new Date().toISOString(),
    total: entries.length,
    entry: entries,
  };

  await admin.from("fhir_resources_outbound").insert({
    hospital_id: keyRow.hospital_id,
    patient_id: patientId,
    grant_id: grant.id,
    resource_type: "Bundle" as any,
    payload: bundle,
    requester_ip: ip,
  });

  await admin.rpc("log_integration_event", {
    _hospital_id: keyRow.hospital_id, _patient_id: patientId, _actor: null, _api_key: keyRow.id,
    _action: "fhir_read", _resource_type: null, _resource_id: null,
    _success: true, _error: null, _ip: ip, _ua: ua, _meta: { types: allowed, count: entries.length },
  });
  await admin.from("hospital_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);

  return json(bundle, 200);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
