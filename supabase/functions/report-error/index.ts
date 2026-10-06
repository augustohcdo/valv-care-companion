// Recebe erros client-side (Error Boundary global, listeners de erro não
// tratado) e grava em public.client_errors via logError. Sem JWT obrigatório
// porque o app pode quebrar antes do login ou com sessão expirada.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { logError } from "../_shared/logError.ts";

/**
 * Descobre quem está reportando, a partir do JWT.
 *
 * O `user_id` deliberadamente NÃO é aceito pelo corpo da requisição: este
 * endpoint é público (`verify_jwt = false`, porque o app pode quebrar antes do
 * login), então um id vindo do cliente seria forjável e atribuiria o erro de
 * um usuário a outro. Sem token, o erro fica anônimo — que é o correto.
 */
async function usuarioDoToken(req: Request): Promise<string | null> {
  try {
    const header = req.headers.get("Authorization") ?? "";
    if (!header.startsWith("Bearer ")) return null;
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return null;
    const admin = createClient(url, key);
    // getUser, não getClaims: `getClaims` não existe no SDK 2.45.0 fixado aqui,
    // e como a chamada fica dentro de um try/catch a ausência virava um
    // `null` silencioso — todo erro ficava anônimo, inclusive de quem estava
    // logado. `getUser` valida o token no servidor e existe nas duas versões.
    // O `error` é OLHADO, e a decisão é a mesma: anônimo. Esta função é pública
    // e recebe a chave anônima neste mesmo cabeçalho — um erro aqui é o caso
    // corriqueiro, não uma anomalia. O que não pode é o erro ser descartado sem
    // ninguém ter decidido nada: a decisão está escrita, e é esta linha.
    const { data, error } = await admin.auth.getUser(header.replace("Bearer ", ""));
    if (error) return null;
    return data?.user?.id ?? null;
  } catch {
    // A chave anônima também chega neste cabeçalho; não é um usuário, e não é
    // motivo para descartar o erro.
    return null;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message : "erro desconhecido";
    const stack = typeof body.stack === "string" ? body.stack : null;
    const route = typeof body.route === "string" ? body.route : "desconhecida";
    const userAgent = typeof body.userAgent === "string" ? body.userAgent : null;

    // Para um "Script error." — que por definição vem sem stack — a origem é o
    // único jeito de distinguir bug nosso de ruído de extensão do navegador.
    const metadata: Record<string, unknown> = {};
    if (userAgent) metadata.userAgent = userAgent;
    if (typeof body.filename === "string" && body.filename) {
      metadata.filename = body.filename.slice(0, 500);
    }
    if (typeof body.lineno === "number") metadata.lineno = body.lineno;
    if (typeof body.colno === "number") metadata.colno = body.colno;

    const registrou = await logError({
      source: "client",
      context: route,
      message,
      stack,
      userId: await usuarioDoToken(req),
      metadata: Object.keys(metadata).length ? metadata : null,
    });

    /**
     * `ok` diz se o erro foi REGISTRADO, e não se a requisição chegou.
     *
     * Antes era `{ ok: true }` fixo: o `logError` não devolvia nada, e uma
     * gravação recusada — que o cliente do Supabase entrega como `{ error }`,
     * sem lançar — virava "ok" aqui. O endpoint cujo trabalho é tornar falhas
     * visíveis respondia sucesso sobre o próprio fracasso.
     *
     * O status fica 200 de propósito, e isso NÃO é descuido: quem chama este
     * endpoint é o tratador de erros do app. Um 500 aqui pode virar outro erro,
     * que vira outro reporte — e o laço some com o erro original. A verdade vai
     * no corpo, como o `offsite-copy` já faz com `alerta_enviado`.
     *
     * Quem lê: `reportError` no cliente é best-effort e não olha a resposta, de
     * propósito. Mas o `console.error` do `logError` lá dentro grita no log da
     * função, e quem chamar este endpoint à mão — para conferir se o caminho
     * está de pé — recebe a resposta honesta.
     */
    return new Response(JSON.stringify({ ok: registrou }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("report-error failed", e);
    return new Response(JSON.stringify({ ok: false }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
