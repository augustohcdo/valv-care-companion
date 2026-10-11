import { supabase } from "@/integrations/supabase/client";

export type ConsentType =
  | "terms_of_use"
  | "privacy_policy"
  | "medical_disclaimer"
  | "data_sharing_doctor"
  | "email_communications"
  | "ai_processing"
  | "directory_listing"
  | "cookies_functional"
  | "cookies_analytics";

export const CONSENT_VERSION = "2.2";

export interface ConsentDefinition {
  type: ConsentType;
  title: string;
  description: string;
  required: boolean;
  audience: "all" | "paciente" | "medico";
  /**
   * A frase que precisa ficar em evidência onde quer que o consentimento
   * apareça — na prática, a revogação.
   *
   * É **dado**, e não negrito escolhido por quem renderiza, porque o mesmo
   * consentimento é exibido no formulário de solicitação e no painel de
   * privacidade. Deixar a ênfase a cargo de cada tela é como as duas cópias
   * deste texto começaram a divergir.
   */
  destaque?: string;
  /**
   * Versão do texto **deste** consentimento, quando ele andou sozinho.
   *
   * A versão global cobre a maioria, mas quando o texto de um consentimento
   * muda de significado ele precisa andar por conta: subir a global
   * re-versionaria Termos e Política que não mudaram, e o registro diria que a
   * pessoa aceitou uma revisão que nunca existiu.
   */
  version?: string;
}

export const CONSENT_CATALOG: ConsentDefinition[] = [
  {
    type: "terms_of_use",
    title: "Termos de Uso",
    description:
      "Concordância com as regras de uso da plataforma ValvePath.",
    required: true,
    audience: "all",
  },
  {
    type: "privacy_policy",
    title: "Política de Privacidade (LGPD)",
    description:
      "Tratamento dos seus dados pessoais conforme a Lei Geral de Proteção de Dados.",
    required: true,
    audience: "all",
  },
  {
    type: "medical_disclaimer",
    title: "Aviso médico",
    description:
      "Reconheço que o ValvePath é apoio educativo e organizacional, não substitui consulta médica e não emite diagnóstico automático.",
    required: true,
    audience: "all",
  },
  {
    type: "data_sharing_doctor",
    title: "Compartilhamento com meu médico vinculado",
    description:
      "Permito que o médico ao qual estou vinculado(a) acesse meus dados clínicos, sintomas, exames e medicações registrados na plataforma.",
    required: false,
    audience: "paciente",
  },
  {
    type: "email_communications",
    title: "Comunicações por e-mail",
    description:
      "Aceito receber lembretes de consultas, novidades educativas e avisos da plataforma por e-mail.",
    required: false,
    audience: "all",
  },
  {
    type: "ai_processing",
    title: "Processamento por IA clínica",
    // O texto anterior dizia "— sem meu nome", e isso era falso para um dos
    // dois caminhos: quando o médico anexa o laudo para leitura automática, o
    // arquivo é enviado inteiro, e um laudo traz nome, data de nascimento e
    // número de registro impressos. O campo do caso continua minimizado; o
    // documento nunca esteve. Dizer as duas coisas separadas é a única forma
    // de o consentimento ser informado.
    description:
      "Permito que dados do meu caso (idade, sexo, sintomas, comorbidades, achados de exames e anotações clínicas) sejam enviados ao Google (API Gemini) para o módulo de apoio à decisão clínica da plataforma. Nessas chamadas o nome do paciente é substituído por um marcador antes do envio. ATENÇÃO: quando um laudo é anexado para leitura automática, o arquivo é enviado como está — incluindo o que estiver impresso nele, como nome, data de nascimento e número de registro. No nível gratuito atual dessa API, o conteúdo enviado pode ser usado pelo Google para aprimorar seus produtos.",
    required: false,
    audience: "all",
    version: "2.3",
  },
  {
    type: "directory_listing",
    // Este é o texto que o médico lê ao consentir **e** o que fica registrado.
    // O formulário de solicitação renderiza daqui; antes ele tinha uma cópia
    // manual com outras palavras, e o profissional lia uma coisa enquanto o
    // sistema guardava outra.
    //
    // Cada elemento abaixo está aqui por uma razão externa, e nenhum pode sair:
    // o que é publicado, para quem, o vínculo só com aceite do médico, a
    // ausência de classificação (Resolução CFM nº 2.336/2023 veda "melhor
    // médico" e afins) e a revogação (LGPD art. 8º §5º — consentimento sem
    // revogação não é consentimento).
    title: "Autorizo a publicação do meu perfil no diretório de profissionais.",
    description:
      "Ficam visíveis a pacientes com conta: nome, CRM/UF, RQE, especialidade, " +
      "cidade, instituição e a descrição profissional cadastrada. O paciente pode " +
      "enviar pedido de vínculo, que só se efetiva mediante aceite do profissional. " +
      "O diretório não exibe nota, estrela, ranking ou ordem de preferência entre " +
      "profissionais.",
    destaque: "A autorização pode ser retirada a qualquer momento, na página de perfil.",
    required: false,
    audience: "medico",
    // Continua "1.0": nenhum consentimento deste tipo foi registrado ainda
    // (conferido no banco), então não há revisão que alguém tenha aceitado.
    // **Se um médico já estivesse no diretório, mudar o texto exigiria subir a
    // versão** — senão o registro afirmaria um aceite que não houve.
    version: "1.0",
  },
  {
    type: "cookies_functional",
    title: "Cookies funcionais",
    description:
      "Lembrar preferências (idioma, tema, filtros salvos). Não impacta o funcionamento essencial.",
    required: false,
    audience: "all",
  },
  {
    type: "cookies_analytics",
    title: "Cookies analíticos",
    description:
      "Métricas agregadas e anônimas de uso para melhorar a experiência. Pode ser revogado a qualquer momento.",
    required: false,
    audience: "all",
  },
];

