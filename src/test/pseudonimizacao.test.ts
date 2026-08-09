// tsconfig.app.json restringe `types` a vitest/globals; como as outras guardas,
// esta lê o disco e por isso puxa os tipos de Node só aqui.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Guarda da correspondência entre pseudônimo e nome real.
 *
 * `pseudonym_map` é a única tabela do projeto que junta, numa linha só, o
 * código que aparece no prontuário e o nome que ele esconde. Se ela ganhar uma
 * policy de leitura — inclusive de administrador — a pseudonimização deixa de
 * separar o que existe para separar, e vira enfeite: bastaria abrir a tela.
 *
 * O desenho é o mesmo de `internal_secrets`: RLS ativa, nenhuma policy, só o
 * `service_role` entra. Quem precisa reidentificar passa pelo processo do DPO,
 * que deixa rastro.
 *
 * Roda sobre as migrations, sem credencial no CI — mesmo molde de
 * `rlsCoverage`, `backupCoverage`, `retencao` e `deleteBehavior`.
 */

const DIR = "supabase/migrations";

function sqlDeTodasAsMigrations(): string {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(DIR, f), "utf8"))
    .join("\n")
    .toLowerCase();
}

describe("pseudonimização", () => {
  const sql = sqlDeTodasAsMigrations();

  it("pseudonym_map tem RLS e nenhuma policy", () => {
    expect(sql).toContain("create table if not exists public.pseudonym_map");
    expect(sql).toMatch(/alter table public\.pseudonym_map enable row level security/);

    const policies = [...sql.matchAll(/create policy[\s\S]{0,200}?on public\.pseudonym_map/g)];
    expect(
      policies.map((m) => m[0].slice(0, 60)),
      "Uma policy em pseudonym_map exporia a correspondência entre o código e o " +
        "nome real — exatamente o que a pseudonimização existe para separar.",
    ).toEqual([]);
  });

  it("o encerramento preserva a autoria do médico", () => {
    // Encerrar a conta de um médico não pode apagar CRM e UF: é a assinatura do
    // prontuário, exigida pela Resolução CFM nº 1.821/2007.
    const corpo = sql.slice(sql.indexOf("function public.encerrar_conta"));
    const updateDoctors = corpo.match(/update public\.doctors set[^;]+;/);
    expect(updateDoctors, "encerrar_conta precisa limpar dados de contato do médico").not.toBeNull();
    for (const coluna of ["crm", "crm_uf"]) {
      expect(
        updateDoctors![0],
        `encerrar_conta não pode mexer em ${coluna}: é a autoria do prontuário.`,
      ).not.toMatch(new RegExp(`\\b${coluna}\\s*=`));
    }
  });

  it("a correspondência é guardada antes de o nome ser trocado", () => {
    // Trocar primeiro e guardar depois perderia o nome original para sempre —
    // e com ele a capacidade de reidentificar, que é o que distingue
    // pseudonimização de anonimização e o que a guarda de 20 anos exige.
    const corpo = sql.slice(sql.indexOf("function public.encerrar_conta"));
    const insercao = corpo.indexOf("insert into public.pseudonym_map");
    const troca = corpo.indexOf("update public.clinical_cases");
    expect(insercao).toBeGreaterThan(-1);
    expect(troca).toBeGreaterThan(-1);
    expect(
      insercao,
      "o insert em pseudonym_map precisa vir antes do update em clinical_cases",
    ).toBeLessThan(troca);
  });
});
