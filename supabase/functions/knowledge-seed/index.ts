// Edge function: knowledge-seed
// Admin-only. Popula a base RAG com trechos PRELIMINARES gerados por conhecimento geral do modelo.
// TODOS os chunks são marcados com review_status='ai_generated' e devem ser revisados por médico
// humano antes de virarem referência clínica publicada.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { logError } from "../_shared/logError.ts";

const EMBED_MODEL = "gemini-embedding-001";
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;

type SeedChunk = { source_slug: string; topic: string; section: string; content: string };

// ============================================================
// CONTEÚDO PRELIMINAR — GERADO POR CONHECIMENTO GERAL DO MODELO
// AGUARDA REVISÃO DE CARDIOLOGISTA/CIRURGIÃO ANTES DE PUBLICAR
// ============================================================
const SEED: SeedChunk[] = [
  // ===== Diretriz brasileira de valvopatias (SBC 2020) =====
  //
  // O rótulo destes trechos dizia "SBC 2024". Procurando a edição para citá-la
  // direito, duas buscas — uma delas restrita ao site do próprio periódico —
  // encontram a linhagem 2011 → 2017 → 2020 (Arq Bras Cardiol 2020;115(4):
  // 720-775) e nenhuma de 2024. Busca não prova ausência, e um cardiologista
  // resolve isto em um segundo; mas atribuir recomendação clínica a um documento
  // que não se consegue apresentar é fabricar procedência, e a direção da
  // cautela é evidente.
  //
  // O `source_slug` continua `sbc-valvopatias-2024` de propósito: é a chave da
  // linha que JÁ EXISTE em `knowledge_sources` na produção, e trocá-la aqui
  // faria o seed pular estes seis trechos silenciosamente. Quem o médico lê é o
  // `title`/`year` daquela linha — e é ela que o SQL desta rodada corrige.
  {
    source_slug: "sbc-valvopatias-2024",
    topic: "estenose_aortica",
    section: "Estenose aórtica — indicações de intervenção (SBC 2020)",
    content:
      "A Atualização das Diretrizes Brasileiras de Valvopatias 2020 recomenda intervenção (SAVR ou TAVI) em pacientes com estenose aórtica grave sintomática (Classe I). Em assintomáticos com FE < 50%, teste ergométrico anormal ou EAo muito grave (Vmax ≥ 5,0 m/s), intervenção é Classe IIa. Para a escolha entre SAVR e TAVI, a SBC pondera a disponibilidade regional de TAVI no SUS e recomenda decisão do Heart Team, com preferência por TAVI em ≥ 75 anos ou alto risco cirúrgico. Em < 65 anos, SAVR é preferido por durabilidade da bioprótese/mecânica.",
  },
  {
    source_slug: "sbc-valvopatias-2024",
    topic: "estenose_mitral",
    section: "Estenose mitral reumática — contexto brasileiro (SBC 2020)",
    content:
      "A doença reumática permanece a causa mais frequente de estenose mitral no Brasil, com pacientes tipicamente mais jovens que em coortes europeias/americanas. A SBC 2020 recomenda valvoplastia mitral percutânea por balão (CMBP) como primeira escolha em pacientes com escore de Wilkins ≤ 8, ausência de trombo em átrio esquerdo e regurgitação mitral ≤ moderada (Classe I). Cirurgia (comissurotomia aberta ou troca valvar) fica reservada a casos com anatomia desfavorável, trombo persistente ou reestenose. Profilaxia secundária com penicilina benzatina IM deve ser mantida.",
  },
  {
    source_slug: "sbc-valvopatias-2024",
    topic: "insuficiencia_mitral",
    section: "Insuficiência mitral primária — SBC 2020",
    content:
      "Para IM primária grave sintomática, a SBC 2020 recomenda reparo valvar em centros com expertise (Classe I). Em assintomáticos com FE 60% e LVESD ≥ 40 mm, considerar reparo em centro experiente (Classe IIa). TEER (MitraClip) é opção para pacientes com alto risco cirúrgico e anatomia favorável, ressaltando disponibilidade limitada no SUS. A diretriz europeia era mais ampla já em 2021, estendendo o TEER também à IM secundária; a SBC destaca critérios rigorosos (COAPT-like) para essa indicação. Para a conduta atual na IM, use a ESC/EACTS 2025.",
  },
  {
    source_slug: "sbc-valvopatias-2024",
    topic: "insuficiencia_aortica",
    section: "Insuficiência aórtica crônica — SBC 2020",
    content:
      "Indicação de cirurgia em IAo crônica grave: sintomas (Classe I); assintomáticos com FE ≤ 55% ou LVESD > 50 mm (> 25 mm/m²) (Classe I). A SBC 2020 alinha-se ao ACC/AHA nesses limiares e recomenda avaliação de aorta ascendente por angioTC quando houver dilatação ≥ 45 mm em pacientes com valva bicúspide, ou ≥ 50 mm em tricúspide.",
  },
  {
    source_slug: "sbc-valvopatias-2024",
    topic: "valvopatia_tricuspide",
    section: "Regurgitação tricúspide — SBC 2020",
    content:
      "RT primária grave sintomática: cirurgia é Classe I quando houver disfunção de VD progressiva. RT funcional secundária a valvopatia esquerda: abordar no mesmo tempo cirúrgico (Classe I). TRI-SCORE é recomendado para estratificação de risco. Intervenção transcateter (T-TEER) é considerada em pacientes inoperáveis e ainda tem disponibilidade limitada no Brasil.",
  },
  {
    source_slug: "sbc-valvopatias-2024",
    topic: "estenose_aortica",
    section: "Epidemiologia e anticoagulação — SBC 2020",
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
    section: "ESC 2021 — indicações de intervenção em EAo (SUPERADA pela ESC/EACTS 2025)",
    content:
      "REFERÊNCIA HISTÓRICA — esta recomendação foi SUPERADA pela ESC/EACTS 2025. O que a ESC/EACTS 2021 dizia: intervenção em EAo grave sintomática Classe I; TAVI preferido a partir de 75 anos ou STS/EuroSCORE II > 8%; cirurgia preferida abaixo de 75 anos com baixo risco; assintomático com FE < 50% sem outra causa Classe I; EAo muito grave assintomática (Vmax ≥ 5,5 m/s) Classe IIa. O que mudou em 2025: o corte de idade do TAVI passou a 70 anos, o gatilho de EA muito grave passou a gradiente médio ≥ 60 mmHg ou Vmax > 5,0 m/s, e entrou a recomendação IIa A de intervir no assintomático de risco baixo como alternativa à vigilância. Use este trecho apenas para mostrar a diferença entre as edições, nunca como conduta atual.",
  },
  {
    source_slug: "esc-eacts-2021-vhd",
    topic: "insuficiencia_mitral",
    section: "ESC 2021 — TEER em IM secundária (referência histórica)",
    content:
      "REFERÊNCIA HISTÓRICA da edição de 2021, mantida porque a ESC/EACTS 2025 não reformulou este ponto: a ESC 2021 ampliou a indicação de TEER (MitraClip) em IM secundária a pacientes não candidatos à cirurgia, com anatomia favorável e tratamento clínico da IC otimizado ao máximo (Classe IIa). Difere da diretriz brasileira, que mantém critérios COAPT-like mais rígidos dada a disponibilidade limitada da técnica no SUS. Confira na ESC/EACTS 2025 antes de usar como conduta.",
  },

  // ===== ESC/EACTS 2025 — a diretriz valvar VIGENTE =====
  //
  // Estes trechos existem porque a base ensinava 2021 enquanto o motor de
  // conduta do ValvePath já calculava por 2025: na mesma tela do caso, o painel
  // dizia "ESC/EACTS 2025" e a IA respondia pela edição anterior. O prompt chama
  // esta camada de "a de maior peso para conduta" — deixá-la em 2021 tornava a
  // atualização do motor uma fachada.
  //
  // Os números vêm de `src/data/diretriz2025.ts`, onde cada um está ao lado da
  // frase literal da diretriz que o sustenta. Como todo trecho semeado aqui,
  // entram como `ai_generated`: a IA os apresenta como preliminares até um
  // cardiologista revisar.
  {
    source_slug: "esc-eacts-2025-vhd",
    topic: "estenose_aortica",
    section: "ESC/EACTS 2025 — indicações de intervenção em EAo",
    content:
      "ESC/EACTS 2025: intervenção em EAo grave sintomática é Classe I. Assintomático com FEVE < 50% sem outra causa: Classe I. MUDANÇA CENTRAL DE 2025 — no assintomático com FEVE ≥ 50%, teste de esforço normal e risco do procedimento baixo, a intervenção deve ser considerada como ALTERNATIVA à vigilância ativa (Classe IIa, nível A). Ainda IIa (nível B) no assintomático de risco baixo com FEVE ≥ 50% e um destes: gradiente médio ≥ 60 mmHg ou Vmax > 5,0 m/s; calcificação valvar grave com progressão de Vmax ≥ 0,3 m/s/ano; BNP/NT-proBNP mais de três vezes o normal, confirmado; ou FEVE < 55% sem outra causa. Queda sustentada de PA > 20 mmHg no teste de esforço é IIa (nível C). Comparado com o que era em 2021: o gatilho de EA muito grave era Vmax ≥ 5,5 m/s.",
  },
  {
    source_slug: "esc-eacts-2025-vhd",
    topic: "estenose_aortica",
    section: "ESC/EACTS 2025 — modo de intervenção: o corte passou a 70 anos",
    content:
      "ESC/EACTS 2025: TAVI é recomendado a partir de 70 anos de idade em pacientes com estenose de valva aórtica tricúspide, se a anatomia for adequada (Classe I, nível A). Abaixo de 70 anos, com risco cirúrgico baixo, a cirurgia é recomendada (Classe I, nível B). Este corte era 75 anos na ESC/EACTS 2021 — é a mudança que mais desloca conduta na prática diária, e qualquer trecho da base que ainda diga 75 anos está superado neste ponto. Fora dessas faixas, a decisão é do Heart Team, pesando anatomia, expectativa de vida, comorbidades e preferência informada.",
  },
  {
    source_slug: "esc-eacts-2025-vhd",
    topic: "estenose_aortica",
    section: "ESC/EACTS 2025 — EAo de baixo fluxo e baixo gradiente",
    content:
      "ESC/EACTS 2025 separa a estenose aórtica de alto gradiente da de baixo fluxo/baixo gradiente, e os ramos têm Classe diferente. Baixo fluxo é volume sistólico indexado ≤ 35 mL/m². Com FEVE < 50% (baixo fluxo, baixo gradiente clássico) e evidência de estenose verdadeira, a intervenção é Classe I. Com FEVE ≥ 50% (baixo fluxo paradoxal), é Classe IIa. Sem Vmax e sem volume sistólico indexado não é possível saber em qual ramo o paciente está — peça os dados antes de opinar, em vez de assumir alto gradiente.",
  },
  {
    source_slug: "esc-eacts-2025-vhd",
    topic: "insuficiencia_aortica",
    section: "ESC/EACTS 2025 — insuficiência aórtica crônica",
    content:
      "ESC/EACTS 2025, IAo grave: cirurgia é Classe I em paciente sintomático, independentemente da função ventricular; e no assintomático com FEVE em repouso ≤ 50%, DSVE > 50 mm ou DSVE indexado > 25 mm/m². ATENÇÃO À MUDANÇA: FEVE ≤ 55% passou a ser Classe IIb, e apenas em paciente com risco cirúrgico baixo — não é indicação Classe I. Trechos anteriores a 2025 que tratam 55% como gatilho cirúrgico estão superados neste ponto; apresentar 55% como Classe I empurra para cirurgia um paciente que a diretriz manda apenas considerar.",
  },
  {
    source_slug: "esc-eacts-2025-vhd",
    topic: "insuficiencia_mitral",
    section: "ESC/EACTS 2025 — insuficiência mitral primária",
    content:
      "ESC/EACTS 2025: na IM primária grave, o reparo valvar é a técnica preferida sempre que houver expectativa de resultado durável (Classe I). Paciente sintomático com indicação cirúrgica: Classe I. No assintomático, entram como gatilho a disfunção ventricular e o DSVE ≥ 40 mm, independentemente da fração de ejeção — o diâmetro sistólico do VE virou critério isolado, e o DSVE indexado pega o paciente de porte pequeno que o valor absoluto não pega.",
  },
  {
    source_slug: "esc-eacts-2025-vhd",
    topic: "estenose_mitral",
    section: "ESC/EACTS 2025 — anticoagulação na estenose mitral e na FA",
    content:
      "ESC/EACTS 2025: em fibrilação atrial com estenose mitral reumática de área ≤ 2,0 cm², os anticoagulantes orais diretos (DOAC) são CLASSE III — contraindicados. A anticoagulação é com antagonista da vitamina K (varfarina). O mesmo vale para portadores de prótese mecânica. Responder apenas 'anticoagulação está indicada' nesse cenário, sem dizer com qual fármaco, leva direto ao erro de prescrição: em FA sem valvopatia reumática o DOAC é preferencial, e a diferença entre os dois cenários é a que decide.",
  },
  {
    source_slug: "esc-eacts-2025-vhd",
    topic: "valvopatia_tricuspide",
    section: "ESC/EACTS 2025 — regurgitação tricúspide",
    content:
      "ESC/EACTS 2025: a avaliação da valva tricúspide deve ser feita pelo Heart Team em todo paciente com valvopatia esquerda com indicação cirúrgica. RT primária grave sintomática: cirurgia é Classe I. RT secundária a valvopatia esquerda: corrigir no mesmo tempo cirúrgico. O tratamento transcateter é opção em paciente de alto risco cirúrgico ou inoperável, com anatomia favorável e avaliação em centro experiente.",
  },
];

