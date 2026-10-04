// tsconfig.app.json restringe `types` a vitest/globals; como as outras guardas,
// esta lê o disco e por isso puxa os tipos de Node só aqui.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Guarda contra tabela nascer sem Row Level Security.
 *
 * ## O QUE ESTA GUARDA NÃO PROMETE — escrito depois de ela ter me enganado
 *
 * Ela confere que o RLS está **ligado**. Não confere que a política restrinja
 * coisa alguma. `enable row level security` mais `using (true)` aparece aqui
 * como tabela coberta, e não protege nada.
 *
 * Não é hipótese. A tabela `doctors` tinha exatamente isso:
 *
 *     CREATE POLICY "Authenticated users view doctors"
 *     ON public.doctors FOR SELECT TO authenticated USING (true);
 *
 * Qualquer conta autenticada lia a tabela inteira — inclusive médicos que
 * desmarcaram "Aparecer no diretório", cuja tela promete que desmarcar "tira
 * você da lista", e médicos ainda não verificados. Provado rodando num
 * PostgreSQL 16: o `diretorio_medicos()` devolvia 0 linhas e o `select *`
 * devolvia as 2, com biografia. Consertado em
 * `20260923140000_doctors_sem_leitura_aberta.sql`.
 *
 * Por isso o bloco novo abaixo: política permissiva não some em silêncio — ela
 * precisa estar declarada, com motivo escrito. Guarda cujo nome promete mais do
 * que ela confere é pior do que nenhuma, porque compra confiança que não
 * sustenta.
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

export interface PoliticaRls {
  tabela: string;
  nome: string;
  arquivo: string;
  comando: "all" | "select" | "insert" | "update" | "delete";
  using: string | null;
  withCheck: string | null;
}

/**
 * As políticas que ainda valem.
 *
 * Migrations posteriores derrubam políticas anteriores com `drop policy`, e
 * contar as derrubadas mediria código que não existe mais — foi assim que a
 * política `TO authenticated, anon` de 2026-04-27 deixou de valer sem sumir do
 * repositório. A varredura percorre os arquivos em ordem e desconsidera o par
 * (tabela, nome) que tenha sido derrubado.
 */
