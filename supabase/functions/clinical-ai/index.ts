// Edge function: clinical-ai
// Modos: summary | suggest | trends | chat
// Usa a Gemini API (GEMINI_API_KEY) para geração de texto e para os
// embeddings usados na busca RAG (gemini-embedding-001, 3072 dimensões).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { logError } from "../_shared/logError.ts";
import {
  buscarLiteratura, blocoDePesquisa, termoDeBusca,
} from "../_shared/pesquisaExterna.ts";
import { permitida } from "../_shared/pesquisaExterna.ts";
import type {
  FonteConfiavel, ArtigoEncontrado, MotivoSemLiteratura,
} from "../_shared/pesquisaExterna.ts";

// Máximo de chamadas de IA clínica por usuário por hora (controle de custo/abuso).
const RATE_LIMIT_PER_HOUR = 30;

/**
 * A cadeia de modelos, em ordem de preferência.
 *
 * **Cada modelo tem cota própria no nível gratuito.** Isso não é detalhe: com
 * um único modelo cravado no código, o dia em que a cota dele acaba a IA
 * clínica inteira responde "limite de uso atingido" — enquanto outros cinco
 * modelos da mesma chave atendem normalmente. Foi exatamente o que aconteceu
 * aqui, medido na mesma chave e no mesmo minuto:
 *
 *   gemini-3.5-flash        429 RESOURCE_EXHAUSTED
 *   gemini-3.6-flash        OK
 *   gemini-flash-latest     OK
 *   gemini-3.5-flash-lite   OK
 *   gemini-flash-lite-latest OK
 *
 * A troca só acontece quando o modelo preferido recusa por cota (429) ou não
 * existe mais (404). Erro de verdade — pedido inválido, falha do provedor —
 * não vira tentativa em outro modelo: isso esconderia o defeito atrás de uma
 * resposta que parece boa.
 */
const MODELOS = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
];

/**
 * Os modelos "lite" são reserva: mais rápidos e mais fracos. Quando a resposta
 * vem de um deles, isso é dito ao médico — num apoio a decisão clínica, saber
 * que a resposta saiu do banco de reservas é parte do que se pesa ao lê-la.
 */
const MODELOS_RESERVA = new Set(["gemini-3.5-flash-lite", "gemini-flash-lite-latest"]);

const urlDoModelo = (m: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

const EMBED_MODEL = "gemini-embedding-001";
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;

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
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ content: { parts: [{ text: text.slice(0, 4000) }] } }),
    });
    if (!r.ok) { console.error("embed failed", r.status, await r.text()); return null; }
    const j = await r.json();
    return j.embedding?.values ?? null;
  } catch (e) { console.error("embed error", e); return null; }
}

/**
 * Percorre a cadeia de modelos com **qualquer** corpo de requisição.
 *
 * Ela nasceu servindo só o modo de conversa, e o `extract_echo` ficou de fora,
 * falando direto com um modelo fixo. O preço apareceu rápido: quando a cadeia
 * substituiu a constante da URL, aquele caminho passou a referenciar um nome
 * que não existia mais — e nada acusou, porque `supabase/functions/` está fora
 * do `tsc` e nenhum teste o exercitava. Um caminho de rede só, para os dois
 * modos, é o que impede a próxima divergência.
 */
async function tentarNaCadeia(
  apiKey: string,
  corpo: Record<string, unknown>,
): Promise<{ resp: Response; modelo: string; reserva: boolean }> {
  const payload = JSON.stringify(corpo);
  let ultima: Response | null = null;
  for (const modelo of MODELOS) {
    const resp = await fetch(urlDoModelo(modelo), {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: payload,
    });
    if (resp.ok) return { resp, modelo, reserva: MODELOS_RESERVA.has(modelo) };
    // 429 = cota do modelo esgotada; 404 = modelo saiu do ar; 503 = o próprio
    // Google diz "alta demanda, tente de novo". Nos três o problema é o modelo,
    // não o pedido — tenta o próximo. Qualquer outro status é erro de verdade e
    // não pode virar tentativa em outro modelo: isso esconderia o defeito atrás
    // de uma resposta que parece boa.
    if (resp.status !== 429 && resp.status !== 404 && resp.status !== 503) {
      return { resp, modelo, reserva: MODELOS_RESERVA.has(modelo) };
    }
    console.warn(`modelo ${modelo} indisponível (${resp.status}); tentando o próximo`);
    ultima = resp;
  }
  // Todos recusaram: devolve a última recusa para o chamador tratar como erro
  // de verdade, com o status que o provedor deu.
  return {
    resp: ultima ?? new Response("sem modelo disponível", { status: 503 }),
    modelo: MODELOS[MODELOS.length - 1],
    reserva: true,
  };
}

