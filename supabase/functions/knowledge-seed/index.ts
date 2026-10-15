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
  // ===== Diretriz Brasileira de Valvopatias — 2026 =====
  //
  // ## A história deste bloco, que vale mais que os trechos
  //
  // O rótulo dizia "SBC 2024". Procurando a edição para citá-la direito, duas
  // buscas — uma restrita ao site do próprio periódico — encontravam a linhagem
  // 2011 → 2017 → 2020 e NENHUMA de 2024. Atribuir recomendação clínica a um
  // documento que não se consegue apresentar é fabricar procedência, e o bloco
  // foi corrigido para 2020, que era o que o projeto conseguia mostrar.
  //
  // Em outubro de 2026 a SBC publicou a edição nova, com a SBHCI e a SBCCV:
  // Arq Bras Cardiol. 2026;123(10):e20260796, DOI 10.36660/abc.20260796. Desta
  // vez o PDF oficial do periódico foi baixado e LIDO — 108 páginas — e cada
  // trecho abaixo cita o quadro e a página de onde saiu. Quem conferir abre o
  // PDF na página indicada.
  //
  // O `source_slug` continua `sbc-valvopatias-2024` de propósito: é a chave da
  // linha que JÁ EXISTE em `knowledge_sources` na produção, e trocá-la aqui
  // faria o seed pular estes seis trechos silenciosamente. Quem o médico lê é o
  // `title`/`year` daquela linha — e é ela que o SQL desta rodada corrige.
  {
    source_slug: "sbc-valvopatias-2024",
    topic: "estenose_aortica",
    section: "Estenose aórtica — indicações de intervenção (SBC 2026, Quadro 27)",
    content:
      "A Diretriz Brasileira de Valvopatias 2026 usa GRADE: força da recomendação (Forte ou Fraca) e certeza da evidência (Alta, Moderada, Baixa ou Muito baixa). No Quadro 27 (p. 41), tratamento cirúrgico convencional ou TAVI na estenose aórtica importante é Forte/Alta quando há sintomas (classe funcional ≥ 2, síncope ou angina). Em assintomáticos com complicadores: FE < 50% é Forte/Moderada; teste ergométrico positivo é Forte/Moderada; valvopatia crítica (área valvar aórtica < 0,7 cm², velocidade máxima do jato ≥ 5,0 m/s ou gradiente médio ≥ 60 mmHg) é Forte/Moderada. Queda progressiva de FE < 60% é Fraca/Baixa — a ESC usa FEVE < 55% nesse mesmo cenário. Situações especiais: baixo fluxo e baixo gradiente com FE reduzida, com ou sem reserva contrátil (escore de cálcio elevado), é Forte/Moderada; estenose aórtica paradoxal sintomática é Forte/Moderada; síndrome de Heyde é Forte/Baixa. Pré-requisito obrigatório do quadro: avaliação por Heart Team institucional, contemplando risco cirúrgico, grau de fragilidade, condições anatômicas e comorbidades.",
  },
  {
    source_slug: "sbc-valvopatias-2024",
    topic: "estenose_mitral",
    section: "Estenose mitral — indicações de intervenção (SBC 2026, Quadro 6)",
    content:
      "No Quadro 6 da Diretriz Brasileira de Valvopatias 2026 (p. 22), a valvoplastia mitral por cateter-balão (VMCB) na estenose mitral REUMÁTICA em classe funcional II–IV, na ausência de contraindicações, é Forte/Alta (AHA I A, ESC I B); na reumática assintomática com fatores complicadores, na ausência de contraindicações, é Forte/Baixa (AHA IIa B, ESC IIa C — a nota do quadro detalha: IIa B se hipertensão pulmonar e IIb C se fibrilação atrial). O tratamento cirúrgico (comissurotomia ou troca valvar) é Forte/Moderada na reumática em classe funcional II–IV com contraindicação à VMCB; Forte/Baixa na reumática assintomática com complicadores não elegível para VMCB; e Forte/Baixa no reumático assintomático em programação de outra cirurgia cardíaca. Na estenose mitral DEGENERATIVA refratária ao tratamento clínico, a cirurgia é Fraca/Baixa e o implante valvar mitral transcateter (valve-in-MAC), com contraindicação ou alto risco cirúrgico e anatomia favorável, também é Fraca/Baixa — as duas com discussão junto ao Heart Team. O escore ecocardiográfico de Wilkins-Block está no Quadro 7 e pontua de 1 a 4 em quatro domínios: mobilidade dos folhetos, acometimento subvalvar, espessura dos folhetos e calcificação valvar.",
  },
  {
    source_slug: "sbc-valvopatias-2024",
    topic: "insuficiencia_mitral",
    section: "Insuficiência mitral primária — reumática e não reumática (SBC 2026, Quadro 14)",
    content:
      "A diferença mais importante do Quadro 14 da Diretriz Brasileira de Valvopatias 2026 (p. 28) em relação à diretriz europeia é que ele separa pacientes REUMÁTICOS de NÃO REUMÁTICOS — divisão que a ESC não faz e que existe porque valva reumática repara mal. No paciente NÃO REUMÁTICO, a plástica da valva mitral é Forte/Moderada quando há sintomas (dispneia CF ≥ II) com anatomia favorável, e também em assintomáticos com complicadores e anatomia favorável: FEVE < 60% e/ou DSVE ≥ 40 mm (ou DSVEi ≥ 20 mm/m²), ou PSAP ≥ 50 mmHg ou fibrilação atrial relacionada à valvopatia. Em assintomáticos com insuficiência mitral por prolapso, anatomia favorável e sem complicadores, em centros com experiência, a plástica é Forte/Baixa. No paciente REUMÁTICO as mesmas situações caem para Fraca/Baixa na plástica, enquanto a TROCA da valva mitral é Forte/Moderada — é a inversão da preferência. O reparo percutâneo borda a borda é Forte/Moderada na insuficiência mitral não reumática, sintomática, com anatomia favorável e alto risco cirúrgico baseado no Heart Team.",
  },
  {
    source_slug: "sbc-valvopatias-2024",
    topic: "insuficiencia_aortica",
    section: "Insuficiência aórtica — indicações de intervenção (SBC 2026, Quadro 34)",
    content:
      "No Quadro 34 da Diretriz Brasileira de Valvopatias 2026 (p. 50), a cirurgia de troca valvar na insuficiência aórtica importante é Forte/Moderada quando há sintomas e quando a FEVE é ≤ 50%. Na dilatação ventricular, os limiares diferem por etiologia: no REUMÁTICO, DDVE > 75 mm ou DSVE > 55 mm (Forte/Moderada); no NÃO REUMÁTICO, DDVE > 70 mm ou DSVE > 50 mm ou DSVEi > 25 mm/m² (Forte/Moderada; AHA IIa B, ESC I B). Intervenção por oportunidade, quando o paciente já vai à cirurgia de aorta ascendente, é Forte/Baixa. A plástica valvar com anatomia favorável, em centros especializados, é Fraca/Moderada. O TAVI na insuficiência aórtica é Fraca/Baixa, restrito a sintomáticos com expectativa de vida > 1 ano, contraindicação ou risco proibitivo à cirurgia e anatomia favorável, após avaliação do Heart Team — e entra na Tabela 1 como uma das principais novidades de 2026. O Quadro 33 (p. 50) acrescenta que a troca valvar é o tratamento de escolha para a maioria dos pacientes e que dilatação da aorta ascendente ≥ 4,5 cm indica intervenção combinada de troca valvar mais tubo em aorta ascendente.",
  },
  {
    source_slug: "sbc-valvopatias-2024",
    topic: "valvopatia_tricuspide",
    section: "Insuficiência tricúspide — indicações de intervenção (SBC 2026, Quadro 41)",
    content:
      "No Quadro 41 da Diretriz Brasileira de Valvopatias 2026 (p. 56), a plástica tricúspide é Forte/Moderada quando se aborda outra valvopatia e a insuficiência tricúspide é importante; quando se aborda outra valvopatia e o anel tricúspide é ≥ 40 mm na presença de insuficiência moderada ou importante; e na insuficiência tricúspide importante secundária, isolada, refratária ao tratamento clínico. É Forte/Baixa na primária assintomática isolada com dilatação ou perda progressiva de função do ventrículo direito, e na primária sintomática isolada sem disfunção de ventrículo direito. A troca valvar cirúrgica é Forte/Moderada quando há indicação de abordagem sem possibilidade de plástica. A abordagem transcateter — refratária ao tratamento clínico, com contraindicação ou alto risco cirúrgico e anatomia favorável — entra na Tabela 1 como novidade de 2026: reparo borda a borda Forte/Alta, implante ortotópico Forte/Alta e implante heterotópico Forte/Baixa. O algoritmo da Figura 11 vai da gravidade anatômica à etiologia, aos sintomas refratários e aos complicadores antes de chegar à intervenção.",
  },
  {
    source_slug: "sbc-valvopatias-2024",
    topic: "estenose_aortica",
    section: "Anticoagulação oral (SBC 2026, Quadro 71)",
    content:
      "O Quadro 71 da Diretriz Brasileira de Valvopatias 2026 (p. 75) organiza a anticoagulação por cenário. Valva nativa: na estenose mitral reumática com fibrilação atrial e/ou trombo em átrio esquerdo, a varfarina é Forte/Moderada (AHA I C, ESC I B) e os DOACs aparecem como Fraca/Baixa APENAS na impossibilidade de uso de varfarina — a mesma coluna registra que a ESC classifica isso como III B, ou seja, as duas diretrizes divergem nesse ponto e a conduta precisa ser discutida, não copiada. Nas demais valvopatias com fibrilação atrial, varfarina e DOACs são ambos Forte/Moderada. Prótese biológica com fibrilação atrial: varfarina Forte/Moderada nos primeiros 3 meses e Forte/Alta no longo prazo, com DOACs Fraca/Moderada nos primeiros 3 meses e Forte/Alta no longo prazo. Prótese biológica em ritmo sinusal: nos primeiros 3 meses (mitral) ou 3 a 6 meses (aórtica), varfarina, DOACs e AAS são todos Fraca/Baixa; no longo prazo, varfarina e DOACs caem para Fraca/Muito baixa e o AAS fica Fraca/Baixa. Após TAVI: com fibrilação atrial, varfarina e DOACs são Forte/Alta; em ritmo sinusal, varfarina e DOACs são marcados como NÃO INDICADOS, e AAS ou clopidogrel é Forte/Moderada. Este trecho reproduz o Quadro 71; o regime da prótese mecânica e as metas de INR estão em outra parte da diretriz e não estão aqui.",
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
    const { data: linhaSegredo, error: erroSegredo } = await admin
      .from("internal_secrets")
      .select("value")
      .eq("key", "seed_cron_secret")
      .maybeSingle();
    // Sem observar o erro, "não consegui ler o segredo" virava "segredo não
    // cadastrado", e a função recusava dizendo o motivo errado.
    if (erroSegredo) {
      return new Response(
        JSON.stringify({ error: "secret_read_failed", detail: erroSegredo.message }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
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
      // O mesmo par que o `has_role` logo abaixo já fazia: negar sem conseguir
      // confirmar está certo, mas chamar isso de "unauth" manda o administrador
      // procurar um problema de permissão que não existe.
      const { data: userRes, error: erroSessao } = await userClient.auth.getUser();
      if (erroSessao) return new Response(
        JSON.stringify({ error: "auth_check_failed", detail: erroSessao.message }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
      if (!userRes?.user) return naoAutorizado();

      const { data: isAdmin, error: erroPapel } = await admin.rpc("has_role", { _user_id: userRes.user.id, _role: "admin" });
      // Quem escreve na base que a IA cita como diretriz precisa ser
      // administrador. Negar sem conseguir confirmar está certo; chamar isso de
      // "admin only" faz o administrador achar que perdeu o papel.
      if (erroPapel) return new Response(
        JSON.stringify({ error: "role_check_failed", detail: erroPapel.message }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
    /**
     * Trechos que NÃO foi possível conferir — distinto de `skipped`.
     *
     * `skipped` significa "já existe, não precisa inserir": é sucesso. Somar
     * aqui uma leitura que falhou faria a resposta dizer `ok: true` com o
     * trecho contado como pulado, quando ninguém sabe se ele está lá. É o
     * mesmo `ok: true, inserted: 0` que esta função já produziu uma vez, com
     * outro nome.
     */
    const naoConferidos: string[] = [];
    for (const chunk of SEED) {
      const source_id = slugToId[chunk.source_slug];
      if (!source_id) { skipped++; continue; }

      // Idempotência: se já existir chunk com essa section para essa fonte, pula
      const { data: existing, error: erroExisting } = await admin
        .from("knowledge_chunks")
        .select("id")
        .eq("source_id", source_id)
        .eq("section", chunk.section)
        .maybeSingle();
      // A checagem de idempotência falhando ABRIA: `existing` nulo e o trecho
      // era inserido de novo. O resultado é diretriz DUPLICADA na base que a IA
      // cita — e ela passaria a citar o mesmo trecho duas vezes, como se
      // fossem duas fontes concordando.
      if (erroExisting) {
        naoConferidos.push(`${chunk.source_slug}/${chunk.section}: ${erroExisting.message}`);
        continue;
      }
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

    /**
     * Trechos da base que NÃO estão mais neste arquivo — os órfãos.
     *
     * A idempotência deste seed é por `(source_id, section)`: trecho cuja
     * section já existe é pulado. Isso tem um efeito que só aparece quando
     * alguém RENOMEIA uma section, e foi o que aconteceu na troca da diretriz
     * brasileira de 2020 para a de 2026: as sections novas entram, e as antigas
     * FICAM — agora debaixo de uma fonte cujo título diz 2026.
     *
     * O resultado seria a base servindo dois conjuntos contraditórios de
     * recomendação como se fossem a mesma fonte concordando consigo mesma. É o
     * pior formato possível do defeito que este projeto persegue, porque não dá
     * erro em lugar nenhum.
     *
     * Aqui o seed só RELATA. Apagar sozinho seria arriscado: um trecho curado à
     * mão por administrador, para uma destas fontes, também apareceria como
     * órfão. Quem apaga é uma migração, que nomeia linha por linha o que remove.
     */
    const orfaos: string[] = [];
    const slugsDoSeed = [...new Set(SEED.map((c) => c.source_slug))];
    for (const slug of slugsDoSeed) {
      const source_id = slugToId[slug];
      if (!source_id) continue;
      const { data: naBase, error: erroBase } = await admin
        .from("knowledge_chunks")
        .select("section")
        .eq("source_id", source_id);
      if (erroBase) {
        naoConferidos.push(`${slug}: não foi possível listar os trechos da base (${erroBase.message})`);
        continue;
      }
      const doArquivo = new Set(SEED.filter((c) => c.source_slug === slug).map((c) => c.section));
      for (const linha of naBase ?? []) {
        if (!doArquivo.has(linha.section)) orfaos.push(`${slug}/${linha.section}`);
      }
    }

    return new Response(
      JSON.stringify({
        // `ok` deixa de ser constante. Esta função já respondeu `ok: true,
        // inserted: 0` uma vez, com a leitura das fontes falhando e todo trecho
        // caindo no "pulado" — sucesso relatado sem o trabalho feito, dentro do
        // próprio seed. Um trecho que não deu para conferir não é pulado: é
        // desconhecido, e a resposta tem de dizer isso.
        ok: naoConferidos.length === 0,
        inserted, skipped, total: SEED.length,
        nao_conferidos: naoConferidos,
        ...(naoConferidos.length > 0 && {
          atencao_leitura:
            `${naoConferidos.length} trecho(s) não puderam ser conferidos contra a base — ` +
            "não se sabe se já estavam lá. Rode de novo; o seed é idempotente.",
        }),
        orfaos,
        ...(orfaos.length > 0 && {
          atencao_orfaos:
            `${orfaos.length} trecho(s) estão na base e NÃO estão mais neste seed. ` +
            "Se foram renomeados, a base tem agora as duas versões — a velha e a nova — " +
            "debaixo da mesma fonte. Apague as antigas por migração, nomeando cada uma.",
        }),
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
