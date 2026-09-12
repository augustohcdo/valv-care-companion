// FHIR Read endpoint — hospitais consultam resumo do paciente em FHIR R4
// GET /fhir-read?patient=<uuid>&type=Condition,Observation
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { logError } from "../_shared/logError.ts";
import { isValidPatientId, resolveAllowedTypes } from "../_shared/fhirSchema.ts";

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const corsHeaders = {
    ...buildCorsHeaders(req),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
  const url = new URL(req.url);
  const patientId = url.searchParams.get("patient");
  const types = (url.searchParams.get("type") ?? "Patient,Condition,Observation,MedicationStatement")
    .split(",").map(s => s.trim()).filter(Boolean);
  // UUID inválido chegava até a consulta e voltava como "no_active_grant",
  // mandando o hospital investigar a autorização em vez do próprio pedido.
  if (!isValidPatientId(patientId)) return json({ error: "missing_or_invalid_patient" }, 400);

  const apiKey = req.headers.get("x-api-key") ?? "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = req.headers.get("user-agent") ?? null;

  const m = apiKey.match(/^vp_([a-z0-9]+)_(.+)$/i);
  if (!m) return json({ error: "invalid_api_key_format" }, 401);
  const hash = await sha256Hex(m[2]);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: keyRow, error: erroChave } = await admin
    .from("hospital_api_keys")
    .select("id, hospital_id, key_hash, scopes, ip_allowlist, revoked_at, expires_at")
    .eq("key_prefix", m[1])
    .maybeSingle();

  // Recusar sem conseguir conferir a chave é a direção certa. Chamar isso de
  // "unauthorized" manda o hospital caçar problema na credencial dele —
  // revogar, emitir outra, abrir chamado — por causa de uma leitura que caiu.
  if (erroChave) return json({ error: "key_check_failed", detail: erroChave.message }, 503);
  if (!keyRow || keyRow.key_hash !== hash) return json({ error: "unauthorized" }, 401);
  if (keyRow.revoked_at) return json({ error: "key_revoked" }, 401);
  if (new Date(keyRow.expires_at) < new Date()) return json({ error: "key_expired" }, 401);
  if (!keyRow.scopes?.includes("fhir.read")) return json({ error: "missing_scope" }, 403);
  if (keyRow.ip_allowlist?.length && ip && !keyRow.ip_allowlist.includes(ip))
    return json({ error: "ip_not_allowed" }, 403);

  const { data: grant, error: erroGrant } = await admin
    .from("data_access_grants")
    .select("id, resource_scopes, direction")
    .eq("hospital_id", keyRow.hospital_id)
    .eq("patient_id", patientId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  // "Não consegui ler a autorização" virava `no_active_grant`, que é uma
  // afirmação sobre a VONTADE DO PACIENTE: o hospital lê que o consentimento
  // não existe ou foi revogado. Registrar isso na trilha de integração como
  // recusa por falta de autorização seria pior ainda — a trilha passaria a
  // dizer que não havia consentimento numa noite em que havia.
  if (erroGrant) {
    return json({ error: "grant_check_failed", detail: erroGrant.message }, 503);
  }
  if (!grant) {
    await admin.rpc("log_integration_event", {
      _hospital_id: keyRow.hospital_id, _patient_id: patientId, _actor: null, _api_key: keyRow.id,
      _action: "fhir_read_denied", _resource_type: null, _resource_id: null,
      _success: false, _error: "no_active_grant", _ip: ip, _ua: ua, _meta: null,
    });
    return json({ error: "no_active_grant" }, 403);
  }
  if (grant.direction === "inbound") return json({ error: "grant_is_inbound_only" }, 403);

  const allowed = resolveAllowedTypes(types, grant.resource_scopes);
  const entries: any[] = [];

  /**
   * O que não pôde ser lido. Enquanto tiver item, não sai bundle.
   *
   * ## Por que aqui a falha aborta em vez de degradar
   *
   * Este endpoint entrega dado clínico ao SISTEMA DE UM HOSPITAL, de máquina
   * para máquina. Cada leitura daqui terminava em `?? []` com o `error` no
   * chão, e o resultado era um FHIR Bundle bem formado, com `total` coerente,
   * HTTP 200 — e uma seção faltando.
   *
   * O caso que decide a questão é `MedicationStatement`: uma falha de leitura
   * em `medications` entregava um paciente **sem anticoagulante nenhum**. Quem
   * tem prótese mecânica e usa varfarina chega ao outro lado como quem não usa
   * nada. Do lado de lá não há como distinguir isso de um paciente que
   * realmente não toma medicação, e ninguém recarrega a página — não há
   * página.
   *
   * `Condition` é do mesmo tamanho: estenose aórtica importante vira paciente
   * sem valvopatia registrada.
   *
   * Bundle incompleto que se apresenta como completo é pior que erro: o erro o
   * hospital repete; o bundle ele arquiva.
   */
  const falhas: string[] = [];

  /**
   * O `patients.id` do titular, lido UMA vez.
   *
   * Antes esta mesma consulta aparecia três vezes, e uma delas com o pior
   * padrão do arquivo:
   *
   *     .eq("patient_id", (await admin.from("patients")…).data?.id
   *                        ?? "00000000-0000-0000-0000-000000000000")
   *
   * O sentinela de UUID zero transformava falha de leitura numa consulta
   * perfeitamente válida que não casa com nada — e devolve zero linhas, sem
   * erro, sem aviso. Não é ausência de dado lida como vazio: é um valor
   * INVENTADO no lugar do que não foi possível ler, produzindo uma resposta
   * limpa e plausível. É a forma mais difícil de perceber que esta sessão
   * encontrou.
   */
  const { data: pacienteRow, error: erroPaciente } = await admin
    .from("patients").select("id").is("deleted_at", null).eq("user_id", patientId).maybeSingle();
  if (erroPaciente) falhas.push(`patients: ${erroPaciente.message}`);
  const pacienteId = pacienteRow?.id ?? null;

  // Nome e data de nascimento são dado pessoal, e "Patient" é um escopo como
  // qualquer outro: só sai se o paciente tiver autorizado explicitamente.
  if (allowed.includes("Patient")) {
    const { data: profile, error: erroPerfil } = await admin
      .from("profiles").select("full_name, birth_date").eq("user_id", patientId).maybeSingle();
    if (erroPerfil) falhas.push(`profiles: ${erroPerfil.message}`);
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
  }

  // Conditions ← clinical_cases
  if (allowed.includes("Condition")) {
    const { data: cases, error: erroCasos } = pacienteId
      ? await admin
          .from("clinical_cases")
          .select("id, valve_type, valve_disease, severity, status, created_at")
          .is("deleted_at", null)
          .eq("patient_id", pacienteId)
      : { data: [], error: null };
    if (erroCasos) falhas.push(`clinical_cases: ${erroCasos.message}`);
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
    if (pacienteId) {
      const { data: syms, error: erroSintomas } = await admin
        .from("symptom_entries")
        .select("entry_date, dyspnea, fatigue, chest_pain, weight_kg, bp_systolic, bp_diastolic")
        .eq("patient_id", pacienteId)
        .is("deleted_at", null)
        .order("entry_date", { ascending: false })
        .limit(30);
      if (erroSintomas) falhas.push(`symptom_entries: ${erroSintomas.message}`);
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
    if (pacienteId) {
      const { data: meds, error: erroMeds } = await admin
        .from("medications")
        .select("name, dose, frequency, start_date, active")
        .eq("patient_id", pacienteId)
        .eq("active", true);
      // A pior deste arquivo: sem isto, um paciente com prótese mecânica em
      // varfarina chegava ao hospital sem anticoagulante nenhum.
      if (erroMeds) falhas.push(`medications: ${erroMeds.message}`);
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

  // Antes de montar o bundle: alguma das leituras falhou?
  //
  // Se sim, o que sairia daqui é um documento clínico com seção faltando e sem
  // nada que o denuncie — `total` bate com `entry`, o JSON é válido, o HTTP é
  // 200. Do lado do hospital não há como distinguir isso de um paciente que
  // realmente não tem aquilo.
  //
  // A recusa fica registrada na trilha de integração com o motivo, e não como
  // se fosse falta de autorização: as duas coisas aparecem no mesmo lugar e
  // quem for auditar depois precisa saber qual foi.
  if (falhas.length) {
    await admin.rpc("log_integration_event", {
      _hospital_id: keyRow.hospital_id, _patient_id: patientId, _actor: null, _api_key: keyRow.id,
      _action: "fhir_read_incomplete", _resource_type: null, _resource_id: null,
      _success: false, _error: falhas.join(" | "), _ip: ip, _ua: ua, _meta: null,
    });
    return json({
      error: "incomplete_read",
      detail: "Uma ou mais fontes não puderam ser lidas; o bundle não foi emitido " +
        "porque sairia incompleto sem indicar o que faltou.",
      sources: falhas,
    }, 503);
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
  } catch (e) {
    await logError({
      source: "edge_function", context: "fhir-read",
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack ?? null : null,
    });
    return json({ error: "internal_error" }, 500);
  }
});
