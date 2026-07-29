import { createClient } from "npm:@supabase/supabase-js@2.45.0";

/**
 * Registra um erro em public.client_errors via service role. Nunca lança —
 * uma falha ao logar não pode derrubar a resposta de erro original.
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
    await admin.from("client_errors").insert({
      source: opts.source,
      context: opts.context,
      message: opts.message.slice(0, 4000),
      stack: opts.stack ? opts.stack.slice(0, 4000) : null,
      user_id: opts.userId ?? null,
      metadata: opts.metadata ?? null,
    });
  } catch (e) {
    console.error("logError failed", e);
  }
}