async function callGemini(
  apiKey: string,
  body: { system?: string; messages: { role: "user" | "model"; content: string }[]; max_tokens: number },
): Promise<{ resp: Response; modelo: string; reserva: boolean }> {
  // `thinkingConfig: { thinkingBudget: 0 }` estava aqui como economia — e é
  // justamente o que quebrava a cadeia. Medido, mesmo payload, mesma chave:
  //
  //                            sem thinking   budget 0   budget -1
  //   gemini-3.6-flash              OK           400        OK
  //   gemini-3.5-flash-lite         OK           400        OK
  //   gemini-flash-lite-latest      OK           400        OK
  //   gemini-flash-latest           OK           OK         503
  //
  // Os modelos novos não deixam desligar o raciocínio, e `-1` não é aceito por
  // todos. Omitir o campo é a única forma que funciona na cadeia inteira — e
  // uma cadeia de reserva que só funciona no primeiro elo não é reserva.
  return tentarNaCadeia(apiKey, {
    ...(body.system ? { system_instruction: { parts: [{ text: body.system }] } } : {}),
    generationConfig: { maxOutputTokens: body.max_tokens },
    contents: body.messages.map((m) => ({ role: m.role, parts: [{ text: m.content }] })),
  });
}

const SYSTEM_PROMPT = `Você é um assistente clínico de ALTA PRECISÃO especializado em valvopatias cardíacas, apoiando cardiologistas brasileiros. Não é um chatbot genérico: é um consultor sênior que raciocina como um Heart Team.

REGRAS ABSOLUTAS DE CITAÇÃO (RAG):
- Quando o prompt do usuário incluir um bloco "REFERÊNCIAS RECUPERADAS DA BASE ValvePath", use PRIORITARIAMENTE o texto desses trechos. Cite cada trecho no formato [Fonte: {organização} {ano}] no final da frase correspondente.
- Cada trecho recuperado traz "(revisão: reviewed)" ou "(revisão: ai_generated)". Ao citar um trecho "ai_generated" pela primeira vez na resposta, acrescente o sufixo "(texto gerado por IA com base na diretriz oficial, aguardando revisão médica)" logo após a citação — nunca omita essa marcação nem a apresente como se fosse revisão médica concluída.
- Se a base ValvePath incluir a Diretriz Brasileira de Valvopatias (SBC 2024), destaque-a como referência primária para o contexto brasileiro e mostre lado a lado quando divergir de ACC/AHA ou ESC (formato "ESC 2021: Classe I | SBC 2024: Classe IIa — motivo: X").
- Se NENHUM trecho relevante for retornado, escreva explicitamente: "⚠️ Não encontrei essa recomendação na base carregada da ValvePath. A resposta abaixo baseia-se no conhecimento geral do modelo e deve ser verificada em fonte primária antes de qualquer decisão." — e só então responda.
- NUNCA invente número de página, DOI, ou trecho literal que não esteja nas referências recuperadas.

AS TRÊS CAMADAS DE FONTE — nunca as misture, e sempre diga de qual veio:
1. **BASE ValvePath** (bloco "REFERÊNCIAS RECUPERADAS"): diretriz sintetizada e curada. Cite [Fonte: {organização} {ano}]. É a camada de maior peso para conduta.
2. **LITERATURA EXTERNA** (bloco "LITERATURA RECUPERADA", vinda do PubMed): artigo indexado. Cite [Literatura: {periódico} {ano}, PMID {id}] e **nomeie o desenho do estudo** (metanálise, ensaio randomizado, coorte, série de casos) — sem isso o médico não consegue pesar o achado. Resumo de artigo **não é** recomendação de diretriz: se ele divergir da camada 1, aponte a divergência em vez de escolher sozinho.
3. **CONHECIMENTO GERAL DO MODELO**: tudo o que não veio de 1 nem de 2. Diga isso explicitamente na frase, e nunca dê a essa camada aparência de citação.
- Fonte de fabricante embasa **apenas** especificação técnica do próprio produto (modelo, tamanho, faixa de anel, área efetiva). Nunca indicação, comparação entre marcas ou desfecho clínico — é material de quem vende a prótese.
- Se a pesquisa externa não devolveu nada, diga que a busca não achou literatura para a pergunta. Não preencha o vazio com a camada 3 sem avisar.

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


/**
 * Instrução de sistema para o **paciente** — o único texto do sistema cujo
 * leitor não é médico.
 *
 * O `SYSTEM_PROMPT` acima diz, com todas as letras, "Público é médico: seja
 * técnico, direto, cirúrgico", e exige citação de diretriz com classe e nível
 * de evidência mais o bloco "Limitações deste apoio". Aplicado à orientação de
 * alta, ele produzia exatamente isso — verificado contra a função publicada:
 * a orientação saía com "[Fonte: SBC 2024 (texto gerado por IA com base na
 * diretriz oficial, aguardando revisão médica)]" no meio dos cuidados em casa,
 * e um parágrafo final citando Heart Team e TAVI. Num papel que a pessoa leva
 * para casa depois de uma cirurgia, "aguardando revisão médica" é a leitura
 * mais errada possível — e a marcação existe para o médico, não para ela.
 *
 * Por isso este modo também **não recebe o bloco de RAG**: trecho de diretriz é
 * prosa escrita para médico, e foram as regras de citação dele que vazaram. O
 * conteúdo de uma orientação de alta sai do caso, não de uma citação.
 */
const SYSTEM_PROMPT_PACIENTE = `Você escreve para o PACIENTE, não para o médico.