async function embedText(apiKey: string, text: string): Promise<number[] | null> {
  const r = await fetch(EMBED_URL, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ content: { parts: [{ text }] } }),
  });
  if (!r.ok) { console.error("embed fail", r.status, await r.text()); return null; }
  const j = await r.json();
  return j.embedding?.values ?? null;
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PUBLISHABLE = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const naoAutorizado = () =>
      new Response(JSON.stringify({ error: "unauth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ---------------------------------------------------------------------
    // Duas portas: o admin logado, e o próprio banco.
    // ---------------------------------------------------------------------
    //
    // A porta do admin já existia e continua igual. A segunda entra porque
    // semear a base era a última ação manual que sobrava para o usuário — ele
    // pediu, com todas as letras, para não precisar clicar. Sem ela, uma
    // migration que acrescenta trechos depende de alguém lembrar de abrir a
    // tela; e "alguém lembra" foi exatamente o que falhou quando as edge
    // functions passaram semanas sem ser publicadas.
    //
    // O segredo mora em `internal_secrets`, tabela que só o service_role lê, e
    // é o MESMO mecanismo que o `weekly-export`, o `admin-digest` e o
    // `job-watchdog` já usam para serem chamados pelo pg_cron. Nada de novo em
    // superfície de ataque: quem consegue ler `internal_secrets` já é
    // service_role, e com isso escreve na tabela direto.
    const { data: linhaSegredo } = await admin
      .from("internal_secrets")
      .select("value")
      .eq("key", "seed_cron_secret")
      .maybeSingle();
    const SEGREDO_CRON = linhaSegredo?.value ?? null;
    const cabecalhoCron = req.headers.get("x-cron-secret");

    // `SEGREDO_CRON &&` não é redundante: sem ele, um segredo ausente no banco
    // (null) casaria com um cabeçalho ausente na requisição (null) e a função
    // ficaria aberta. É a comparação que transforma "não configurado" em
    // "liberado" — e o tipo de erro que ninguém enxerga lendo o código rápido.
    let autorizado = !!(SEGREDO_CRON && cabecalhoCron === SEGREDO_CRON);

    if (!autorizado) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return naoAutorizado();

      const userClient = createClient(SUPABASE_URL, PUBLISHABLE, { global: { headers: { Authorization: authHeader } } });
      const { data: userRes } = await userClient.auth.getUser();
      if (!userRes?.user) return naoAutorizado();

      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userRes.user.id, _role: "admin" });
      if (!isAdmin) return new Response(JSON.stringify({ error: "admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      autorizado = true;
    }

    // Mapa slug -> id
    //
    // Esta leitura descartava o `error`, e a consequência era exatamente o
    // defeito que este projeto persegue: falhando aqui, `slugToId` fica vazio,
    // TODO trecho cai no `if (!source_id) { skipped++; continue; }`, e a função
    // responde `{ ok: true, inserted: 0, skipped: N }` — sucesso relatado sem
    // ter feito nada. Quem clicasse em "Popular base" veria a operação
    // concluída com a base intacta.
    const { data: sources, error: erroFontes } = await admin
      .from("knowledge_sources")
      .select("id, slug");
    if (erroFontes) {
      return new Response(
        JSON.stringify({
          error: "não foi possível ler knowledge_sources",
          detalhe: erroFontes.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const slugToId: Record<string, string> = {};
    (sources ?? []).forEach((s: any) => { slugToId[s.slug] = s.id; });

    // Trecho apontando para fonte inexistente é o outro jeito de sumir em
    // silêncio: o `skipped` engloba "já existia" e "a fonte não está cadastrada",
    // que são coisas opostas. A resposta passa a separar as duas.
    const fontesFaltando = [...new Set(SEED.map((c) => c.source_slug))].filter(
      (slug) => !slugToId[slug],
    );

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

      const embedding = await embedText(GEMINI_API_KEY, `${chunk.section}\n\n${chunk.content}`);
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
        fontes_nao_cadastradas: fontesFaltando,
        ...(fontesFaltando.length > 0 && {
          atencao:
            `Estas fontes não existem em knowledge_sources e seus trechos NÃO entraram: ` +
            `${fontesFaltando.join(", ")}. Cadastre a fonte e rode de novo.`,
        }),
        warning: "Todos os trechos são PRELIMINARES (ai_generated). Requerem revisão médica antes de publicar.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("knowledge-seed error", e);
    await logError({
      source: "edge_function", context: "knowledge-seed",
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack ?? null : null,
    });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
