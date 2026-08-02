import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { logError } from "../_shared/logError.ts";
import { recordJobRun } from "../_shared/jobRun.ts";

const JOB = "weekly-digest";

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Fora do try: o catch precisa dos dois para registrar a execução que falhou.
  const startedAt = new Date().toISOString();
  let triggeredBy = "desconhecido";

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Read the shared cron secret from the locked internal_secrets table.
    const { data: secretRow } = await supabase
      .from("internal_secrets")
      .select("value")
      .eq("key", "digest_cron_secret")
      .maybeSingle();
    const CRON_SECRET = secretRow?.value ?? null;

    // Auth: allow (a) valid cron secret via header, or (b) authenticated admin JWT.
    const cronHeader = req.headers.get("x-cron-secret");
    let authorized = !!(CRON_SECRET && cronHeader === CRON_SECRET);
    triggeredBy = cronHeader ? "pg_cron" : "admin";

    if (!authorized) {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        // `getClaims` não existe no SDK 2.45.0 fixado acima: este ramo (admin
        // disparando o resumo à mão) nunca funcionou. O agendamento usa o
        // segredo de cron, por isso a falha passou despercebida.
        const { data } = await supabase.auth.getUser(token);
        const uid = data?.user?.id;
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

    // Pega todos os médicos (verificados ou não)
    const { data: doctors, error } = await supabase
      .from("doctors")
      .select("user_id");
    if (error) throw error;

    let created = 0;
    let failed = 0;
    let firstError: string | null = null;

    for (const d of doctors ?? []) {
      // O erro do rpc() precisa ser olhado. Sem isto, uma falha vira `digest`
      // nulo, os contadores viram zero e o médico é pulado em silêncio — foi
      // o que manteve este resumo sem sair para ninguém, reportando ok:true.
      const { data: digest, error: rpcError } = await supabase.rpc("doctor_weekly_digest", {
        _doctor_user_id: d.user_id,
      });
      if (rpcError) {
        failed++;
        firstError ??= rpcError.message;
        continue;
      }
      const stats = (digest ?? {}) as Record<string, number>;
      const newCases = stats.new_cases ?? 0;
      const upcoming = stats.upcoming_appointments ?? 0;
      const pending = stats.pending_action ?? 0;
      const severe = stats.active_severe ?? 0;

      // Só notifica se houver algo relevante
      if (newCases + upcoming + pending + severe === 0) continue;

      const body =
        `Esta semana: ${newCases} novo(s) caso(s) · ${upcoming} retorno(s) agendado(s)` +
        (pending > 0 ? ` · ${pending} caso(s) sem atualização há 30+ dias` : "") +
        (severe > 0 ? ` · ${severe} caso(s) importante(s)/crítico(s) ativo(s)` : "");

      await supabase.from("notifications").insert({
        user_id: d.user_id,
        type: "system",
        title: "Resumo semanal do consultório",
        body,
        link: "/app/medico/relatorios",
        metadata: stats,
      });
      created++;
    }

    // Registro da execução. Um digest que respondeu `sent: 0` porque ninguém
    // tinha novidade e um que nunca rodou eram, até aqui, o mesmo silêncio.
    await recordJobRun({
      job: JOB,
      startedAt,
      ok: failed === 0,
      itemsOk: created,
      itemsFailed: failed,
      details: { doctors: doctors?.length ?? 0 },
      error: firstError,
      triggeredBy,
    });

    if (failed > 0) {
      await logError({
        source: "edge_function", context: "weekly-digest",
        message: `resumo falhou para ${failed} de ${doctors?.length ?? 0} médico(s): ${firstError}`,
      });
    }

    // `ok` reflete a realidade: um digest que falhou para todo mundo não pode
    // responder sucesso.
    return new Response(JSON.stringify({ ok: failed === 0, sent: created, failed }), {
      status: failed > 0 ? 500 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    await recordJobRun({
      job: JOB, startedAt, ok: false,
      error: e instanceof Error ? e.message : String(e),
      triggeredBy,
    });
    await logError({
      source: "edge_function", context: "weekly-digest",
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack ?? null : null,
    });
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
