import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Guarda: o lugar de guardar coisas é privado, e não promete o que não tem.
 *
 * Duas famílias de defeito, cada uma com consequência concreta:
 *
 * 1. **Bucket que vaza.** `public = true` num bucket do Supabase não é uma
 *    configuração de conveniência: transforma todo objeto numa URL aberta,
 *    sem sessão e sem RLS. Este bucket existe justamente porque o repositório
 *    é público e não servia — publicá-lo desfaria a única razão de ele existir.
 *    O mesmo vale para uma allowlist nula, que aceita qualquer coisa.
 * 2. **Tela que promete espaço infinito.** O pedido original foi "arquivos
 *    ilimitados". A quantidade é ilimitada; o tamanho não — 50 MB por arquivo
 *    é teto da plataforma (`fileSizeLimit` na config de storage do projeto,
 *    medido). Escrever "sem limite" ao lado do seletor de arquivo seria a
 *    interface mentindo sobre o próprio estado, que é o defeito que esta base
 *    passou a sessão inteira removendo.
 */

const raiz = resolve(__dirname, "../..");
const ler = (p: string) => readFileSync(resolve(raiz, p), "utf8");

/** A migration mais recente que cria o bucket é a que vale. */
function migrationDoBucket(): string {
  const dir = resolve(raiz, "supabase/migrations");
  const arquivos = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const com = arquivos.filter((f) =>
    /insert into storage\.buckets[\s\S]{0,400}'workspace'/i.test(readFileSync(resolve(dir, f), "utf8")));
  expect(com.length, "nenhuma migration cria o bucket workspace").toBeGreaterThan(0);
  return readFileSync(resolve(dir, com[com.length - 1]), "utf8");
}

