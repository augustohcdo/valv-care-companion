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
    // Sem observar o erro, uma falha ao ler o usuário fazia esta função voltar
    // `false` calada — e `false` aqui quer dizer "não gravei". O JSDoc acima
    // promete que "alguém saiba que o registro não entrou"; a promessa vale
    // para esta saída também, senão a trilha para de receber linhas e o
    // sistema segue relatando normalidade, que é o que ela veio impedir.
    const { data: { user }, error: erroUsuario } = await supabase.auth.getUser();
    if (erroUsuario) {
      reportError(
        new Error(`auditoria não gravada (não li o usuário): ${action} em ${targetTable}: ${erroUsuario.message}`),
      );
      return false;
    }
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
