// tsconfig.app.json restringe `types` a vitest/globals; como as outras guardas,
// esta lê o disco e por isso puxa os tipos de Node só aqui.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Guarda contra tabela nascer sem Row Level Security.
 *
 * No Postgres do Supabase, uma tabela sem RLS é legível por qualquer um que
 * tenha a chave pública — que é justamente a chave que vai embutida no
 * JavaScript do site. Esquecer o `enable row level security` numa migration não
 * quebra nada, não aparece em teste e não gera aviso: simplesmente expõe a
 * tabela. Num sistema com dado clínico, é a falha mais cara possível pelo menor
 * dos descuidos.
 *
 * Auditei o estado atual e ele está correto — 38 de 38 tabelas com RLS ativa.
 * Esta guarda existe para que continue assim: ela varre as migrations e falha
 * se alguma tabela criada não tiver a linha em lugar nenhum.
 *
 * Roda sobre o código, não sobre o banco, então não precisa de credencial no
 * CI — mesmo desenho de `backupCoverage.test.ts` e `softDelete.test.ts`.
 */

const DIR = "supabase/migrations";

/** Exceções deliberadas, se algum dia houver. Sem motivo escrito, é bug. */
const SEM_RLS_JUSTIFICADO: Record<string, string> = {};

function sqlDeTodasAsMigrations(): string {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(DIR, f), "utf8"))
    .join("\n")
    .toLowerCase();
}

describe("cobertura de RLS", () => {
  const sql = sqlDeTodasAsMigrations();

  const criadas = new Set(
    [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_]+)"?/g)]
      .map((m) => m[1]),
  );
  const comRls = new Set(
    [...sql.matchAll(/alter\s+table\s+(?:public\.)?"?([a-z_]+)"?\s+enable\s+row\s+level\s+security/g)]
      .map((m) => m[1]),
  );

  it("encontra as migrations e as tabelas criadas nelas", () => {
    expect(criadas.size).toBeGreaterThan(20);
  });

  it("toda tabela criada em migration habilita RLS", () => {
    const desprotegidas = [...criadas]
      .filter((t) => !comRls.has(t) && !(t in SEM_RLS_JUSTIFICADO))
      .sort();

    expect(
      desprotegidas,
      `Tabelas criadas sem "enable row level security": ${desprotegidas.join(", ")}.\n` +
        `Sem RLS, a tabela fica legível por quem tiver a chave pública do site.`,
    ).toEqual([]);
  });
});
