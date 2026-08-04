// tsconfig.app.json restringe `types` a vitest/globals; como o softDelete.test,
// este lê o disco e por isso puxa os tipos de Node só aqui.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Guarda contra backup incompleto.
 *
 * O `weekly-export` percorre uma lista de tabelas escrita à mão. Uma migration
 * que cria tabela nova não mexe nessa lista, e nada avisa: o export continua
 * relatando sucesso — "22 tabelas, 0 falhas" — porque ele nunca soube que
 * deveria copiar mais.
 *
 * Foi assim que 15 tabelas ficaram de fora sem ninguém perceber, entre elas a
 * trilha de auditoria (`audit_logs`), quem é administrador (`user_roles`) e o
 * catálogo de próteses inteiro (246 linhas). Um backup que omite a trilha de
 * auditoria de um prontuário eletrônico é problema de conformidade, não de
 * conveniência.
 *
 * A lista de referência sai de `src/integrations/supabase/types.ts`, que é
 * gerado do schema real e fica commitado — então esta verificação roda no CI
 * sem precisar de credencial nenhuma.
 */

const TYPES = "src/integrations/supabase/types.ts";
const EXPORT_FN = "supabase/functions/weekly-export/index.ts";

/**
 * Tabelas deliberadamente fora do backup. Cada uma precisa de um motivo — se
 * não dá para escrever o motivo, provavelmente é esquecimento, não decisão.
 */
const NAO_COPIADAS: Record<string, string> = {
  // Segredos de cron e URL base: nenhum dado clínico ou de usuário, recriáveis
  // por migration. Copiá-los para um arquivo num bucket amplia a exposição sem
  // nenhum ganho de recuperação.
  internal_secrets: "segredo operacional recriável; copiar só aumenta exposição",
};

/** Nomes de tabela do bloco `Tables` dos tipos gerados. */
function tabelasDoSchema(): string[] {
  const linhas = readFileSync(TYPES, "utf8").split("\n");
  const ini = linhas.findIndex((l) => /^ {4}Tables: \{/.test(l));
  const fim = linhas.findIndex((l, i) => i > ini && /^ {4}Views: \{/.test(l));
  if (ini < 0 || fim < 0) throw new Error(`não achei o bloco Tables em ${TYPES}`);
  return linhas
    .slice(ini, fim)
    .map((l) => /^ {6}([a-z_]+): \{$/.exec(l)?.[1])
    .filter((n): n is string => !!n);
}

/** Tabelas listadas no `const TABLES = [...]` do export semanal. */
function tabelasDoBackup(): string[] {
  const src = readFileSync(EXPORT_FN, "utf8");
  const bloco = /const TABLES = \[([\s\S]*?)\];/.exec(src);
  if (!bloco) throw new Error(`não achei o array TABLES em ${EXPORT_FN}`);
  return [...bloco[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe("cobertura do backup semanal", () => {
  it("encontra as duas listas", () => {
    expect(tabelasDoSchema().length).toBeGreaterThan(20);
    expect(tabelasDoBackup().length).toBeGreaterThan(20);
  });

  it("toda tabela do schema é copiada ou tem exclusão justificada", () => {
    const noBackup = new Set(tabelasDoBackup());
    const esquecidas = tabelasDoSchema().filter(
      (t) => !noBackup.has(t) && !(t in NAO_COPIADAS),
    );

    expect(
      esquecidas,
      `Tabelas fora do backup semanal: ${esquecidas.join(", ")}.\n` +
        `Inclua em TABLES (${EXPORT_FN}) ou justifique em NAO_COPIADAS.`,
    ).toEqual([]);
  });

  it("não lista no backup tabela que não existe mais no schema", () => {
    const noSchema = new Set(tabelasDoSchema());
    const fantasmas = tabelasDoBackup().filter((t) => !noSchema.has(t));
    expect(fantasmas, `Tabelas inexistentes em TABLES: ${fantasmas.join(", ")}`).toEqual([]);
  });

  it("não mantém exclusão de tabela que já sumiu do schema", () => {
    const noSchema = new Set(tabelasDoSchema());
    const orfas = Object.keys(NAO_COPIADAS).filter((t) => !noSchema.has(t));
    expect(orfas, `Exclusões obsoletas: ${orfas.join(", ")}`).toEqual([]);
  });
});

/**
 * As contas de usuário vivem em `auth.users`, fora do alcance do PostgREST, e
 * por isso são exportadas por RPC — numa lista à parte de `TABLES`.
 *
 * Sem elas o backup não restaura um sistema: quatro tabelas de `public`
 * (`profiles`, `doctors`, `patients`, `user_roles`) têm chave estrangeira
 * apontando para `auth.users`, então numa restauração não carregariam — e,
 * mesmo carregando, ninguém conseguiria entrar.
 */
const MIGRATION_AUTH = "supabase/migrations/20260803170000_auth_identity_export.sql";
const MIGRATION_STORAGE = "supabase/migrations/20260803180000_keep_case_files_and_inventory.sql";

/**
 * Colunas que NUNCA podem sair do banco para um arquivo em bucket.
 *
 * Levar o hash da senha pouparia um "esqueci minha senha" depois de um
 * desastre e, em troca, transformaria o arquivo de backup num alvo muito mais
 * valioso. A decisão foi levar identidade, não credencial — e esta guarda
 * existe porque a tentação de "facilitar a restauração" é exatamente o tipo de
 * melhoria bem-intencionada que desfaz isso em silêncio.
 */
const CREDENCIAIS_PROIBIDAS = [
  "encrypted_password",
  "recovery_token",
  "confirmation_token",
  "email_change_token",
  "reauthentication_token",
];

describe("as contas no backup", () => {
  const exportSrc = readFileSync(EXPORT_FN, "utf8");
  const migrationSrc = readFileSync(MIGRATION_AUTH, "utf8");

  it("os arquivos vindos de RPC continuam sendo exportados", () => {
    // O inventário de storage entra aqui pelo mesmo motivo das contas: sem ele
    // uma restauração não sabe quais exames deveria trazer, e nada percebe que
    // um documento vivo perdeu o arquivo.
    for (const arquivo of ["auth_users", "auth_identities", "storage_inventory"]) {
      expect(exportSrc, `${EXPORT_FN} não exporta ${arquivo}`).toContain(`"${arquivo}"`);
    }
    for (const rpc of ["auth_users_export", "auth_identities_export"]) {
      expect(exportSrc, `${EXPORT_FN} não chama ${rpc}`).toContain(rpc);
      expect(migrationSrc, `${MIGRATION_AUTH} não define ${rpc}`).toContain(rpc);
    }
    expect(
      readFileSync(MIGRATION_STORAGE, "utf8"),
      `${MIGRATION_STORAGE} não define storage_inventory`,
    ).toContain("function public.storage_inventory");
  });

  it("nenhuma credencial atravessa para o arquivo de backup", () => {
    for (const coluna of CREDENCIAIS_PROIBIDAS) {
      // O nome pode aparecer em comentário explicando por que está fora; o que
      // não pode é aparecer numa linha de SQL que o seleciona.
      const linhasSql = migrationSrc
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("--"))
        .join("\n");
      expect(linhasSql, `${MIGRATION_AUTH} seleciona ${coluna}`).not.toContain(coluna);
      expect(exportSrc, `${EXPORT_FN} menciona ${coluna}`).not.toContain(coluna);
    }
  });
});
