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
  // O SQL que PROVA que produção não chama o projeto antigo. A palavra ali é o
  // assunto do arquivo, não um resto: tirá-la deixaria a conferência sem dizer
  // o que ela confere. Mesma natureza das duas migrations acima.
  "scripts/catalogo/conferir-independencia.sql",
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

/**
 * O buraco que a guarda acima tinha: ela cobra a PALAVRA.
 *
 * ## Como apareceu
 *
 * Varrendo o que ainda ligava o projeto ao Lovable, o `semLovable` estava verde
 * — e três migrations de julho carregavam, no corpo do comando de `pg_cron`, a
 * URL do projeto Supabase do Lovable escrita por extenso. Elas não dizem
 * "Lovable" em lugar nenhum; dizem `bjgzychcgaeyhfjvlsip`. A guarda passou por
 * cima.
 *
 * O estrago foi real e está documentado em `20260801130000`: o agendamento
 * ficava "ativo", nunca produzia um arquivo de backup, e na primeira execução
 * teria mandado o nosso segredo de cron — no cabeçalho — para um projeto que
 * não controlamos. Levou de 19/07 a 01/08 para alguém notar.
 *
 * ## O que esta varredura cobra
 *
 * Não é "não escreva `bjgzychcgaeyhfjvlsip`". É a propriedade: **nenhum arquivo
 * do projeto aponta para um projeto Supabase que não seja o nosso.** Assim ela
 * também pega o próximo ref, que ninguém consegue listar hoje — que é a
 * diferença entre guarda e lista negra.
 *
 * O ref de produção é lido de `supabase/config.toml`, não digitado aqui: guarda
 * que repete o valor que deveria conferir passa a concordar consigo mesma.
 */
describe("nada no projeto aponta para outro projeto Supabase", () => {
  const PRODUCAO = readFileSync("supabase/config.toml", "utf8").match(
    /project_id\s*=\s*"([^"]+)"/,
  )?.[1];

  /**
   * Migrations JÁ APLICADAS que carregam o ref antigo. Ficam porque reescrever
   * migration aplicada é falsificar o que rodou no banco — e porque a correção
   * delas é outra migration, não a edição destas.
   */
  const HISTORICO = new Set([
    "supabase/migrations/20260719035328_b136a8bb-7ba4-4a97-bd0f-ee41d7d84be7.sql",
    "supabase/migrations/20260719035407_e31bbbb8-5a08-49e8-92b1-fb74199c9033.sql",
    "supabase/migrations/20260725120000_digest_cron_secret.sql",
  ]);
  // Escrevi esta lista com seis entradas. Conferindo arquivo por arquivo, três
  // não carregavam URL de terceiro nenhuma — a migration que CONSERTA o
  // problema, esta guarda e o SQL de conferência falam do assunto em português,
  // não em URL. Exceção que não isenta nada é permissão aberta esperando o
  // próximo arquivo com aquele nome. Ficaram as três que realmente têm.

  const REF = /https:\/\/([a-z0-9]{15,25})\.supabase\.co/g;

  it("o ref de produção vem do config.toml", () => {
    expect(PRODUCAO, "sem project_id em supabase/config.toml a varredura não sabe o que é 'nosso'")
      .toMatch(/^[a-z0-9]{15,25}$/);
  });

  it("nenhum arquivo aponta para projeto Supabase de terceiro", () => {
    const achados: string[] = [];
    for (const arquivo of varrer(".")) {
      if (HISTORICO.has(arquivo) || arquivo === "package-lock.json") continue;
      let conteudo: string;
      try {
        conteudo = readFileSync(arquivo, "utf8");
      } catch {
        continue;
      }
      for (const m of conteudo.matchAll(REF)) {
        if (m[1] !== PRODUCAO) achados.push(`${arquivo}: ${m[1]}`);
      }
    }
    expect(
      achados.join("\n"),
      "arquivo apontando para um projeto Supabase que não é o nosso — foi assim que o " +
        "backup semanal passou duas semanas chamando o projeto do Lovable, e o segredo " +
        "de cron chegou a um passo de sair para lá",
    ).toBe("");
  });

  it("TODA exceção histórica existe e ainda carrega o ref antigo", () => {
    // "Pelo menos uma" seria frouxo: bastaria uma migration antiga segurar a
    // lista inteira, e as outras entradas ficariam de permissão aberta para o
    // próximo arquivo que nascesse com aquele nome. A cobrança é por arquivo.
    const inuteis = [...HISTORICO].filter((arquivo) => {
      if (!existsSync(arquivo)) return true;
      const texto = readFileSync(arquivo, "utf8");
      return ![...texto.matchAll(REF)].some((m) => m[1] !== PRODUCAO);
    });
    expect(
      inuteis.join("\n"),
      "exceção que não isenta nada — arquivo sumiu ou não tem mais URL de terceiro; tire-o da lista",
    ).toBe("");
    expect(HISTORICO.size, "a lista esvaziou; a varredura passou a cobrar sem isentar nada")
      .toBeGreaterThan(0);
  });

  it("a expressão realmente casa uma URL de projeto", () => {
    // Contraprova da própria ferramenta: uma regex quebrada acharia zero em
    // tudo, e o teste acima passaria com o repositório apontando para qualquer
    // lugar.
    const amostra = `url := 'https://${PRODUCAO}.supabase.co/functions/v1/x'`;
    expect([...amostra.matchAll(REF)].map((m) => m[1])).toEqual([PRODUCAO]);
  });
});
