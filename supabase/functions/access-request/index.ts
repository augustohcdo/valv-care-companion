// Edge function: access-request
//
// Recebe o pedido de acesso profissional de um visitante anônimo, grava em
// `access_requests` e avisa o responsável por e-mail.
//
// `verify_jwt = false` porque quem preenche ainda não tem conta — é justamente
// o ponto. A porta é fechada por três coisas: captcha verificado aqui no
// servidor, validação de formato, e coalescência para um duplo clique não
// virar duas linhas.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { logError } from "../_shared/logError.ts";
import { verificarCaptcha } from "../_shared/captcha.ts";
import { sendEmail } from "../_shared/sendEmail.ts";

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

/** Texto de formulário → o que vai ao banco. Vazio vira null, não string vazia. */
function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  return t ? t.slice(0, max) : null;
}

function validar(body: Record<string, unknown>): { erro: string } | { dados: Record<string, unknown> } {
  const tipo = body.tipo === "clinica" ? "clinica" : "medico";
  const nome = texto(body.nome, 160);
  const email = texto(body.email, 200)?.toLowerCase() ?? null;
  const crm = texto(body.crm, 20);
  const crmUf = texto(body.crm_uf, 2)?.toUpperCase() ?? null;

  if (!nome || nome.length < 5) return { erro: "informe o nome completo" };
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return { erro: "informe um e-mail válido" };
  // CRM é exigido do médico e não da clínica: quem responde por uma clínica
  // pode ser o administrador, e o CRM do responsável técnico vem depois.
  if (tipo === "medico") {
    if (!crm || !/^\d{3,10}$/.test(crm)) return { erro: "informe o número do CRM (só dígitos)" };
    if (!crmUf || !UFS.includes(crmUf)) return { erro: "informe a UF do CRM" };
  }
  if (body.consent_diretorio !== true) {
    return { erro: "é preciso aceitar aparecer no diretório de profissionais" };
  }

  return {
    dados: {
      tipo, nome, email, crm, crm_uf: crmUf,
      telefone: texto(body.telefone, 30),
      especialidade: texto(body.especialidade, 120),
      rqe: texto(body.rqe, 30),
      instituicao: texto(body.instituicao, 160),
      cidade: texto(body.cidade, 120),
      uf: texto(body.uf, 2)?.toUpperCase() ?? null,
      mensagem: texto(body.mensagem, 2000),
      consent_diretorio: true,
      status: "recebido",
    },
  };
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json().catch(() => ({}));

    const captcha = await verificarCaptcha(
      typeof body.captchaToken === "string" ? body.captchaToken : null,
      req.headers.get("cf-connecting-ip"),
    );
    if (!captcha.ok) return json({ error: "captcha_failed", motivo: captcha.motivo }, 403);

    const validado = validar(body);
    if ("erro" in validado) return json({ error: validado.erro }, 400);
    const dados = validado.dados;

    const url = Deno.env.get("SUPABASE_URL");
    const chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !chave) return json({ error: "servidor sem credencial" }, 500);
    const admin = createClient(url, chave);

    // Duplo clique, ou a pessoa reenviando por não ter certeza de que foi, não
    // pode virar duas linhas na fila de aprovação.
    const { data: recente } = await admin
      .from("access_requests")
      .select("id, status")
      .eq("email", dados.email)
      .gte("created_at", new Date(Date.now() - 3600_000).toISOString())
      .limit(1)
      .maybeSingle();
    if (recente) return json({ ok: true, duplicado: true, id: recente.id });

    const { data: criada, error } = await admin
      .from("access_requests").insert(dados).select("id").single();
    if (error || !criada) {
      await logError({
        source: "edge_function", context: "access-request",
        message: `falha ao gravar solicitação: ${error?.message ?? "sem linha"}`,
      });
      return json({ error: "não foi possível registrar a solicitação" }, 500);
    }

    // O e-mail é best-effort e o motivo vai na resposta: se o aviso não sair, a
    // solicitação continua na fila e a tela do administrador a mostra. Uma
    // solicitação perdida por causa do e-mail seria pior que um aviso perdido.
    const destino = Deno.env.get("ALERT_EMAIL_TO");
    const envio = await sendEmail({
      to: destino ?? "",
      subject: `Nova solicitação de acesso — ${dados.nome}`,
      replyTo: String(dados.email),
      text: [
        "Chegou um pedido de acesso profissional ao ValvePath.",
        "",
        `Tipo:          ${dados.tipo === "clinica" ? "Clínica" : "Médico"}`,
        `Nome:          ${dados.nome}`,
        `E-mail:        ${dados.email}`,
        `Telefone:      ${dados.telefone ?? "—"}`,
        `CRM:           ${dados.crm ? `${dados.crm}/${dados.crm_uf}` : "—"}`,
        `Especialidade: ${dados.especialidade ?? "—"}`,
        `RQE:           ${dados.rqe ?? "—"}`,
        `Instituição:   ${dados.instituicao ?? "—"}`,
        `Cidade/UF:     ${[dados.cidade, dados.uf].filter(Boolean).join("/") || "—"}`,
        "",
        dados.mensagem ? `Mensagem:\n${dados.mensagem}\n` : "",
        "Para aprovar ou recusar, abra a fila de acessos:",
        "https://valvepath.com.br/app/admin/acessos",
        "",
        "O CRM ainda não foi conferido — a tela traz o link do portal do CFM",
        "e o que a base pública do CNES tem sobre este nome.",
      ].join("\n"),
    });

    return json({ ok: true, id: criada.id, aviso_enviado: envio.sent, aviso_motivo: envio.reason ?? null });
  } catch (e) {
    await logError({
      source: "edge_function", context: "access-request",
      message: String((e as Error)?.message ?? e),
      stack: (e as Error)?.stack ?? undefined,
    });
    return json({ error: "erro interno" }, 500);
  }
});
