// tsconfig.app.json restringe `types` a vitest/globals; como as outras guardas,
// esta lê o disco e por isso puxa os tipos de Node só aqui.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Guarda contra a direção perigosa do expurgo.
 *
 * A retenção existe porque a Política de Privacidade promete apagar log de
 * acesso em 6 meses. O risco não é esquecer de apagar — é apagar a coisa
 * errada: `audit_logs`, `integration_audit_log` e `consent_audit_log` não são
 * log de acesso, são a trilha clínica e de consentimento, com 20 anos
 * publicados em `Termos.tsx` e `Parceiros.tsx`. Uma linha a mais na lista de
 * retenção destruiria isso em silêncio, e não há como desfazer.
 *
 * São duas asserções, e a segunda é a que importa: a recusa precisa estar
 * **dentro da função**, não só na ausência de linha na tabela. Proteção de uma
 * camada só é exatamente o que esta rodada corrigiu na imutabilidade da trilha.
 *
 * Roda sobre as migrations, não sobre o banco — sem credencial no CI, mesmo
 * desenho de `rlsCoverage`, `backupCoverage` e `softDelete`.
 */

const DIR = "supabase/migrations";

/** A trilha. Nenhuma delas pode ser expurgada por retenção, nunca. */
const TRILHA = ["audit_logs", "integration_audit_log", "consent_audit_log"];

function sqlDeTodasAsMigrations(): string {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(DIR, f), "utf8"))
    .join("\n")
    .toLowerCase();
}

/** As tabelas semeadas em `retention_policies` por qualquer migration. */
function tabelasComRetencao(sql: string): string[] {
  const blocos = [...sql.matchAll(/insert\s+into\s+public\.retention_policies[\s\S]*?;/g)].map(
    (m) => m[0],
  );
  // Cada linha de VALUES começa com o nome da tabela entre aspas simples.
  return blocos.flatMap((b) => [...b.matchAll(/\(\s*'([a-z_]+)'\s*,/g)].map((m) => m[1]));
}

describe("retenção de logs", () => {
  const sql = sqlDeTodasAsMigrations();

  it("nenhuma tabela de trilha de auditoria entra na lista de retenção", () => {
    const listadas = tabelasComRetencao(sql);
    expect(listadas.length).toBeGreaterThan(0); // a varredura precisa estar achando algo

    const proibidas = listadas.filter((t) => TRILHA.includes(t));
    expect(
      proibidas,
      `Trilha de auditoria em retention_policies: ${proibidas.join(", ")}. ` +
        "Essas tabelas têm 20 anos de guarda publicados — expurgá-las é irreversível.",
    ).toEqual([]);
  });

  it("a função de expurgo recusa a trilha por si mesma, não só pela lista", () => {
    for (const tabela of TRILHA) {
      expect(
        sql,
        `aplicar_retencao() precisa recusar ${tabela} explicitamente, ` +
          "para que um insert futuro na lista encontre a recusa.",
      ).toContain(tabela);
    }
    // A recusa vive num array de proibidas dentro da função.
    expect(sql).toMatch(/proibidas\s+constant\s+text\[\]/);
    expect(sql).toMatch(/trilha de auditoria não pode ser expurgada/);
  });

  it("a trilha perde update, delete e truncate", () => {
    for (const tabela of TRILHA) {
      expect(
        sql,
        `Falta revogar update/delete/truncate de ${tabela}. TRUNCATE é o que mais ` +
          "importa: RLS não se aplica a ele, então nenhuma policy o filtra.",
      ).toMatch(
        new RegExp(`revoke\\s+update,\\s*delete,\\s*truncate\\s+on\\s+public\\.${tabela}\\s+from`),
      );
    }
  });
});
