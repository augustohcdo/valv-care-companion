// Resumo semanal para quem administra a plataforma.
//
// Existe porque o painel só informa quem lembra de abrir — e esta base já
// mostrou o que isso custa: o backup passou semanas sem gravar arquivo, o
// resumo do médico passou meses sem enviar nada, e nos dois casos a
// informação estava lá, numa tela que ninguém abriu. O resumo inverte a
// direção: vai até a caixa de entrada.
//
// Os números vêm do MESMO RPC que alimenta o painel (`admin_site_metrics`).
// Recontar aqui criaria duas verdades para divergirem com o tempo.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { logError } from "../_shared/logError.ts";
import { recordJobRun, quemDisparou } from "../_shared/jobRun.ts";
import { sendEmail } from "../_shared/sendEmail.ts";
import { montarResumo, type Metricas, type SaudeTarefa } from "../_shared/adminDigest.ts";

const JOB = "admin-digest";
const DIA_MS = 86_400_000;

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

    // Os números. O erro do rpc() é olhado: engoli-lo foi o que manteve o
    // resumo do médico respondendo sucesso sem enviar nada a ninguém.
    const { data: metricas, error: mErr } = await supabase.rpc("admin_site_metrics");
    if (mErr) throw mErr;
    const m = metricas as unknown as Metricas;

    // Saúde das tarefas, montada como o vigia monta: a última execução BEM
    // SUCEDIDA, não a última execução. Uma tarefa que roda e falha todo dia não
    // pode aparecer saudável só porque rodou.
    const { data: vigiadas, error: vErr } = await supabase
      .from("watched_jobs").select("job, label, stale_after_days").eq("enabled", true).order("job");
    if (vErr) throw vErr;

    const agora = Date.now();
    const tarefas: SaudeTarefa[] = [];
    for (const v of vigiadas ?? []) {
      // Ele mesmo fica de fora. Na primeira execução a linha de sucesso ainda
      // não existe (é gravada no fim), então o resumo abriria com "resumo
      // semanal nunca concluiu" — dito por um e-mail que só existe porque a
      // tarefa concluiu. Um alarme que se contradiz treina quem lê a ignorar
      // todos os outros. Quem vigia esta tarefa é o `job-watchdog`, de fora.
      if (v.job === JOB) continue;
      const { data: ultima } = await supabase
        .from("job_runs").select("finished_at")
        .eq("job", v.job).eq("ok", true)
        .order("finished_at", { ascending: false }).limit(1).maybeSingle();
      tarefas.push({
        job: v.job,
        label: v.label,
        diasDesdeSucesso: ultima?.finished_at
          ? Math.floor((agora - new Date(ultima.finished_at).getTime()) / DIA_MS)
          : null,
        limiteDias: v.stale_after_days,
      });
    }

    const resumo = montarResumo(m, tarefas);

    // Quem recebe. O e-mail vai para os administradores de verdade, não para um
    // endereço fixo: se alguém deixar de ser admin, deixa de receber o resumo
    // da plataforma junto.
    const { data: admins, error: aErr } = await supabase.rpc("admin_recipients");
    if (aErr) throw aErr;
    const destinatarios = (admins ?? []) as Array<{ user_id: string; email: string | null }>;

    // Notificação no app, uma por administrador. É transacional e garantida;
    // o e-mail é o canal que atravessa, mas quem estiver dentro do app vê.
    let notificados = 0;
    for (const a of destinatarios) {
      const { error } = await supabase.from("notifications").insert({
        user_id: a.user_id,
        type: "system",
        title: resumo.pendencias
          ? `Resumo semanal — ${resumo.pendencias} item(ns) pedindo atenção`
          : "Resumo semanal — tudo em dia",
        body: resumo.resumoCurto,
        link: "/app/admin/erros",
        metadata: { kind: "admin_digest", pendencias: resumo.pendencias },
      });
      if (!error) notificados++;
    }

    const enderecos = destinatarios.map((a) => a.email).filter((e): e is string => !!e);
    const envio = enderecos.length
      ? await sendEmail({ to: enderecos, subject: resumo.assunto, text: resumo.corpo })
      : { sent: false, reason: "sem_destinatario" as const };

    await recordJobRun({
      job: JOB, startedAt,
      // Sem administrador cadastrado não há a quem enviar, e isso não é falha
      // desta tarefa — é estado do sistema. Falhar aqui esconderia que a tarefa
      // está funcionando; o número de destinatários é que conta a história.
      ok: true,
      itemsOk: notificados,
      itemsFailed: destinatarios.length - notificados,
      details: {
        administradores: destinatarios.length,
        pendencias: resumo.pendencias,
        email_enviado: envio.sent,
        email_motivo: envio.reason ?? null,
      },
      triggeredBy,
    });

    return new Response(JSON.stringify({
      ok: true,
      administradores: destinatarios.length,
      notificados,
      pendencias: resumo.pendencias,
      assunto: resumo.assunto,
      email: envio,
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
