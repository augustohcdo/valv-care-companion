// tsconfig.app.json restringe `types` a vitest/globals; como as outras guardas,
// esta lê o disco e por isso puxa os tipos de Node só aqui.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Guardas da cópia externa do backup.
 *
 * A cópia é a segunda camada — a única que cobre perda do projeto inteiro. Três
 * jeitos de ela virar teatro, e um teste para cada um:
 *
 * 1. copiar sem reler: "enviado" é o que o provedor respondeu, "chegou íntegro"
 *    é outra coisa;
 * 2. sair da lista do vigia: uma tarefa que ninguém cobra pode passar meses sem
 *    rodar, e é exatamente essa a história do backup deste projeto;
 * 3. a restauração não saber ler a cópia: aí ela é um arquivo bonito e inútil no
 *    único dia em que importa.
 */

const MIGRATIONS = "supabase/migrations";
const OFFSITE = "supabase/functions/_shared/offsite.ts";
const FUNCAO = "supabase/functions/offsite-copy/index.ts";

const ler = (p: string) => readFileSync(p, "utf8");

function sqlDeTodasAsMigrations(): string {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ler(join(MIGRATIONS, f)))
    .join("\n")
    .toLowerCase();
}

describe("cópia externa do backup", () => {
  it("confere o que copiou, relendo do destino", () => {
    const helper = ler(OFFSITE);
    expect(helper).toContain("export async function copiarEConferir");
    // A releitura é o ponto: sem o GET de volta, a conferência compararia o
    // arquivo com ele mesmo.
    expect(helper).toMatch(/copiarEConferir[\s\S]{0,900}?lerObjeto/);
    expect(ler(FUNCAO), "a função precisa usar a versão que confere").toContain("copiarEConferir");
  });

  it("não deixa o segredo vazar em mensagem de erro", () => {
    const helper = ler(OFFSITE);
    // O corpo do erro do provedor entra na mensagem; a credencial, nunca. Um
    // log de falha que vaza chave troca um problema por outro maior.
    const usaSegredo = /`[^`]*\$\{[^}]*(secret|keyId)[^}]*\}[^`]*`/i.test(helper);
    expect(usaSegredo, "há interpolação de credencial numa string do offsite.ts").toBe(false);
  });

  it("a tarefa está na lista do vigia", () => {
    const sql = sqlDeTodasAsMigrations();
    expect(
      sql,
      "sem entrada em watched_jobs, o silêncio da cópia externa não é cobrado por ninguém.",
    ).toMatch(/insert into public\.watched_jobs[\s\S]{0,200}?'offsite-copy'/);
  });

  it("a restauração sabe ler a cópia externa", () => {
    const script = ler("scripts/restore.mjs");
    expect(script).toContain("--offsite");
    // E não pode exigir a chave do projeto de origem nesse modo: no cenário que
    // justifica a cópia, esse projeto não existe mais.
    expect(script).toMatch(/!ORIGEM_KEY\s*&&\s*!OFFSITE/);
    // E confere o hash do que baixou contra o manifesto da cópia.
    expect(script).toContain("_offsite_manifest.json");
    expect(script).toMatch(/integridade falhou/);
  });
});
