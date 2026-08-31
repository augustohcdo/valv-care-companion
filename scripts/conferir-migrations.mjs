/**
 * Toda migration analisada pela gramática de verdade do PostgreSQL.
 *
 * ## Por que isto existe
 *
 * As mudanças de catálogo desta rodada vão por migration, e não por script com
 * chave de serviço — o que é melhor, porque fica revisável no diff. Mas tem um
 * custo: **eu não consigo executar a migration aqui.** Não há Postgres nem
 * Docker neste ambiente, então entre escrever o SQL e ele rodar em produção não
 * havia nenhuma conferência. Um ponto e vírgula fora do lugar só apareceria no
 * deploy, quebrando a publicação inteira.
 *
 * Isto não substitui rodar a migration: não valida se a coluna existe, se o
 * `UPDATE` acerta alguma linha ou se a `CHECK` é satisfeita pelos dados. Valida
 * **sintaxe**, contra o parser real do PostgreSQL (`libpg_query`, via `pglast`),
 * e não contra uma expressão regular que acha que entende SQL.
 *
 * ## Os três códigos de saída, e por que o 2 existe
 *
 *   0 — todas as migrations analisadas e válidas
 *   1 — alguma migration não analisa: erro de sintaxe, com o arquivo e a posição
 *   2 — **não foi possível conferir** (falta o `pglast`)
 *
 * O 2 é o ponto do arquivo. Sem ele, a ausência da ferramenta viraria "nada a
 * relatar", que é indistinguível de "está tudo certo" — e um comando que
 * anuncia sucesso sem ter feito o trabalho é exatamente o defeito que este
 * projeto persegue. Instalar: `pip install pglast`.
 *
 * Uso: node scripts/conferir-migrations.mjs
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const DIR = "supabase/migrations";
const arquivos = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

if (arquivos.length === 0) {
  console.error("Nenhuma migration encontrada em " + DIR + " — isto não é sucesso, é busca vazia.");
  process.exit(2);
}

const py = `
import sys, json
try:
    import pglast
    from pglast import ast
except ImportError:
    print(json.dumps({"faltando": True})); sys.exit(0)

# ---------------------------------------------------------------------------
# Aridade e nome de coluna — o que o parser NÃO pega sozinho
# ---------------------------------------------------------------------------
#
# \`parse_sql\` valida sintaxe. \`INSERT INTO t (a,b,c) SELECT x,y\` é sintaxe
# perfeita e só explode quando alguém executa. Como o SQL desta rodada é colado
# à mão no painel do Supabase, dentro de um BEGIN, esse erro deixaria metade do
# catálogo aplicada e metade não — o pior estado possível.
#
# O mesmo vale para nome de coluna: \`mercado_br_fonte\` escrito \`mercado_br_font\`
# passa no parser e morre na execução.
CONHECIDAS = {}

def registrar_colunas(arvore):
    for raw in arvore:
        st = raw.stmt
        if isinstance(st, ast.CreateStmt) and st.relation is not None:
            alvo = CONHECIDAS.setdefault(st.relation.relname, set())
            for el in st.tableElts or []:
                if isinstance(el, ast.ColumnDef):
                    alvo.add(el.colname)
        if isinstance(st, ast.AlterTableStmt) and st.relation is not None:
            alvo = CONHECIDAS.setdefault(st.relation.relname, set())
            for cmd in st.cmds or []:
                d = getattr(cmd, "def_", None)
                if isinstance(d, ast.ColumnDef):
                    alvo.add(d.colname)

def problemas(arvore, caminho):
    achados = []
    for raw in arvore:
        st = raw.stmt
        if isinstance(st, ast.InsertStmt) and st.relation is not None:
            tabela = st.relation.relname
            cols = [c.name for c in (st.cols or [])]
            sel = st.selectStmt
            alvos = getattr(sel, "targetList", None) or []
            # Só compara quando é INSERT ... SELECT com lista explícita; um
            # INSERT ... VALUES tem a checagem noutro ramo do nó.
            if cols and alvos and len(cols) != len(alvos):
                achados.append(
                    "INSERT em %s: %d colunas para %d valores" % (tabela, len(cols), len(alvos)))
            desconhecidas = [c for c in cols if c not in CONHECIDAS.get(tabela, set())]
            if desconhecidas and tabela in CONHECIDAS:
                achados.append("INSERT em %s cita coluna inexistente: %s" % (tabela, ", ".join(desconhecidas)))
        if isinstance(st, ast.UpdateStmt) and st.relation is not None:
            tabela = st.relation.relname
            nomes = [t.name for t in (st.targetList or []) if t.name]
            desconhecidas = [c for c in nomes if c not in CONHECIDAS.get(tabela, set())]
            if desconhecidas and tabela in CONHECIDAS:
                achados.append("UPDATE em %s cita coluna inexistente: %s" % (tabela, ", ".join(desconhecidas)))
    return achados

caminhos = sys.argv[1:]
arvores = {}
saida = []
for caminho in caminhos:
    with open(caminho, encoding="utf-8") as f:
        sql = f.read()
    try:
        arv = pglast.parse_sql(sql)
        arvores[caminho] = arv
        registrar_colunas(arv)
        saida.append({"arquivo": caminho, "ok": True, "comandos": len(arv)})
    except Exception as e:
        saida.append({"arquivo": caminho, "ok": False, "erro": str(e)})

# Segunda passada: as colunas de TODAS as migrations já estão registradas, então
# uma migration que usa coluna criada por outra anterior não acusa falso.
for caminho, arv in arvores.items():
    for p in problemas(arv, caminho):
        for r in saida:
            if r["arquivo"] == caminho:
                r["ok"] = False
                r["erro"] = p
print(json.dumps({"resultados": saida}))
`;

const r = spawnSync("python3", ["-c", py, ...arquivos.map((f) => join(DIR, f))], {
  encoding: "utf8",
});

if (r.error || r.status !== 0) {
  console.error("Não foi possível rodar o analisador:", r.error?.message ?? r.stderr?.slice(0, 400));
  process.exit(2);
}

let dados;
try {
  dados = JSON.parse(r.stdout);
} catch {
  console.error("Saída do analisador ilegível:", r.stdout.slice(0, 300));
  process.exit(2);
}

if (dados.faltando) {
  console.error(
    "NÃO CONFERIDO: falta o `pglast` (parser real do PostgreSQL).\n" +
    "  Instale com `pip install pglast` e rode de novo.\n" +
    "  Isto NÃO é 'nenhum problema encontrado' — é 'ninguém procurou'.",
  );
  process.exit(2);
}

/**
 * O SQL que vai para as mãos do usuário tem de refletir as migrations.
 *
 * `scripts/catalogo/aplicar-no-supabase.sql` é gerado por concatenação, e é o
 * arquivo que alguém cola no painel do Supabase. Se uma migration for editada e
 * ninguém regerar, o que o usuário executa passa a descrever um estado que o
 * repositório não tem mais — e produção fica com um catálogo que nenhum arquivo
 * do projeto explica. Foi desse tipo de buraco que saiu o "Biocor" que a Braile
 * nunca vendeu.
 */
const gerado = spawnSync("node", ["scripts/catalogo/gerar-sql-de-aplicacao.mjs", "--conferir"], {
  encoding: "utf8",
});
if (gerado.status !== 0) {
  console.error("\n" + (gerado.stderr || gerado.stdout || "falha ao conferir o SQL de aplicação").trim());
  process.exit(1);
}
console.log(gerado.stdout.trim());

const ruins = dados.resultados.filter((r) => !r.ok);
for (const r of dados.resultados) {
  console.log(r.ok ? `✓ ${r.arquivo} — ${r.comandos} comando(s)` : `✗ ${r.arquivo}\n    ${r.erro}`);
}
console.log(`\n${dados.resultados.length - ruins.length} de ${dados.resultados.length} migrations analisadas sem erro de sintaxe.`);
process.exit(ruins.length ? 1 : 0);
