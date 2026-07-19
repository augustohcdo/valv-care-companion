// Edge function: knowledge-seed
// Admin-only. Popula a base RAG com trechos PRELIMINARES gerados por conhecimento geral do modelo.
// TODOS os chunks são marcados com review_status='ai_generated' e devem ser revisados por médico
// humano antes de virarem referência clínica publicada.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const EMBED_MODEL = "google/gemini-embedding-2";

type SeedChunk = { source_slug: string; topic: string; section: string; content: string };

// ============================================================
// CONTEÚDO PRELIMINAR — GERADO POR CONHECIMENTO GERAL DO MODELO
// AGUARDA REVISÃO DE CARDIOLOGISTA/CIRURGIÃO ANTES DE PUBLICAR
// ============================================================
const SEED: SeedChunk[] = [
  // ===== SBC 2024 =====
  {
    source_slug: "sbc-valvopatias-2024",
    topic: "estenose_aortica",
    section: "Estenose aórtica — indicações de intervenção (SBC 2024)",
    content:
      "A Diretriz Brasileira de Valvopatias 2024 recomenda intervenção (SAVR ou TAVI) em pacientes com estenose aórtica grave sintomática (Classe I). Em assintomáticos com FE < 50%, teste ergométrico anormal ou EAo muito grave (Vmax ≥ 5,0 m/s), intervenção é Classe IIa. Para a escolha entre SAVR e TAVI, a SBC pondera a disponibilidade regional de TAVI no SUS e recomenda decisão do Heart Team, com preferência por TAVI em ≥ 75 anos ou alto risco cirúrgico. Em < 65 anos, SAVR é preferido por durabilidade da bioprótese/mecânica.",
  },
  {
    source_slug: "sbc-valvopatias-2024",
    topic: "estenose_mitral",
    section: "Estenose mitral reumática — contexto brasileiro (SBC 2024)",
    content:
      "A doença reumática permanece a causa mais frequente de estenose mitral no Brasil, com pacientes tipicamente mais jovens que em coortes europeias/americanas. A SBC 2024 recomenda valvoplastia mitral percutânea por balão (CMBP) como primeira escolha em pacientes com escore de Wilkins ≤ 8, ausência de trombo em átrio esquerdo e regurgitação mitral ≤ moderada (Classe I). Cirurgia (comissurotomia aberta ou troca valvar) fica reservada a casos com anatomia desfavorável, trombo persistente ou reestenose. Profilaxia secundária com penicilina benzatina IM deve ser mantida.",
  },
  {
    source_slug: "sbc-valvopatias-2024",
    topic: "insuficiencia_mitral",
    section: "Insuficiência mitral primária — SBC 2024",
    content:
      "Para IM primária grave sintomática, a SBC 2024 recomenda reparo valvar em centros com expertise (Classe I). Em assintomáticos com FE 60% e LVESD ≥ 40 mm, considerar reparo em centro experiente (Classe IIa). TEER (MitraClip) é opção para pacientes com alto risco cirúrgico e anatomia favorável, ressaltando disponibilidade limitada no SUS. Diferentemente do ESC 2021 que estende TEER também a IM secundária, a SBC destaca critérios rigorosos (COAPT-like) para essa indicação.",
  },
  {
    source_slug: "sbc-valvopatias-2024",
    topic: "insuficiencia_aortica",
    section: "Insuficiência aórtica crônica — SBC 2024",
    content:
      "Indicação de cirurgia em IAo crônica grave: sintomas (Classe I); assintomáticos com FE ≤ 55% ou LVESD > 50 mm (> 25 mm/m²) (Classe I). A SBC 2024 alinha-se ao ACC/AHA nesses limiares e recomenda avaliação de aorta ascendente por angioTC quando houver dilatação ≥ 45 mm em pacientes com valva bicúspide, ou ≥ 50 mm em tricúspide.",
  },
  {
    source_slug: "sbc-valvopatias-2024",
    topic: "valvopatia_tricuspide",
    section: "Regurgitação tricúspide — SBC 2024",
    content:
      "RT primária grave sintomática: cirurgia é Classe I quando houver disfunção de VD progressiva. RT funcional secundária a valvopatia esquerda: abordar no mesmo tempo cirúrgico (Classe I). TRI-SCORE é recomendado para estratificação de risco. Intervenção transcateter (T-TEER) é considerada em pacientes inoperáveis e ainda tem disponibilidade limitada no Brasil.",
  },
  {
    source_slug: "sbc-valvopatias-2024",
    topic: "estenose_aortica",
    section: "Epidemiologia e anticoagulação — SBC 2024",
    content:
      "Prótese mecânica: anticoagulação com varfarina é obrigatória e permanente; DOACs (rivaroxabana, apixabana, dabigatrana, edoxabana) são contraindicados. Bioprótese aórtica pós-op: AAS 75-100 mg/dia; anticoagulação plena 3-6 meses é opcional. FA associada a estenose mitral reumática moderada/grave ou a prótese mecânica: somente varfarina, INR-alvo conforme prótese.",
  },
  // ===== DATASUS =====
  {
    source_slug: "datasus-valvopatia-reumatica",
    topic: "estenose_mitral",
    section: "Epidemiologia brasileira da doença reumática",
    content:
      "Dados do DATASUS/SIH-SUS mostram que a febre reumática e a valvopatia reumática continuam responsáveis por parcela expressiva das internações cardiovasculares em adolescentes e adultos jovens no Brasil, com maior concentração em regiões Norte e Nordeste. Isso contrasta com EUA e Europa Ocidental, onde a etiologia degenerativa domina. Consequência prática: em paciente jovem brasileiro com dispneia progressiva e sopro diastólico, estenose mitral reumática deve estar entre as primeiras hipóteses.",
  },
  // ===== ACC/AHA 2020 =====
  {
    source_slug: "acc-aha-2020-valvular",
    topic: "estenose_aortica",
    section: "AHA 2020 — indicações de intervenção em EAo",
    content:
      "ACC/AHA 2020: SAVR ou TAVI em EAo grave sintomática (Classe I, NE A). TAVI preferido em ≥ 80 anos ou expectativa de vida < 10 anos; SAVR em < 65 anos ou expectativa de vida > 20 anos. Zona intermediária (65-80): decisão do Heart Team. Assintomáticos com FE < 50% (Classe I) ou EAo muito grave Vmax ≥ 5,0 m/s (Classe IIa).",
  },
  {
    source_slug: "acc-aha-2020-valvular",
    topic: "insuficiencia_mitral",
    section: "AHA 2020 — IM primária",
    content:
      "IM primária grave crônica sintomática (Estágio D): reparo mitral em centro experiente é Classe I. IM primária assintomática com FE ≤ 60% ou LVESD ≥ 40 mm: reparo em centro experiente é Classe IIa. TEER em IM primária de alto risco cirúrgico: Classe IIa quando anatomia favorável.",
  },
  // ===== ESC 2021 =====
  {
    source_slug: "esc-eacts-2021-vhd",
    topic: "estenose_aortica",
    section: "ESC 2021 — indicações de intervenção em EAo",
    content:
      "ESC/EACTS 2021: intervenção em EAo grave sintomática é Classe I. TAVI preferido em ≥ 75 anos ou STS/EuroSCORE II > 8%; SAVR preferido em < 75 anos com baixo risco cirúrgico. Em assintomáticos com FE < 50% sem outra causa: Classe I para intervenção. EAo muito grave assintomática (Vmax ≥ 5,5 m/s): Classe IIa.",
  },
  {
    source_slug: "esc-eacts-2021-vhd",
    topic: "insuficiencia_mitral",
    section: "ESC 2021 — TEER em IM secundária",
    content:
      "ESC 2021 amplia indicação de TEER (MitraClip) em IM secundária a pacientes não candidatos à cirurgia, quando anatomia favorável e otimização máxima do tratamento clínico de IC (Classe IIa). Difere da SBC 2024 que mantém critérios COAPT-like mais rígidos, dada a disponibilidade limitada da técnica no SUS.",
  },
];

