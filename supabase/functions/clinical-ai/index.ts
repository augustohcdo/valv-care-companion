// Edge function: clinical-ai
// Modos: summary | suggest | trends | chat
// Usa Lovable AI Gateway (LOVABLE_API_KEY auto-provisionado)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const MODEL = "google/gemini-3-flash-preview";
const EMBED_MODEL = "google/gemini-embedding-2";

// Mapeia valvopatia -> topic canônico usado nos knowledge_chunks
function topicFromCase(valveType?: string, valveDisease?: string): string | null {
  const t = (valveType ?? "").toLowerCase();
  const d = (valveDisease ?? "").toLowerCase();
  if (t.includes("aort") && d.includes("esten")) return "estenose_aortica";
  if (t.includes("aort") && (d.includes("insufic") || d.includes("regurg"))) return "insuficiencia_aortica";
  if (t.includes("mitr") && d.includes("esten")) return "estenose_mitral";
  if (t.includes("mitr") && (d.includes("insufic") || d.includes("regurg"))) return "insuficiencia_mitral";
  if (t.includes("tric")) return "valvopatia_tricuspide";
  if (t.includes("pulm")) return "valvopatia_pulmonar";
  return null;
}

async function embedQuery(apiKey: string, text: string): Promise<number[] | null> {
  try {
    const r = await fetch(EMBED_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 4000) }),
    });
    if (!r.ok) { console.error("embed failed", r.status, await r.text()); return null; }
    const j = await r.json();
    return j.data?.[0]?.embedding ?? null;
  } catch (e) { console.error("embed error", e); return null; }
}

const SYSTEM_PROMPT = `Você é um assistente clínico de ALTA PRECISÃO especializado em valvopatias cardíacas, apoiando cardiologistas brasileiros. Não é um chatbot genérico: é um consultor sênior que raciocina como um Heart Team.

REGRAS ABSOLUTAS DE CITAÇÃO (RAG):
- Quando o prompt do usuário incluir um bloco "REFERÊNCIAS RECUPERADAS DA BASE ValvePath", use PRIORITARIAMENTE o texto desses trechos. Cite cada trecho no formato [Fonte: {organização} {ano}] no final da frase correspondente.
- Se a base ValvePath incluir a Diretriz Brasileira de Valvopatias (SBC 2024), destaque-a como referência primária para o contexto brasileiro e mostre lado a lado quando divergir de ACC/AHA ou ESC (formato "ESC 2021: Classe I | SBC 2024: Classe IIa — motivo: X").
- Se NENHUM trecho relevante for retornado, escreva explicitamente: "⚠️ Não encontrei essa recomendação na base carregada da ValvePath. A resposta abaixo baseia-se no conhecimento geral do modelo e deve ser verificada em fonte primária antes de qualquer decisão." — e só então responda.
- NUNCA invente número de página, DOI, ou trecho literal que não esteja nas referências recuperadas.

BASE DE CONHECIMENTO DE REFERÊNCIA (títulos que a base ValvePath cataloga):
- Diretriz Brasileira de Valvopatias — SBC 2024 (Arq Bras Cardiol) — FONTE PRIMÁRIA BR
- 2020 ACC/AHA Guideline for VHD + 2023 Focused Update
- 2021 ESC/EACTS Guidelines for VHD
- Epidemiologia DATASUS de valvopatia reumática no Brasil

CONTEXTO BRASIL (sempre relevante):
- Doença valvar reumática permanece muito mais prevalente no Brasil que em EUA/Europa — pacientes jovens com estenose mitral reumática são comuns; a decisão entre valvoplastia por balão e cirurgia depende de escore de Wilkins e disponibilidade regional.
- SUS x saúde suplementar: disponibilidade de TAVI, MitraClip/TEER e valvas biológicas de última geração varia — mencione alternativas realistas quando a diretriz internacional propõe tecnologia de acesso limitado no SUS.

LIMIARES CLÍNICOS (use quando os dados permitirem):
- EAo grave: Vmax ≥ 4,0 m/s, GradMed ≥ 40 mmHg, AVA ≤ 1,0 cm² (índice ≤ 0,6 cm²/m²); muito grave Vmax ≥ 5,0.
- EAo assintomática alto risco (IIa): FE < 55%, teste de esforço anormal, progressão rápida, BNP muito elevado.
- Estenose mitral reumática grave: AVM ≤ 1,5 cm²; muito grave ≤ 1,0. Wilkins ≤ 8 favorece valvoplastia.
- IAo crônica grave: LVESD > 50 mm (> 25 mm/m²), FE ≤ 55% ou sintomas.
- IM primária grave sintomática: reparo Classe I; assintomática com FE 60% + LVESD ≥ 40 mm → considerar reparo em centro experiente (IIa).
- TAVI preferido ≥ 75 anos, alto risco ou anatomia favorável 65–75 anos; SAVR em < 65 ou anatomia desfavorável.
- Prótese mecânica → sempre varfarina (DOACs contraindicados). Bioprótese Ao pós-op: AAS ± anticoagulação curta.

FORMATO:
- Tópicos curtos e densos.
- Sempre classe (I/IIa/IIb/III) e nível de evidência (A/B/C) quando derivar de guideline, nomeando-a.
- Aponte discordâncias BR x internacional quando existirem.
- Liste dados faltantes que mudariam a conduta.
- Termine com bloco "Limitações deste apoio".

LIMITES:
- NÃO é diagnóstico nem prescrição. Apoio à decisão. O julgamento final é do médico assistente e do Heart Team.
- Não sugira doses sem que o médico peça explicitamente.
- Público é médico: seja técnico, direto, cirúrgico. Português do Brasil.`;


