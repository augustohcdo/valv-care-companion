// tsconfig.app.json restringe `types` a vitest/globals; como as outras guardas,
// esta lê o disco e por isso puxa os tipos de Node só aqui.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
// Importados em vez de recopiados: a terceira cópia de uma decisão é onde ela
// começa a divergir. `sqlSemComentarios` existe porque uma guarda já foi
// enganada por uma migration que CITAVA o SQL num comentário, e este arquivo
// precisa dela pelo mesmo motivo — o cabeçalho de `20261005121000` cita, em
// comentário, a própria linha da porta 5 que ele remove.
import {
  sqlSemComentarios, tabelasVivas, tabelasVivasDeSql, tabelasDoSchemaGerado,
} from "./sqlDeMigrations";
import { semComentarios, encadeamentoDaEscrita } from "./aplicarComSelect.test";

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

/**
 * Todas as migrations num texto só, SEM comentário.
 *
 * O `sqlSemComentarios` entrou aqui depois: a única asserção que usa esta
 * função cobra que `pode_ver_medico` seja `security definer`, e o cabeçalho de
 * mais de uma migration deste repositório CITA SQL em prosa. Uma guarda de
 * segurança satisfeita por um comentário é a forma mais pura do defeito que
 * esta sessão persegue — e eu já a vi acontecer hoje, num detector cuja dívida
 * declarada subiu por causa de uma docstring minha.
 */
function sqlDeTodasAsMigrations(): string {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => sqlSemComentarios(readFileSync(join(DIR, f), "utf8")))
    .join("\n")
    .toLowerCase();
}

