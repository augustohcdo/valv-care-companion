import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Pega todos os médicos (verificados ou não)
    const { data: doctors, error } = await supabase
      .from("doctors")
      .select("user_id");
    if (error) throw error;

    let created = 0;
    for (const d of doctors ?? []) {
      const { data: digest } = await supabase.rpc("doctor_weekly_digest", {
        _doctor_user_id: d.user_id,
      });
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
        (severe > 0 ? ` · ${severe} grave(s) ativo(s)` : "");

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

    return new Response(JSON.stringify({ ok: true, sent: created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
