import { describe, it, expect } from "vitest";
import {
  buildSummary, extractPatientId, extractResources, parseResource,
  isValidPatientId, resolveAllowedTypes, MAX_RESOURCE_BYTES,
} from "../../supabase/functions/_shared/fhirSchema";
import type { ParseResult } from "../../supabase/functions/_shared/fhirSchema";

/** O tsconfig do app roda sem strictNullChecks, e sem ele o TS não estreita a
 *  união pelo discriminante `ok`. O cast evita depender disso no teste. */
const asFailure = (r: ParseResult) => r as Extract<ParseResult, { ok: false }>;

const PATIENT_UUID = "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

const observation = (over: Record<string, unknown> = {}) => ({
  resourceType: "Observation",
  id: "obs-1",
  subject: { reference: `Patient/${PATIENT_UUID}` },
  code: { text: "Fração de ejeção" },
  valueQuantity: { value: 55, unit: "%" },
  ...over,
});

describe("contrato de entrada FHIR", () => {
  it("aceita um recurso válido", () => {
    const r = parseResource(observation());
    expect(r.ok).toBe(true);
  });

  // Esta é a regra que mais importa: gravamos o recurso inteiro no prontuário.
  // Se a validação removesse o que não conhece, apagaria conteúdo clínico em
  // silêncio — pior do que não validar.
  it("preserva campos que não modelamos, em vez de descartá-los", () => {
    const r = parseResource(observation({
      interpretation: [{ text: "Abaixo do esperado" }],
      performer: [{ display: "Dr. Fulano" }],
    }));
    if (!r.ok) throw new Error("esperava recurso válido");
    expect((r.resource as any).valueQuantity).toEqual({ value: 55, unit: "%" });
    expect((r.resource as any).interpretation).toEqual([{ text: "Abaixo do esperado" }]);
    expect((r.resource as any).performer).toEqual([{ display: "Dr. Fulano" }]);
  });

  it("rejeita tipo de recurso não suportado com erro próprio", () => {
    const r = parseResource({ resourceType: "Claim", subject: { reference: `Patient/${PATIENT_UUID}` } });
    expect(r).toMatchObject({ ok: false, error: "unsupported_resource_type" });
  });

  it("rejeita payload que nem é um objeto FHIR", () => {
    expect(parseResource("só um texto")).toMatchObject({ ok: false });
    expect(parseResource(null)).toMatchObject({ ok: false });
    expect(parseResource(42)).toMatchObject({ ok: false });
  });

  it("aponta onde está o problema quando a forma está errada", () => {
    const r = asFailure(parseResource(observation({ id: 123 })));
    expect(r.error).toBe("invalid_resource");
    expect(r.issues?.some((i) => i.path === "id")).toBe(true);
  });

  it("recusa recurso acima do limite de tamanho", () => {
    const grande = observation({ note: "x".repeat(MAX_RESOURCE_BYTES + 1) });
    expect(parseResource(grande)).toMatchObject({ ok: false, error: "resource_too_large" });
  });
});

describe("identificação do paciente", () => {
  it("aceita subject.reference no formato Patient/<uuid>", () => {
    const r = parseResource(observation());
    if (!r.ok) throw new Error("fixture inválida");
    expect(extractPatientId(r.resource)).toBe(PATIENT_UUID);
  });

  it("aceita subject.identifier.value", () => {
    const r = parseResource(observation({ subject: { identifier: { value: PATIENT_UUID } } }));
    if (!r.ok) throw new Error("fixture inválida");
    expect(extractPatientId(r.resource)).toBe(PATIENT_UUID);
  });

  // Antes, um valor qualquer ia direto para a consulta; o Postgres devolvia
  // erro de tipo e a função traduzia como "sem autorização ativa" — mensagem
  // enganosa, que mandaria o hospital procurar o problema no lugar errado.
  it("rejeita identificador que não é um UUID", () => {
    const r = parseResource(observation({ subject: { reference: "Patient/joao-da-silva" } }));
    if (!r.ok) throw new Error("fixture inválida");
    expect(extractPatientId(r.resource)).toBeNull();
  });

  it("rejeita recurso sem subject", () => {
    const r = parseResource(observation({ subject: undefined }));
    if (!r.ok) throw new Error("fixture inválida");
    expect(extractPatientId(r.resource)).toBeNull();
  });
});

