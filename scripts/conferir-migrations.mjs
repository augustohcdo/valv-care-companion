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
except ImportError:
    print(json.dumps({"faltando": True})); sys.exit(0)
saida = []
for caminho in sys.argv[1:]:
    with open(caminho, encoding="utf-8") as f:
        sql = f.read()
    try:
        n = len(pglast.parse_sql(sql))
        saida.append({"arquivo": caminho, "ok": True, "comandos": n})
    except Exception as e:
        saida.append({"arquivo": caminho, "ok": False, "erro": str(e)})
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

const ruins = dados.resultados.filter((r) => !r.ok);
for (const r of dados.resultados) {
  console.log(r.ok ? `✓ ${r.arquivo} — ${r.comandos} comando(s)` : `✗ ${r.arquivo}\n    ${r.erro}`);
}
console.log(`\n${dados.resultados.length - ruins.length} de ${dados.resultados.length} migrations analisadas sem erro de sintaxe.`);
process.exit(ruins.length ? 1 : 0);
