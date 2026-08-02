import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * Registra a execução de uma tarefa agendada em public.job_runs.
 *
 * Nunca lança: falhar ao registrar não pode derrubar a tarefa em si. Mas a
 * ausência da linha é justamente o que faz a tela de admin acusar atraso, então
 * um registro que não entrou merece pelo menos aparecer no log da função.
 */
/**
 * Quem de fato disparou a execução.
 *
 * Antes isto era inferido da presença do cabeçalho `x-cron-secret` — o que
 * marcava como "pg_cron" qualquer chamada feita com o segredo, inclusive as
 * manuais de verificação. O campo afirmava um fato que não conhecia, e no
 * histórico ficava impossível separar execução agendada de teste.
 *
 * O comando do cron manda `{"source":"pg_cron"}` no corpo; é essa marca que
 * vale. Com o segredo mas sem a marca, é chamada manual autenticada.
 */
export function quemDisparou(body: unknown, temSegredo: boolean): string {
  const source = (body as { source?: unknown })?.source;
  if (source === "pg_cron") return "pg_cron";
  return temSegredo ? "cron_secret" : "admin";
}

export async function recordJobRun(opts: {
  job: string;
  startedAt: string;
  ok: boolean;
  itemsOk?: number;
  itemsFailed?: number;
  details?: Record<string, unknown> | null;
  error?: string | null;
  triggeredBy?: string | null;
}) {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    const admin = createClient(url, key);
    const { error } = await admin.from("job_runs").insert({
      job: opts.job,
      started_at: opts.startedAt,
      finished_at: new Date().toISOString(),
      ok: opts.ok,
      items_ok: opts.itemsOk ?? 0,
      items_failed: opts.itemsFailed ?? 0,
      details: opts.details ?? null,
      error: opts.error ? opts.error.slice(0, 2000) : null,
      triggered_by: opts.triggeredBy ?? null,
    });
    if (error) console.error("recordJobRun insert failed", error.message);
  } catch (e) {
    console.error("recordJobRun failed", e);
  }
}