describe("cobertura de RLS", () => {
  /**
   * As tabelas saem de `tabelasVivas`, com noção de ORDEM e sem comentário.
   *
   * A versão anterior era um `new Set(sql.matchAll(/create table …/))` sobre a
   * concatenação CRUA de todas as migrations, mais outro para
   * `enable row level security`. Sem `drop table`, sem `disable`, e lendo
   * comentário como código. O motivo de isso importar está escrito em
   * `sqlDeMigrations.ts`, junto da medida: ela contava `backup_runs`, apagada
   * há dois meses — e o jeito de doer é uma tabela criada com RLS, apagada, e
   * recriada depois SEM RLS com o mesmo nome, que ela aprovaria.
   *
   * A função irmã deste mesmo arquivo, `politicasVivas`, já tinha aprendido
   * isso para `drop policy`. A de tabelas, não.
   */
  const { vivas, rlsOrfao, criacoesLidas } = tabelasVivas(DIR);
  const doSchema = tabelasDoSchemaGerado();

  it("encontra as migrations e as tabelas que ainda existem", () => {
    expect(criacoesLidas, "nenhum `create table` lido — o extrator parou de casar")
      .toBeGreaterThan(20);
    expect(vivas.size, "nenhuma tabela viva — o extrator apagou tudo").toBeGreaterThan(20);
  });

  it("nenhum `enable row level security` fica órfão", () => {
    // Terceiro estado. No Postgres, ligar RLS numa tabela que não existe é
    // erro; aqui quer dizer que a leitura perdeu o `create table`. Engolir isso
    // transformaria uma falha do extrator em silêncio, e o zero da regra
    // seguinte passaria a valer só para o que ele conseguiu ler.
    expect(
      rlsOrfao,
      `\n${rlsOrfao.join("\n")}\n\n` +
        "Isto não acusa o SQL: acusa o extrator. Ele viu `enable row level\n" +
        "security` numa tabela cujo `create table` não leu, então a cobertura\n" +
        "abaixo não cobre essa tabela.",
    ).toEqual([]);
  });

  it("toda tabela que ainda existe habilita RLS", () => {
    const desprotegidas = [...vivas.values()]
      .filter((t) => !t.rls && !(t.tabela in SEM_RLS_JUSTIFICADO))
      .map((t) => `  · ${t.tabela} (criada em ${t.criadaEm})`)
      .sort();

    expect(
      desprotegidas,
      `\nTabelas sem "enable row level security":\n${desprotegidas.join("\n")}\n\n` +
        "Sem RLS, a tabela fica legível por quem tiver a chave pública do site —\n" +
        "que vai no pacote servido a todo visitante, de propósito.",
    ).toEqual([]);
  });

  it("a lista das migrations bate com as tabelas que existem de verdade", () => {
    /**
     * O cruzamento que faltava, e a lição que ele fecha: cobertura não é
     * garantia — é garantia só sobre o que a guarda olha.
     *
     * A regra acima cobre as tabelas que as MIGRATIONS criam. Uma tabela criada
     * à mão no painel do Supabase, ou vinda de um caminho não versionado, nunca
     * apareceria ali — e passaria a vida inteira sem ninguém conferir se tem
     * RLS, com a guarda verde.
     *
     * `src/integrations/supabase/types.ts` é gerado do banco de produção e é a
     * única lista aqui que não depende de as migrations terem sido aplicadas.
     * `backupCoverage.test.ts` já a usava por isso. Medido quando esta regra foi
     * escrita: 47 tabelas no schema, 47 vivas pelas migrations, e as duas
     * listas iguais.
     *
     * Se divergirem, qualquer das duas direções é notícia:
     *
     *   · só no schema → tabela que nenhuma migration deste repositório cria.
     *     A regra de RLS acima não a cobre, e o `db.yml` não a recria num banco
     *     novo;
     *   · só nas migrations → ou os tipos estão velhos (rode a geração), ou a
     *     migration não foi aplicada em produção.
     */
    const vivasOrdenadas = [...vivas.keys()].sort();
    const soNoSchema = doSchema.filter((t) => !vivas.has(t)).sort();
    const soNasMigrations = vivasOrdenadas.filter((t) => !doSchema.includes(t));

    expect(doSchema.length, "não achei tabela nenhuma nos tipos gerados")
      .toBeGreaterThan(20);
    expect(
      soNoSchema,
      `\nEstas tabelas existem no banco e nenhuma migration daqui as cria:\n` +
        `  ${soNoSchema.join(", ")}\n\n` +
        "A regra de RLS deste arquivo NÃO as cobre — ela olha o que as\n" +
        "migrations criam. E num banco recriado do zero elas não voltam.",
    ).toEqual([]);
    expect(
      soNasMigrations,
      `\nEstas tabelas são criadas por migration e não estão nos tipos gerados:\n` +
        `  ${soNasMigrations.join(", ")}\n\n` +
        "Ou os tipos estão velhos — gere-os de novo —, ou a migration não foi\n" +
        "aplicada em produção. Nos dois casos, uma das duas fontes está mentindo\n" +
        "sobre o estado do banco.",
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

describe("o extrator de tabelas, conferido contra material plantado", () => {
  /**
   * A contraprova, e por que ela não existia.
   *
   * Duas inversões desta rodada falharam: mutar o tratamento de
   * `disable row level security` e o do `enable` órfão não derrubava nada.
   * Motivo: NENHUMA migration deste repositório tem esses dois casos, então as
   * duas linhas estavam sem teste e as duas regras passavam por vazio.
   *
   * É a lição que esta sessão repete: cobertura não é garantia — é garantia só
   * sobre o que a guarda olha. Aqui o material é plantado em texto, para a
   * varredura do repositório nunca o encontrar.
   */
  const ler = (...entradas: Array<[string, string]>) =>
    tabelasVivasDeSql(entradas.map(([arquivo, sql]) => ({ arquivo, sql })));

  it("`create` + `enable` deixa a tabela viva e protegida", () => {
    const { vivas, rlsOrfao } = ler([
      "001.sql",
      "create table public.t (id uuid);\nalter table public.t enable row level security;",
    ]);
    expect([...vivas.keys()]).toEqual(["t"]);
    expect(vivas.get("t")!.rls).toBe(true);
    expect(rlsOrfao).toEqual([]);
  });

  it("`disable` depois do `enable` desprotege", () => {
    // A linha que a inversão provou estar sem teste.
    const { vivas } = ler([
      "001.sql",
      "create table public.t (id uuid);\n" +
        "alter table public.t enable row level security;\n" +
        "alter table public.t disable row level security;",
    ]);
    expect(vivas.get("t")!.rls, "o `disable` foi ignorado").toBe(false);
    expect(vivas.get("t")!.rlsEm).toBeNull();
  });

  it("a ORDEM decide, e não a presença", () => {
    // `disable` antes do `enable` deixa protegida; o contrário, não. Um
    // extrator que só olhasse presença daria o mesmo resultado para os dois.
    const antes = ler([
      "001.sql",
      "create table public.t (id uuid);\n" +
        "alter table public.t disable row level security;\n" +
        "alter table public.t enable row level security;",
    ]);
    expect(antes.vivas.get("t")!.rls).toBe(true);
  });

  it("`drop table` apaga, e a tabela some da conta", () => {
    const { vivas, criacoesLidas } = ler([
      "001.sql", "create table public.t (id uuid);\ndrop table if exists public.t;",
    ]);
    expect([...vivas.keys()], "a tabela apagada continuou na lista").toEqual([]);
    // A criação foi LIDA — o piso mede trabalho do extrator, não tabelas vivas.
    expect(criacoesLidas).toBe(1);
  });

  it("recriada depois do `drop` volta SEM o RLS de antes", () => {
    /**
     * O falso verde que a versão anterior desta guarda tinha. Ela guardava
     * `criadas` e `comRls` em dois conjuntos sem ordem: a tabela entrava nos
     * dois na primeira criação, e a recriação sem RLS era aprovada.
     */
    const { vivas } = ler([
      "001.sql",
      "create table public.t (id uuid);\n" +
        "alter table public.t enable row level security;\n" +
        "drop table if exists public.t;\n" +
        "create table public.t (id uuid, dado_de_pessoa text);",
    ]);
    expect(vivas.get("t")!.rls, "o RLS da encarnação anterior sobreviveu").toBe(false);
  });

  it("o `drop` de uma migration posterior também conta", () => {
    // Entre arquivos, e não só dentro de um. `backup_runs` é exatamente este
    // caso: criada em 20260801130000 e apagada em 20260801160000.
    const { vivas } = ler(
      ["001.sql", "create table public.t (id uuid);\nalter table public.t enable row level security;"],
      ["002.sql", "drop table if exists public.t;"],
    );
    expect([...vivas.keys()]).toEqual([]);
  });

  it("`enable` sem `create` antes é ÓRFÃO, e é relatado", () => {
    // A outra linha que a inversão provou estar sem teste. No Postgres isto é
    // erro; aqui quer dizer que o extrator perdeu o `create table`.
    const { vivas, rlsOrfao } = ler([
      "001.sql", "alter table public.ninguem_criou enable row level security;",
    ]);
    expect(vivas.size).toBe(0);
    expect(rlsOrfao).toHaveLength(1);
    expect(rlsOrfao[0]).toContain("ninguem_criou");
  });

  it("comentário não cria tabela nem liga RLS", () => {
    const { vivas, rlsOrfao, criacoesLidas } = ler([
      "001.sql",
      "create table public.t (id uuid);\n" +
        "-- alter table public.t enable row level security;\n" +
        "/* create table public.fantasma (id uuid);\n" +
        "   alter table public.fantasma enable row level security; */",
    ]);
    expect([...vivas.keys()], "o comentário criou uma tabela").toEqual(["t"]);
    expect(vivas.get("t")!.rls, "o comentário ligou o RLS").toBe(false);
    expect(rlsOrfao).toEqual([]);
    expect(criacoesLidas).toBe(1);
  });

  it("`if not exists` repetido não duplica, e não reseta o RLS", () => {
    const { vivas, criacoesLidas } = ler(
      ["001.sql", "create table if not exists public.t (id uuid);\nalter table public.t enable row level security;"],
      ["002.sql", "create table if not exists public.t (id uuid);"],
    );
    expect(vivas.size).toBe(1);
    expect(vivas.get("t")!.rls, "o segundo `if not exists` desligou o RLS").toBe(true);
    expect(criacoesLidas).toBe(2);
  });

  it("lê nome de tabela com dígito", () => {
    // O regex antigo era `[a-z_]+`: `fhir_r4` virava `fhir_r`. Duas tabelas que
    // só diferissem pelo dígito colapsariam numa, e o RLS de uma valeria pela
    // outra.
    const { vivas } = ler([
      "001.sql",
      "create table public.fhir_r4 (id uuid);\nalter table public.fhir_r4 enable row level security;\n" +
        "create table public.fhir_r5 (id uuid);",
    ]);
    expect([...vivas.keys()].sort()).toEqual(["fhir_r4", "fhir_r5"]);
    expect(vivas.get("fhir_r4")!.rls).toBe(true);
    expect(vivas.get("fhir_r5")!.rls, "o dígito foi truncado e o RLS vazou").toBe(false);
  });
});

/**
 * A ÚLTIMA definição de uma função nas migrations, em ordem de arquivo.
 *
 * Perguntar "o SQL de todas as migrations contém X?" responde outra coisa:
 * `create or replace` substitui, então o que vale é a definição mais recente.
 * Uma busca no texto inteiro encontraria a versão antiga e diria que a porta 5
 * ainda está lá — ou, se eu invertesse o teste, diria que ela saiu porque a
 * versão NOVA existe, ignorando que uma migration posterior poderia tê-la
 * recolocado.
 */
export function ultimaDefinicaoDeFuncao(
  nome: string,
  dir = DIR,
): { arquivo: string; corpo: string } | null {
  const arquivos = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let achada: { arquivo: string; corpo: string } | null = null;
  for (const arquivo of arquivos) {
    const sql = sqlSemComentarios(readFileSync(join(dir, arquivo), "utf8"));
    const re = new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${nome}\\s*\\(`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) {
      const fim = sql.indexOf("$$;", m.index);
      achada = { arquivo, corpo: sql.slice(m.index, fim < 0 ? sql.length : fim + 3) };
    }
  }
  return achada;
}

/**
 * A quinta porta de `doctors`: "quem é médico vê qualquer médico".
 *
 * ## O que ela era
 *
 * A migration de setembro trocou o `using (true)` de `doctors` por uma cerca de
 * cinco portas e registrou no cabeçalho, com todas as letras, o que NÃO fazia:
 *
 *   > A porta 5 mantém todo médico enxergando todo médico, inclusive quem
 *   > desmarcou a caixa. É o que o convite de colaboração por CRM exige, e RLS
 *   > não sabe dizer "só quando a consulta filtra por CRM exato".
 *
 * Quer dizer: a promessa da caixa "Aparecer no diretório" — enquadrada no
 * `MedicoPerfil` como consentimento revogável, LGPD art. 8º §5º e Resolução
 * CFM nº 2.336/2023 — passou a valer para pacientes e continuou não valendo
 * para colegas.
 *
 * ## Medido numa bancada PostgreSQL 16, nos quatro estados
 *
 *                                            A lê B    A vê a tabela   P lê B
 *   política aberta (antes de setembro)          1           3            1
 *   cerca de setembro, porta 5 aberta            1           3            0
 *   etapa 1 (o RPC entra)                        1           3            0
 *   etapa 2 (a porta 5 fecha)                    0           2            0
 *
 * O estado do meio é o que prova que o teste exercita a mudança: sem ele,
 * "A não lê B" poderia estar passando pelo motivo errado.
 *
 * E o RPC, na mesma bancada: CRM+UF exatos → 1 linha; UF errada → 0; busca por
 * prefixo `2222` → 0; paciente chamando → 0; e, depois do convite, A volta a
 * ler a linha de B pela porta 4.
 */
describe("a porta 5 de `doctors`", () => {
  const RPC = "medico_por_crm";

  it("a última definição de `pode_ver_medico` não tem a porta 5", () => {
    const def = ultimaDefinicaoDeFuncao("pode_ver_medico");
    expect(def, "não achei definição de `pode_ver_medico` em migration nenhuma").not.toBeNull();
    expect(
      def!.corpo,
      `a porta 5 voltou em ${def!.arquivo}: "quem é médico vê qualquer médico" é leitura ` +
        "da tabela inteira por qualquer médico, inclusive das linhas de quem desmarcou " +
        '"Aparecer no diretório" — e a tela promete que desmarcar tira da lista',
    ).not.toMatch(/d2\s*\.\s*user_id\s*=\s*_user_id/);

    // E as quatro que ficam, nomeadas: sem isto, uma função vazia passaria.
    for (const [porta, padrao] of [
      ["1 (a própria linha)", /d\.id\s*=\s*_doctor_id/],
      ["2 (o médico do paciente)", /p\.linked_doctor_id\s*=\s*_doctor_id/],
      ["3 (o dono de um caso que vejo)", /c\.doctor_id\s*=\s*_doctor_id/],
      ["4 (colaborador de um caso)", /cc\.doctor_id\s*=\s*_doctor_id/],
    ] as const) {
      expect(def!.corpo, `a porta ${porta} desapareceu junto`).toMatch(padrao);
    }
  });

  it(`\`${RPC}\` existe, é security definer e exige que quem chama seja médico`, () => {
    const def = ultimaDefinicaoDeFuncao(RPC);
    expect(def, `sem o RPC, fechar a porta 5 quebra o convite de colega`).not.toBeNull();
    expect(def!.corpo, "o RPC deixou de ser security definer").toMatch(/security\s+definer/i);
    expect(
      def!.corpo,
      "o RPC não exige mais que quem chama seja médico — seria uma leitura de `doctors` " +
        "por CRM aberta a qualquer conta autenticada, mais frouxa que a cerca que ele " +
        "veio ajudar a fechar",
    ).toMatch(/eu\.user_id\s*=\s*auth\.uid\(\)/);
    // CRM e UF exatos. `like` ou `ilike` aqui viraria busca por padrão, e a
    // tabela voltaria a ser varrível — por outro caminho.
    expect(def!.corpo, "o RPC casa CRM por padrão em vez de igualdade").not.toMatch(/\bi?like\b/i);
    expect(def!.corpo).toMatch(/d\.crm\s*=/);
    expect(def!.corpo).toMatch(/d\.crm_uf\s*=/);
  });

  it("a etapa que FECHA vem depois da que CRIA o RPC", () => {
    /**
     * A ordem não é estética: aplicar o fechamento antes do RPC deixa o
     * frontend publicado fazendo `select … where crm = …` contra a cerca, e a
     * tela responde "Médico não encontrado — verifique o CRM e a UF" sobre um
     * colega que existe. Frase falsa que joga a culpa na digitação de quem
     * convida.
     *
     * Em ordem de nome de arquivo, que é a ordem em que as migrations se
     * aplicam nesta base.
     */
    const criaRpc = ultimaDefinicaoDeFuncao(RPC)!.arquivo;
    const fecha = ultimaDefinicaoDeFuncao("pode_ver_medico")!.arquivo;
    expect(
      criaRpc < fecha,
      `${criaRpc} precisa vir antes de ${fecha}: fechar a porta 5 sem o RPC existir ` +
        "deixa o convite de colega sem caminho nenhum",
    ).toBe(true);
  });

  it("nenhum código de `src/` lê `doctors` filtrando por CRM", () => {
    /**
     * A regressão que reabriria a necessidade da porta 5. Qualquer tela que
     * volte a procurar colega direto na tabela vai encontrar zero linhas — e,
     * pelo texto do `CaseCollaborators`, dizer que o médico não existe.
     *
     * Lido pelo encadeamento equilibrado, não por janela de N caracteres: a
     * cadeia `.from("doctors").select(…).eq("crm", …)` quebra em várias linhas
     * e uma janela a perde quando alguém reformata.
     */
    const arquivos = execFileSync("git", ["ls-files", "src"], { encoding: "utf8" })
      .trim().split("\n")
      .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f) && !f.startsWith("src/test/"));

    const culpadas: string[] = [];
    let cadeiasDeDoctors = 0;
    for (const arquivo of arquivos) {
      const limpo = semComentarios(readFileSync(arquivo, "utf8"));
      for (const m of limpo.matchAll(/\.from\(\s*"doctors"\s*\)/g)) {
        cadeiasDeDoctors++;
        const cadeia = encadeamentoDaEscrita(limpo, m.index);
        if (/\.eq\(\s*"crm(_uf)?"/.test(cadeia)) {
          const linha = limpo.slice(0, m.index).split("\n").length;
          culpadas.push(`  · ${arquivo}:${linha} — ${cadeia.replace(/\s+/g, " ").slice(0, 110)}`);
        }
      }
    }

    // Piso: a varredura precisa estar achando as cadeias de `doctors`. Sem
    // isto, renomear a tabela deixaria zero iterações e o teste passaria por
    // não ter olhado nada.
    expect(cadeiasDeDoctors, "a varredura não achou leitura de `doctors` nenhuma")
      .toBeGreaterThanOrEqual(5);
    expect(
      culpadas,
      `\n${culpadas.join("\n")}\n\n` +
        "Leitura de `doctors` por CRM direto na tabela. Com a porta 5 fechada ela\n" +
        "devolve zero linhas — e zero linhas aqui não se distingue de 'não existe'.\n\n" +
        'Use `supabase.rpc("medico_por_crm", { _crm, _crm_uf })`.',
    ).toEqual([]);
    /**
     * Prazo declarado porque este bloco sobe `git ls-files`.
     * `prazoDeSubprocesso.test.ts` cobrou na hora — e com razão: o padrão do
     * Vitest são 5 s, e numa máquina de CI disputada isso já produziu vermelho
     * sem causa nesta base. Guarda que pune quem fez certo é guarda que alguém
     * desliga.
     */
  }, 30_000);

  it("o convite de colega usa o RPC", () => {
    // O outro lado: o RPC existir e ninguém usá-lo deixaria a porta 5 fechada
    // com o convite quebrado — e o teste acima passaria, porque não há leitura
    // por CRM em lugar nenhum.
    const tela = semComentarios(readFileSync("src/components/CaseCollaborators.tsx", "utf8"));
    expect(
      tela,
      "o convite de colega não chama `medico_por_crm` — sem ele não há como achar o colega",
    ).toMatch(/\.rpc\(\s*"medico_por_crm"/);
  });
});
