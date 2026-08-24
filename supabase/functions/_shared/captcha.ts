/**
 * Verificação do token do Turnstile no servidor.
 *
 * O captcha do login e do cadastro é cobrado pelo **servidor de auth** do
 * Supabase — foi assim que a proteção deixou de viver só no navegador. Um
 * formulário público que não passa por `/auth` não é coberto por aquilo, então
 * a verificação precisa acontecer aqui.
 *
 * O token é de uso único: a Cloudflare recusa a segunda validação do mesmo
 * token com `timeout-or-duplicate`. Por isso quem chama valida **uma vez** e
 * segue; revalidar o mesmo token depois falharia.
 */
export type CaptchaResult = { ok: true } | { ok: false; motivo: string };

export async function verificarCaptcha(token: string | undefined | null, ip?: string | null): Promise<CaptchaResult> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    // Sem segredo configurado a verificação não pode acontecer. Recusar é a
    // única resposta honesta: deixar passar transformaria "captcha exigido" em
    // afirmação sobre a interface, que é exatamente o defeito que a checagem
    // no servidor de auth existiu para corrigir.
    return { ok: false, motivo: "captcha_indisponivel" };
  }
  if (!token) return { ok: false, motivo: "captcha_ausente" };

  const corpo = new URLSearchParams({ secret, response: token });
  if (ip) corpo.set("remoteip", ip);

  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: corpo,
    });
    const j = await r.json().catch(() => ({}));
    if (j?.success === true) return { ok: true };
    const codigos: string[] = Array.isArray(j?.["error-codes"]) ? j["error-codes"] : [];
    return { ok: false, motivo: codigos.join(",") || "captcha_recusado" };
  } catch (e) {
    // Falha de rede até a Cloudflare recusa o envio. É um formulário público:
    // deixar passar quando o porteiro está fora do ar é abrir a porta.
    return { ok: false, motivo: `captcha_indisponivel: ${String(e).slice(0, 120)}` };
  }
}
