/**
 * Envio de e-mail via Resend.
 *
 * Nasceu como parte do `sendAlert`, que só sabia mandar para o administrador.
 * Foi extraído quando surgiu a mensagem de boas-vindas, que vai para o usuário
 * — duas implementações de envio divergindo seria a mesma armadilha da lista de
 * tabelas do backup.
 *
 * Nunca lança: uma falha no envio não pode derrubar quem estava tentando
 * avisar. Sem `RESEND_API_KEY` fica inerte e diz o motivo.
 */
export type EmailResult = {
  sent: boolean;
  /**
   * `nada_a_avisar` não é falha de envio: é o vigia dizendo que não havia o que
   * mandar. Ficava fora da união e era atribuído mesmo assim — o `deno check`
   * que passou a rodar no CI foi quem mostrou.
   */
  reason?: "not_configured" | "send_failed" | "sem_destinatario" | "nada_a_avisar";
  detail?: string;
};

/** Remetente padrão. O subdomínio de envio não recebe e-mail — daí o "não responda". */
const REMETENTE_PADRAO = "ValvePath <nao-responda@envio.valvepath.com.br>";

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  text: string;
  /** Para onde vai quem apertar "responder". O remetente não recebe. */
  replyTo?: string;
}): Promise<EmailResult> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("ALERT_EMAIL_FROM") ?? REMETENTE_PADRAO;
  const replyTo = opts.replyTo ?? Deno.env.get("ALERT_EMAIL_TO") ?? undefined;

  const destinos = (Array.isArray(opts.to) ? opts.to : opts.to.split(","))
    .map((e) => e.trim())
    .filter(Boolean);

  if (!destinos.length) return { sent: false, reason: "sem_destinatario" };
  if (!key) {
    console.log(`[e-mail não enviado: sem provedor configurado] ${opts.subject}`);
    return { sent: false, reason: "not_configured" };
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: destinos,
        reply_to: replyTo,
        subject: opts.subject,
        text: opts.text,
      }),
    });
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 500);
      console.error("sendEmail falhou", r.status, detail);
      return { sent: false, reason: "send_failed", detail };
    }
    return { sent: true };
  } catch (e) {
    console.error("sendEmail falhou", e);
    return { sent: false, reason: "send_failed", detail: String(e).slice(0, 500) };
  }
}
