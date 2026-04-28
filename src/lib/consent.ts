import { supabase } from "@/integrations/supabase/client";

export type ConsentType =
  | "terms_of_use"
  | "privacy_policy"
  | "medical_disclaimer"
  | "data_sharing_doctor"
  | "email_communications"
  | "ai_processing";

export const CONSENT_VERSION = "1.0";

export interface ConsentDefinition {
  type: ConsentType;
  title: string;
  description: string;
  required: boolean;
  audience: "all" | "paciente" | "medico";
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
    description:
      "Permito que dados do meu caso sejam processados pelo módulo de apoio à decisão clínica baseado em IA, dentro da plataforma.",
    required: false,
    audience: "all",
  },
];

export async function registerConsent(params: {
  type: ConsentType;
  granted: boolean;
  source?: string;
  version?: string;
  metadata?: Record<string, unknown>;
}) {
  const userAgent =
    typeof navigator !== "undefined" ? navigator.userAgent : null;
  const { data, error } = await supabase.rpc("register_consent", {
    _consent_type: params.type,
    _granted: params.granted,
    _document_version: params.version ?? CONSENT_VERSION,
    _source: params.source ?? "portal",
    _ip_address: null,
    _user_agent: userAgent,
    _metadata: (params.metadata ?? null) as never,
  });
  if (error) throw error;
  return data as string;
}
