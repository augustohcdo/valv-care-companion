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
 *
 * ## Devolve se GRAVOU, e por que isso faltava
 *
 * O bloco abaixo raciocina com cuidado sobre a LEITURA de agrupamento poder
 * degradar em silêncio, e promete, com todas as letras, que nesse caso "o erro
 * CONTINUA sendo registrado". As duas ESCRITAS que registram não olhavam o
 * `error` — e o cliente do Supabase devolve `{ error }` em vez de lançar, então
 * o `try/catch` em volta nunca disparava.
 *
 * Quer dizer: uma gravação recusada sumia, a função respondia normalmente, e a
 * promessa do parágrafo acima não tinha nada por trás. É o defeito que
 * `src/lib/auditLog.ts` já conserta, com o motivo escrito lá:
 *
 *   > "Uma gravação recusada sumia sem deixar rastro: a trilha de auditoria de
 *   >  um prontuário eletrônico podia parar de receber linhas e o sistema
 *   >  seguiria relatando normalidade."
 *
 * Mesmo defeito, no irmão da edge. O frontend foi consertado; este não.
 *
 * Continua sem lançar — o registro do incêndio não pode pegar fogo —, mas agora
 * diz se gravou, e grita no `console.error` quando não grava. Quem chama pode
 * decidir a partir disso; o `report-error` decide.
 */
export async function logError(opts: {
  source: "client" | "edge_function";
  context: string;
  message: string;
  stack?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<boolean> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      // Sem credencial não há como gravar, e dizer `true` aqui seria afirmar um
      // registro que não existe.
      console.error("logError: sem SUPABASE_URL/SERVICE_ROLE_KEY — o erro NÃO foi registrado");
      return false;
    }
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
      /**
       * `.select("id")` e a contagem: numa recusa de RLS o PostgREST responde
       * 200 com `error: null` e ZERO linhas — conferir só o `error` leria isso
       * como gravado. É a mesma distinção que `src/lib/mutate.ts` documenta
       * para o lado do cliente, e ela vale igual aqui.
       */
      const { data: alteradas, error: erroUpdate } = await admin
        .from("client_errors")
        .update({
          occurrences: (recente.occurrences ?? 1) + 1,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", recente.id)
        .select("id");
      if (erroUpdate || !alteradas?.length) {
        console.error(
          "logError: NÃO consegui somar a repetição —",
          erroUpdate?.message ?? "zero linhas alteradas",
          `| contexto: ${opts.context}`,
        );
        return false;
      }
      return true;
    }

    const { data: inseridas, error: erroInsert } = await admin
      .from("client_errors")
      .insert({
        source: opts.source,
        context: opts.context,
        message,
        stack: opts.stack ? opts.stack.slice(0, 4000) : null,
        user_id: opts.userId ?? null,
        metadata: opts.metadata ?? null,
      })
      .select("id");
    if (erroInsert || !inseridas?.length) {
      console.error(
        "logError: NÃO consegui registrar o erro —",
        erroInsert?.message ?? "zero linhas inseridas",
        `| contexto: ${opts.context}`,
      );
      return false;
    }
    return true;
  } catch (e) {
    console.error("logError failed", e);
    return false;
  }
}
