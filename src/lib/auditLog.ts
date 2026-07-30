import { supabase } from "@/integrations/supabase/client";

/**
 * Registra uma ação sensível em audit_logs — quem fez o quê, quando.
 * Nunca lança: uma falha ao logar não pode travar a ação que está sendo registrada.
 */
export async function logAudit(
  action: string,
  targetTable: string,
  targetId?: string | null,
  metadata?: Record<string, unknown>,
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action,
      target_table: targetTable,
      target_id: targetId ?? null,
      metadata: metadata ?? null,
    });
  } catch (e) {
    console.error("logAudit failed", action, e);
  }
}