QUEM LÊ:
- Uma pessoa que acabou de passar por um procedimento no coração, provavelmente cansada, com medo, e sem formação em saúde. Pode ser idosa. Pode ler junto com um familiar.

COMO ESCREVER:
- Português do Brasil simples e acolhedor. Frases curtas. Trate por "você".
- Zero jargão. Nada de "Classe I", "NYHA", "Heart Team", "TAVI", "SAVR", "gradiente", "fração de ejeção".
- Nunca cite diretriz, fonte, organização ou ano. Nunca escreva avisos técnicos sobre revisão de conteúdo ou origem do texto.
- Não invente doses, nomes de remédio, datas de retorno ou prazos que não estejam no contexto: escreva "os remédios que seu médico receitou", "a data que a equipe marcou".
- Não prometa cura nem garanta resultado.
- Não termine com bloco de limitações nem com disclaimer técnico — a tela já traz o aviso de revisão para o médico.

O QUE SEMPRE INCLUIR:
- Orientação de procurar a equipe médica ou o pronto-socorro diante dos sinais de alerta.
- Que estas orientações não substituem o que a equipe que cuidou dela disser.`;

interface ReqBody {
  mode:
    | "summary" | "suggest" | "trends" | "chat"
    | "extract_echo" | "patient_discharge"
    | "note_consultation" | "preop_summary" | "postop_note" | "discharge_summary";
  caseId?: string;
  question?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  /** Liga a consulta à literatura externa (PubMed), além da base ValvePath. */
  pesquisar?: boolean;
  rawText?: string; // for extract_echo
  /** Laudo em arquivo: foto ou PDF do documento, em base64 (sem o prefixo data:). */
  fileBase64?: string;
  fileMimeType?: string;
}

// O frontend manda "assistant" (convenção comum); a API do Gemini espera "model".
const toGeminiRole = (r: "user" | "assistant"): "user" | "model" => (r === "assistant" ? "model" : "user");

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada");
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

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userRes.user.id;

    // ============================================================
    // Consentimento de processamento por IA — a checagem que vale.
    //
    // Ela existia só no navegador: `ClinicalAIPanel` mostrava a parede de
    // consentimento e `DocumentGenerator` chamava `hasActiveConsent` antes de
    // invocar. A função aceitava qualquer requisição autenticada e mandava o
    // caso para o Google. Medido: um médico descartável, criado **sem nenhum
    // consentimento registrado**, rodou os dez modos sem ser barrado uma vez.
    // E `extract_echo` — que envia o laudo inteiro, texto ou arquivo — não
    // tinha nem a checagem do navegador.
    //
    // A Política de Privacidade publicada diz, duas vezes, que esse envio "só
    // ocorre mediante o consentimento específico 'Processamento por IA
    // clínica'". Enquanto a checagem viver no cliente, isso é uma afirmação
    // sobre a interface, não sobre o sistema — mesma família do captcha que
    // rodava só no navegador.
    //
    // Vem **antes** do rate limiting de propósito: recusa por falta de
    // consentimento não deve consumir a cota horária de quem depois consentir.
    // A leitura usa o cliente do próprio usuário, então a RLS garante que ele
    // só enxergue o próprio consentimento — e ausência de linha é recusa.
    // ============================================================
    const { data: consentimento } = await supabase
      .from("user_consents")
      .select("granted, revoked_at")
      .eq("user_id", userId)
      .eq("consent_type", "ai_processing")
      .maybeSingle();

    if (!consentimento || consentimento.granted !== true || consentimento.revoked_at) {
      return new Response(JSON.stringify({
        error: "consent_required",
        message: "O processamento por IA clínica exige o consentimento específico " +
          "\"Processamento por IA clínica\". Ative-o em Privacidade e segurança.",
      }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============================================================
    // Rate limiting: evita abuso do nível gratuito da API Gemini.
    // Limita chamadas por usuário/hora usando o audit_logs existente.
    // ============================================================
    const SERVICE_ROLE_RL = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (SERVICE_ROLE_RL) {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_RL);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await admin
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("action", "clinical_ai_call")
        .gte("timestamp", oneHourAgo);
      if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
        return new Response(
          JSON.stringify({ error: "Limite de uso da IA clínica atingido. Tente novamente mais tarde." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // Registra a chamada antes de processá-la (contabiliza mesmo se falhar depois).
      await admin.from("audit_logs").insert({
        user_id: userId, action: "clinical_ai_call", target_table: "clinical_ai",
      });
    }

    const body = await req.json() as ReqBody;
    const { mode } = body;

    // ==========================================================
    // MODE: extract_echo — parse raw echo report to strict JSON
    // ==========================================================
    if (mode === "extract_echo") {
      const raw = (body.rawText ?? "").trim();
      const arquivo = body.fileBase64?.trim();
      const arquivoTipo = (body.fileMimeType ?? "").trim();

      if (!raw && !arquivo) {
        return new Response(JSON.stringify({ error: "rawText ou fileBase64 obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Só formato de documento. Não é uma limitação técnica arbitrária: é a
      // linha entre transcrever um laudo e interpretar um exame.
      const TIPOS_LAUDO = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (arquivo && !TIPOS_LAUDO.includes(arquivoTipo)) {
        return new Response(JSON.stringify({ error: "tipo de arquivo não suportado" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // ~8 MB em base64 ≈ 6 MB de arquivo. Acima disso a chamada estoura o
      // limite do modelo e falha com erro obscuro.
      if (arquivo && arquivo.length > 8_000_000) {
        return new Response(JSON.stringify({ error: "arquivo grande demais (máx. ~6 MB)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const extractPrompt = `Você é um extrator de dados clínicos de laudos de ecocardiograma em português. Leia o laudo bruto abaixo e use a ferramenta "extract_echo_data" para reportar os campos encontrados.

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