async function embedText(apiKey: string, text: string): Promise<number[] | null> {
  const r = await fetch(EMBED_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!r.ok) { console.error("embed fail", r.status, await r.text()); return null; }
  const j = await r.json();
  return j.data?.[0]?.embedding ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PUBLISHABLE = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "unauth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, PUBLISHABLE, { global: { headers: { Authorization: authHeader } } });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) return new Response(JSON.stringify({ error: "unauth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userRes.user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Mapa slug -> id
    const { data: sources } = await admin.from("knowledge_sources").select("id, slug");
    const slugToId: Record<string, string> = {};
    (sources ?? []).forEach((s: any) => { slugToId[s.slug] = s.id; });

    let inserted = 0, skipped = 0;
    for (const chunk of SEED) {
      const source_id = slugToId[chunk.source_slug];
      if (!source_id) { skipped++; continue; }

      // Idempotência: se já existir chunk com essa section para essa fonte, pula
      const { data: existing } = await admin
        .from("knowledge_chunks")
        .select("id")
        .eq("source_id", source_id)
        .eq("section", chunk.section)
        .maybeSingle();
      if (existing) { skipped++; continue; }

      const embedding = await embedText(LOVABLE_API_KEY, `${chunk.section}\n\n${chunk.content}`);
      if (!embedding) { skipped++; continue; }

      const { error } = await admin.from("knowledge_chunks").insert({
        source_id,
        topic: chunk.topic,
        section: chunk.section,
        content: chunk.content,
        embedding: embedding as any,
        review_status: "ai_generated",
        metadata: { generated_by: "knowledge-seed", awaiting_medical_review: true },
      });
      if (error) { console.error("insert fail", error); skipped++; continue; }
      inserted++;
    }

    return new Response(
      JSON.stringify({
        ok: true, inserted, skipped, total: SEED.length,
        warning: "Todos os trechos são PRELIMINARES (ai_generated). Requerem revisão médica antes de publicar.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("knowledge-seed error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
