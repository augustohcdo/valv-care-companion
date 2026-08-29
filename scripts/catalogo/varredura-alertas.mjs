/**
 * Varredura de alerta regulatório, família por família, contra a base da FDA.
 *
 * ## Por que este script existe
 *
 * A tela do catálogo dizia, com data e tudo:
 *
 *     "Alertas regulatórios: conferidos em 2026-08-28 contra 3 fontes.
 *      1 modelo(s) com alerta que impede nova indicação;
 *      19 conferidos e sem alerta."
 *
 * Quem lê isso conclui que o catálogo inteiro passou por uma varredura. Não
 * passou: o catálogo tem **45 famílias**, e a lista `semAlerta` tinha 19. As
 * outras 25 nunca foram conferidas por ninguém, e a frase não dizia isso — ela
 * contava apenas o que tinha sido feito, sem contar o que faltava, que é a
 * forma mais comum de um relatório mentir sem escrever nada falso.
 *
 * Pior: a varredura original nasceu de um susto real. O catálogo indicava
 * ativamente a Abbott Trifecta GT, retirada do mercado em 2023 por deterioração
 * estrutural precoce. Uma varredura que cobre 42% das famílias e se apresenta
 * como completa é justamente o que deixaria o próximo caso passar.
 *
 * ## O que este script faz, e o que ele NÃO faz
 *
 * Consulta os dois bancos públicos da FDA para dispositivos — `device/recall`
 * (recolhimentos) e `device/enforcement` (ações de fiscalização) — por termo de
 * busca de cada família, e imprime **todo** achado com data, empresa e
 * descrição.
 *
 * O que ele **não** faz, de propósito: decidir se um achado impede nova
 * indicação. Essa classificação é de leitura humana e continua escrita à mão em
 * `VARREDURA_DE_ALERTAS`, porque a maioria dos achados é de **acessório ou
 * lote** — kit descartável da Perceval, sistema de entrega da Sapien — e não da
 * prótese. Um script que promovesse recolhimento de embalagem a "não indicar"
 * encheria a tela de alerta falso, e alerta falso treina o médico a ignorar
 * alerta.
 *
 * Também não faz o inverso: **silêncio da FDA não é ausência de alerta**. A base
 * é dos EUA; ANVISA, autoridade europeia e carta ao cliente do fabricante não
 * estão aqui. O que a tela pode afirmar é o que foi consultado e quando.
 *
 * ## Uso
 *
 *     node scripts/catalogo/varredura-alertas.mjs            # todas as famílias
 *     node scripts/catalogo/varredura-alertas.mjs Perceval   # só as que casam
 *
 * Precisa de `VITE_SUPABASE_PUBLISHABLE_KEY` no ambiente para ler o catálogo.
 */

const SUPABASE = "https://qwiojyfxzvdcfbbexyxg.supabase.co";
const CHAVE = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
if (!CHAVE) {
  console.error("Falta VITE_SUPABASE_PUBLISHABLE_KEY no ambiente.");
  process.exit(2);
}

const filtro = process.argv[2]?.toLowerCase();

const resp = await fetch(`${SUPABASE}/rest/v1/rpc/catalogo_proteses`, {
  method: "POST",
  headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json" },
  body: "{}",
});
if (!resp.ok) {
  console.error(`RPC do catálogo respondeu ${resp.status}.`);
  process.exit(2);
}
const linhas = await resp.json();

const familias = [...new Set(linhas.map((l) => `${l.manufacturer}|${l.model_name}`))].sort();

/**
 * O termo que vai para a FDA.
 *
 * O nome comercial sozinho erra dos dois lados: "Epic" acha qualquer coisa e
 * "Prótese de Pericárdio Bovino" não acha nada, porque a base é em inglês e
 * indexa o nome de registro. Onde o nome de catálogo não serve, o termo certo
 * fica escrito aqui, à mão, e não adivinhado.
 */
