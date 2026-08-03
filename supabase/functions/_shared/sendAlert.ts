import { sendEmail, type EmailResult } from "./sendEmail.ts";

/**
 * Alerta operacional para quem administra a plataforma.
 *
 * O envio em si vive em `sendEmail.ts`; aqui fica só a decisão de para quem
 * mandar. Continua inerte sem `RESEND_API_KEY`, sem lançar — uma falha ao
 * avisar não pode derrubar quem estava avisando.
 */
export type AlertResult = EmailResult;

export async function sendAlert(opts: {
  subject: string;
  body: string;
}): Promise<AlertResult> {
  const to = Deno.env.get("ALERT_EMAIL_TO");
  if (!to) {
    console.log(`[alerta não enviado: sem destinatário configurado] ${opts.subject}`);
    return { sent: false, reason: "not_configured" };
  }
  return await sendEmail({ to, subject: opts.subject, text: opts.body });
}
