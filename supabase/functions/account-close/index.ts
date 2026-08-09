// Encerramento de conta (LGPD Art. 18, VI).
//
// Duas metades, e cada uma tem que ficar do seu lado: o banco cuida do que é
// dado (pseudonimizar o prontuário, limpar a camada de conta, revogar
// autorizações) pelo RPC `encerrar_conta`; esta função cuida do que é
// **acesso** — embaralhar o e-mail, banir a conta e derrubar as sessões —
// usando a Admin API, que é a interface suportada para mexer em `auth`.
//
// Pode ser chamada pelo administrador (atendendo um pedido da fila de LGPD) ou
// pelo próprio titular (a partir de "Segurança e privacidade"). Nos dois casos
// a identidade sai do JWT; `user_id` no corpo só é aceito de quem é admin.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { logError } from "../_shared/logError.ts";

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    // `getUser`, não `getClaims`: o SDK fixado aqui não tem `getClaims`, e foi
    // exatamente esse detalhe que deixou a `hospital-api-key-create` sem
    // nenhuma verificação de identidade funcionando.
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const ator = userData.user.id;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { data: ehAdmin } = await admin.rpc("has_role", { _user_id: ator, _role: "admin" });
    const alvo = typeof body.user_id === "string" && body.user_id ? body.user_id : ator;

    // O corpo só pode apontar para outra pessoa se quem pede for administrador.
    // Sem esta linha, qualquer usuário autenticado encerraria a conta alheia.
    if (alvo !== ator && !ehAdmin) return json({ error: "forbidden" }, 403);

    const motivo =
      typeof body.motivo === "string" && body.motivo.trim()
        ? body.motivo.trim().slice(0, 500)
        : alvo === ator
          ? "Encerramento solicitado pelo próprio titular"
          : "Pedido de eliminação (LGPD Art. 18, VI) atendido pelo administrador";

    // 1) O banco. Se o RPC recusar (única conta de administrador, por exemplo),
    //    nada em `auth` foi tocado ainda — a conta continua íntegra.
    const { data: relatorio, error: rpcErr } = await admin.rpc("encerrar_conta", {
      _user_id: alvo,
      _motivo: motivo,
    });
    if (rpcErr) return json({ error: "rpc_failed", detail: rpcErr.message }, 400);

    // 2) O acesso. O e-mail é substituído por um endereço inválido por
    //    construção (domínio reservado pela RFC 2606), para que a conta não possa
    //    ser recuperada por e-mail nem colida com um cadastro novo do mesmo
    //    endereço — quem quiser voltar cria uma conta do zero.
    const emailNeutro = `removido-${alvo}@invalid.invalid`;
    const { error: authErr } = await admin.auth.admin.updateUserById(alvo, {
      email: emailNeutro,
      phone: undefined,
      ban_duration: "876000h", // 100 anos: a Admin API não aceita "para sempre"
      user_metadata: { encerrada_em: new Date().toISOString() },
    });
    if (authErr) {
      await logError(admin, {
        source: "edge_function",
        context: "account-close",
        message: `dados encerrados mas auth não: ${authErr.message}`,
        metadata: { user_id: alvo },
      });
      return json({ error: "auth_update_failed", detail: authErr.message }, 500);
    }

    // 3) Derruba o que já estava aberto — sem isto a sessão viva continuaria
    //    valendo até expirar, e "encerrada" seria só uma palavra.
    await admin.auth.admin.signOut(token, "global").catch(() => {});

    // 4) Quando o pedido nasce do próprio titular não existe linha na fila de
    //    LGPD. Criar uma aqui faz o encerramento entrar no mesmo trilho de
    //    conformidade dos pedidos formais, com protocolo e resposta.
    if (alvo === ator) {
      await admin.from("dpo_requests").insert({
        user_id: alvo,
        right_type: "eliminacao",
        status: "atendido",
        requester_name: "Titular (autoatendimento)",
        requester_email: userData.user.email ?? "",
        details: motivo,
        response: JSON.stringify(relatorio),
        responded_at: new Date().toISOString(),
      });
    }

    return json({ ok: true, relatorio });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logError(admin, { source: "edge_function", context: "account-close", message });
    return json({ error: "internal_error" }, 500);
  }
});
