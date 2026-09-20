// Cópia do backup para fora do Supabase.
//
// O `weekly-export` produz, confere contra manifesto e guarda tudo em
// `clinical-exports` — dentro do mesmo projeto que ele protege. Isso cobre
// exclusão acidental de linha e não cobre perda do projeto. Esta função pega a
// pasta datada mais recente e a espelha num provedor S3-compatível, fora daqui.
//
// O trabalho de verdade não é enviar: é **conferir**. Cada arquivo é enviado,
// lido de volta e comparado por SHA-256. Uma cópia que ninguém releu é a mesma
// armadilha do backup que ninguém restaurou — e este projeto passou semanas com
// um backup agendado que nunca gravou um único arquivo.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { logError } from "../_shared/logError.ts";
import { recordJobRun, quemDisparou } from "../_shared/jobRun.ts";
import { sendAlert } from "../_shared/sendAlert.ts";
import { copiarEConferir, enviarObjeto } from "../_shared/offsite.ts";
import { lerConfig } from "../_shared/offsiteConfig.ts";

const JOB = "offsite-copy";
const BUCKET = "clinical-exports";

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = new Date().toISOString();
  let triggeredBy = "desconhecido";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: secretRow, error: erroSegredo } = await supabase
      .from("internal_secrets").select("value").eq("key", "export_cron_secret").maybeSingle();
    const cronHeader = req.headers.get("x-cron-secret");
    triggeredBy = quemDisparou(await req.json().catch(() => ({})), !!cronHeader);
    // "Não consegui LER o segredo" e "o segredo está errado" davam o mesmo 401,
    // e o 401 sai antes de registrar execução nenhuma. Quer dizer que uma falha
    // de leitura aqui parava a CÓPIA DE SEGURANÇA sem deixar rastro em
    // `job_runs` — e o vigia só notaria dias depois, pelo silêncio.
    //
    // Com o registro de falha, a tarefa aparece vermelha no painel na hora.
    if (erroSegredo) {
      await recordJobRun({
        job: JOB, startedAt, ok: false,
        error: `não foi possível ler o segredo do cron: ${erroSegredo.message}`,
        triggeredBy,
      });
      return json({ error: "secret_read_failed", detail: erroSegredo.message }, 503);
    }
    if (!secretRow?.value || cronHeader !== secretRow.value) {
      return json({ error: "unauthorized" }, 401);
    }

    // Sem credenciais a tarefa nasce inerte, e **não grava execução nenhuma**.
    //
    // Gravar uma linha de falha seria tecnicamente verdadeiro e praticamente
    // ruim: o vigia diário passaria a mandar e-mail todo dia sobre um recurso
    // que ainda não foi ligado, e alarme que toca sem motivo é o caminho mais
    // curto para ninguém mais olhar alarme nenhum. Registrar sucesso seria pior
    // ainda — seria relatar cópia que não houve. Então: nada, e o motivo na
    // resposta. Quem controla se isto é cobrado é `watched_jobs.enabled`, que
    // só passa a `true` quando as credenciais existem.
    const cfg = lerConfig();
    if (!cfg) {
      console.log("[offsite-copy] provedor externo não configurado — nada a copiar");
      return json({ ok: false, reason: "not_configured" });
    }

    // A pasta datada mais recente. O nome é `exports/AAAA-MM-DD`, então a ordem
    // alfabética é a cronológica.
    const { data: pastas, error: erroLista } = await supabase.storage
      .from(BUCKET).list("exports", { limit: 1000 });
    if (erroLista) throw erroLista;
    const nomes = (pastas ?? []).map((p) => p.name).filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort();
    const stamp = nomes.at(-1);
    if (!stamp) throw new Error("nenhuma pasta de export encontrada em clinical-exports");

    const { data: arquivos, error: erroArquivos } = await supabase.storage
      .from(BUCKET).list(`exports/${stamp}`, { limit: 1000 });
    if (erroArquivos) throw erroArquivos;
    if (!arquivos?.length) throw new Error(`a pasta exports/${stamp} está vazia`);

    const conferidos: Record<string, { sha256: string; bytes: number }> = {};
    const falhas: Record<string, string> = {};

    for (const arquivo of arquivos) {
      const caminho = `exports/${stamp}/${arquivo.name}`;
      try {
        const { data: blob, error } = await supabase.storage.from(BUCKET).download(caminho);
        if (error || !blob) throw error ?? new Error("download vazio");
        const bytes = new Uint8Array(await blob.arrayBuffer());
        conferidos[arquivo.name] = await copiarEConferir(
          cfg, caminho, bytes,
          arquivo.name.endsWith(".json") ? "application/json" : "application/x-ndjson",
        );
      } catch (e) {
        falhas[arquivo.name] = e instanceof Error ? e.message : String(e);
      }
    }

    // O manifesto da cópia: tamanho e hash de cada arquivo, do lado de lá. É por
    // ele que uma restauração futura sabe se o que baixou está inteiro sem
    // precisar do Supabase — que, no cenário que justifica tudo isto, não existe.
    const manifesto = {
      stamp,
      copiado_em: new Date().toISOString(),
      destino: `${cfg.endpoint}/${cfg.bucket}`,
      arquivos: conferidos,
      falhas,
    };
    const manifestoBytes = new TextEncoder().encode(JSON.stringify(manifesto, null, 2));
    // O manifesto é o que uma restauração usa para saber, SEM o Supabase, se o
    // que baixou está inteiro — e no cenário que justifica esta função inteira,
    // o Supabase é justamente o que não existe mais. As duas gravações dele
    // eram descartadas: uma cópia externa sem manifesto era relatada igual a
    // uma com, e a diferença só apareceria na hora de restaurar.
    let manifestoFora = true;
    let manifestoAqui = true;
    try {
      await enviarObjeto(cfg, `exports/${stamp}/_offsite_manifest.json`, manifestoBytes, "application/json");
    } catch (e) {
      manifestoFora = false;
      falhas["_offsite_manifest.json (destino externo)"] =
        e instanceof Error ? e.message : String(e);
    }
    const { error: erroManifesto } = await supabase.storage.from(BUCKET).upload(
      `exports/${stamp}/_offsite_manifest.json`, manifestoBytes,
      { contentType: "application/json", upsert: true },
    );
    if (erroManifesto) {
      manifestoAqui = false;
      console.error("manifesto da cópia externa não subiu ao bucket", erroManifesto.message);
    }

    const nFalhas = Object.keys(falhas).length;
    const ok = nFalhas === 0;

    // O alerta ANTES do `recordJobRun`, e com o resultado guardado.
    //
    // Era depois, e descartado. O comentário dele diz "precisa gritar, não
    // esperar alguém abrir o painel" — e ninguém conferia se o grito saiu.
    // `sendAlert` devolve `{ sent: false, reason: "not_configured" }` quando
    // não há `ALERT_EMAIL_TO`: a cópia externa do backup podia falhar toda
    // semana em silêncio, com o registro dizendo que a falha foi "alertada".
    //
    // Mandando antes, o `job_runs` carrega se o aviso saiu — que é onde quem
    // investiga vai olhar. É o mesmo desenho do `job-watchdog`, que já fazia
    // assim, e a cópia externa é a camada que sobra quando o resto se perdeu.
    let alerta: { sent: boolean; reason?: string } = { sent: false, reason: "sem_falha" };
    if (!ok) {
      alerta = await sendAlert({
        subject: `[ValvePath] cópia externa do backup falhou (${nFalhas} arquivo(s))`,
        body:
          `Pasta: exports/${stamp}\nDestino: ${cfg.bucket}\n\n` +
          Object.entries(falhas).map(([a, m]) => `• ${a}: ${m}`).join("\n"),
      });
      if (!alerta.sent) {
        console.error(`alerta da cópia externa NÃO saiu: ${alerta.reason ?? "sem motivo"}`);
      }
    }

    await recordJobRun({
      job: JOB, startedAt, ok,
      itemsOk: Object.keys(conferidos).length,
      itemsFailed: nFalhas,
      details: {
        stamp, destino: cfg.bucket,
        manifesto_fora: manifestoFora, manifesto_aqui: manifestoAqui,
        alerta_enviado: alerta.sent, alerta_motivo: alerta.reason ?? null,
      },
      error: ok ? null : `${nFalhas} arquivo(s) não copiados: ${Object.keys(falhas).join(", ")}`,
      triggeredBy,
    });

    return json({
      ok, stamp, copiados: Object.keys(conferidos).length, falhas,
      // Quem chama à mão precisa saber se o grito saiu. "Falhou e avisei" e
      // "falhou e ninguém soube" não podem chegar como a mesma resposta.
      alerta_enviado: alerta.sent,
      alerta_motivo: alerta.reason ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logError({ source: "edge_function", context: JOB, message });
    await recordJobRun({ job: JOB, startedAt, ok: false, error: message, triggeredBy });
    // Também olhado: é o caminho da falha inesperada, onde o aviso importa mais.
    const alertaDoErro = await sendAlert({
      subject: "[ValvePath] cópia externa do backup falhou",
      body: message,
    });
    if (!alertaDoErro.sent) {
      console.error(`alerta do erro da cópia externa NÃO saiu: ${alertaDoErro.reason ?? "sem motivo"}`);
    }
    return json({
      error: "internal_error", detail: message,
      alerta_enviado: alertaDoErro.sent,
      alerta_motivo: alertaDoErro.reason ?? null,
    }, 500);
  }
});
