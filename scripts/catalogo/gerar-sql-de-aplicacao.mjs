#!/usr/bin/env node
/**
 * Junta as migrations pendentes num arquivo só, para colar no SQL Editor.
 *
 * ## Por que este arquivo existe
 *
 * Neste projeto **nada aplica migration sozinho**. A CI só roda os checks, e o
 * DDL sempre entrou à mão por token da Management API, que esta sessão não tem.
 * O efeito prático é o pior possível: o código sabe de um catálogo que o banco
 * não tem, e a tela continua mostrando prótese que saiu do mercado enquanto três
 * migrations corretas dormem no repositório.
 *
 * A saída acordada com o usuário é ele mesmo colar o SQL no painel do Supabase.
 * Para isso o arquivo precisa ser um só, na ordem certa, e legível o bastante
 * para alguém decidir se roda.
 *
 * ## Por que GERADO, e não escrito à mão
 *
 * Porque um arquivo escrito à parte diverge das migrations no primeiro ajuste, e
 * aí produção passa a ter um estado que nenhum arquivo do projeto descreve —
 * exatamente o buraco de onde saiu a confusão do "Biocor" e a do 17 mm que não
 * existia. Aqui o arquivo colado É a concatenação das migrations, e o script
 * refaz isso a qualquer momento.
 *
 * ## O que o arquivo gerado tem além do SQL
 *
 * Um `SELECT` de conferência no fim. Sem ele o usuário cola, vê "Success" e não
 * tem como saber se o que ele queria — a Perimount fora do catálogo — aconteceu.
 * "Rodou sem erro" não é "fez o que devia".
 *
 * Uso:
 *   node scripts/catalogo/gerar-sql-de-aplicacao.mjs            # gera
 *   node scripts/catalogo/gerar-sql-de-aplicacao.mjs --conferir # só confere que está atualizado
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = "supabase/migrations";
const SAIDA = "scripts/catalogo/aplicar-no-supabase.sql";

/**
 * As migrations desta rodada, na ordem em que precisam rodar.
 *
 * Lista explícita, e não "tudo a partir de tal data": concatenar migrations
 * antigas que já estão aplicadas faria o arquivo tentar recriar o mundo, e
 * qualquer uma que não seja idempotente quebraria no meio, deixando o banco pela
 * metade. Quem entra aqui é escolhido a dedo e conferido como idempotente.
 */
const PENDENTES = [
  "20260830010000_catalogo_so_cirurgico.sql",
  "20260830020000_catalogo_imagens_e_novas.sql",
  "20260830030000_magna_ease_por_tamanho.sql",
  "20260830040000_mercado_brasileiro.sql",
];

const CABECALHO = `-- ===========================================================================
-- CATÁLOGO DE PRÓTESES — aplicação manual, ${new Date().toISOString().slice(0, 10)}
-- ===========================================================================
--
-- Cole ESTE ARQUIVO INTEIRO no SQL Editor do painel do Supabase e execute.
--
-- Ele é a concatenação, na ordem, das migrations que estão no repositório e
-- ainda não foram aplicadas. Não há pipeline que as aplique neste projeto: a CI
-- só roda os checks, e a chave service_role não executa DDL.
--
-- É SEGURO RODAR DUAS VEZES. Toda alteração é idempotente: as colunas usam
-- ADD COLUMN IF NOT EXISTS, as restrições ignoram duplicata, os INSERT têm
-- WHERE NOT EXISTS e os UPDATE são por fabricante e modelo, não por posição.
--
-- O QUE ELE FAZ, em uma linha cada:
--
--   1. separa os três motivos de uma prótese sair do catálogo — não existe,
--      é transcateter, ou saiu de linha — e cria a função referencia_historica()
--   2. aplica as 19 imagens oficiais conferidas uma a uma e cadastra Avalus
--      Ultra, Mosaic mitral e Epic Max
--   3. completa a Magna Ease de 2 para 5 tamanhos com EOA (Tsui 2022)
--   4. marca o registro brasileiro por família e cadastra Labcor e Cardioprótese
--
-- O QUE MUDA NA TELA: a Perimount e a Trifecta GT saem do catálogo e passam a
-- aparecer só na seção de referência histórica; as 10 famílias transcateter
-- somem; a Abbott "Epic" vira Epic Plus Supra e Epic Plus; entram os dois
-- fabricantes nacionais.
--
-- NO FIM há um SELECT de conferência. Olhe o resultado dele: "rodou sem erro"
-- não é a mesma coisa que "fez o que devia".
-- ===========================================================================

BEGIN;
`;

const RODAPE = `
COMMIT;

-- ===========================================================================
-- CONFERÊNCIA — o resultado abaixo é o que prova que deu certo
-- ===========================================================================
--
-- Esperado depois de rodar:
--   familias_ativas ....... 40   (36 do catálogo cirúrgico + 4 dos nacionais)
--   transcateter_ativas .... 0
--   sem_imagem ............. 0
--   fora_de_linha .......... 2   (Edwards Perimount e Abbott Trifecta GT)
--   perimount_no_catalogo .. 0   ← era isto que estava errado na tela

SELECT
  (SELECT count(DISTINCT manufacturer || '|' || model_name)
     FROM public.prosthesis_catalog WHERE active) AS familias_ativas,
  (SELECT count(*) FROM public.prosthesis_catalog
    WHERE active AND type::text = 'tavi') AS transcateter_ativas,
  (SELECT count(DISTINCT manufacturer || '|' || model_name)
     FROM public.prosthesis_catalog WHERE active AND image_url IS NULL) AS sem_imagem,
  (SELECT count(DISTINCT manufacturer || '|' || model_name)
     FROM public.prosthesis_catalog WHERE inactive_reason = 'fora_de_linha') AS fora_de_linha,
  (SELECT count(*) FROM public.prosthesis_catalog
    WHERE active AND model_name = 'Perimount') AS perimount_no_catalogo;
`;

const partes = [CABECALHO];
for (const nome of PENDENTES) {
  const caminho = join(DIR, nome);
  if (!existsSync(caminho)) {
    console.error(`Migration não encontrada: ${caminho}. Nada foi gerado.`);
    process.exit(1);
  }
  partes.push(
    `\n-- ---------------------------------------------------------------------------\n` +
    `-- ${nome}\n` +
    `-- ---------------------------------------------------------------------------\n\n` +
    readFileSync(caminho, "utf8").trimEnd() + "\n",
  );
}
partes.push(RODAPE);
const conteudo = partes.join("");

if (process.argv.includes("--conferir")) {
  // Modo usado pela guarda: o arquivo colado tem de refletir as migrations. Se
  // alguém editar uma migration e esquecer de regerar, o SQL entregue ao usuário
  // passa a descrever um estado que o repositório não tem mais.
  const atual = existsSync(SAIDA) ? readFileSync(SAIDA, "utf8") : "";
  // A data do cabeçalho muda todo dia; comparar o corpo é o que importa.
  const corpo = (t) => t.slice(t.indexOf("BEGIN;"));
  if (corpo(atual) !== corpo(conteudo)) {
    console.error(
      `${SAIDA} está desatualizado em relação às migrations.\n` +
      "Rode `node scripts/catalogo/gerar-sql-de-aplicacao.mjs` e commite o resultado.",
    );
    process.exit(1);
  }
  console.log(`✓ ${SAIDA} corresponde às ${PENDENTES.length} migrations pendentes.`);
  process.exit(0);
}

writeFileSync(SAIDA, conteudo);
console.log(`${SAIDA} gerado a partir de ${PENDENTES.length} migrations, ${conteudo.split("\n").length} linhas.`);