describe("resumo do recurso", () => {
  it("prefere code.text", () => {
    const r = parseResource(observation());
    if (!r.ok) throw new Error("fixture inválida");
    expect(buildSummary(r.resource)).toBe("Fração de ejeção");
  });

  it("cai para o display do coding, depois para a conclusão, depois para o tipo", () => {
    const semTexto = parseResource(observation({ code: { coding: [{ display: "Ecocardiograma" }] } }));
    if (!semTexto.ok) throw new Error("fixture inválida");
    expect(buildSummary(semTexto.resource)).toBe("Ecocardiograma");

    const soConclusao = parseResource(observation({ code: undefined, conclusion: "Sem alterações" }));
    if (!soConclusao.ok) throw new Error("fixture inválida");
    expect(buildSummary(soConclusao.resource)).toBe("Sem alterações");

    const nada = parseResource(observation({ code: undefined }));
    if (!nada.ok) throw new Error("fixture inválida");
    expect(buildSummary(nada.resource)).toBe("Observation");
  });

  it("trunca em 500 caracteres, que é o limite da coluna", () => {
    const r = parseResource(observation({ code: { text: "a".repeat(900) } }));
    if (!r.ok) throw new Error("fixture inválida");
    expect(buildSummary(r.resource)).toHaveLength(500);
  });
});

describe("achatamento de Bundle", () => {
  it("extrai os recursos das entradas", () => {
    const bundle = { resourceType: "Bundle", entry: [{ resource: observation() }, { resource: observation() }] };
    expect(extractResources(bundle)).toHaveLength(2);
  });

  it("ignora entradas vazias em vez de quebrar", () => {
    const bundle = { resourceType: "Bundle", entry: [{ resource: observation() }, {}, { resource: null }] };
    expect(extractResources(bundle)).toHaveLength(1);
  });

  it("trata um recurso solto como lista de um", () => {
    expect(extractResources(observation())).toHaveLength(1);
  });

  it("não quebra com Bundle sem entry", () => {
    expect(extractResources({ resourceType: "Bundle" })).toHaveLength(0);
  });
});

describe("escopo de leitura (fhir-read)", () => {
  it("devolve só o que o paciente autorizou", () => {
    expect(resolveAllowedTypes(["Condition", "Observation"], ["Observation"])).toEqual(["Observation"]);
  });

  // "Patient" (nome e data de nascimento) é um escopo como qualquer outro.
  // Antes, o recurso Patient era montado fora do filtro e ia junto de
  // qualquer forma — dado pessoal saindo além do que o paciente autorizou.
  it("não libera a identificação do paciente sem o escopo Patient", () => {
    const permitido = resolveAllowedTypes(["Patient", "Observation"], ["Observation"]);
    expect(permitido).not.toContain("Patient");
    expect(permitido).toEqual(["Observation"]);
  });

  it("libera a identificação quando o paciente autorizou", () => {
    expect(resolveAllowedTypes(["Patient", "Observation"], ["Patient", "Observation"]))
      .toEqual(["Patient", "Observation"]);
  });

  it("um escopo autorizado que o hospital não pediu não é devolvido", () => {
    expect(resolveAllowedTypes(["Observation"], ["Observation", "Condition"])).toEqual(["Observation"]);
  });

  it("aceita como paciente só um UUID", () => {
    expect(isValidPatientId("3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d")).toBe(true);
    expect(isValidPatientId("joao-da-silva")).toBe(false);
    expect(isValidPatientId("")).toBe(false);
    expect(isValidPatientId(null)).toBe(false);
  });
});
