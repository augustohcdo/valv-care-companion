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

const SYSTEM_PROMPT = `Você é um assistente clínico especializado em valvopatias (cardiologia), apoiando médicos brasileiros.
Baseie-se nas diretrizes ESC 2021 (Manejo de Valvopatias) e AHA/ACC 2020.
Princípios:
- Seja objetivo, técnico e estruturado em tópicos.
- Cite a classe de recomendação (I, IIa, IIb, III) e nível de evidência quando aplicável.
- NÃO realize diagnóstico definitivo. Sempre destaque "apoio à decisão" e que o julgamento clínico final é do médico.
- Quando faltarem dados, indique explicitamente quais informações adicionais ajudariam.
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
