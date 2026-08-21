// Ingestão da base de conhecimento a partir de obras de referência.
//
// O `knowledge-seed` tem os trechos escritos dentro do próprio arquivo: para
// acrescentar conteúdo era preciso editar código e publicar a função de novo.
// Esta recebe os trechos por payload, calcula os embeddings e grava — é o que
// torna a base alimentável a cada obra lida, sem deploy.
//
// **O que entra aqui é síntese com citação, nunca a redação da obra.** Fato e
// recomendação não são protegidos; a expressão é. Copiar parágrafos de um livro
// para o banco e servi-los seria reproduzir a obra — por isso cada trecho exige
// `citation` apontando capítulo/página, e há um teto de tamanho: um "trecho" que
// passa de alguns milhares de caracteres deixou de ser síntese.
//
// Tudo nasce `ai_generated`. O gatilho `impedir_revisao_sem_medico` recusa
// qualquer tentativa de gravar 'reviewed' por aqui — a promoção só acontece pelo
// `revisar_trecho`, que lê nome e CRM de um médico verificado.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { logError } from "../_shared/logError.ts";

const EMBED_MODEL = "gemini-embedding-001";
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;

/** Acima disto não é mais síntese — é transcrição. */
const MAX_CONTEUDO = 4000;

interface TrechoEntrada {
  topic: string;
  section: string;
  content: string;
  /** De onde veio, com precisão suficiente para alguém conferir na fonte. */
  citation: string;
}

interface FonteEntrada {
  slug: string;
  title: string;
  organization?: string;
  authors?: string;
  edition?: string;
  year?: number;
  scope?: string;
  url?: string | null;
  citation?: string;
  description?: string;
  license_note?: string;
  is_primary_br?: boolean;
}

async function embedText(apiKey: string, text: string): Promise<number[] | null> {
  const r = await fetch(EMBED_URL, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ content: { parts: [{ text }] } }),
  });
  if (!r.ok) {
    console.error("embed fail", r.status, (await r.text()).slice(0, 300));
    return null;
  }
  const j = await r.json();
  return j.embedding?.values ?? null;
}

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
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const { data: userData } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return json({ error: "missing_gemini_key" }, 500);

    let body: { source?: FonteEntrada; chunks?: TrechoEntrada[] };
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const fonte = body.source;
    const trechos = body.chunks ?? [];
    if (!fonte?.slug || !fonte.title) return json({ error: "source_incompleta" }, 400);
    if (!trechos.length) return json({ error: "sem_trechos" }, 400);

    // Validação antes de gastar uma única chamada de embedding: recusar o lote
    // inteiro é melhor que gravar metade e deixar a base num estado que ninguém
    // sabe descrever.
    const invalidos = trechos
      .map((t, i) => {
        if (!t.topic || !t.section || !t.content) return `#${i}: campo obrigatório vazio`;
        if (!t.citation?.trim()) return `#${i}: sem citação — não dá para conferir na fonte`;
        if (t.content.length > MAX_CONTEUDO)
          return `#${i}: ${t.content.length} caracteres (máx. ${MAX_CONTEUDO}) — isso é transcrição, não síntese`;
        return null;
      })
      .filter(Boolean);
    if (invalidos.length) return json({ error: "lote_invalido", detalhes: invalidos }, 400);

    const { data: fonteGravada, error: erroFonte } = await admin
      .from("knowledge_sources")
      .upsert(
        {
          slug: fonte.slug,
          title: fonte.title,
          organization: fonte.organization ?? null,
          authors: fonte.authors ?? null,
          edition: fonte.edition ?? null,
          year: fonte.year ?? null,
          scope: fonte.scope ?? null,
          url: fonte.url ?? null,
          citation: fonte.citation ?? null,
          description: fonte.description ?? null,
          license_note: fonte.license_note ?? null,
          is_primary_br: fonte.is_primary_br ?? false,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (erroFonte || !fonteGravada) throw erroFonte ?? new Error("fonte não gravada");

    const gravados: string[] = [];
    const falhas: Record<string, string> = {};

    for (const t of trechos) {
      const chave = `${t.topic} · ${t.section}`;
      try {
        // O texto do embedding inclui a seção: é o que faz a busca por tópico
        // encontrar o trecho certo quando o enunciado é curto.
        const vetor = await embedText(GEMINI_API_KEY, `${t.section}\n\n${t.content}`);
        if (!vetor) throw new Error("embedding não gerado");

        const { error } = await admin.from("knowledge_chunks").insert({
          source_id: fonteGravada.id,
          topic: t.topic,
          section: t.section,
          content: t.content,
          embedding: vetor,
          metadata: { citation: t.citation, ingerido_em: new Date().toISOString() },
          review_status: "ai_generated",
        });
        if (error) throw error;
        gravados.push(chave);
      } catch (e) {
        falhas[chave] = e instanceof Error ? e.message : String(e);
      }
    }

    await admin.from("audit_logs").insert({
      user_id: userData.user.id,
      action: "knowledge_ingested",
      target_table: "knowledge_chunks",
      target_id: fonteGravada.id,
      metadata: { fonte: fonte.slug, gravados: gravados.length, falhas: Object.keys(falhas).length },
    });

    return json({
      ok: Object.keys(falhas).length === 0,
      fonte: fonte.slug,
      gravados: gravados.length,
      falhas,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logError({ source: "edge_function", context: "knowledge-ingest", message });
    return json({ error: "internal_error", detail: message }, 500);
  }
});