describe("o bucket dos arquivos de trabalho", () => {
  it("é privado", () => {
    const sql = migrationDoBucket();
    const insert = sql.slice(sql.indexOf("insert into storage.buckets"), sql.indexOf("on conflict"));
    expect(insert, "o bucket foi criado público").toMatch(/'workspace',\s*'workspace',\s*false/);
    // E o `on conflict` não pode reabrir o que o insert fechou: rodar a
    // migration de novo é o caminho por onde isso voltaria.
    const conflito = sql.slice(sql.indexOf("on conflict"), sql.indexOf("drop policy"));
    expect(conflito, "o on conflict deixa o bucket público").toMatch(/public\s*=\s*false/);
    expect(conflito).not.toMatch(/public\s*=\s*true/);
  });

  it("tem allowlist de tipos, e não tipo aberto", () => {
    const sql = migrationDoBucket();
    const insert = sql.slice(sql.indexOf("insert into storage.buckets"), sql.indexOf("on conflict"));
    expect(insert, "allowed_mime_types nulo aceita qualquer arquivo").toMatch(/array\[/);
    expect(insert).not.toMatch(/allowed_mime_types[\s\S]{0,40}null/i);
  });

  it("toda policy do bucket exige administrador", () => {
    const sql = migrationDoBucket();
    const policies = sql.match(/create policy[\s\S]*?on storage\.objects[\s\S]*?;/gi) ?? [];
    expect(policies.length, "nenhuma policy declarada para o bucket").toBeGreaterThanOrEqual(3);
    for (const pol of policies) {
      expect(pol, "policy sem exigência de admin").toMatch(/has_role\(auth\.uid\(\), 'admin'/);
      expect(pol, "policy aberta a anônimo").not.toMatch(/\bto\s+anon\b/);
    }
  });

  it("o índice tem RLS e nenhuma policy sem admin", () => {
    const sql = migrationDoBucket();
    expect(sql).toMatch(/alter table public\.workspace_files enable row level security/i);
    const policies = sql.match(/create policy[\s\S]*?on public\.workspace_files[\s\S]*?;/gi) ?? [];
    expect(policies.length, "nenhuma policy em workspace_files").toBeGreaterThan(0);
    for (const pol of policies) {
      expect(pol, "policy sem exigência de admin").toMatch(/has_role\(auth\.uid\(\), 'admin'/);
    }
  });

  it("o índice entra no backup, e por decisão", () => {
    // A guarda de cobertura cobraria de qualquer jeito; esta confirma que a
    // escolha foi feita, e o comentário ao lado diz o limite honesto dela.
    const backup = ler("supabase/functions/weekly-export/index.ts");
    const lista = backup.slice(backup.indexOf("const TABLES = ["), backup.indexOf("];", backup.indexOf("const TABLES = [")));
    expect(lista, "workspace_files ficou fora do backup").toContain('"workspace_files"');
  });
});

describe("a tela não promete o que a plataforma não dá", () => {
  const tela = ler("src/pages/app/AdminArquivos.tsx");
  const semComentarios = tela.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("diz o teto de 50 MB onde a pessoa escolhe o arquivo", () => {
    // Recorta o bloco do seletor de arquivo. A primeira versão desta guarda
    // procurava "50 MB" no arquivo inteiro e passava mesmo com o rótulo
    // apagado — o texto do toast de recusa bastava para satisfazê-la. Só se
    // descobriu invertendo.
    const i = semComentarios.indexOf('id="arquivo"');
    expect(i, "o seletor de arquivo sumiu da tela").toBeGreaterThan(0);
    const bloco = semComentarios.slice(i, semComentarios.indexOf("</Card>", i));
    expect(bloco, "o teto por arquivo não está escrito junto ao seletor").toMatch(/50\s*MB/);
  });

  it("não afirma espaço ou tamanho ilimitado", () => {
    // "Quantidade de arquivos sem limite" é verdade e pode ficar. O que não
    // pode é a promessa colada em tamanho ou espaço.
    const proibido = /(tamanho|espaço|armazenamento)[^.]{0,40}(ilimitad|sem limite)/i;
    expect(semComentarios.match(proibido)?.[0] ?? null, "a tela promete espaço ilimitado").toBeNull();
  });

  it("o download é por URL assinada, não por link permanente", () => {
    // `getPublicUrl` num bucket privado devolve uma URL que não funciona — e
    // num bucket que alguém tornasse público, uma que funciona para sempre.
    expect(semComentarios).toContain("createSignedUrl");
    expect(semComentarios, "usa URL pública num bucket privado").not.toContain("getPublicUrl");
  });

  it("se o registro falhar, o arquivo enviado não fica órfão", () => {
    // Só dentro da função de envio. A primeira versão varria o arquivo todo e
    // casava com o `if (!ok)` da **exclusão**, onde o `.remove()` é o objetivo
    // e não o desfazer — passava com o rollback do envio apagado.
    const i = semComentarios.indexOf("const enviar =");
    const f = semComentarios.indexOf("const baixar =");
    expect(i, "a função de envio sumiu").toBeGreaterThan(0);
    expect(f).toBeGreaterThan(i);
    const envio = semComentarios.slice(i, f);
    expect(envio, "envio sem desfazer: o arquivo ficaria órfão no bucket")
      .toMatch(/if \(!ok\)[\s\S]{0,200}\.remove\(/);
  });
});

describe("o script de linha de comando", () => {
  const script = ler("scripts/workspace.mjs");

  it("recusa arquivo acima do teto com motivo, em vez de deixar o servidor negar", () => {
    expect(script).toMatch(/MAX_BYTES/);
    expect(script).toMatch(/teto da plataforma é 50 MB/);
  });

  it("recusa extensão fora da allowlist", () => {
    expect(script).toMatch(/não está na allowlist do bucket/);
  });

  it("não guarda credencial em arquivo", () => {
    // A chave sai da API de projeto a cada execução. Uma constante com `sb_`
    // ou `eyJ` aqui seria segredo versionado num repositório público.
    expect(script).not.toMatch(/sb_secret_|service_role_key\s*=\s*['"]/);
    expect(script).not.toMatch(/['"]eyJ[A-Za-z0-9_-]{20,}/);
    expect(script).toContain("SUPABASE_ACCESS_TOKEN");
  });
});
