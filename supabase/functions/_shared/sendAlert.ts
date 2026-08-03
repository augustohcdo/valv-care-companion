/**
 * Envia um alerta operacional por e-mail, via Resend.
 *
 * Nasce inerte de propósito: sem `RESEND_API_KEY` ou `ALERT_EMAIL_TO` ele não
 * envia, não lança e diz o motivo. Assim o vigia pode ser publicado e exercitado
 * antes de existir provedor de e-mail — quem chama decide o que fazer com um
 * `sent: false`, e nada quebra enquanto a chave não chega.
 *
 * No mesmo molde de `logError.ts` e `jobRun.ts`: uma falha ao avisar não pode
 * derrubar quem estava avisando.
 */
export type AlertResult = {
  sent: boolean;
  reason?: "not_configured" | "send_failed";
  detail?: string;
};

export async function sendAlert(opts: {
  subject: string;
  body: string;
}): Promise<AlertResult> {
  const key = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("ALERT_EMAIL_TO");
  const from = Deno.env.get("ALERT_EMAIL_FROM") ??
    "ValvePath <nao-responda@envio.valvepath.com.br>";
  // O domínio de envio não recebe e-mail: resposta a ele volta. O Reply-To
  // manda quem responder para uma caixa que existe de verdade.
  const replyTo = Deno.env.get("ALERT_EMAIL_TO");

  if (!key || !to) {
    console.log(`[alerta não enviado: sem provedor configurado] ${opts.subject}`);
    return { sent: false, reason: "not_configured" };
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: to.split(",").map((e) => e.trim()).filter(Boolean),
        reply_to: replyTo,
        subject: opts.subject,
        text: opts.body,
      }),
    });
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 500);
      console.error("sendAlert falhou", r.status, detail);
      return { sent: false, reason: "send_failed", detail };
    }
    return { sent: true };
  } catch (e) {
    console.error("sendAlert falhou", e);
    return { sent: false, reason: "send_failed", detail: String(e).slice(0, 500) };
  }
}
