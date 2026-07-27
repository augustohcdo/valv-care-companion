// CORS allowlist compartilhado pelas edge functions que lidam com dados de paciente.
// Funções públicas/sem dado sensível (ex.: turnstile-config) podem manter "*".
const ALLOWED_ORIGINS = [
  "https://valvepath.com.br",
  "https://www.valvepath.com.br",
];

// Ambiente de desenvolvimento local (Vite) — só relevante fora de produção.
const DEV_ORIGINS = ["http://localhost:8080", "http://localhost:5173"];

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || DEV_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}
