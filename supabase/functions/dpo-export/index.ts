// Gera um export dos dados pessoais de um titular para uma solicitação
// LGPD de acesso/portabilidade (dpo_requests.right_type IN ('acesso','portabilidade')).
// Requer admin autenticado. NÃO executa eliminação — só exportação.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { logError } from "../_shared/logError.ts";

// Tabelas cujo `patient_id` referencia `patients.id` (não auth.users.id).
const PATIENT_ID_TABLES = ["clinical_cases", "patient_documents", "symptom_entries", "medications", "medication_logs"];

// Tabelas cujo `patient_id` referencia auth.users.id diretamente (convenção
// diferente — RLS usa `patient_id = auth.uid()`, não um join via `patients`).
const USER_AS_PATIENT_ID_TABLES = [
  "data_access_requests", "data_access_grants",
  "fhir_resources_inbound", "fhir_resources_outbound", "integration_audit_log",
];

const USER_ID_TABLES = [
  "profiles", "doctors", "patients", "user_consents", "consent_audit_log",
  "notifications", "saved_filters", "dpo_requests",
];

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
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    // `getClaims` não existe no SDK que este bundle resolve: `_shared/logError.ts`
    // fixa `@2.45.0`, e o `npm:@2` daqui deduplica para ela. A chamada lançaria
    // em tempo de execução, e nada acusava — `supabase/functions/` estava fora
    // de toda checagem estática até esta rodada.
    const { data: userData, error: erroSessao } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    // Ler quem chamou e FALHAR não é o mesmo que o chamador não existir. As duas
    // coisas davam 401, e o administrador de verdade concluía que tinha perdido
    // o acesso justamente quando o serviço de autenticação é que tropeçou.
    if (erroSessao) return json({ error: "auth_check_failed", detail: erroSessao.message }, 503);
    const adminUserId = userData?.user?.id;
    if (!adminUserId) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
    const { data: isAdmin, error: erroPapel } = await admin.rpc("has_role", {
      _user_id: adminUserId, _role: "admin",
    });
    // Mesma distinção, do outro lado: "não consegui conferir o papel" virava
    // 403 "forbidden". Nega o acesso — o que está certo, não se abre export de
    // dados pessoais sem confirmar o papel — mas dizia o motivo errado.
    if (erroPapel) return json({ error: "role_check_failed", detail: erroPapel.message }, 503);
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
    const { dpo_request_id } = body ?? {};
    if (!dpo_request_id) return json({ error: "missing_dpo_request_id" }, 400);

    const { data: reqRow, error: reqErr } = await admin
      .from("dpo_requests")
      .select("id, user_id, right_type")
      .eq("id", dpo_request_id)
      .maybeSingle();
    if (reqErr || !reqRow) return json({ error: "not_found" }, 404);
    if (!["acesso", "portabilidade"].includes(reqRow.right_type)) {
      return json({ error: "unsupported_right_type" }, 400);
    }
    const targetUserId = reqRow.user_id as string;

    /**
     * O que NÃO pôde ser lido. Enquanto tiver item, não sai documento.
     *
     * ## O defeito que isto fecha
     *
     * Cada leitura daqui terminava em `?? []`, e o `error` não era olhado.
     * Uma recusa de RLS, uma queda de rede, uma coluna renomeada — qualquer uma
     * virava **tabela vazia dentro do JSON**, e o JSON é assinado, entregue ao
     * titular e apresentado como os dados pessoais dele por inteiro.
     *
     * Não havia como o titular notar: um paciente sem medicação e um paciente
     * cuja tabela de medicações não pôde ser lida produziam o mesmo arquivo.
     * Pior, o `audit_logs` gravava a tabela na lista de incluídas, porque a
     * chave existia com um array vazio — a trilha de conformidade AFIRMAVA a
     * completude que o documento não tinha.
     *
     * Por isso a falha aborta, e não degrada. Resposta atrasada a um pedido do
     * art. 18 se resolve respondendo; resposta incompleta que se apresenta como
     * completa não se resolve, porque ninguém fica sabendo.
     *
     * As falhas são ACUMULADAS em vez de abortarem na primeira: quem for
     * corrigir precisa ver tudo o que está quebrado de uma vez, não descobrir
     * uma por tentativa.
     */
    const falhas: string[] = [];

    /**
     * A checagem fica colada em cada leitura, e não dentro de um `ler(...)`.
     *
     * A primeira versão desta correção tinha o ajudante, e a varredura continuou
     * acusando duas linhas — com razão: passar `admin.from(...)` como ARGUMENTO
     * tira a leitura do alcance de quem a escreveu. O erro era observado uma
     * função adiante, e nem a varredura nem quem lê o arquivo conseguem ver
     * isso daqui.
     *
     * Dava para calar a varredura com uma exceção nominal. Não é o que se faz:
     * lista de exceção envelhece, e um zero comprado com isenção mente mais que
     * um número explicado. Três linhas repetidas por leitura são o preço de a
     * checagem ficar visível ao lado do que ela checa — que é a regra que esta
     * base já aprendeu quando um comentário de quinze linhas empurrou uma
     * checagem para fora do alcance da varredura.
     */
    const { data: patientRow, error: erroPaciente } = await admin
      .from("patients").select("id").eq("user_id", targetUserId).maybeSingle();
    const { data: doctorRow, error: erroMedico } = await admin
      .from("doctors").select("id").eq("user_id", targetUserId).maybeSingle();
    // Estas duas são as piores do arquivo: sem observá-las, UMA falha aqui
    // esvaziava cinco tabelas clínicas de uma vez (casos, documentos, sintomas,
    // medicações e registros de tomada), porque `patientId` ficava nulo e o
    // ternário devolvia `[]` para todas — sem nenhuma delas acusar erro.
    // Linha nula é legítima (o titular pode não ser paciente); `error`, não.
    if (erroPaciente) falhas.push(`patients: ${erroPaciente.message}`);
    if (erroMedico) falhas.push(`doctors: ${erroMedico.message}`);
    const patientId = patientRow?.id ?? null;
    const doctorId = doctorRow?.id ?? null;

    const gathered: Record<string, unknown[]> = {};

    for (const table of USER_ID_TABLES) {
      const { data, error } = await admin.from(table).select("*").eq("user_id", targetUserId);
      if (error) { falhas.push(`${table}: ${error.message}`); continue; }
      gathered[table] = data ?? [];
    }

    for (const table of PATIENT_ID_TABLES) {
      // Sem `patientId` o titular não é paciente, e a tabela vazia é verdade.
      if (!patientId) { gathered[table] = []; continue; }
      const { data, error } = await admin.from(table).select("*").eq("patient_id", patientId);
      if (error) { falhas.push(`${table}: ${error.message}`); continue; }
      gathered[table] = data ?? [];
    }

    for (const table of USER_AS_PATIENT_ID_TABLES) {
      const { data, error } = await admin.from(table).select("*").eq("patient_id", targetUserId);
      if (error) { falhas.push(`${table}: ${error.message}`); continue; }
      gathered[table] = data ?? [];
    }

    // As três do lado médico, que eram três ternários iguais. Em lista, a coluna
    // de cada uma fica à vista — `case_comments` filtra por `author_doctor_id`,
    // e essa diferença estava enterrada no meio de uma expressão.
    const DO_LADO_MEDICO: { chave: string; tabela: string; coluna: string }[] = [
      { chave: "case_collaborators", tabela: "case_collaborators", coluna: "doctor_id" },
      { chave: "case_comments", tabela: "case_comments", coluna: "author_doctor_id" },
      { chave: "clinical_cases_as_doctor", tabela: "clinical_cases", coluna: "doctor_id" },
    ];
    for (const { chave, tabela, coluna } of DO_LADO_MEDICO) {
      if (!doctorId) { gathered[chave] = []; continue; }
      const { data, error } = await admin.from(tabela).select("*").eq(coluna, doctorId);
      if (error) { falhas.push(`${chave}: ${error.message}`); continue; }
      gathered[chave] = data ?? [];
    }

    // Segunda ordem: tabelas filhas de clinical_cases (só relevantes se o
    // titular tem casos como paciente ou como médico responsável).
    const caseIds = [
      ...((gathered["clinical_cases"] as any[]) ?? []).map((c) => c.id),
      ...((gathered["clinical_cases_as_doctor"] as any[]) ?? []).map((c) => c.id),
    ];
    for (const table of ["case_events", "case_exams", "case_messages", "case_documents"]) {
      if (!caseIds.length) { gathered[table] = []; continue; }
      const { data, error } = await admin.from(table).select("*").in("case_id", caseIds);
      if (error) { falhas.push(`${table}: ${error.message}`); continue; }
      gathered[table] = data ?? [];
    }

    if (falhas.length) {
      // Registrar a TENTATIVA falha também é parte da trilha: sem isto, o
      // pedido de LGPD ficaria sem nenhum rastro de que alguém tentou atendê-lo
      // e o sistema não conseguiu.
      await logError({
        source: "edge_function", context: "dpo-export",
        message: `export abortado — ${falhas.length} tabela(s) não puderam ser lidas: ${falhas.join(" | ")}`,
      });
      return json({ error: "incomplete_read", tables: falhas }, 503);
    }

    const doc = {
      generated_at: new Date().toISOString(),
      dpo_request_id,
      right_type: reqRow.right_type,
      subject_user_id: targetUserId,
      data: gathered,
    };
    const path = `dpo-exports/${dpo_request_id}-${Date.now()}.json`;
    const { error: upErr } = await admin.storage.from("clinical-exports").upload(
      path,
      new TextEncoder().encode(JSON.stringify(doc, null, 2)),
      { contentType: "application/json", upsert: false },
    );
    if (upErr) return json({ error: upErr.message }, 500);

    const { data: signed, error: signErr } = await admin.storage
      .from("clinical-exports")
      .createSignedUrl(path, 60 * 30);
    if (signErr || !signed) return json({ error: signErr?.message ?? "sign_failed" }, 500);

    // `Object.keys(gathered)` sozinho dizia "esta tabela entrou no export" sem
    // dizer com o quê — e era exatamente essa frase que ficava verdadeira
    // quando a leitura falhava e a chave existia com um array vazio. Guardar a
    // CONTAGEM por tabela deixa a trilha conferível: quem auditar depois compara
    // com a base e vê se bate.
    const linhasPorTabela: Record<string, number> = {};
    for (const [tabela, linhas] of Object.entries(gathered)) {
      linhasPorTabela[tabela] = linhas.length;
    }
    const { error: erroTrilha } = await admin.from("audit_logs").insert({
      user_id: adminUserId,
      action: "dpo_export_generated",
      target_table: "dpo_requests",
      target_id: dpo_request_id,
      metadata: { tables: linhasPorTabela, right_type: reqRow.right_type, path },
    });
    // O documento já foi gerado e assinado: recusar a entrega agora não
    // desfaria nada e deixaria o titular sem resposta. Mas um export de dados
    // pessoais entregue SEM registro é um problema de conformidade por si só —
    // então a falha é relatada junto, em vez de sumir.
    if (erroTrilha) {
      await logError({
        source: "edge_function", context: "dpo-export",
        message: `export ${path} entregue, mas a trilha em audit_logs NÃO foi gravada: ${erroTrilha.message}`,
      });
    }

    return json({
      url: signed.signedUrl, path, generated_at: doc.generated_at,
      tables: linhasPorTabela,
      audit_logged: !erroTrilha,
    }, 200);
  } catch (e) {
    await logError({
      source: "edge_function", context: "dpo-export",
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack ?? null : null,
    });
    return json({ error: "internal_error" }, 500);
  }
});
