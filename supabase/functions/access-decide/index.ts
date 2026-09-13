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

    const { data: isAdmin, error: erroPapel } = await admin.rpc("has_role", {
      _user_id: adminUserId, _role: "admin",
    });
    // Negar sem confirmar o papel está certo. Dizer "forbidden" quando o que
    // houve foi falha de leitura, não: o administrador de verdade conclui que
    // perdeu o acesso e vai procurar o problema na conta dele.
    if (erroPapel) return json({ error: "role_check_failed", detail: erroPapel.message }, 503);
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : null;
    const aprovar = body.aprovar === true;
    const motivo = typeof body.motivo === "string" ? body.motivo.trim().slice(0, 1000) : null;
    if (!id) return json({ error: "id obrigatório" }, 400);
    if (!aprovar && !motivo) return json({ error: "recusa exige motivo" }, 400);

    const { data: pedido, error: erroPedido } = await admin
      .from("access_requests").select("*").eq("id", id).maybeSingle();
    // A leitura falhando dizia ao administrador "solicitação não encontrada" —
    // sobre um pedido que ESTÁ lá. Falso em dois níveis, como o "médico não
    // encontrado" que esta base já tinha: o pedido existe, e a culpa some para
    // o lado de quem clicou. Aqui o pedido é de acesso a dados pelo titular;
    // concluir que ele sumiu da fila é concluir que alguém o apagou.
    if (erroPedido) {
      return json({ error: "leitura_falhou", detail: erroPedido.message }, 503);
    }
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
      const { error: erroTrilhaRecusa } = await admin.from("audit_logs").insert({
        user_id: adminUserId, action: "access_request_rejected",
        target_table: "access_requests", target_id: id,
        metadata: { email: pedido.email, motivo, email_enviado: envio.sent },
      });
      // A recusa já foi gravada e o e-mail já saiu; o que falta é o registro de
      // QUEM recusou e por quê. Numa decisão sobre acesso profissional, é
      // exatamente essa parte que alguém vai querer reconstituir depois.
      if (erroTrilhaRecusa) {
        await logError({
          source: "edge_function", context: "access-decide",
          message: `recusa de ${pedido.email} registrada, mas a trilha NÃO gravou: ${erroTrilhaRecusa.message}`,
        });
      }
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

    /**
     * O que NÃO ficou gravado nesta aprovação.
     *
     * O `doctors.upsert` logo acima É conferido e devolve 500 com o motivo —
     * quem escreveu aquilo conhecia o padrão. As três escritas seguintes
     * ficaram sem, e cada uma falha de um jeito próprio e caro.
     *
     * Nenhuma delas dá para desfazer aqui: a conta já existe e o e-mail de
     * "seu acesso foi aprovado" já saiu. O que dá é NÃO responder `ok: true`
     * sobre o que não persistiu, e dizer ao administrador exatamente o que
     * falta para ele consertar à mão.
     */
    const naoPersistiu: string[] = [];

    const { error: erroPapelMedico } = await admin.from("user_roles").upsert(
      { user_id: userId, role: "medico" }, { onConflict: "user_id,role" },
    );
    // Sem o papel, a pessoa recebe o e-mail dizendo que foi aprovada, define a
    // senha, entra — e o `ProtectedRoute` não a deixa passar. Aprovada no papel
    // e barrada na porta, sem ninguém dos dois lados entender por quê.
    if (erroPapelMedico) {
      naoPersistiu.push(`papel de médico (user_roles): ${erroPapelMedico.message}`);
    }

    // A anuência do diretório entra na trilha de consentimento, e não só na
    // fila: é lá que um pedido de LGPD ("mostre tudo que vocês têm sobre mim")
    // vai procurar. A data que vale é a do pedido, não a da aprovação.
    if (pedido.consent_diretorio) {
      const { error: erroConsentimento } = await admin.from("user_consents").upsert({
        user_id: userId, consent_type: "directory_listing", granted: true,
        document_version: "1.0", source: "access_request",
        granted_at: pedido.created_at,
      }, { onConflict: "user_id,consent_type" });
      // A mais grave das três, e o comentário acima já dizia por quê sem que a
      // escrita fosse conferida: é aqui que um pedido de LGPD vai procurar. Se
      // isto falha calado, a pessoa PASSA A APARECER no diretório e não existe
      // registro de que ela concordou. O art. 8º §2º põe o ônus da prova do
      // consentimento no controlador — e a prova é exatamente esta linha.
      if (erroConsentimento) {
        naoPersistiu.push(
          `consentimento de listagem no diretório (user_consents): ${erroConsentimento.message}`,
        );
      }
    }

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

    const { error: erroStatus } = await admin.from("access_requests").update({
      status: "aprovado", user_id: userId,
      decidido_por: adminUserId, decidido_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    // É esta linha que faz a guarda de duplicidade lá em cima funcionar: o
    // `if (pedido.status === "aprovado") return 409` só protege se o status
    // tiver mudado. Falhando calada, o pedido continua PENDENTE na fila, e a
    // próxima aprovação refaz tudo — segundo e-mail, segundo link de senha.
    if (erroStatus) {
      naoPersistiu.push(`status do pedido (access_requests): ${erroStatus.message}`);
    }

    const { error: erroTrilha } = await admin.from("audit_logs").insert({
      user_id: adminUserId, action: "access_request_approved",
      target_table: "access_requests", target_id: id,
      metadata: {
        email: pedido.email, conta_criada: userId,
        crm_conferido: !!pedido.crm_conferido_em, email_enviado: envio.sent,
      },
    });
    if (erroTrilha) naoPersistiu.push(`trilha de auditoria (audit_logs): ${erroTrilha.message}`);

    // `ok` deixa de ser constante. Uma aprovação em que o papel não gravou não
    // é uma aprovação; dizer `ok: true` sobre ela é o defeito que esta sessão
    // inteira persegue, no fluxo que decide quem entra no sistema.
    if (naoPersistiu.length) {
      await logError({
        source: "edge_function", context: "access-decide",
        message:
          `aprovação de ${pedido.email} ficou INCOMPLETA — conta ${userId} criada e e-mail ` +
          `enviado, mas não persistiu: ${naoPersistiu.join(" | ")}`,
      });
      return json({
        ok: false,
        status: "aprovacao_incompleta",
        user_id: userId,
        conta_criada: true,
        email_enviado: envio.sent,
        nao_persistiu: naoPersistiu,
        o_que_fazer:
          "A conta existe e a pessoa já recebeu o e-mail de aprovação. Corrija os itens " +
          "acima à mão antes que ela tente entrar — sem o papel de médico ela será barrada.",
      }, 500);
    }

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
