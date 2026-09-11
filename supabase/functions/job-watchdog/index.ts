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

/**
 * O terceiro estado do vigia: **não conferido**.
 *
 * Toda leitura desta função caía em duas respostas — "está tudo bem" ou "achei
 * um problema" — e uma leitura que FALHAVA caía na primeira. O RPC das
 * concessões privilegiadas falhando dava `concessoes = []`, e o registro
 * gravava `concessoes_privilegiadas: 0` como fato. A URL do site falhando dava
 * `rotasQuebradas = []`, e o vigia dizia que o site respondia sem ter batido em
 * rota nenhuma.
 *
 * Num vigia isso é a pior forma do problema, porque ele é o último a avisar:
 * se ele cala, ninguém mais fala. "Não consegui olhar" tem que ser tão visível
 * quanto "olhei e está ruim" — é a mesma distinção que o resto deste projeto já
 * usa nos scripts (0 = certo, 1 = errado, 2 = NÃO CONFERIDO).
 */
type NaoConferido = { o_que: string; motivo: string };

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

    const { data: secretRow, error: erroSegredo } = await supabase
      .from("internal_secrets").select("value").eq("key", "export_cron_secret").maybeSingle();
    const cronHeader = req.headers.get("x-cron-secret");
    triggeredBy = quemDisparou(await req.json().catch(() => ({})), !!cronHeader);
    // "Não consegui LER o segredo" e "o segredo está errado" davam o mesmo 401,
    // e o 401 não registra execução nenhuma. Resultado: uma falha de leitura
    // aqui desligava o vigia em silêncio — e o vigia é quem avisaria.
    if (erroSegredo) {
      await recordJobRun({
        job: JOB, startedAt, ok: false,
        error: `não foi possível ler o segredo do cron: ${erroSegredo.message}`,
        triggeredBy,
      });
      await logError({
        source: "edge_function", context: JOB,
        message: `vigia não rodou: falha ao ler internal_secrets — ${erroSegredo.message}`,
      });
      return new Response(JSON.stringify({ error: "secret_read_failed" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!secretRow?.value || cronHeader !== secretRow.value) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const naoConferido: NaoConferido[] = [];

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
    const { data: concessoesRaw, error: erroConcessoes } = await supabase.rpc(
      "recent_privileged_grants",
      { _since: new Date(agora - DIA_MS).toISOString() },
    );
    // O `?? []` fazia esta leitura falhar EXATAMENTE como ela tem sucesso: sem
    // concessão nenhuma. Um `admin` concedido em silêncio — quem tem esse papel
    // lê o backup inteiro e edita a base que a IA cita como diretriz — passaria
    // despercebido justamente na noite em que o RPC recusasse o chamador.
    if (erroConcessoes) {
      naoConferido.push({
        o_que: "papéis privilegiados concedidos nas últimas 24h",
        motivo: erroConcessoes.message,
      });
    }
    const concessoes = (concessoesRaw ?? []) as Array<{ user_id: string; role: string }>;

    // O site publicado responde? Esta pergunta ficou uma semana sem ser feita:
    // faltava o rewrite de SPA na Vercel e **toda** rota que não fosse `/`
    // devolvia 404 — quebrando o link de redefinir senha, o retorno do login
    // com Google e a confirmação de cadastro. Nada no sistema notou, porque
    // toda verificação olhava o banco, nunca a entrega.
    //
    // A URL vem de `internal_secrets`, ao lado da base das functions, para não
    // cravar domínio no código pela segunda vez.
    const { data: baseRow, error: erroBase } = await supabase
      .from("internal_secrets").select("value").eq("key", "site_base_url").maybeSingle();
    // Três desfechos, e antes dois deles se pareciam: falha de leitura e URL
    // não configurada davam a mesma lista vazia, que o resto do código lê como
    // "todas as rotas responderam". O vigia afirmava que o site estava no ar
    // sem ter batido em nenhuma rota.
    if (erroBase) {
      naoConferido.push({
        o_que: "rotas do site publicado",
        motivo: `não foi possível ler a URL base: ${erroBase.message}`,
      });
    } else if (!baseRow?.value) {
      naoConferido.push({
        o_que: "rotas do site publicado",
        motivo: "site_base_url não está gravada em internal_secrets",
      });
    }
    const rotasQuebradas: RotaQuebrada[] = baseRow?.value
      ? await sondarRotas(baseRow.value)
      : [];

    for (const v of vigiadas ?? []) {
      // A última execução BEM SUCEDIDA. Uma tarefa que roda todo dia e falha
      // todo dia não pode passar por saudável só porque rodou.
      const { data: ultima, error: erroUltima } = await supabase
        .from("job_runs")
        .select("finished_at, ok, error")
        .eq("job", v.job)
        .eq("ok", true)
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Sem observar o erro, uma falha aqui caía no `!ultima?.finished_at` e a
      // tarefa era acusada de "nunca concluiu com sucesso". Alarme falso é o
      // lado menos perigoso — mas é o lado que faz o leitor do e-mail aprender
      // a ignorá-lo, e aí o alarme verdadeiro morre junto.
      if (erroUltima) {
        naoConferido.push({
          o_que: `histórico de ${v.label} (${v.job})`,
          motivo: erroUltima.message,
        });
        continue;
      }

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
      const { data: recente, error: erroRecente } = await supabase
        .from("job_runs")
        .select("ok, error, finished_at")
        .eq("job", v.job)
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      // Esta é a que passava por saudável: `recente` nulo por falha de leitura
      // não entra no `if` abaixo, e a tarefa — cuja última execução pode ter
      // falhado — saía da volta sem uma linha em `problemas`. Sucesso antigo
      // dentro do prazo + leitura falha = "tudo certo".
      if (erroRecente) {
        naoConferido.push({
          o_que: `última execução de ${v.label} (${v.job})`,
          motivo: erroRecente.message,
        });
        continue;
      }
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
    // `naoConferido` entra na condição junto com os outros: o vigia que não
    // conseguiu olhar precisa avisar disso com a mesma urgência com que avisaria
    // de um problema encontrado. Deixá-lo de fora manteria o defeito — o e-mail
    // não sairia, e o silêncio seria lido como calmaria.
    if (problemas.length || concessoes.length || rotasQuebradas.length || naoConferido.length) {
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
        ...(naoConferido.length
          ? [
              "O QUE O VIGIA NÃO CONSEGUIU CONFERIR nesta execução:",
              "",
              ...naoConferido.map((n) => `- ${n.o_que}: ${n.motivo}`),
              "",
              "Isto NÃO quer dizer que esteja tudo bem nesses pontos — quer dizer",
              "que ninguém olhou. Confira à mão até a próxima execução passar limpa.",
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
        naoConferido.length ? `${naoConferido.length} verificação(ões) NÃO REALIZADA(S)` : "",
      ].filter(Boolean);
      const assunto = `[ValvePath] ${partes.join(" e ")}`;
      alerta = await sendAlert({ subject: assunto, body: corpo });
      await logError({
        source: "edge_function", context: JOB,
        message: [
          ...rotasQuebradas.map((r) => `rota ${r.rota}: ${r.motivo}`),
          ...problemas.map((p) => `${p.job}: ${p.texto}`),
          ...concessoes.map((c) => `papel ${c.role} concedido a ${c.user_id}`),
          ...naoConferido.map((n) => `NÃO CONFERIDO — ${n.o_que}: ${n.motivo}`),
        ].join(" | "),
      });
    }

    await recordJobRun({
      job: JOB, startedAt,
      // O vigia cumpriu o papel dele mesmo quando encontra problema — o que
      // falhou foi a tarefa vigiada, e ela é quem aparece vermelha no painel.
      // Marcar o vigia como falho aqui esconderia que ele está funcionando.
      //
      // Mas uma verificação que ele NÃO CONSEGUIU FAZER é falha dele, não da
      // tarefa vigiada — e esta é a diferença que faltava. Com `ok: false`, o
      // próprio vigia entra na lista de tarefas com a última execução falha, e
      // a execução seguinte o denuncia. É a única forma de a corrente se
      // fechar sobre si mesma.
      ok: naoConferido.length === 0,
      error: naoConferido.length
        ? `${naoConferido.length} verificação(ões) não realizada(s): ` +
          naoConferido.map((n) => `${n.o_que} (${n.motivo})`).join("; ")
        : null,
      itemsOk: (vigiadas?.length ?? 0) - problemas.length - naoConferido.length,
      itemsFailed: problemas.length,
      details: {
        verificadas: vigiadas?.length ?? 0,
        problemas: problemas.map((p) => `${p.job}: ${p.texto}`),
        // `concessoes_privilegiadas: 0` era gravado como fato mesmo quando o RPC
        // falhava. Agora `null` diz a verdade: ninguém olhou.
        concessoes_privilegiadas: erroConcessoes ? null : concessoes.length,
        rotas_quebradas: rotasQuebradas.map((r) => `${r.rota}: ${r.motivo}`),
        nao_conferido: naoConferido.map((n) => `${n.o_que}: ${n.motivo}`),
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
      // Quem chama esta função à mão lia `ok: true` e ia embora tranquilo,
      // mesmo quando metade das verificações não tinha acontecido.
      ok: naoConferido.length === 0,
      verificadas: vigiadas?.length ?? 0,
      problemas,
      rotas_quebradas: rotasQuebradas,
      concessoes_privilegiadas: erroConcessoes ? null : concessoes.length,
      nao_conferido: naoConferido,
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