/**
 * O que a pessoa lê quando o servidor recusa por falta de consentimento.
 *
 * Fica aqui, e não nas três telas, porque é o texto de uma recusa de
 * conformidade: divergir entre elas seria dar três explicações diferentes para
 * a mesma regra.
 */
export const AVISO_CONSENTIMENTO_IA = {
  titulo: "Consentimento necessário",
  descricao:
    'Ative "Processamento por IA clínica" em Privacidade e segurança para usar a IA — ' +
    "os dados do caso só vão ao provedor com esse consentimento.",
} as const;

/**
 * O texto do consentimento de IA — o MESMO que fica registrado.
 *
 * Existe porque o muro do `ClinicalAIPanel` tinha a sua própria redação, e ela
 * afirmava que os dados vão ao Google "sem o seu nome" — a frase que esta base
 * já identificou como falsa e tirou do catálogo, no único lugar onde a pessoa
 * DECIDE. A guarda proibia `/sem meu nome/` e só varria o catálogo.
 *
 * É o remédio que o `directory_listing` já tinha, com o motivo escrito lá: "o
 * formulário de solicitação renderiza daqui; antes ele tinha uma cópia manual
 * com outras palavras, e o profissional lia uma coisa enquanto o sistema
 * guardava outra".
 */
export function textoDoConsentimentoDeIA(): string {
  const def = CONSENT_CATALOG.find((c) => c.type === "ai_processing");
  if (!def) throw new Error("`ai_processing` saiu do catálogo de consentimentos");
  return def.description;
}

/**
 * A versão vigente do texto de um consentimento.
 *
 * Sem isto, o registro guardaria "2.2" ao lado de um texto que mudou — e o
 * painel de privacidade mostra essa versão para o titular.
 */
export function versaoDoConsentimento(type: ConsentType): string {
  return CONSENT_CATALOG.find((c) => c.type === type)?.version ?? CONSENT_VERSION;
}

export async function registerConsent(params: {
  type: ConsentType;
  granted: boolean;
  source?: string;
  version?: string;
  metadata?: Record<string, unknown>;
}) {
  const userAgent =
    typeof navigator !== "undefined" ? navigator.userAgent : undefined;
  const { data, error } = await supabase.rpc("register_consent", {
    _consent_type: params.type,
    _granted: params.granted,
    _document_version: params.version ?? versaoDoConsentimento(params.type),
    _source: params.source ?? "portal",
    _ip_address: undefined,
    _user_agent: userAgent,
    _metadata: (params.metadata ?? null) as never,
  });
  if (error) throw error;
  return data as string;
}

/**
 * O estado de um consentimento. `ok` é o único que libera.
 *
 * Mesma união de `supabase/functions/_shared/consentimentoIA.ts`, e as duas são
 * exercitadas pela MESMA tabela de casos em `src/test/consentimentoIA.test.ts`.
 * Duas cópias porque as duas bases não compilam juntas — como os nomes de modo
 * da IA — e a divergência reprova a guarda.
 */
export type EstadoDoConsentimento =
  | "ok"
  | "ausente"
  | "revogado"
  | "versao_antiga"
  | "nao_conferido";

/**
 * `aceita` cobre `vigente`?
 *
 * Numérica, campo a campo: `"2.10"` é posterior a `"2.9"` e menor em ordem
 * alfabética. E a pergunta é "cobre", não "é igual" — com igualdade, um
 * frontend publicado antes das functions recusaria quem consentiu com o texto
 * MAIS completo. Falso vermelho num portão de conformidade é o caminho mais
 * curto para alguém desligar o portão.
 */
export function versaoCobre(aceita: string | null | undefined, vigente: string): boolean {
  const partes = (v: string) => v.trim().split(".").map((p) => Number(p));
  if (typeof aceita !== "string" || !aceita.trim()) return false;
  const a = partes(aceita);
  const b = partes(vigente);
  if (a.some((n) => !Number.isFinite(n)) || b.some((n) => !Number.isFinite(n))) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}

