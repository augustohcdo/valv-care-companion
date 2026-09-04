// Este teste lê o disco; tsconfig.app.json restringe `types`, daí a referência.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Nenhuma dependência do Lovable volta ao código.
 *
 * ## Por que esta guarda existe
 *
 * O usuário pediu a remoção do Lovable, achou que estava resolvido, e voltou a
 * encontrar o assunto vivo. "Resolvido" que não é verificado é resolvido só até
 * a próxima vez que alguém colar um trecho de código gerado por lá — o
 * `lovable-tagger` no `vite.config.ts` é o caso clássico, porque volta junto com
 * qualquer scaffold e ninguém repara numa linha de plugin.
 *
 * Então a exigência passa a ser cobrada a cada rodada, e não lembrada.
 *
 * ## O que é permitido, e por quê
 *
 * Duas migrations JÁ APLICADAS carregam a palavra em comentários que descrevem
 * o que aconteceu: o backup semanal que apontava para o projeto antigo com a URL
 * do Lovable embutida (corrigido em 01/08, e a URL passou a viver em
 * `internal_secrets`), e a troca dos embeddings gerados por lá. São REGISTRO
 * histórico, dentro de arquivos que não se reescreve — reescrever migration
 * aplicada é falsificar o que rodou no banco.
 *
 * Apagar esses comentários não removeria dependência nenhuma; removeria a
 * explicação de por que a dependência acabou.
 */

const PERMITIDOS = new Set([
  "supabase/migrations/20260801130000_fix_cron_target_and_rotate_secrets.sql",
  "supabase/migrations/20260725130000_clear_knowledge_chunks_embedding_swap.sql",
  // A própria guarda fala do assunto o tempo todo.
  "src/test/semLovable.test.ts",
]);

/** Pastas que não são nossas ou não são código publicado. */
const IGNORAR = new Set(["node_modules", "dist", ".git", "coverage", ".vercel"]);

function varrer(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue;
    const full = join(dir, nome);
    if (statSync(full).isDirectory()) varrer(full, out);
    else out.push(full.replace(/\\/g, "/").replace(/^\.\//, ""));
  }
  return out;
}

describe("o produto não depende do Lovable", () => {
  it("nenhum arquivo do projeto menciona o Lovable fora do histórico declarado", () => {
    const achados: string[] = [];
    for (const arquivo of varrer(".")) {
      if (PERMITIDOS.has(arquivo)) continue;
      // Lockfile é gerado; o que importa é o package.json, coberto abaixo.
      if (arquivo === "package-lock.json") continue;
      let conteudo: string;
      try {
        conteudo = readFileSync(arquivo, "utf8");
      } catch {
        continue; // binário ou ilegível
      }
      conteudo.split("\n").forEach((linha, i) => {
        if (/lovable/i.test(linha)) {
          achados.push(`${arquivo}:${i + 1}: ${linha.trim().slice(0, 100)}`);
        }
      });
    }
    expect(
      achados.join("\n"),
      "voltou dependência ou referência ao Lovable — o pedido do usuário foi remover, e ficar removido",
    ).toBe("");
  });

  it("o package.json não traz pacote do Lovable", () => {
    // Cobrado à parte porque é o caminho mais provável de volta: o
    // `lovable-tagger` entra como devDependency e passa despercebido.
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const todos = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(
      todos.filter((d) => /lovable/i.test(d)),
      "pacote do Lovable de volta no package.json",
    ).toEqual([]);
  });

  it("o vite.config não carrega plugin do Lovable", () => {
    const cfg = existsSync("vite.config.ts") ? readFileSync("vite.config.ts", "utf8") : "";
    expect(cfg.length, "vite.config.ts sumiu — a guarda ficaria cobrando nada").toBeGreaterThan(50);
    expect(cfg, "plugin do Lovable no vite.config").not.toMatch(/lovable|componentTagger/i);
  });

  it("a varredura enxerga o repositório inteiro", () => {
    // Contraprova: uma varredura que não achasse arquivo nenhum passaria com o
    // Lovable espalhado por tudo.
    const arquivos = varrer(".");
    expect(arquivos.length).toBeGreaterThan(300);
    expect(arquivos).toContain("package.json");
    expect(arquivos).toContain("src/App.tsx");
    expect(arquivos).toContain("index.html");
  });

  it("os arquivos permitidos existem e realmente citam o Lovable", () => {
    // Exceção que não cobre nada é exceção que envelheceu: se a migration for
    // renomeada, ou o comentário sair, a permissão sai junto.
    for (const arquivo of PERMITIDOS) {
      expect(existsSync(arquivo), `${arquivo} não existe mais`).toBe(true);
      expect(
        /lovable/i.test(readFileSync(arquivo, "utf8")),
        `${arquivo} não cita mais o Lovable — tire-o da lista de permitidos`,
      ).toBe(true);
    }
  });
});
