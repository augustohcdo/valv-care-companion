// tsconfig.app.json restringe `types` a vitest/globals; este é o único teste
// que lê o disco, então puxa os tipos de Node só aqui.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guarda contra soft-delete pela metade.
 *
 * Adicionar `deleted_at` a uma tabela é só metade do trabalho: quem apaga
 * precisa marcar a coluna, e *todo mundo que lê* precisa filtrá-la. A segunda
 * metade é fácil de esquecer, e o esquecimento é silencioso — o dado apagado
 * simplesmente reaparece num relatório, num PDF exportado ou, no pior caso,
 * numa checagem de permissão.
 *
 * Foi exatamente o que aconteceu nesta base: `case_collaborators` ganhou
 * soft-delete, mas a RLS continuou checando só `status = 'aceito'`, então
 * remover um colaborador deixou de revogar o acesso dele. Este teste varre o
 * código procurando leitura de tabela com soft-delete sem o filtro.
 */

const SOFT_DELETE_TABLES = [
  "clinical_cases", "patients", "case_documents", "case_exams", "case_events",
  "appointments", "patient_documents", "case_comments", "case_collaborators",
  "symptom_entries", "notifications",
];

/**
 * Exceções deliberadas. Cada entrada precisa de um motivo — se não dá para
 * escrever o motivo, provavelmente é um bug, não uma exceção.
 */
const ALLOWLIST: Record<string, string> = {
  // Pedido LGPD de acesso/portabilidade: o titular tem direito a tudo o que o
  // controlador guarda a respeito dele, inclusive o que ele apagou na interface.
  "supabase/functions/dpo-export/index.ts": "export LGPD deve incluir o apagado",
  // Backup semanal: um backup que omite linhas apagadas não é backup.
  "supabase/functions/weekly-export/index.ts": "backup deve incluir o apagado",
  // A própria varredura cita os nomes das tabelas.
  "src/test/softDelete.test.ts": "é este teste",
};

const ROOTS = ["src", "supabase/functions"];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** Leituras (`.from(tabela).…select(…)`) que não filtram `deleted_at`. */
function findUnfilteredReads(): string[] {
  const pattern = new RegExp(`\\.from\\("(${SOFT_DELETE_TABLES.join("|")})"\\)`, "g");
  const offenders: string[] = [];

  for (const root of ROOTS) {
    for (const file of walk(root)) {
      // `walk` parte de raízes relativas, então o caminho já sai relativo.
      const rel = file.replace(/\\/g, "/");
      if (rel in ALLOWLIST) continue;
      if (/\.test\.tsx?$/.test(rel)) continue; // fixtures de teste usam mocks

      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(pattern)) {
        // A cadeia vai até o fim do statement; o `;` é um limite bom o
        // bastante porque estas consultas nunca contêm um literal com `;`.
        const rest = source.slice(match.index! + match[0].length);
        const end = rest.indexOf(";");
        const chain = end > 0 ? rest.slice(0, end) : rest.slice(0, 400);

        // insert/update/delete não leem — o `.select()` depois de um insert só
        // devolve a linha recém-criada, que por definição não está apagada.
        if (!chain.includes(".select(")) continue;
        if (/\.(insert|update|upsert|delete)\(/.test(chain.slice(0, chain.indexOf(".select(")))) continue;
        if (chain.includes("deleted_at")) continue;

        const line = source.slice(0, match.index).split("\n").length;
        offenders.push(`${rel}:${line} lê ${match[1]} sem filtrar deleted_at`);
      }
    }
  }
  return offenders;
}

describe("soft-delete", () => {
  it("toda leitura de tabela com soft-delete filtra deleted_at", () => {
    const offenders = findUnfilteredReads();
    expect(offenders, `\n${offenders.join("\n")}\n`).toEqual([]);
  });

  it("a allowlist só contém arquivos que existem", () => {
    // Uma entrada obsoleta esconderia um arquivo novo com o mesmo caminho.
    for (const path of Object.keys(ALLOWLIST)) {
      expect(() => statSync(path), `allowlist aponta para ${path}`).not.toThrow();
    }
  });
});