const TERMO = {
  "Braile|Prótese de Pericárdio Bovino": "Braile",
  "Braile|Vivere": "Braile",
  "Braile|Inovare Alpha": "Inovare",
  "Braile|Anel Rígido Braile": "Braile",
  "Braile|Anel Rígido Gregori": "Braile",
  "Abbott|Epic": "Epic Heart Valve",
  "Abbott|St. Jude Regent": "Regent",
  "Abbott|St. Jude Masters HP": "Masters HP",
  "Edwards|Cosgrove-Edwards Band (4600)": "Cosgrove",
  "Edwards|MC3 Tricuspid (4900)": "MC3",
  "Edwards|Physio Flex (5300)": "Physio Flex",
  "Edwards|Physio II (5200)": "Physio II",
  "Meril|Miltonia AP": "Miltonia",
  "Medtronic|Open Pivot": "Open Pivot",
  "Medtronic|CG Future": "CG Future",
};

const termoDe = (familia) => TERMO[familia] ?? familia.split("|")[1];

/** Uma consulta à openFDA, com o erro dito em vez de virar lista vazia. */
async function consultar(endpoint, termo) {
  const url =
    `https://api.fda.gov/device/${endpoint}.json` +
    `?search=${encodeURIComponent(`product_description:"${termo}"`)}&limit=20`;
  const r = await fetch(url);
  // 404 na openFDA significa "nenhum resultado", e é a resposta esperada para a
  // maioria das famílias. Qualquer outro código é falha de consulta, e falha de
  // consulta NÃO pode virar "nada encontrado" — seria a mesma mentira que este
  // arquivo inteiro combate.
  if (r.status === 404) return { achados: [] };
  if (!r.ok) return { erro: `HTTP ${r.status}` };
  const j = await r.json();
  return { achados: j.results ?? [] };
}

const relatorio = [];
let falhasDeConsulta = 0;

for (const familia of familias) {
  if (filtro && !familia.toLowerCase().includes(filtro)) continue;
  const termo = termoDe(familia);
  const fabricante = familia.split("|")[0];

  const achados = [];
  for (const endpoint of ["recall", "enforcement"]) {
    const { achados: as, erro } = await consultar(endpoint, termo);
    if (erro) {
      falhasDeConsulta++;
      console.log(`⚠ ${familia} — ${endpoint}: ${erro} (NÃO é "sem achado")`);
      continue;
    }
    for (const a of as) {
      // A base é global; sem filtrar por empresa, "Epic" traz recolhimento de
      // outro fabricante e o relatório passa a acusar a prótese errada.
      const empresa = a.recalling_firm ?? a.firm_name ?? "";
      const doFabricante =
        new RegExp(fabricante.split(" ")[0], "i").test(empresa) ||
        /sorin|livanova|st\.? jude|biocor/i.test(empresa);
      achados.push({
        endpoint,
        data: a.event_date_initiated ?? a.recall_initiation_date ?? "(sem data)",
        empresa,
        doFabricante,
        classe: a.product_res_number ?? a.recall_number ?? "",
        descricao: (a.product_description ?? "").replace(/\s+/g, " ").slice(0, 180),
        motivo: (a.reason_for_recall ?? "").replace(/\s+/g, " ").slice(0, 200),
      });
    }
  }

  const doFabricante = achados.filter((a) => a.doFabricante);
  relatorio.push({ familia, termo, achados: doFabricante, descartados: achados.length - doFabricante.length });

  const marca = doFabricante.length ? "●" : "·";
  console.log(`${marca} ${familia}  (termo "${termo}") — ${doFabricante.length} achado(s) do fabricante`);
  for (const a of doFabricante) {
    console.log(`     ${a.data}  ${a.empresa}`);
    console.log(`       ${a.descricao}`);
    if (a.motivo) console.log(`       motivo: ${a.motivo}`);
  }
}

console.log(
  `\n${relatorio.length} família(s) consultadas; ` +
  `${relatorio.filter((r) => r.achados.length).length} com achado do próprio fabricante.`,
);
if (falhasDeConsulta) {
  console.log(
    `\n${falhasDeConsulta} consulta(s) FALHARAM e não valem como "sem achado". ` +
    "Rode de novo antes de escrever qualquer coisa na tela a partir disto.",
  );
  process.exit(1);
}
console.log(
  "\nLeia os achados e classifique à mão em VARREDURA_DE_ALERTAS. Recolhimento de " +
  "acessório ou de lote NÃO é alerta que impede indicação.",
);
