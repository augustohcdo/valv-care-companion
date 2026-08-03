// Boas-vindas: notificação no app e e-mail, a partir do mesmo texto.
//
// Dois caminhos de entrada, de propósito:
//
//   1. o gatilho de `auth.users` chama com `user_id` no instante em que a
//      pessoa confirma o e-mail — é o que faz a mensagem chegar na hora;
//   2. o cron chama sem `user_id` e varre quem confirmou nos últimos dias — é
//      o que impede a mensagem de se perder quando o disparo (1) falha.
//
// Os dois convergem no mesmo procedimento, que é idempotente: a notificação de
// boas-vindas já existente é a marca de "já foi", e o e-mail é reenviado só se
// a marca disser que ele não saiu. Sem isso, a varredura mandaria boas-vindas
// todo dia para as mesmas pessoas.
//
// A function NUNCA aceita e-mail nem tipo de conta vindos do corpo: recebe no
// máximo um `user_id` e resolve o resto no servidor. Aceitar o endereço a
// mandar transformaria isto num remetente aberto assinado pelo nosso domínio.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { logError } from "../_shared/logError.ts";
import { recordJobRun, quemDisparou } from "../_shared/jobRun.ts";
import { sendEmail } from "../_shared/sendEmail.ts";
import { boasVindas, assuntoBoasVindas, type Publico } from "../_shared/welcome.ts";

const JOB = "welcome-email";
/** Janela da varredura. Folga larga sobre a periodicidade diária do cron. */
const DIAS_JANELA = 7;

type Candidato = {
  user_id: string;
  email: string | null;
  account_type: string | null;
  full_name: string | null;
};

type Resultado = {
  user_id: string;
  publico?: Publico;
  notificado: boolean;
  email: string;
};

