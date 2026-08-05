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
import { sondarRotas, type RotaQuebrada } from "../_shared/siteRoutes.ts";

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

    // Papel privilegiado é concessão rara e deliberada — hoje o sistema tem um
    // administrador só, criado à mão. Um `admin` que aparece sozinho é o tipo
    // de evento que ninguém percebe olhando tabela, e que muda tudo: quem tem
    // esse papel lê o backup inteiro no bucket e edita a base que a IA cita
    // como diretriz. Por isso o vigia cobra explicação por qualquer concessão
    // recente, em vez de esperar alguém desconfiar.
    //
    // Fica FORA de `problemas` de propósito: aquela lista conta tarefa
    // agendada, e somar uma concessão ali faria o registro dizer "1 tarefa
    // falhou" quando nenhuma falhou. O aviso vai junto no e-mail; a contagem,
    // não.
    const { data: concessoesRaw } = await supabase.rpc("recent_privileged_grants", {
      _since: new Date(agora - DIA_MS).toISOString(),
    });
    const concessoes = (concessoesRaw ?? []) as Array<{ user_id: string; role: string }>;

    // O site publicado responde? Esta pergunta ficou uma semana sem ser feita:
    // faltava o rewrite de SPA na Vercel e **toda** rota que não fosse `/`
    // devolvia 404 — quebrando o link de redefinir senha, o retorno do login
    // com Google e a confirmação de cadastro. Nada no sistema notou, porque
    // toda verificação olhava o banco, nunca a entrega.
    //
    // A URL vem de `internal_secrets`, ao lado da base das functions, para não
    // cravar domínio no código pela segunda vez.
    const { data: baseRow } = await supabase
      .from("internal_secrets").select("value").eq("key", "site_base_url").maybeSingle();
    const rotasQuebradas: RotaQuebrada[] = baseRow?.value
      ? await sondarRotas(baseRow.value)
      : [];

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

    // Sem problema não há o que avisar, e isso não é o mesmo que "provedor de
    // e-mail ausente". Antes o valor inicial dizia `not_configured` mesmo com a
    // chave gravada — um campo afirmando algo que não era verdade, na mesma
    // família dos outros achados desta base.
    let alerta: Awaited<ReturnType<typeof sendAlert>> & { reason?: string } = {
      sent: false,
      reason: "nada_a_avisar",
    };
    if (problemas.length || concessoes.length || rotasQuebradas.length) {
      const corpo = [
        // As rotas vêm primeiro: site fora do ar é a falha que os usuários
        // sentem na hora, enquanto um backup atrasado ainda tem margem.
        ...(rotasQuebradas.length
          ? [
              "Rotas do site que não respondem:",
              "",
              ...rotasQuebradas.map((r) => `- ${r.rota}: ${r.motivo}`),
              "",
              rotasQuebradas.length >= 4
                ? "Se forem quase todas menos `/`, o rewrite de SPA do vercel.json não está valendo."
                : "",
              "",
            ]
          : []),
        ...(problemas.length
          ? [
              "Tarefas agendadas do ValvePath com problema:",
              "",
              ...problemas.map((p) => `- ${p.label} (${p.job}): ${p.texto}`),
              "",
            ]
          : []),
        ...(concessoes.length
          ? [
              "Papel privilegiado concedido nas últimas 24h:",
              "",
              ...concessoes.map((c) => `- "${c.role}" para o usuário ${c.user_id}`),
              "",
              "Se não foi você, remova o papel em user_roles e troque os segredos.",
              "",
            ]
          : []),
        "Painel: https://valvepath.com.br/app/admin/erros",
      ].join("\n");
      // O assunto precisa dizer qual das coisas aconteceu: um e-mail que sempre
      // diz "tarefa com problema" faria uma concessão de administrador — ou o
      // site fora do ar — passar por atraso de backup.
      const partes = [
        rotasQuebradas.length ? `${rotasQuebradas.length} rota(s) do site fora do ar` : "",
        problemas.length ? `${problemas.length} tarefa(s) agendada(s) com problema` : "",
        concessoes.length ? `${concessoes.length} papel(is) privilegiado(s) concedido(s)` : "",
      ].filter(Boolean);
      const assunto = `[ValvePath] ${partes.join(" e ")}`;
      alerta = await sendAlert({ subject: assunto, body: corpo });
      await logError({
        source: "edge_function", context: JOB,
        message: [
          ...rotasQuebradas.map((r) => `rota ${r.rota}: ${r.motivo}`),
          ...problemas.map((p) => `${p.job}: ${p.texto}`),
          ...concessoes.map((c) => `papel ${c.role} concedido a ${c.user_id}`),
        ].join(" | "),
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
        concessoes_privilegiadas: concessoes.length,
        rotas_quebradas: rotasQuebradas.map((r) => `${r.rota}: ${r.motivo}`),
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
      rotas_quebradas: rotasQuebradas,
      concessoes_privilegiadas: concessoes.length,
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
