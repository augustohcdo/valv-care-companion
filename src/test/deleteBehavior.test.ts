// tsconfig.app.json restringe `types` a vitest/globals; como as outras guardas,
// esta lê o disco e por isso puxa os tipos de Node só aqui.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Guarda contra a cascata que destrói prontuário.
 *
 * Até 08/08 a corrente era esta, e foi medida contra o banco real com conta
 * descartável — apagar a conta levou os casos de 2 para 1 e os exames de 1 para
 * 0, sem uma linha de auditoria:
 *
 *   auth.users --CASCADE--> doctors --CASCADE--> clinical_cases --CASCADE--> ...
 *
 * O elo que importa é `clinical_cases`: com RESTRICT nas duas pontas
 * (`doctor_id` e `patient_id`), a cascata que vem de `auth.users` esbarra e
 * aborta a transação inteira. Conta sem prontuário continua podendo ser
 * apagada; conta com prontuário passa a exigir uma decisão consciente.
 *
 * Reverter isso não quebraria teste nenhum e não apareceria em revisão — é
 * uma palavra numa migration. Por isso a guarda.
 *
 * Roda sobre as migrations, não sobre o banco, então não precisa de credencial
 * no CI — mesmo desenho de `rlsCoverage`, `backupCoverage` e `retencao`.
 */

const DIR = "supabase/migrations";

/** As duas pontas de `clinical_cases` e o que cada uma precisa ser. */
const EXIGIDO: Record<string, string> = {
  clinical_cases_doctor_id_fkey: "restrict",
  clinical_cases_patient_id_fkey: "restrict",
};

/**
 * Migrations são append-only: o que vale é a **última** definição de cada
 * constraint. Ler só a primeira daria um falso verde para quem reintroduzisse
 * a cascata numa migration nova.
 */
function ultimaAcaoDeDelete(sql: string, constraint: string): string | null {
  const re = new RegExp(
    `add\\s+constraint\\s+${constraint}[\\s\\S]{0,300}?on\\s+delete\\s+(restrict|cascade|set\\s+null|no\\s+action|set\\s+default)`,
    "g",
  );
  const achados = [...sql.matchAll(re)].map((m) => m[1].replace(/\s+/g, " "));
  return achados.length ? achados[achados.length - 1] : null;
}

function sqlDeTodasAsMigrations(): string {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(DIR, f), "utf8"))
    .join("\n")
    .toLowerCase();
}

describe("o que acontece ao apagar uma conta", () => {
  const sql = sqlDeTodasAsMigrations();

  for (const [constraint, esperado] of Object.entries(EXIGIDO)) {
    it(`${constraint} termina em ON DELETE ${esperado.toUpperCase()}`, () => {
      const atual = ultimaAcaoDeDelete(sql, constraint);
      expect(atual, `${constraint} não foi encontrada em migration nenhuma`).not.toBeNull();
      expect(
        atual,
        `${constraint} está como "${atual}". Com cascata, apagar a conta do médico ` +
          "apaga os casos clínicos dele — e o site publica retenção de 20 anos " +
          "(Lei 13.787/2018) mesmo após eliminação.",
      ).toBe(esperado);
    });
  }

  // O outro lado do mesmo defeito: sem chave estrangeira, apagar o paciente
  // deixava diário, medicações e documentos apontando para quem não existe —
  // invisíveis pela RLS e nunca eliminados.
  const DO_PACIENTE = [
    "medications_patient_id_fkey",
    "medication_logs_patient_id_fkey",
    "symptom_entries_patient_id_fkey",
    "patient_documents_patient_id_fkey",
  ];

  it("os dados do paciente têm chave estrangeira, em vez de virarem órfãos", () => {
    for (const c of DO_PACIENTE) {
      expect(
        ultimaAcaoDeDelete(sql, c),
        `${c} precisa existir com ON DELETE CASCADE: são dados do próprio ` +
          "paciente, e a cascata só roda quando ele não tem prontuário.",
      ).toBe("cascade");
    }
  });

  /**
   * A direção oposta, e igualmente importante: campo de trilha ou de autoria
   * **não** pode ganhar chave estrangeira para `auth.users`. Com CASCADE
   * apagaria a prova de que algo aconteceu; com RESTRICT tornaria a exclusão de
   * conta impossível para sempre.
   */
  it("a trilha e a autoria continuam sem chave estrangeira para auth.users", () => {
    const proibidas = [
      ["audit_logs", "user_id"],
      ["consent_audit_log", "user_id"],
      ["user_consents", "user_id"],
      ["dpo_requests", "user_id"],
      ["case_comments", "author_id"],
    ];
    for (const [tabela, coluna] of proibidas) {
      const re = new RegExp(
        `alter\\s+table\\s+(?:only\\s+)?public\\.${tabela}[\\s\\S]{0,200}?foreign\\s+key\\s*\\(\\s*${coluna}\\s*\\)[\\s\\S]{0,80}?auth\\.users`,
      );
      expect(
        sql,
        `${tabela}.${coluna} não pode referenciar auth.users: é registro do que ` +
          "aconteceu, e precisa sobreviver à conta que nomeia.",
      ).not.toMatch(re);
    }
  });
});
