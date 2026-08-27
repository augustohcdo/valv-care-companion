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

/** Verifica se o usuário logado tem um consentimento ativo (concedido e não revogado). */
export async function hasActiveConsent(type: ConsentType): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_consents")
    .select("granted, revoked_at")
    .eq("consent_type", type)
    .maybeSingle();
  if (error || !data) return false;
  return data.granted === true && !data.revoked_at;
}
