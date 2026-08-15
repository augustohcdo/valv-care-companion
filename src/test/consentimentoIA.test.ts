import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * Guarda: o consentimento de IA é cobrado no servidor, e todo chamador avisa.
 *
 * Ele existia só no navegador. `ClinicalAIPanel` mostrava a parede de
 * consentimento, `DocumentGenerator` chamava `hasActiveConsent` — e a edge
 * function aceitava qualquer requisição autenticada e mandava o caso ao
 * provedor. Medido na auditoria dos dez modos: um médico descartável, criado
 * **sem nenhum consentimento registrado**, rodou todos eles sem ser barrado.
 * `extract_echo`, que envia o laudo inteiro, não tinha nem a checagem do
 * navegador.
 *
 * A Política de Privacidade publicada afirma, duas vezes, que o envio "só
 * ocorre mediante o consentimento específico". Com a checagem no cliente, isso
 * era uma afirmação sobre a interface, não sobre o sistema — mesma família do
 * captcha que rodava só no navegador e do backup que estava agendado e nunca
 * gravou arquivo.
 */

const raiz = resolve(__dirname, "../..");
const funcao = readFileSync(
  resolve(raiz, "supabase/functions/clinical-ai/index.ts"), "utf8",
);

function arquivosDe(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivosDe(caminho);
    return /\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

describe("consentimento de IA no servidor", () => {
  it("a função consulta user_consents para ai_processing", () => {
    expect(funcao).toContain('.eq("consent_type", "ai_processing")');
    expect(funcao).toContain('.from("user_consents")');
  });

  it("recusa quando não há consentimento, e com código próprio", () => {
    expect(funcao).toContain('error: "consent_required"');
  });

  it("a checagem vem antes de qualquer chamada ao provedor de IA", () => {
    // Se ela ficasse depois, o dado já teria saído — a recusa seria decorativa.
    const consentimento = funcao.indexOf('"consent_required"');
    const primeiraChamada = Math.min(
      ...["callGemini(", "embedQuery("]
        .map((t) => funcao.indexOf(t, funcao.indexOf("Deno.serve")))
        .filter((i) => i > 0),
    );
    expect(consentimento).toBeGreaterThan(0);
    expect(consentimento).toBeLessThan(primeiraChamada);
  });

  it("a recusa não consome a cota horária de quem depois consentir", () => {
    expect(funcao.indexOf('"consent_required"'))
      .toBeLessThan(funcao.indexOf('action: "clinical_ai_call"'));
  });
});

describe("consentimento de IA no cliente", () => {
  const chamadores = arquivosDe(resolve(raiz, "src"))
    .filter((f) => readFileSync(f, "utf8").includes('invoke("clinical-ai"'));

  it("existem chamadores para varrer", () => {
    // Sem esta asserção, renomear a função faria a varredura devolver lista
    // vazia e o teste passar sem conferir nada.
    expect(chamadores.length).toBeGreaterThanOrEqual(3);
  });

  it("todo chamador confere o consentimento antes de invocar", () => {
    const sem = chamadores.filter(
      (f) => !readFileSync(f, "utf8").includes("hasActiveConsent(\"ai_processing\")"),
    );
    expect(sem.map((f) => f.replace(raiz + "/", "")),
      "chamadores da IA sem checagem de consentimento").toEqual([]);
  });

  it("todo chamador traduz a recusa 403 em explicação", () => {
    const sem = chamadores.filter((f) => {
      const t = readFileSync(f, "utf8");
      return !(t.includes("status === 403") && t.includes("AVISO_CONSENTIMENTO_IA"));
    });
    expect(sem.map((f) => f.replace(raiz + "/", "")),
      "chamadores que mostrariam erro cru em vez do motivo").toEqual([]);
  });
});
