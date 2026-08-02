// Vigia das tarefas agendadas.
//
// Um alerta emitido pela própria tarefa não consegue avisar que a tarefa não
// rodou — e foi exatamente essa a forma das duas falhas deste projeto: o cron
// apontava para o projeto Supabase antigo (a função nunca foi chamada) e o RPC
// do resumo recusava o chamador (a função achou que tinha dado certo). Nos dois
// casos um "avise em caso de erro" dentro da função teria ficado calado.
//
// Por isso este observador é independente e procura AUSÊNCIA: ele não espera
// ninguém reportar problema, ele cobra sinal de vida.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { logError } from "../_shared/logError.ts";
import { recordJobRun, quemDisparou } from "../_shared/jobRun.ts";
import { sendAlert } from "../_shared/sendAlert.ts";

const JOB = "job-watchdog";
const DIA_MS = 86_400_000;

type Problema = { job: string; label: string; texto: string };

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = new Date().toISOString();
  let triggeredBy = "desconhecido";

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: secretRow } = await supabase
      .from("internal_secrets").select("value").eq("key", "export_cron_secret").maybeSingle();
    const cronHeader = req.headers.get("x-cron-secret");
    triggeredBy = quemDisparou(await req.json().catch(() => ({})), !!cronHeader);
    if (!secretRow?.value || cronHeader !== secretRow.value) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: vigiadas, error } = await supabase
      .from("watched_jobs")
      .select("job, label, stale_after_days")
      .eq("enabled", true);
    if (error) throw error;

    const agora = Date.now();
    const problemas: Problema[] = [];

    for (const v of vigiadas ?? []) {
      // A última execução BEM SUCEDIDA. Uma tarefa que roda todo dia e falha
      // todo dia não pode passar por saudável só porque rodou.
      const { data: ultima } = await supabase
        .from("job_runs")
        .select("finished_at, ok, error")
        .eq("job", v.job)
        .eq("ok", true)
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!ultima?.finished_at) {
        problemas.push({
          job: v.job, label: v.label,
          texto: "nunca concluiu com sucesso",
        });
        continue;
      }

      const dias = Math.floor((agora - new Date(ultima.finished_at).getTime()) / DIA_MS);
      if (dias > v.stale_after_days) {
        problemas.push({
          job: v.job, label: v.label,
          texto: `sem execução bem sucedida há ${dias} dias (limite: ${v.stale_after_days})`,
        });
        continue;
      }

      // Rodou dentro do prazo, mas a execução mais recente falhou: o sucesso
      // antigo mascararia isso se olhássemos só a última bem sucedida.
      const { data: recente } = await supabase
        .from("job_runs")
        .select("ok, error, finished_at")
        .eq("job", v.job)
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recente && recente.ok === false) {
        problemas.push({
          job: v.job, label: v.label,
          texto: `última execução falhou: ${recente.error ?? "sem detalhe"}`,
        });
      }
    }

    let alerta: Awaited<ReturnType<typeof sendAlert>> = { sent: false, reason: "not_configured" };
    if (problemas.length) {
      const corpo = [
        "Tarefas agendadas do ValvePath com problema:",
        "",
        ...problemas.map((p) => `- ${p.label} (${p.job}): ${p.texto}`),
        "",
        "Painel: https://valvepath.com.br/app/admin/erros",
      ].join("\n");
      alerta = await sendAlert({
        subject: `[ValvePath] ${problemas.length} tarefa(s) agendada(s) com problema`,
        body: corpo,
      });
      await logError({
        source: "edge_function", context: JOB,
        message: problemas.map((p) => `${p.job}: ${p.texto}`).join(" | "),
      });
    }

    await recordJobRun({
      job: JOB, startedAt,
      // O vigia cumpriu o papel dele mesmo quando encontra problema — o que
      // falhou foi a tarefa vigiada, e ela é quem aparece vermelha no painel.
      // Marcar o vigia como falho aqui esconderia que ele está funcionando.
      ok: true,
      itemsOk: (vigiadas?.length ?? 0) - problemas.length,
      itemsFailed: problemas.length,
      details: {
        verificadas: vigiadas?.length ?? 0,
        problemas: problemas.map((p) => `${p.job}: ${p.texto}`),
        alerta_enviado: alerta.sent,
        alerta_motivo: alerta.reason ?? null,
      },
      triggeredBy,
    });

    // Ponte para um vigia externo: é ele quem alerta se ESTA função parar de
    // rodar. Sem isso, a corrente termina em alguém lembrar de abrir o painel.
    const ping = Deno.env.get("DEADMAN_PING_URL");
    if (ping) {
      try { await fetch(ping, { method: "GET" }); }
      catch (e) { console.error("ping do vigia externo falhou", e); }
    }

    return new Response(JSON.stringify({
      ok: true,
      verificadas: vigiadas?.length ?? 0,
      problemas,
      alerta,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    await recordJobRun({
      job: JOB, startedAt, ok: false,
      error: e instanceof Error ? e.message : String(e),
      triggeredBy,
    });
    await logError({
      source: "edge_function", context: JOB,
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack ?? null : null,
    });
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
