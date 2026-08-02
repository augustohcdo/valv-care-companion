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
    const { data } = await admin.auth.getUser(header.replace("Bearer ", ""));
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

    await logError({
      source: "client",
      context: route,
      message,
      stack,
      userId: await usuarioDoToken(req),
      metadata: Object.keys(metadata).length ? metadata : null,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("report-error failed", e);
    return new Response(JSON.stringify({ ok: false }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
