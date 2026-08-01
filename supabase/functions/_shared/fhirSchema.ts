// Contrato de entrada do FHIR — o que um hospital parceiro precisa mandar para
// que o recurso seja aceito no prontuário.
//
// Duas regras de projeto que valem explicar, porque não são óbvias:
//
// 1. Todo schema é `passthrough`. O recurso inteiro é gravado em
//    `fhir_resources_inbound.payload`, e um FHIR R4 real traz dezenas de campos
//    que não modelamos. Se o zod removesse o que não conhece, a validação
//    passaria a **apagar conteúdo clínico em silêncio** — muito pior que não
//    validar. Validamos o que precisamos ler; o resto passa intacto.
//
// 2. A validação é de forma, não de conteúdo clínico. Não julgamos se um valor
//    de exame é plausível: isso é decisão médica e não cabe a um parser.
import { z } from "npm:zod@3";

export const ALLOWED_TYPES = [
  "Observation", "DiagnosticReport", "Condition", "MedicationStatement",
  "Procedure", "Encounter", "AllergyIntolerance", "ImagingStudy",
] as const;

/** Limites de tamanho. Sem eles um parceiro pode encher a tabela com um POST. */
export const MAX_RESOURCES_PER_REQUEST = 200;
export const MAX_RESOURCE_BYTES = 512 * 1024; // 512 KB por recurso

const uuid = z.string().uuid();

/** `subject` identifica o paciente, por referência ou por identificador. */
const subjectSchema = z.object({
  reference: z.string().optional(),
  identifier: z.object({ value: z.string().optional() }).passthrough().optional(),
}).passthrough();

/** Texto exibível de um recurso; usado só para montar o resumo. */
const codeableConcept = z.object({
  text: z.string().optional(),
  coding: z.array(z.object({ display: z.string().optional() }).passthrough()).optional(),
}).passthrough();

export const fhirResourceSchema = z.object({
  resourceType: z.enum(ALLOWED_TYPES),
  id: z.string().optional(),
  subject: subjectSchema.optional(),
  code: codeableConcept.optional(),
  conclusion: z.string().optional(),
}).passthrough();

export type FhirResource = z.infer<typeof fhirResourceSchema>;

/**
 * Extrai o id do paciente do `subject`, aceitando as duas convenções do FHIR.
 * Devolve `null` se não houver um UUID válido — antes, um valor qualquer ia
 * direto para a consulta e o Postgres devolvia erro de tipo, que a função
 * traduzia como "sem autorização ativa": mensagem enganosa para o hospital.
 */
export function extractPatientId(resource: FhirResource): string | null {
  const fromIdentifier = resource.subject?.identifier?.value;
  const ref = resource.subject?.reference;
  const fromReference = ref?.startsWith("Patient/") ? ref.slice("Patient/".length) : undefined;
  const candidate = fromIdentifier ?? fromReference;
  if (!candidate) return null;
  return uuid.safeParse(candidate).success ? candidate : null;
}

/** Resumo curto e legível do recurso, para a lista do paciente. */
export function buildSummary(resource: FhirResource): string {
  const candidate =
    resource.code?.text ??
    resource.code?.coding?.[0]?.display ??
    resource.conclusion ??
    resource.resourceType;
  return String(candidate).slice(0, 500);
}

/** O identificador de paciente na URL/no payload precisa ser um UUID. */
export function isValidPatientId(id: string | null | undefined): id is string {
  return !!id && uuid.safeParse(id).success;
}

/**
 * Interseção entre o que o hospital pediu e o que o paciente autorizou.
 *
 * O `Patient` (nome e data de nascimento) é um escopo como qualquer outro no
 * enum `fhir_resource_type` — o paciente pode autorizar exames sem autorizar
 * a própria identificação. Antes, o recurso Patient era montado fora deste
 * filtro e ia junto de qualquer forma.
 */
export function resolveAllowedTypes(requested: string[], granted: string[]): string[] {
  const grantedSet = new Set(granted);
  return requested.filter((t) => grantedSet.has(t));
}

export type ValidationIssue = { path: string; message: string };

export type ParseResult =
  | { ok: true; resource: FhirResource }
  | { ok: false; error: string; issues?: ValidationIssue[] };

/** Valida um recurso isolado: tamanho primeiro, forma depois. */
export function parseResource(raw: unknown): ParseResult {
  let bytes: number;
  try {
    bytes = new TextEncoder().encode(JSON.stringify(raw)).length;
  } catch {
    return { ok: false, error: "resource_not_serializable" };
  }
  if (bytes > MAX_RESOURCE_BYTES) return { ok: false, error: "resource_too_large" };

  const parsed = fhirResourceSchema.safeParse(raw);
  if (!parsed.success) {
    // `resourceType` fora da lista é o caso mais comum e merece erro próprio,
    // para o hospital saber que o tipo não é suportado em vez de "inválido".
    const typeIssue = parsed.error.issues.find(
      (i) => i.path.length === 1 && i.path[0] === "resourceType",
    );
    if (typeIssue) return { ok: false, error: "unsupported_resource_type" };
    return {
      ok: false,
      error: "invalid_resource",
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join(".") || "(raiz)",
        message: i.message,
      })),
    };
  }
  return { ok: true, resource: parsed.data };
}

/** Achata um Bundle (ou um recurso solto) na lista de recursos a processar. */
export function extractResources(body: unknown): unknown[] {
  const b = body as { resourceType?: unknown; entry?: unknown } | null;
  if (b && b.resourceType === "Bundle") {
    const entries = Array.isArray(b.entry) ? b.entry : [];
    return entries
      .map((e) => (e as { resource?: unknown } | null)?.resource)
      .filter((r) => r != null);
  }
  return [body];
}