/** Só existe cadastro de médico e paciente hoje; ver `_shared/welcome.ts`. */
function publicoDe(accountType: string | null): Publico | null {
  return accountType === "medico" || accountType === "paciente" ? accountType : null;
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = new Date().toISOString();
  let triggeredBy = "desconhecido";
  let varredura = false;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: secretRow } = await supabase
      .from("internal_secrets").select("value").eq("key", "export_cron_secret").maybeSingle();
    const cronHeader = req.headers.get("x-cron-secret");
    const body = await req.json().catch(() => ({})) as { user_id?: string; source?: string };
    triggeredBy = body.source === "trigger" ? "trigger" : quemDisparou(body, !!cronHeader);

    if (!secretRow?.value || cronHeader !== secretRow.value) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- quem vai receber -------------------------------------------------
    const candidatos: Candidato[] = [];

    if (body.user_id) {
      // Caminho do gatilho. O `user_id` é o único dado que aceitamos de fora, e
      // ele não diz nada sozinho: endereço, nome e tipo de conta vêm daqui.
      const { data: u, error: uErr } = await supabase.auth.admin.getUserById(body.user_id);
      if (uErr) throw uErr;
      if (u?.user?.email_confirmed_at) {
        const { data: perfil } = await supabase
          .from("profiles").select("account_type, full_name")
          .eq("user_id", body.user_id).maybeSingle();
        candidatos.push({
          user_id: body.user_id,
          email: u.user.email ?? null,
          account_type: perfil?.account_type ?? null,
          full_name: perfil?.full_name ?? null,
        });
      }
    } else {
      varredura = true;
      const desde = new Date(Date.now() - DIAS_JANELA * 86_400_000).toISOString();
      const { data, error } = await supabase.rpc("recent_confirmed_users", { _since: desde });
      if (error) throw error;
      for (const r of (data ?? []) as Array<Record<string, string | null>>) {
        candidatos.push({
          user_id: r.user_id as string,
          email: r.email,
          account_type: r.account_type,
          full_name: r.full_name,
        });
      }
    }

    // ---- o que já foi entregue -------------------------------------------
    // A notificação de boas-vindas é a marca de "já recebeu". Deliberadamente
    // sem filtrar `deleted_at`: se a pessoa apagou o aviso do sino, ela viu —
    // reenviar seria transformar uma limpeza de caixa em mensagem repetida.
    const ids = candidatos.map((c) => c.user_id);
    const jaEntregue = new Map<string, { id: string; email_sent: boolean }>();
    if (ids.length) {
      const { data: existentes } = await supabase
        .from("notifications")
        .select("id, user_id, metadata")
        .in("user_id", ids)
        .eq("metadata->>kind", "welcome");
      for (const n of existentes ?? []) {
        const meta = (n.metadata ?? {}) as Record<string, unknown>;
        jaEntregue.set(n.user_id as string, {
          id: n.id as string,
          email_sent: meta.email_sent === true,
        });
      }
    }

    // ---- entrega ----------------------------------------------------------
    const resultados: Resultado[] = [];
    let falhas = 0;
    let primeiroErro: string | null = null;

    for (const c of candidatos) {
      const publico = publicoDe(c.account_type);
      if (!publico) {
        // Conta sem texto de boas-vindas (hoje: qualquer coisa fora de
        // médico/paciente). Registrar em vez de mandar algo genérico.
        resultados.push({ user_id: c.user_id, notificado: false, email: "sem_publico" });
        continue;
      }

      const msg = boasVindas(publico, c.full_name);
      const anterior = jaEntregue.get(c.user_id);
      let notificacaoId = anterior?.id ?? null;
      let notificado = false;

      if (!anterior) {
        const { data: nova, error: nErr } = await supabase.from("notifications").insert({
          user_id: c.user_id,
          type: "system",
          title: msg.titulo,
          body: msg.resumo,
          link: msg.link,
          metadata: { kind: "welcome", publico, email_sent: false },
        }).select("id").maybeSingle();
        if (nErr) {
          falhas++;
          primeiroErro ??= nErr.message;
          resultados.push({ user_id: c.user_id, publico, notificado: false, email: "nao_tentado" });
          continue;
        }
        notificacaoId = nova?.id ?? null;
        notificado = true;
      }

      // E-mail só quando ainda não saiu. Um envio que falhou (provedor ausente,
      // erro da API) é tentado de novo na varredura seguinte — daí a marca
      // ficar no metadado em vez de na existência da notificação.
      if (anterior?.email_sent) {
        resultados.push({ user_id: c.user_id, publico, notificado, email: "ja_enviado" });
        continue;
      }
      if (!c.email) {
        resultados.push({ user_id: c.user_id, publico, notificado, email: "sem_endereco" });
        continue;
      }

      const envio = await sendEmail({
        to: c.email,
        subject: assuntoBoasVindas(publico),
        text: msg.email,
      });
      if (notificacaoId) {
        await supabase.from("notifications").update({
          metadata: {
            kind: "welcome", publico,
            email_sent: envio.sent,
            email_reason: envio.reason ?? null,
          },
        }).eq("id", notificacaoId);
      }
      resultados.push({
        user_id: c.user_id, publico, notificado,
        email: envio.sent ? "enviado" : (envio.reason ?? "falhou"),
      });
    }

    // Só a varredura registra execução: ela é a tarefa agendada que o vigia
    // acompanha. O gatilho dispara uma vez por cadastro e encheria o histórico
    // de linhas que não dizem nada sobre a saúde do agendamento.
    if (varredura) {
      await recordJobRun({
        job: JOB, startedAt,
        ok: falhas === 0,
        itemsOk: resultados.length - falhas,
        itemsFailed: falhas,
        details: {
          candidatos: candidatos.length,
          notificados: resultados.filter((r) => r.notificado).length,
          emails_enviados: resultados.filter((r) => r.email === "enviado").length,
        },
        error: primeiroErro,
        triggeredBy,
      });
    }

    if (falhas > 0) {
      await logError({
        source: "edge_function", context: JOB,
        message: `boas-vindas falharam para ${falhas} de ${candidatos.length}: ${primeiroErro}`,
      });
    }

    return new Response(JSON.stringify({
      ok: falhas === 0,
      varredura,
      candidatos: candidatos.length,
      resultados,
    }), {
      status: falhas > 0 ? 500 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (varredura) {
      await recordJobRun({
        job: JOB, startedAt, ok: false,
        error: e instanceof Error ? e.message : String(e),
        triggeredBy,
      });
    }
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
