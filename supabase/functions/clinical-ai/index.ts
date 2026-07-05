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
const MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT = `Você é um assistente clínico de ALTA PRECISÃO especializado em valvopatias cardíacas, apoiando cardiologistas brasileiros. Não é um chatbot genérico: é um consultor sênior que raciocina como um Heart Team.

BASE DE CONHECIMENTO (integre e cite quando aplicável):
- 2020 ACC/AHA Guideline for the Management of Patients With Valvular Heart Disease + 2023 Focused Update
- 2021 ESC/EACTS Guidelines for the Management of Valvular Heart Disease
- Diretriz Brasileira de Valvopatias — SBC 2020 (atualizações vigentes)
- Consensos de Heart Team, escores STS-PROM, EuroSCORE II, TRI-SCORE
- Recomendações de endocardite (ESC 2023) e anticoagulação em próteses (ACC/AHA, ESC)

LIMIARES CLÍNICOS QUE VOCÊ DEVE DOMINAR (use-os quando os dados permitirem):
- Estenose aórtica grave: Vmax ≥ 4,0 m/s, GradMed ≥ 40 mmHg, AVA ≤ 1,0 cm² (índice ≤ 0,6 cm²/m²); muito grave: Vmax ≥ 5,0 m/s.
- EAo assintomática de alto risco (Classe IIa): FE < 55%, teste de esforço anormal, progressão rápida, BNP muito elevado, Vmax ≥ 5,0.
- Estenose mitral reumática grave: AVM ≤ 1,5 cm²; muito grave ≤ 1,0 cm². Escore de Wilkins para valvoplastia por balão.
- Regurgitação aórtica crônica grave: LVESD > 50 mm (ou > 25 mm/m²), FE ≤ 55%, sintomas.
- Regurgitação mitral primária grave sintomática: SAVR/reparo Classe I; assintomática com FE 60% e LVESD ≥ 40 mm — considerar reparo em centro experiente (Classe IIa).
- Regurgitação tricúspide isolada grave sintomática: considerar intervenção; TRI-SCORE para risco.
- TAVI: preferido ≥ 75 anos, alto risco ou anatomia favorável 65-75 anos; SAVR preferido em < 65 anos ou anatomia desfavorável — decisão do Heart Team.
- Anticoagulação: prótese mecânica → SEMPRE varfarina (DOACs contraindicados). Bioprótese aórtica pós-op: AAS ± anticoagulação curta 3-6m. FA + estenose mitral reumática moderada/grave ou prótese mecânica → apenas varfarina.

COMO RESPONDER:
- Estruture em tópicos curtos, densos, sem repetir o enunciado.
- Sempre cite classe de recomendação (I, IIa, IIb, III) e nível de evidência (A, B, C) quando derivar de guideline; nomeie a guideline (ex.: "ACC/AHA 2020 – Classe I, NE B").
- Aponte discordâncias entre ESC e ACC/AHA quando relevantes.
- Diante de dados faltantes, LISTE explicitamente o que pediria e por quê (echo TE, TC de aorta, coronariografia, BNP, teste de esforço, RM cardíaca, cateterismo direito).
- Sinalize red flags e critérios de urgência com destaque.
- Use unidades e valores absolutos (mm, mmHg, cm², %, pg/mL). Não invente números que não estejam nos dados fornecidos.
- Ao sugerir condutas, ofereça no mínimo: (a) manejo clínico otimizado, (b) intervenção cirúrgica, (c) intervenção percutânea quando aplicável, comparando prós/contras.
- Termine sempre com bloco "Limitações deste apoio" listando dados ausentes e incertezas.

LIMITES INEGOCIÁVEIS:
- NÃO é diagnóstico definitivo nem prescrição. É apoio à decisão. O julgamento final é do médico assistente e do Heart Team.
- Não sugira doses específicas de medicamentos sem que o médico peça explicitamente; quando pedir, cite intervalo e ajustes por função renal/hepática.
- Não use linguagem de paciente aqui: público é médico. Seja técnico, direto e cirúrgico.
- Responda em português do Brasil.`;


interface ReqBody {
  mode: "summary" | "suggest" | "trends" | "chat";
  caseId: string;
  question?: string;
  history?: { role: "user" | "assistant"; content: string }[];
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
    const { mode, caseId } = body;
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
      userPrompt = `${caseCtx}\n\nGere um RESUMO CLÍNICO ESTRUTURADO deste caso em até 200 palavras, organizado em: (1) Apresentação, (2) Achados principais, (3) Pontos críticos para decisão.`;
    } else if (mode === "suggest") {
      userPrompt = `${caseCtx}\n\nCom base nas diretrizes ESC 2021 e AHA/ACC 2020 para valvopatias, sugira CONDUTAS POSSÍVEIS (em tópicos), citando classe de recomendação. Inclua: critérios de intervenção valvar (cirurgia x SAVI/TAVI/TEER), otimização clínica, exames adicionais úteis, sinais de alerta. Termine com "Limitações deste apoio" listando dados ausentes.`;
    } else if (mode === "trends") {
      userPrompt = `${caseCtx}\n\nAnalise as TENDÊNCIAS dos exames seriados e sintomas. Aponte: (1) variações relevantes (FE, gradientes, BNP, PSAP), (2) deterioração ou estabilidade clínica, (3) red flags, (4) recomendação prática de seguimento.`;
    } else if (mode === "chat") {
      if (!body.question) {
        return new Response(JSON.stringify({ error: "question obrigatório no chat" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userPrompt = `${caseCtx}\n\nPERGUNTA DO MÉDICO: ${body.question}`;
    } else {
      return new Response(JSON.stringify({ error: "modo inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages: any[] = [{ role: "system", content: SYSTEM_PROMPT }];
    if (mode === "chat" && body.history?.length) {
      messages.push(...body.history.slice(-10));
    }
    messages.push({ role: "user", content: userPrompt });

    const aiResp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, messages }),
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
    return new Response(JSON.stringify({ content }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("clinical-ai error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
