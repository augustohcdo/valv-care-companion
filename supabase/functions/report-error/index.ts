// Recebe erros client-side (Error Boundary global, listeners de erro não
// tratado) e grava em public.client_errors via logError. Sem JWT obrigatório
// porque o app pode quebrar antes do login ou com sessão expirada.
import { buildCorsHeaders } from "../_shared/cors.ts";
import { logError } from "../_shared/logError.ts";

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message : "erro desconhecido";
    const stack = typeof body.stack === "string" ? body.stack : null;
    const route = typeof body.route === "string" ? body.route : "desconhecida";
    const userAgent = typeof body.userAgent === "string" ? body.userAgent : null;

    await logError({
      source: "client",
      context: route,
      message,
      stack,
      metadata: userAgent ? { userAgent } : null,
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