export function politicasVivas(dir = DIR): PoliticaRls[] {
  const vivas = new Map<string, PoliticaRls>();
  const arquivos = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  /**
   * Uma passada ÚNICA, em ordem de posição — e o motivo tem data.
   *
   * A primeira versão fazia duas varreduras por arquivo: primeiro todos os
   * `drop policy`, depois todos os `create policy`, e no fim descartava o par
   * (tabela, nome) que tivesse aparecido em algum drop. Quer dizer: ela não
   * tinha noção de ORDEM.
   *
   * O preço apareceu quando a migration de `doctors` ganhou um
   * `drop policy if exists` da própria política ANTES de criá-la — que é o
   * idioma idempotente, e foi acrescentado justamente porque o `db.yml` afirma
   * que todo SQL que ele aplica é reexecutável. A guarda passou a considerar a
   * política derrubada e reprovou dizendo "doctors ficou sem política de
   * SELECT", sobre uma tabela que tem uma.
   *
   * Agora cada instrução é aplicada na posição em que aparece: um `create`
   * depois de um `drop` revive, e um `drop` depois de um `create` derruba. É o
   * que o Postgres faz, e modelar menos do que isso é modelar outra coisa.
   */
  for (const arquivo of arquivos) {
    const sql = readFileSync(join(dir, arquivo), "utf8");
    const instrucoes: { pos: number; tipo: "drop" | "create"; p?: PoliticaRls; chave: string }[] = [];

    for (const m of sql.matchAll(
      /drop\s+policy\s+(?:if\s+exists\s+)?"?([^";]+?)"?\s+on\s+(?:public\.)?"?(\w+)"?/gi,
    )) {
      instrucoes.push({
        pos: m.index!, tipo: "drop",
        chave: `${m[2].toLowerCase()}::${m[1].trim().toLowerCase()}`,
      });
    }

    for (const m of sql.matchAll(
      /create\s+policy\s+"?([^"]+?)"?\s+on\s+(?:public\.)?"?(\w+)"?([\s\S]*?);\s*(?:\n|$)/gi,
    )) {
      const nome = m[1].trim().toLowerCase();
      const tabela = m[2].toLowerCase();
      const resto = m[3];
      const comando = (/\bfor\s+(all|select|insert|update|delete)\b/i.exec(resto)?.[1] ?? "all")
        .toLowerCase() as PoliticaRls["comando"];
      const using = /\busing\s*\(([\s\S]*?)\)\s*(?:with\s+check|$)/i.exec(resto)?.[1]?.trim() ?? null;
      const withCheck = /\bwith\s+check\s*\(([\s\S]*?)\)\s*$/i.exec(resto.trim())?.[1]?.trim() ?? null;
      instrucoes.push({
        pos: m.index!, tipo: "create", chave: `${tabela}::${nome}`,
        p: { tabela, nome, arquivo, comando, using, withCheck },
      });
    }

    instrucoes.sort((a, b) => a.pos - b.pos);
    for (const i of instrucoes) {
      if (i.tipo === "drop") vivas.delete(i.chave);
      else vivas.set(i.chave, i.p!);
    }
  }

  return [...vivas.values()];
}

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

  /**
   * Toda política que não restringe nada está DECLARADA, com motivo.
   *
   * `using (true)` é legítimo para dado de referência — o catálogo de fontes da
   * IA é público de propósito, e o site o cita. O que não pode é uma política
   * dessas aparecer sem ninguém decidir, numa tabela com dado de pessoa, e
   * passar por "coberta" porque o RLS está ligado.
   *
   * A lista é a mesma forma das outras deste repositório: motivo que não se
   * consegue escrever é esquecimento disfarçado de decisão.
   */
  const PERMISSIVA_JUSTIFICADA: Record<string, string> = {
    content_review_status:
      "tabela de referência: os estados possíveis de revisão de conteúdo ('ai_generated', " +
      "'reviewed'). Não tem dado de pessoa; a tela mostra o rótulo para todo mundo.",
    trusted_sources:
      "catálogo dos domínios que a IA pode citar — sociedade médica, órgão público, base " +
      "de literatura, fabricante — com o que cada um embasa e o que NÃO embasa. É " +
      "referência, sem dado de pessoa, e a instrução do modelo cita esse texto literalmente. " +
      "Só apareceu nesta lista quando o extrator passou a respeitar a ORDEM das instruções: " +
      "a versão anterior a escondia, porque o arquivo usa `drop policy if exists` antes do " +
      "`create` e ela contava o drop sem olhar a posição.",
    knowledge_sources:
      "catálogo das fontes que a IA cita (ESC/EACTS 2025, SBC 2024…). É público de propósito: " +
      "a resposta da IA nomeia a fonte, e quem lê precisa poder conferir qual é.",
  };

  it("toda política que não restringe nada está declarada, com motivo", () => {
    const vivas = politicasVivas();
    const frouxas: string[] = [];

    for (const p of vivas) {
      const alvo = p.comando === "insert" ? p.withCheck : p.using;
      if (alvo !== null && !/^\s*true\s*$/i.test(alvo)) continue;
      if (p.tabela in PERMISSIVA_JUSTIFICADA) continue;
      frouxas.push(
        `  · ${p.tabela} — política "${p.nome}" [${p.comando}] sem restrição (${p.arquivo})`,
      );
    }

    expect(
      vivas.length,
      "nenhuma política encontrada — o extrator parou de casar e a regra aprovaria tudo",
    ).toBeGreaterThanOrEqual(80);
    expect(
      frouxas,
      `\n${frouxas.join("\n")}\n\n` +
        "RLS ligado com `using (true)` não protege nada, e aparece como tabela\n" +
        "coberta no teste acima. Foi assim que `doctors` ficou legível por\n" +
        "qualquer conta autenticada, incluindo médicos que tinham desmarcado\n" +
        "'Aparecer no diretório'.\n\n" +
        "Se a exposição for deliberada — dado de referência, catálogo público —,\n" +
        "declare a tabela em PERMISSIVA_JUSTIFICADA e escreva por quê.",
    ).toEqual([]);
  });

  it("as isenções continuam existindo — e continuam sendo permissivas", () => {
    // Exceção que não isenta nada ensina a acrescentar exceção sem olhar.
    const vivas = politicasVivas();
    for (const tabela of Object.keys(PERMISSIVA_JUSTIFICADA)) {
      const tem = vivas.some(
        (p) => p.tabela === tabela && /^\s*true\s*$/i.test(p.using ?? p.withCheck ?? ""),
      );
      expect(
        tem,
        `${tabela} está em PERMISSIVA_JUSTIFICADA mas já não tem política permissiva. ` +
          "Tire a entrada.",
      ).toBe(true);
    }
  });

  it("`doctors` saiu da leitura aberta — e o helper decide sem recursão", () => {
    /**
     * O conserto concreto, ancorado. A regra de classe acima passaria se
     * alguém trocasse `using (true)` por outra coisa igualmente aberta; este
     * bloco cobra a cerca que foi conferida rodando.
     */
    const vivas = politicasVivas();
    const deDoctors = vivas.filter((p) => p.tabela === "doctors" && p.comando === "select");
    expect(deDoctors.length, "doctors ficou sem política de SELECT").toBeGreaterThanOrEqual(1);
    for (const p of deDoctors) {
      expect(
        p.using,
        `a política "${p.nome}" de doctors voltou a ser aberta`,
      ).toMatch(/pode_ver_medico/);
    }

    const sql = sqlDeTodasAsMigrations();
    expect(
      sql,
      "pode_ver_medico precisa ser security definer: política que consulta `doctors` " +
        "aplicaria a política de `doctors`, e o Postgres recusa por recursão",
    ).toMatch(/function\s+public\.pode_ver_medico[\s\S]{0,400}security\s+definer/i);
  });
});