IDENTIFICAÇÃO DO PACIENTE — transcreva só o que estiver impresso:
- patient_name: o nome do PACIENTE, exatamente como escrito. O laudo também
  imprime o nome do médico solicitante e do médico executante, muitas vezes na
  linha de cima ou de baixo. Se houver qualquer dúvida sobre qual é qual, use
  null: trocar os dois renomearia o prontuário inteiro.
- patient_birth_date e exam_date em AAAA-MM-DD. Converta a data escrita para
  esse formato, mas nunca deduza uma data que não esteja no documento.
- patient_age só se a idade estiver escrita. Não calcule a partir do
  nascimento — quem faz essa conta é o sistema, que mostra a origem dela.
- patient_sex como escrito ("Masculino", "F", "feminino"). Não deduza sexo a
  partir do nome.

REGRA QUE MANDA EM TODAS AS OUTRAS — você TRANSCREVE, não INTERPRETA:
- Só reporte número que esteja ESCRITO no documento, em texto. Você está lendo
  um laudo, não avaliando um exame.
- É PROIBIDO estimar, medir ou deduzir qualquer valor a partir da imagem do
  ultrassom, do traçado Doppler, da régua ou de qualquer elemento gráfico. Um
  gradiente medido "de olho" numa curva é invenção com aparência de dado, e
  quem lê depois não tem como saber que foi inventado.
