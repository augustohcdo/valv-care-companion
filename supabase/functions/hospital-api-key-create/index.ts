// Cria nova API key para um hospital. Requer admin autenticado.
// Retorna a chave em texto-claro UMA ÚNICA VEZ.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function randomBase62(len: number) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => alphabet[b % alphabet.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

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
  const userId = claims.claims.sub;

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const { hospital_id, name, scopes, ip_allowlist, expires_in_days } = body ?? {};
  if (!hospital_id || !name) return json({ error: "missing_fields" }, 400);

  const prefix = randomBase62(8);
  const secret = randomBase62(40);
  const key = `vp_${prefix}_${secret}`;
  const key_hash = await sha256Hex(secret);
  const expires_at = new Date(Date.now() + (Number(expires_in_days) || 180) * 86400_000).toISOString();

  const { data, error } = await admin.from("hospital_api_keys").insert({
    hospital_id, name, key_prefix: prefix, key_hash,
    scopes: Array.isArray(scopes) && scopes.length ? scopes : ["fhir.read", "fhir.write"],
    ip_allowlist: Array.isArray(ip_allowlist) && ip_allowlist.length ? ip_allowlist : null,
    expires_at, created_by: userId,
  }).select("id, name, key_prefix, scopes, expires_at").single();

  if (error) return json({ error: error.message }, 500);

  await admin.rpc("log_integration_event", {
    _hospital_id: hospital_id, _patient_id: null, _actor: userId, _api_key: data.id,
    _action: "key_created", _resource_type: null, _resource_id: data.id,
    _success: true, _error: null, _ip: null, _ua: null, _meta: { name },
  });

  return json({ ...data, api_key: key, warning: "Salve esta chave agora — ela não será exibida novamente." }, 200);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
