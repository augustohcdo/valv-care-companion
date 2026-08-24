// Edge function: access-decide
//
// Aprova ou recusa um pedido de acesso profissional. Admin autenticado.
//
// Aprovar não é mudar um status: é criar a conta, o registro de médico e o
// papel, e mandar ao profissional o link para ele mesmo definir a senha. Se
// qualquer parte disso falhar, a resposta diz o que falhou — um "aprovado" que
// não criou conta seria a pior forma de sucesso relatado sem trabalho feito.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { logError } from "../_shared/logError.ts";
import { sendEmail } from "../_shared/sendEmail.ts";

const SITE = "https://valvepath.com.br";

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

    // `getUser`, não `getClaims`: o SDK fixado aqui não tem o segundo, e a
    // chamada lançaria em tempo de execução.
    const { data: userData } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    const adminUserId = userData?.user?.id;
    if (!adminUserId) return json({ error: "unauthorized" }, 401);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: adminUserId, _role: "admin" });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : null;
    const aprovar = body.aprovar === true;
    const motivo = typeof body.motivo === "string" ? body.motivo.trim().slice(0, 1000) : null;
    if (!id) return json({ error: "id obrigatório" }, 400);
    if (!aprovar && !motivo) return json({ error: "recusa exige motivo" }, 400);

    const { data: pedido } = await admin
      .from("access_requests").select("*").eq("id", id).maybeSingle();
    if (!pedido) return json({ error: "solicitação não encontrada" }, 404);
    if (pedido.status === "aprovado" || pedido.status === "recusado") {
      return json({ error: `solicitação já ${pedido.status}` }, 409);
    }

    // ------------------------------------------------------------- recusa
    if (!aprovar) {
      const { error } = await admin.from("access_requests").update({
        status: "recusado", motivo_recusa: motivo,
        decidido_por: adminUserId, decidido_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) return json({ error: "não foi possível registrar a recusa" }, 500);

      const envio = await sendEmail({
        to: pedido.email,
        subject: "Sobre sua solicitação de acesso ao ValvePath",
        text: [
          `Olá, ${pedido.nome}.`, "",
          "Analisamos seu pedido de acesso ao ValvePath e ele não pôde ser aprovado neste momento.",
          "", `Motivo: ${motivo}`, "",
          "Se quiser conversar sobre isso ou enviar informações adicionais, basta responder",
          "a esta mensagem.", "", "Equipe ValvePath",
        ].join("\n"),
      });
      await admin.from("audit_logs").insert({
        user_id: adminUserId, action: "access_request_rejected",
        target_table: "access_requests", target_id: id,
        metadata: { email: pedido.email, motivo, email_enviado: envio.sent },
      });
      return json({
        ok: true, status: "recusado",
        email_enviado: envio.sent, email_motivo: envio.reason ?? null,
        email_detalhe: envio.detail ?? null,
      });
    }

    // ----------------------------------------------------------- aprovação
    // A conta nasce confirmada: quem aprovou já sabe quem é. O que o
    // profissional faz é definir a própria senha pelo link — nunca recebe uma
    // senha pronta, que teria que trafegar por e-mail.
    const { data: criado, error: erroConta } = await admin.auth.admin.createUser({
      email: pedido.email,
      email_confirm: true,
      user_metadata: {
        full_name: pedido.nome,
        account_type: "medico",
        phone: pedido.telefone ?? undefined,
      },
    });

    let userId = criado?.user?.id ?? null;
    if (!userId) {
      // Conta já existente não é erro: pode ser alguém que já era paciente e
      // agora pede acesso profissional. Recuperar o id é melhor que recusar.
      const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      userId = lista?.users?.find((u) => u.email?.toLowerCase() === String(pedido.email).toLowerCase())?.id ?? null;
      if (!userId) {
        await logError({
          source: "edge_function", context: "access-decide",
          message: `não consegui criar nem localizar a conta: ${erroConta?.message ?? "sem detalhe"}`,
        });
        return json({ error: "não foi possível criar a conta", detalhe: erroConta?.message ?? null }, 500);
      }
    }

    const { error: erroMedico } = await admin.from("doctors").upsert({
      user_id: userId,
      crm: pedido.crm ?? "",
      crm_uf: pedido.crm_uf ?? "",
      specialty: pedido.especialidade ?? null,
      rqe: pedido.rqe ?? null,
      institution: pedido.instituicao ?? null,
      city: pedido.cidade ?? null,
      // Verificado só se alguém de fato conferiu o CRM no portal do CFM. O
      // selo é o que dá autoridade a uma revisão de conteúdo clínico; ligá-lo
      // por aprovação administrativa esvaziaria o significado dele.
      verified: !!pedido.crm_conferido_em,
    }, { onConflict: "user_id" });
    if (erroMedico) {
      await logError({
        source: "edge_function", context: "access-decide",
        message: `conta criada mas registro de médico falhou: ${erroMedico.message}`,
      });
      return json({ error: "conta criada, mas o registro de médico falhou", detalhe: erroMedico.message }, 500);
    }

    await admin.from("user_roles").upsert(
      { user_id: userId, role: "medico" }, { onConflict: "user_id,role" },
    );

    const { data: link } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: pedido.email,
      options: { redirectTo: `${SITE}/auth/redefinir` },
    });

    const envio = await sendEmail({
      to: pedido.email,
      subject: "Seu acesso ao ValvePath foi liberado",
      text: [
        `Olá, ${pedido.nome}.`, "",
        "Seu acesso ao ValvePath foi aprovado.",
        "", "Para entrar, defina sua senha neste link:",
        link?.properties?.action_link ?? `${SITE}/auth/recuperar`,
        "", "O link vale por 1 hora. Se expirar, use \"Esqueci minha senha\" na tela de",
        `entrada (${SITE}/auth/recuperar) com este mesmo e-mail.`,
        "",
        "Seu perfil fica visível no diretório de profissionais que os pacientes",
        "consultam — foi o que você aceitou ao solicitar acesso. Você pode sair do",
        "diretório quando quiser, pela sua página de perfil.",
        "", "Equipe ValvePath",
      ].join("\n"),
    });

    await admin.from("access_requests").update({
      status: "aprovado", user_id: userId,
      decidido_por: adminUserId, decidido_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    await admin.from("audit_logs").insert({
      user_id: adminUserId, action: "access_request_approved",
      target_table: "access_requests", target_id: id,
      metadata: {
        email: pedido.email, conta_criada: userId,
        crm_conferido: !!pedido.crm_conferido_em, email_enviado: envio.sent,
      },
    });

    return json({
      ok: true, status: "aprovado", user_id: userId,
      email_enviado: envio.sent, email_motivo: envio.reason ?? null,
      email_detalhe: envio.detail ?? null,
    });
  } catch (e) {
    await logError({
      source: "edge_function", context: "access-decide",
      message: String((e as Error)?.message ?? e),
      stack: (e as Error)?.stack ?? undefined,
    });
    return json({ error: "erro interno" }, 500);
  }
});