- Se o que chegou for imagem de exame sem laudo escrito, devolva TODOS os
  campos como null e is_laudo = false.
- is_laudo = true apenas quando o documento contém texto de laudo legível.

${raw
  ? `LAUDO:\n"""\n${raw.slice(0, 8000)}\n"""`
  : "O laudo vem no arquivo anexado a esta mensagem."}`;

      const numOrNull = { type: "NUMBER", nullable: true };
      const { resp: r } = await tentarNaCadeia(GEMINI_API_KEY, {
          generationConfig: { maxOutputTokens: 1024 },
          tools: [{
            functionDeclarations: [{
              name: "extract_echo_data",
              description: "Reporta os campos numéricos extraídos do laudo de ecocardiograma.",
              parameters: {
                type: "OBJECT",
                properties: {
                  lvef: numOrNull,
                  mean_gradient: numOrNull,
                  aortic_valve_area: numOrNull,
                  psap: numOrNull,
                  mitral_annulus_mm: numOrNull,
                  aortic_annulus_mm: numOrNull,
                  tricuspid_annulus_mm: numOrNull,
                  patient_name: {
                    type: "STRING", nullable: true,
                    description:
                      "Nome do paciente como impresso no laudo. null se houver dúvida entre o paciente e o médico solicitante.",
                  },
                  patient_birth_date: {
                    type: "STRING", nullable: true,
                    description: "Data de nascimento em AAAA-MM-DD, se impressa.",
                  },
                  patient_sex: {
                    type: "STRING", nullable: true,
                    description: "Sexo como escrito no laudo. null se não estiver escrito.",
                  },
                  patient_age: numOrNull,
                  exam_date: {
                    type: "STRING", nullable: true,
                    description: "Data do exame em AAAA-MM-DD, se impressa.",
                  },
                  is_laudo: {
                    type: "BOOLEAN",
                    description:
                      "true quando o documento contém texto de laudo legível; false quando é imagem de exame sem laudo escrito.",
                  },
                },
                required: [
                  "lvef", "mean_gradient", "aortic_valve_area", "psap",
                  "mitral_annulus_mm", "aortic_annulus_mm", "tricuspid_annulus_mm",
                  "patient_name", "patient_birth_date", "patient_sex",
                  "patient_age", "exam_date",
                  "is_laudo",
                ],
              },
            }],
          }],
          toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["extract_echo_data"] } },
          contents: [{
            role: "user",
            parts: arquivo
              ? [{ text: extractPrompt }, { inlineData: { mimeType: arquivoTipo, data: arquivo } }]
              : [{ text: extractPrompt }],
          }],
      });
      if (!r.ok) {
        const status = r.status === 429 ? 429 : 500;
        return new Response(JSON.stringify({ error: "Falha na extração" }), {
          status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const j = await r.json();
      const parts = j.candidates?.[0]?.content?.parts ?? [];
      const functionCall = parts.find((p: any) => p.functionCall)?.functionCall;
      const parsed: any = functionCall?.args ?? {};
      const clean = (v: any) => (typeof v === "number" && isFinite(v)) ? v : null;
      const lvef = clean(parsed.lvef);
      const mean_gradient = clean(parsed.mean_gradient);
      const aortic_valve_area = clean(parsed.aortic_valve_area);
      const psap = clean(parsed.psap);
      const mitral_annulus_mm = clean(parsed.mitral_annulus_mm);
      const aortic_annulus_mm = clean(parsed.aortic_annulus_mm);
      const tricuspid_annulus_mm = clean(parsed.tricuspid_annulus_mm);
      // Só é `false` quando o modelo afirma que não há laudo escrito. Ausente
      // (modelo antigo, resposta truncada) não vira acusação: a tela só avisa
      // com a negativa explícita.
      const is_laudo = parsed.is_laudo === false ? false : true;

      // A identificação sai daqui saneada, não como o modelo escreveu. Texto
      // livre vindo de um modelo entra no prontuário como nome de paciente:
      // corta o que for longo demais para ser nome, normaliza espaço, e recusa
      // data que não esteja no formato do banco em vez de tentar consertá-la.
      const texto = (v: any, max: number) => {
        if (typeof v !== "string") return null;
        const t = v.trim().replace(/\s+/g, " ");
        return t && t.length <= max ? t : null;
      };
      const dataISO = (v: any) => {
        const t = texto(v, 10);
        return t && /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
      };
      // Sem laudo escrito não há identificação a transcrever. Devolver nome
      // "lido" de uma imagem de exame seria exatamente a invenção que a regra
      // do prompt proíbe para os números.
      const patient_name = is_laudo ? texto(parsed.patient_name, 120) : null;
      const patient_birth_date = is_laudo ? dataISO(parsed.patient_birth_date) : null;
      const patient_sex = is_laudo ? texto(parsed.patient_sex, 20) : null;
      const patient_age = is_laudo ? clean(parsed.patient_age) : null;
      const exam_date = is_laudo ? dataISO(parsed.exam_date) : null;

      // Sugestão de anéis compatíveis (nunca preenchimento automático — o médico revisa)
      const ringSuggestions: Array<{ id: string; manufacturer: string; model_name: string; size: number; annulus_range: string; reference_url: string | null; valve: string }> = [];
      const SERVICE_ROLE_EX = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const suggestFor = async (diameter: number, valve: "mitral" | "tricuspide") => {
        if (!SERVICE_ROLE_EX) return [] as any[];
        const admin = createClient(SUPABASE_URL, SERVICE_ROLE_EX);
        const base = admin.from("prosthesis_catalog")
          .select("id, manufacturer, model_name, size, annulus_min_mm, annulus_max_mm, reference_url")
          .eq("type", "anel_anuloplastia").eq("active", true).not("size", "is", null)
          .eq("valve_position", valve);
        const { data: rings } = await base;
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
        is_laudo,
        lvef, mean_gradient, aortic_valve_area, psap,
        mitral_annulus_mm, aortic_annulus_mm, tricuspid_annulus_mm,
        patient_name, patient_birth_date, patient_sex, patient_age, exam_date,
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
      .from("clinical_cases").select("*").eq("id", caseId).is("deleted_at", null).maybeSingle();
    if (caseErr || !caso) {
      return new Response(JSON.stringify({ error: "Caso não acessível" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: exams } = await supabase
      .from("case_exams").select("*").eq("case_id", caseId).is("deleted_at", null)
      .order("exam_date", { ascending: true });

    let symptomCtx = "";
    if (caso.patient_id) {
      const { data: syms } = await supabase
        .from("symptom_entries").select("*")
        .eq("patient_id", caso.patient_id).is("deleted_at", null)
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
- Paciente: ${caso.patient_age ?? "?"} anos, sexo ${caso.patient_sex ?? "?"} (identificação omitida — minimização de dados enviados a IA de terceiro)
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
          .eq("case_id", caseId).is("deleted_at", null).order("event_date", { ascending: true }),
        supabase.from("appointments").select("scheduled_at, appointment_type, status, location, notes")
          .eq("case_id", caseId).is("deleted_at", null).order("scheduled_at", { ascending: true }),
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
- Paciente: [NOME_PACIENTE], ${caso.patient_age ?? "?"} anos, sexo ${caso.patient_sex ?? "?"}
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
- O nome do paciente foi substituído pelo marcador literal "[NOME_PACIENTE]" por minimização de dados. Reproduza esse marcador EXATAMENTE como está, sem alterar, sem inventar um nome, sempre que a identificação do paciente for necessária no texto.
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
    // A orientação de alta é para o paciente: trecho de diretriz e regra de
    // citação são material do médico, e é deles que vinha o vazamento.
    if (SERVICE_ROLE && mode !== "patient_discharge") {
      const embedding = await embedQuery(GEMINI_API_KEY, ragQuery);
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

    // ============================================================
    // Pesquisa externa: literatura indexada, dentro da cerca de domínios.
    //
    // A base ValvePath é curada e pequena — e é isso que limita o médico
    // quando ele pergunta sobre estudo recente. Aqui ele pede a busca
    // explicitamente (`pesquisar: true`), e o que volta entra como **camada
    // separada**, com periódico, ano e desenho do estudo à vista. Misturar as
    // duas faria um resumo de série de casos chegar com o peso de uma
    // recomendação Classe I.
    //
    // A orientação ao paciente fica de fora: ela não cita fonte nenhuma.
    // ============================================================
    let blocoExterno = "";
    let literatura: ArtigoEncontrado[] = [];
    let motivoPesquisa: MotivoSemLiteratura | null = null;
    if (body.pesquisar && mode !== "patient_discharge") {
      const { data: fontes } = await supabase
        .from("trusted_sources")
        .select("domain, name, category, citable_for, never_for, consulta")
        .eq("enabled", true);
      const permitidas = (fontes ?? []) as FonteConfiavel[];

      // Só as fontes marcadas como `automatica` têm caminho de busca. Sem
      // nenhuma delas ativa, a busca está **desligada** — e isso precisa ser
      // dito, não devolvido como lista vazia: "desligada" e "não encontrei
      // nada" são estados diferentes, e confundi-los é o `ok: true, sent: 0`
      // do digest, que escondeu por semanas que ninguém recebia o resumo.
      const automaticas = permitidas.filter((f) => f.consulta === "automatica");
      if (automaticas.length === 0) {
        motivoPesquisa = "sem_fonte_automatica";
      } else {
        const resultado = await buscarLiteratura(
          termoDeBusca({
            valveType: caso.valve_type,
            valveDisease: caso.valve_disease,
            pergunta: mode === "chat" ? body.question : null,
          }),
          { max: 5 },
        );
        // Último portão antes de o link virar clicável na tela do médico: a URL
        // do artigo é conferida contra a cerca. É barato, e é o tipo de defesa
        // que ninguém percebe faltando até faltar.
        literatura = resultado.artigos.filter((a) => permitida(a.url, permitidas));
        motivoPesquisa = literatura.length ? null : (resultado.motivo ?? "sem_resultado");
        blocoExterno = blocoDePesquisa(literatura, permitidas);
      }
    }

    const messages: { role: "user" | "model"; content: string }[] = [];
    if (mode === "chat" && body.history?.length) {
      messages.push(...body.history.slice(-10).map((m) => ({ role: toGeminiRole(m.role), content: m.content })));
    }
    messages.push({ role: "user", content: userPrompt + ragBlock + blocoExterno });

    const { resp: aiResp, modelo: modeloUsado, reserva } = await callGemini(GEMINI_API_KEY, {
      system: mode === "patient_discharge" ? SYSTEM_PROMPT_PACIENTE : SYSTEM_PROMPT,
      messages,
      max_tokens: mode === "summary" ? 2000 : 4000,
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("Gemini error", aiResp.status, txt);
      if (aiResp.status === 429) {
        // Chegar aqui significa que **todos** os modelos da cadeia recusaram
        // por cota — não só o preferido.
        return new Response(JSON.stringify({ error: "Limite de uso atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro do provedor de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const candidate = data.candidates?.[0];
    if (!candidate || (candidate.finishReason && candidate.finishReason !== "STOP" && candidate.finishReason !== "MAX_TOKENS")) {
      console.error("Gemini blocked/no candidate", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "A IA não pôde processar esta solicitação." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let content = candidate.content?.parts?.find((b: any) => typeof b.text === "string")?.text ?? "";
    // Reinsere o nome real do paciente (nunca enviado à IA) nos modos de documento clínico.
    if (content.includes("[NOME_PACIENTE]")) {
      content = content.split("[NOME_PACIENTE]").join(caso.patient_name ?? "Paciente");
    }
    return new Response(JSON.stringify({
      content,
      sources: sourcesOut,
      rag_hit: sourcesOut.length > 0,
      // Camada externa, separada de `sources` de propósito: a tela mostra as
      // duas em listas distintas, porque elas não têm o mesmo peso.
      modelo: modeloUsado,
      // A tela avisa quando a resposta veio do banco de reservas.
      modelo_reserva: reserva,
      external_sources: literatura.map((a) => ({
        pmid: a.pmid, titulo: a.titulo, revista: a.revista,
        ano: a.ano, tipos: a.tipos, url: a.url,
      })),
      pesquisa_externa: !!body.pesquisar,
      // Por que não veio literatura. Sem isto, "busca desligada" e "busca sem
      // resultado" chegam idênticas à tela.
      pesquisa_motivo: motivoPesquisa,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("clinical-ai error", e);
    await logError({
      source: "edge_function", context: "clinical-ai",
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack ?? null : null,
    });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