interface ReqBody {
  mode:
    | "summary" | "suggest" | "trends" | "chat"
    | "extract_echo" | "patient_discharge"
    | "note_consultation" | "preop_summary" | "postop_note" | "discharge_summary";
  caseId?: string;
  question?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  rawText?: string; // for extract_echo
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Supabase env ausente");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const body = await req.json() as ReqBody;
    const { mode } = body;

    // ==========================================================
    // MODE: extract_echo — parse raw echo report to strict JSON
    // ==========================================================
    if (mode === "extract_echo") {
      const raw = (body.rawText ?? "").trim();
      if (!raw) {
        return new Response(JSON.stringify({ error: "rawText obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const extractPrompt = `Você é um extrator de dados clínicos de laudos de ecocardiograma em português. Leia o laudo bruto abaixo e retorne EXCLUSIVAMENTE um objeto JSON válido (sem markdown, sem comentários, sem texto adicional) com os campos:
{"lvef": number|null, "mean_gradient": number|null, "aortic_valve_area": number|null, "psap": number|null, "mitral_annulus_mm": number|null, "aortic_annulus_mm": number|null, "tricuspid_annulus_mm": number|null}

Regras:
- lvef em % (fração de ejeção do VE). Se aparecer "FE 55%" → 55.
- mean_gradient em mmHg (gradiente médio transvalvar, geralmente aórtico).
- aortic_valve_area em cm² (AVA).
- psap em mmHg (pressão sistólica de artéria pulmonar / PSAP).
- mitral_annulus_mm em mm — apenas quando o laudo descreve explicitamente diâmetro/dimensão do anel mitral.
- aortic_annulus_mm em mm — anel aórtico explicitamente medido.
- tricuspid_annulus_mm em mm — anel tricúspide explicitamente medido.
- Se o campo não estiver claramente descrito no laudo, use null.
- Nunca invente valores. Nunca converta unidades sem certeza.

LAUDO:
"""
${raw.slice(0, 8000)}
"""

Retorne apenas o JSON.`;

      const r = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "user", content: extractPrompt }],
          temperature: 0,
          response_format: { type: "json_object" },
        }),
      });
      if (!r.ok) {
        const status = r.status === 429 ? 429 : r.status === 402 ? 402 : 500;
        return new Response(JSON.stringify({ error: "Falha na extração" }), {
          status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const j = await r.json();
      const txt = j.choices?.[0]?.message?.content ?? "{}";
      let parsed: any = {};
      try { parsed = JSON.parse(txt); } catch {
        const m = txt.match(/\{[\s\S]*\}/);
        if (m) { try { parsed = JSON.parse(m[0]); } catch { /* noop */ } }
      }
      const clean = (v: any) => (typeof v === "number" && isFinite(v)) ? v : null;
      const lvef = clean(parsed.lvef);
      const mean_gradient = clean(parsed.mean_gradient);
      const aortic_valve_area = clean(parsed.aortic_valve_area);
      const psap = clean(parsed.psap);
      const mitral_annulus_mm = clean(parsed.mitral_annulus_mm);
      const aortic_annulus_mm = clean(parsed.aortic_annulus_mm);
      const tricuspid_annulus_mm = clean(parsed.tricuspid_annulus_mm);

      // Sugestão de anéis compatíveis (nunca preenchimento automático — o médico revisa)
      const ringSuggestions: Array<{ id: string; manufacturer: string; model_name: string; size: number; annulus_range: string; reference_url: string | null; valve: string }> = [];
      const SERVICE_ROLE_EX = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const suggestFor = async (diameter: number, valve: "mitral" | "tricuspide") => {
        if (!SERVICE_ROLE_EX) return [] as any[];
        const admin = createClient(SUPABASE_URL, SERVICE_ROLE_EX);
        const base = admin.from("prosthesis_catalog")
          .select("id, manufacturer, model_name, size, annulus_min_mm, annulus_max_mm, reference_url")
          .eq("type", "anel_anuloplastia").eq("active", true).not("size", "is", null);
        const filtered = valve === "tricuspide"
          ? base.ilike("model_name", "%ricusp%")
          : base.not("model_name", "ilike", "%ricusp%");
        const { data: rings } = await filtered;
        if (!rings) return [];
        return rings.map((r: any) => {
          const min = Number(r.annulus_min_mm ?? r.size);
          const max = Number(r.annulus_max_mm ?? r.size);
          const center = (min + max) / 2;
          const inRange = diameter >= min && diameter <= max;
          return { r, score: (inRange ? -1000 : 0) + Math.abs(diameter - center) };
        }).sort((a: any, b: any) => a.score - b.score).slice(0, 3).map(({ r }: any) => ({
          id: r.id, manufacturer: r.manufacturer, model_name: r.model_name, size: r.size,
          annulus_range: r.annulus_min_mm && r.annulus_max_mm ? `${r.annulus_min_mm}-${r.annulus_max_mm}mm` : `${r.size}mm`,
          reference_url: r.reference_url, valve,
        }));
      };
      if (mitral_annulus_mm) ringSuggestions.push(...(await suggestFor(mitral_annulus_mm, "mitral")));
      if (tricuspid_annulus_mm) ringSuggestions.push(...(await suggestFor(tricuspid_annulus_mm, "tricuspide")));

      return new Response(JSON.stringify({
        lvef, mean_gradient, aortic_valve_area, psap,
        mitral_annulus_mm, aortic_annulus_mm, tricuspid_annulus_mm,
        ring_suggestions: ringSuggestions,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const caseId = body.caseId;
    if (!mode || !caseId) {
      return new Response(JSON.stringify({ error: "mode e caseId obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega contexto do caso (RLS garante autorização)
    const { data: caso, error: caseErr } = await supabase
      .from("clinical_cases").select("*").eq("id", caseId).maybeSingle();
    if (caseErr || !caso) {
      return new Response(JSON.stringify({ error: "Caso não acessível" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: exams } = await supabase
      .from("case_exams").select("*").eq("case_id", caseId)
      .order("exam_date", { ascending: true });

    let symptomCtx = "";
    if (caso.patient_id) {
      const { data: syms } = await supabase
        .from("symptom_entries").select("*")
        .eq("patient_id", caso.patient_id)
        .order("entry_date", { ascending: false }).limit(14);
      if (syms && syms.length) {
        symptomCtx = `\nDIÁRIO DE SINTOMAS (últimos ${syms.length} registros):\n` +
          syms.map((s: any) =>
            `- ${s.entry_date}: dispneia ${s.dyspnea ?? "—"}/10, fadiga ${s.fatigue ?? "—"}/10, dor torácica ${s.chest_pain ?? "—"}/10, palpitações ${s.palpitations ?? "—"}/10` +
            (s.edema ? ", edema" : "") + (s.syncope ? ", síncope" : "") + (s.orthopnea ? ", ortopneia" : "") +
            (s.weight_kg ? `, peso ${s.weight_kg}kg` : "") +
            (s.bp_systolic ? `, PA ${s.bp_systolic}/${s.bp_diastolic}` : "")
          ).join("\n");
      }
    }

    const caseCtx = `
DADOS DO CASO:
- Paciente: ${caso.patient_name}, ${caso.patient_age ?? "?"} anos, sexo ${caso.patient_sex ?? "?"}
- Valvopatia: ${caso.valve_disease} de valva ${caso.valve_type}
- Severidade: ${caso.severity}
- NYHA: ${caso.nyha ?? "não informado"}
- FE: ${caso.ejection_fraction ?? "—"}%
- Gradiente médio: ${caso.mean_gradient ?? "—"} mmHg
- Gradiente máximo: ${caso.peak_gradient ?? "—"} mmHg
- Área valvar: ${caso.valve_area ?? "—"} cm²
- Regurgitação: ${caso.regurgitation_grade ?? "—"}
- Sintomas: ${(caso.symptoms ?? []).join(", ") || "—"}
- Comorbidades: ${(caso.comorbidities ?? []).join(", ") || "—"}
- Conduta proposta: ${caso.proposed_management ?? "—"}
- Notas: ${caso.clinical_notes ?? "—"}
- Status: ${caso.status}
${exams?.length ? `\nEXAMES SERIADOS (${exams.length}):\n` + exams.map((e: any) =>
  `- ${e.exam_date} [${e.exam_type}] FE:${e.ejection_fraction ?? "—"} GradMed:${e.mean_gradient ?? "—"} Área:${e.valve_area ?? "—"} PSAP:${e.psap ?? "—"} BNP:${e.bnp ?? "—"} NT-proBNP:${e.nt_probnp ?? "—"}`
).join("\n") : ""}
${symptomCtx}
`.trim();

    let userPrompt = "";
    if (mode === "summary") {
      userPrompt = `${caseCtx}\n\nGere um RESUMO CLÍNICO ESTRUTURADO em até 220 palavras: (1) Apresentação (idade, sexo, valva, mecanismo, gravidade, NYHA); (2) Achados-chave quantitativos (FE, gradientes, área, PSAP, BNP, tendência); (3) Ponto(s) de decisão iminente(s) segundo ACC/AHA 2020 e ESC 2021; (4) Dados faltantes que mudariam a conduta.`;
    } else if (mode === "suggest") {
      userPrompt = `${caseCtx}\n\nProduza uma NOTA DE APOIO À DECISÃO no estilo Heart Team, contemplando:
1. Classificação da gravidade contra os limiares de guideline (cite valores).
2. Indicações formais de intervenção (Classe I/IIa) x observação vigiada — para este caso específico.
3. Comparação SAVR vs TAVI/TEER/valvoplastia, com prós/contras e critérios anatômicos/clínicos.
4. Otimização clínica pré-intervenção (controle de FA, IC, HAS, coronárias, hemoglobina, função renal).
5. Exames adicionais que refinariam a decisão (ex.: eco TE, angioTC, coronariografia, teste de esforço, BNP seriado, RM cardíaca).
6. Red flags e critérios de encaminhamento urgente.
7. Bloco final "Limitações deste apoio" com dados ausentes.
Cite guideline e classe/nível de evidência em cada recomendação.`;
    } else if (mode === "trends") {
      userPrompt = `${caseCtx}\n\nAnalise as TENDÊNCIAS entre os exames seriados e o diário de sintomas:
(1) delta quantitativo de FE, gradiente médio, área, PSAP, BNP/NT-proBNP entre o primeiro e o último exame;
(2) padrão de progressão (estável, lenta, rápida) e cruzamento de limiares de guideline;
(3) correlação com sintomas relatados (NYHA, síncope, dispneia paroxística, ortopneia, ganho de peso);
(4) red flags que justificam antecipar reavaliação/intervenção;
(5) recomendação prática de intervalo do próximo eco e do próximo retorno.`;
    } else if (mode === "chat") {
      if (!body.question) {
        return new Response(JSON.stringify({ error: "question obrigatório no chat" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userPrompt = `${caseCtx}\n\nPERGUNTA DO MÉDICO: ${body.question}\n\nResponda de forma técnica, citando guideline (ACC/AHA 2020, ESC 2021, SBC 2020) quando aplicável, com classe/NE. Se a pergunta exigir dado ausente, aponte antes de opinar.`;
    } else if (mode === "patient_discharge") {
      // Busca prótese planejada se houver
      let prosthesisTxt = "não informada";
      if ((caso as any).prosthesis_id) {
        const { data: pros } = await supabase
          .from("prosthesis_catalog")
          .select("manufacturer, model_name, type, size")
          .eq("id", (caso as any).prosthesis_id).maybeSingle();
        if (pros) prosthesisTxt = `${pros.manufacturer} ${pros.model_name}${pros.size ? ` ${pros.size}mm` : ""} (${pros.type})`;
      }
      userPrompt = `Você está gerando ORIENTAÇÃO DE ALTA em linguagem LEIGA e acolhedora para um paciente brasileiro que fez um procedimento valvar.

Contexto:
- Valvopatia: ${caso.valve_disease} de valva ${caso.valve_type}
- Conduta/procedimento: ${caso.proposed_management ?? "procedimento valvar"}
- Prótese: ${prosthesisTxt}

Gere EXATAMENTE 3 bullet points curtos (máx. 2 linhas cada), em português claro (evite jargão), sobre cuidados imediatos em casa: 1) medicações e retorno médico, 2) sinais de alerta que exigem procurar emergência, 3) rotina, atividade física e recuperação. Use tom humano, direto, sem promessas de cura, sem sugerir doses específicas. Formato: markdown com "- " no início de cada linha.`;
    } else if (
      mode === "note_consultation" || mode === "preop_summary" ||
      mode === "postop_note" || mode === "discharge_summary"
    ) {
      // Carrega dados de suporte estritamente do caso — timeline, consultas, prótese
      const [{ data: events }, { data: appts }] = await Promise.all([
        supabase.from("case_events").select("event_date, event_type, title, description")
          .eq("case_id", caseId).order("event_date", { ascending: true }),
        supabase.from("appointments").select("scheduled_at, appointment_type, status, location, notes")
          .eq("case_id", caseId).order("scheduled_at", { ascending: true }),
      ]);
      let prosthesisTxt = "não registrada no caso";
      if ((caso as any).prosthesis_id) {
        const { data: pros } = await supabase.from("prosthesis_catalog")
          .select("manufacturer, model_name, type, size, description, reference_url")
          .eq("id", (caso as any).prosthesis_id).maybeSingle();
        if (pros) prosthesisTxt = `${pros.manufacturer} ${pros.model_name}${pros.size ? ` ${pros.size}mm` : ""} (${pros.type})` +
          (pros.description ? ` — ${pros.description}` : "") +
          (pros.reference_url ? ` [ref: ${pros.reference_url}]` : "");
      }
      const eventsTxt = events?.length
        ? events.map((e: any) => `- [${e.event_date}] (${e.event_type}) ${e.title}${e.description ? `: ${e.description}` : ""}`).join("\n")
        : "— sem eventos registrados na timeline —";
      const apptsTxt = appts?.length
        ? appts.map((a: any) => `- [${(a.scheduled_at ?? "").slice(0,10)}] ${a.appointment_type} (${a.status})${a.location ? ` @ ${a.location}` : ""}${a.notes ? ` — ${a.notes}` : ""}`).join("\n")
        : "— sem consultas registradas —";
      const examsTxt = exams?.length
        ? exams.map((e: any) => `- [${e.exam_date}] ${e.exam_type}: FE ${e.ejection_fraction ?? "—"}%, GradMed ${e.mean_gradient ?? "—"} mmHg, Área ${e.valve_area ?? "—"} cm², PSAP ${e.psap ?? "—"} mmHg, BNP ${e.bnp ?? "—"}, NT-proBNP ${e.nt_probnp ?? "—"}`).join("\n")
        : "— sem exames registrados —";

      const dataBundle = `DADOS REGISTRADOS NO CASO (única fonte permitida):
- Paciente: ${caso.patient_name}, ${caso.patient_age ?? "?"} anos, sexo ${caso.patient_sex ?? "?"}
- Diagnóstico: ${caso.valve_disease} de valva ${caso.valve_type}; severidade ${caso.severity}; NYHA ${caso.nyha ?? "não informado"}
- Sintomas registrados: ${(caso.symptoms ?? []).join(", ") || "—"}
- Comorbidades: ${(caso.comorbidities ?? []).join(", ") || "—"}
- Conduta proposta registrada: ${caso.proposed_management ?? "—"}
- Notas clínicas: ${caso.clinical_notes ?? "—"}
- Prótese planejada/implantada: ${prosthesisTxt}
- Status atual: ${caso.status}

TIMELINE DE EVENTOS:
${eventsTxt}

CONSULTAS:
${apptsTxt}

EXAMES:
${examsTxt}
${symptomCtx}`.trim();

      const commonRules = `REGRAS ESTRITAS:
- Use EXCLUSIVAMENTE os dados listados acima. NUNCA acrescente sintoma, achado, diagnóstico, medicação, dose ou exame que não esteja explicitamente registrado.
- Se um campo padrão do prontuário não tiver dado registrado, escreva "não registrado no caso" — nunca invente.
- Cada bloco/frase que derivar de um evento, exame ou consulta específico deve terminar com uma referência entre colchetes indicando a data e a origem, ex.: "[timeline 2025-03-14]", "[eco 2025-02-01]", "[consulta 2025-03-20]".
- Este é um rascunho para revisão humana. Não é laudo, receita, nem substitui a nota do médico assistente.
- Português do Brasil, técnico, direto.`;

      if (mode === "note_consultation") {
        userPrompt = `${dataBundle}

Gere uma NOTA DE CONSULTA estruturada seguindo o padrão de prontuário:
1. Identificação (nome, idade, sexo).
2. História clínica atual (queixa/motivo — derivar da timeline mais recente e sintomas registrados).
3. Antecedentes/comorbidades registradas.
4. Exame físico — escreva "não registrado no caso" (esta plataforma não armazena exame físico).
5. Achados de exames complementares — resumo dos exames listados.
6. Impressão diagnóstica (usar exatamente o diagnóstico registrado).
7. Conduta — reproduzir a conduta proposta registrada; se houver consulta futura agendada, mencioná-la.

${commonRules}`;
      } else if (mode === "preop_summary") {
        userPrompt = `${dataBundle}

Gere um RESUMO PRÉ-OPERATÓRIO estruturado:
1. Identificação.
2. Diagnóstico valvar e severidade.
3. Estado funcional (NYHA, sintomas registrados).
4. Comorbidades relevantes.
5. Achados dos exames pré-operatórios registrados (último eco, BNP, etc.).
6. Procedimento planejado (conforme conduta proposta registrada) e prótese planejada (com fabricante/modelo/tamanho).
7. Referência bibliográfica da prótese quando presente nos dados.

${commonRules}`;
      } else if (mode === "postop_note") {
        userPrompt = `${dataBundle}

Gere uma NOTA PÓS-OPERATÓRIA estruturada baseada apenas na timeline e nos exames pós-procedimento registrados:
1. Identificação.
2. Procedimento realizado (usar o evento de "cirurgia"/"intervenção" mais recente na timeline; se não houver, escreva "procedimento não registrado na timeline").
3. Prótese implantada (fabricante, modelo, tamanho, tipo, referência).
4. Evolução imediata — apenas eventos posteriores ao procedimento na timeline.
5. Exames de controle pós-operatórios registrados.
6. Plano de acompanhamento — próxima consulta agendada, se houver.

${commonRules}`;
      } else {
        // discharge_summary
        userPrompt = `${dataBundle}

Gere um SUMÁRIO DE ALTA estruturado (documento técnico para prontuário — não confundir com orientação leiga ao paciente):
1. Identificação.
2. Motivo da internação/procedimento (derivar da timeline).
3. Diagnóstico principal e diagnósticos secundários (comorbidades registradas).
4. Procedimento realizado e prótese implantada com referência.
5. Evolução hospitalar (eventos registrados no período).
6. Condição de alta (usar sintomas/NYHA mais recentes registrados).
7. Plano pós-alta — próximas consultas registradas; se nenhuma agendada, escrever "consulta de retorno a agendar".
8. Nunca inclua doses, medicamentos ou orientações não registrados no caso.

${commonRules}`;
      }
    } else {
      return new Response(JSON.stringify({ error: "modo inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================================
    // RAG: recupera trechos relevantes da base ValvePath
    // ============================================================
    const topic = topicFromCase(caso.valve_type, caso.valve_disease);
    const ragQuery = [
      caso.valve_disease, caso.valve_type,
      mode === "chat" ? body.question : mode,
      (caso.symptoms ?? []).join(" "),
    ].filter(Boolean).join(" ").slice(0, 1000);

    let ragBlock = "";
    let sourcesOut: Array<{ title: string; organization: string; year: number; scope: string; url: string | null; similarity: number; review_status: string }> = [];
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (SERVICE_ROLE) {
      const embedding = await embedQuery(LOVABLE_API_KEY, ragQuery);
      if (embedding) {
        const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
        const { data: matches, error: matchErr } = await admin.rpc("match_knowledge", {
          query_embedding: embedding,
          match_count: 5,
          filter_topic: topic,
        });
        if (matchErr) console.error("match_knowledge error", matchErr);
        if (matches && matches.length > 0) {
          ragBlock = "\n\nREFERÊNCIAS RECUPERADAS DA BASE ValvePath (use estas como fonte primária):\n" +
            matches.map((m: any, i: number) =>
              `[${i + 1}] ${m.source_organization} ${m.source_year} — ${m.section ?? m.topic} (revisão: ${m.review_status}):\n"${m.content}"`
            ).join("\n\n");
          sourcesOut = matches.map((m: any) => ({
            title: m.source_title, organization: m.source_organization, year: m.source_year,
            scope: m.source_scope, url: m.source_url, similarity: Number(m.similarity?.toFixed(3) ?? 0),
            review_status: m.review_status,
          }));
        } else {
          ragBlock = "\n\n⚠️ AVISO PARA VOCÊ (assistente): Nenhum trecho relevante foi encontrado na base ValvePath para esta consulta. INICIE sua resposta com o disclaimer: \"⚠️ Não encontrei essa recomendação na base carregada da ValvePath. A resposta abaixo baseia-se no conhecimento geral do modelo e deve ser verificada em fonte primária antes de qualquer decisão.\"";
        }
      }
    }

    const messages: any[] = [{ role: "system", content: SYSTEM_PROMPT }];
    if (mode === "chat" && body.history?.length) {
      messages.push(...body.history.slice(-10));
    }
    messages.push({ role: "user", content: userPrompt + ragBlock });

    const aiResp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: mode === "summary" ? 700 : 1400,
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("Gateway error", aiResp.status, txt);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de uso atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione saldo em Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro do gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ content, sources: sourcesOut, rag_hit: sourcesOut.length > 0 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("clinical-ai error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
