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

    const { data: recente, error: erroBusca } = await admin
      .from("client_errors")
      .select("id, occurrences")
      .eq("source", opts.source)
      .eq("context", opts.context)
      .eq("message", message)
      .gte("last_seen_at", desde)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    /**
     * A única leitura desta base que DEVE degradar em silêncio — quase.
     *
     * `logError` é quem todas as outras funções chamam para relatar falha. Se
     * ela recusar, lançar ou responder com erro, o problema original some junto:
     * o registro do incêndio pegaria fogo. Por isso ela "nunca lança", e isso
     * está certo.
     *
     * O que esta leitura decide é só se a repetição soma numa linha existente ou
     * cria outra. Falhando, o caminho de baixo insere — o erro CONTINUA sendo
     * registrado, e o preço é uma linha duplicada em vez de um contador. Entre
     * perder o registro e duplicá-lo, duplicar é obviamente melhor.
     *
     * Mas tolerada não é silenciosa, e o canal aqui não pode ser `logError`
     * (seria ela chamando a si mesma em cima de uma falha dela). Fica o
     * `console.error`, que é o que sobra e é suficiente: quem for investigar a
     * tabela cheia de duplicatas acha a causa no log da função.
     */
    if (erroBusca) {
      console.error(
        "logError: não consegui agrupar repetições (vai inserir linha nova)",
        erroBusca.message,
      );
    }

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
