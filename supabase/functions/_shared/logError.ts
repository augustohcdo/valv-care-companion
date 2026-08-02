import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/** Por quanto tempo uma repetição é somada à linha existente em vez de criar
 *  outra. Uma hora agrupa uma rajada inteira sem esconder que o erro voltou
 *  amanhã — a linha nova de amanhã é justamente o sinal de que reincidiu. */
const JANELA_MS = 60 * 60 * 1000;

/**
 * Registra um erro em public.client_errors via service role. Nunca lança —
 * uma falha ao logar não pode derrubar a resposta de erro original.
 *
 * Repetições da mesma mensagem no mesmo contexto são somadas numa linha só.
 * Sem isso, um erro em laço de render enche a tabela e empurra todos os outros
 * para fora da janela da tela de admin — foi o que aconteceu com as 20
 * primeiras linhas que esta tabela recebeu.
 */
export async function logError(opts: {
  source: "client" | "edge_function";
  context: string;
  message: string;
  stack?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    const admin = createClient(url, key);
    const message = opts.message.slice(0, 4000);
    const desde = new Date(Date.now() - JANELA_MS).toISOString();

    const { data: recente } = await admin
      .from("client_errors")
      .select("id, occurrences")
      .eq("source", opts.source)
      .eq("context", opts.context)
      .eq("message", message)
      .gte("last_seen_at", desde)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recente) {
      await admin
        .from("client_errors")
        .update({
          occurrences: (recente.occurrences ?? 1) + 1,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", recente.id);
      return;
    }

    await admin.from("client_errors").insert({
      source: opts.source,
      context: opts.context,
      message,
      stack: opts.stack ? opts.stack.slice(0, 4000) : null,
      user_id: opts.userId ?? null,
      metadata: opts.metadata ?? null,
    });
  } catch (e) {
    console.error("logError failed", e);
  }
}