/**
 * O estado, a partir do que foi lido. Puro.
 *
 * ## O defeito que isto conserta
 *
 * `hasActiveConsent` fazia:
 *
 *     .select("granted, revoked_at")
 *     if (error || !data) return false;
 *     return data.granted === true && !data.revoked_at;
 *
 * Duas coisas erradas na mesma função.
 *
 * **1. A versão não era lida.** `document_version` existe na tabela desde a
 * primeira migration e é gravada em todo registro. O texto do `ai_processing`
 * MUDOU DE SENTIDO: dizia que os dados iam ao Google "— sem meu nome", e isso
 * era falso para o caminho do laudo anexado, que vai inteiro, com nome, data de
 * nascimento e número de registro impressos. A versão própria (2.3) foi criada,
 * nas palavras do teste que a cobra, para o registro não dizer "que a pessoa
 * aceitou uma revisão que nunca existiu" — e então o portão não olhava a
 * versão. Quem aceitou o texto antigo passava como tendo consentido com o novo.
 * A LGPD, art. 8º §2º, põe sobre o controlador o ônus de PROVAR o
 * consentimento.
 *
 * **2. Falha de leitura virava "não consentiu".** `if (error || !data) return
 * false`. O servidor já tinha consertado isso, com o motivo escrito lá: "sem
 * observar o erro, quem consentiu era informado de que não consentiu, e o
 * médico ia procurar na tela de privacidade do paciente uma revogação que nunca
 * houve." O cliente continuava fazendo exatamente isso — e o remédio que ele
 * oferecia (clicar para consentir) grava um "concedido" novo na trilha de
 * auditoria para um consentimento que nunca foi retirado.
 */
export function estadoDoConsentimento(args: {
  linha: { granted: boolean | null; revoked_at: string | null; document_version: string | null } | null | undefined;
  erro?: unknown;
  versaoVigente: string;
}): { estado: EstadoDoConsentimento; versaoAceita: string | null } {
  const { linha, erro, versaoVigente } = args;
  if (erro) return { estado: "nao_conferido", versaoAceita: null };
  if (!linha) return { estado: "ausente", versaoAceita: null };
  const versaoAceita = linha.document_version ?? null;
  if (linha.revoked_at) return { estado: "revogado", versaoAceita };
  if (linha.granted !== true) return { estado: "ausente", versaoAceita };
  if (!versaoCobre(versaoAceita, versaoVigente)) {
    return { estado: "versao_antiga", versaoAceita };
  }
  return { estado: "ok", versaoAceita };
}

/**
 * O que a pessoa lê, por estado.
 *
 * Quatro textos onde havia um. `AVISO_CONSENTIMENTO_IA` continua servindo o
 * caso `ausente` — é dele que `src/lib/aiErros.ts` traduz o 403 — e os outros
 * três dizem coisas diferentes porque a providência é diferente em cada um.
 */
export const AVISO_POR_ESTADO: Record<
  Exclude<EstadoDoConsentimento, "ok">,
  { titulo: string; descricao: string }
> = {
  ausente: AVISO_CONSENTIMENTO_IA,
  revogado: {
    titulo: "Consentimento retirado",
    descricao:
      'O consentimento "Processamento por IA clínica" foi retirado. A IA só volta a ' +
      "funcionar se ele for concedido de novo, em Privacidade e segurança.",
  },
  versao_antiga: {
    titulo: "O texto do consentimento mudou",
    descricao:
      "O consentimento registrado é de uma versão anterior do texto, que descrevia o " +
      "envio de outra forma. Leia o texto atual e confirme de novo em Privacidade e " +
      "segurança — sem isso não é possível afirmar que houve consentimento para o que " +
      "o sistema faz hoje.",
  },
  nao_conferido: {
    titulo: "Não foi possível conferir o consentimento",
    descricao:
      "A consulta ao registro de consentimento falhou. Isso NÃO quer dizer que o " +
      "consentimento não exista nem que tenha sido retirado — tente de novo daqui a pouco.",
  },
};

/**
 * Lê o consentimento do usuário logado e devolve o estado.
 *
 * `user_id` não vai na consulta de propósito: `UNIQUE(user_id, consent_type)`
 * dá uma linha por tipo e a RLS (`auth.uid() = user_id`) garante que seja a
 * dele.
 */
export async function consentimentoDoUsuario(type: ConsentType): Promise<{
  estado: EstadoDoConsentimento;
  versaoAceita: string | null;
  versaoVigente: string;
}> {
  const versaoVigente = versaoDoConsentimento(type);
  const { data, error } = await supabase
    .from("user_consents")
    .select("granted, revoked_at, document_version")
    .eq("consent_type", type)
    .maybeSingle();
  return { ...estadoDoConsentimento({ linha: data, erro: error, versaoVigente }), versaoVigente };
}

/**
 * Verifica se o usuário logado tem um consentimento ativo.
 *
 * "Ativo" é: concedido, não revogado **e na versão vigente do texto**. Quem
 * precisa distinguir os quatro motivos de um `false` usa
 * `consentimentoDoUsuario` — e quem vai AVISAR alguém precisa, porque "nunca
 * consentiu", "retirou", "o texto mudou" e "não deu para ler" pedem quatro
 * providências diferentes.
 */
export async function hasActiveConsent(type: ConsentType): Promise<boolean> {
  return (await consentimentoDoUsuario(type)).estado === "ok";
}
