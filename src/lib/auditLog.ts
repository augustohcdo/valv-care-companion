import { supabase } from "@/integrations/supabase/client";
import { reportError } from "@/lib/reportError";
import type { Json } from "@/integrations/supabase/types";

/**
 * Registra uma ação sensível em audit_logs — quem fez o quê, quando.
 *
 * **Nunca lança, mas também não fica cego.** Antes fazia
 * `await supabase.from("audit_logs").insert(...)` sem olhar o retorno, dentro
 * de um `try/catch` que nunca disparava — porque o cliente do Supabase devolve
 * `{ error }` em vez de lançar. Uma gravação recusada sumia sem deixar rastro:
 * a trilha de auditoria de um prontuário eletrônico podia parar de receber
 * linhas e o sistema seguiria relatando normalidade.
 *
 * Agora a falha vai para `reportError`, que alimenta `client_errors` → painel
 * de admin → resumo semanal por e-mail. Continua sem lançar: a ação registrada
 * já aconteceu, e travá-la depois do fato é impossível — o que dá para fazer é
 * garantir que alguém saiba que o registro não entrou.
 *
 * Devolve se gravou, para quem precisar decidir a partir disso.
 */
export async function logAudit(
  action: string,
  targetTable: string,
  targetId?: string | null,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase.from("audit_logs").insert({
      user_id: user.id,
      action,
      target_table: targetTable,
      target_id: targetId ?? null,
      metadata: (metadata ?? null) as Json,
    });

    if (error) {
      reportError(
        new Error(`auditoria não gravada: ${action} em ${targetTable}: ${error.message}`),
      );
      return false;
    }
    return true;
  } catch (e) {
    reportError(e);
    return false;
  }
}
