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
 * `PENDENTES` é exportado porque o `conferir-publicacao.mjs` precisa dizer ao
 * usuário QUAIS migrations estão esperando. Ele repetia a lista à mão e
 * envelheceu em silêncio: dizia "as três migrations de 30/08" quando já eram
 * cinco. Lista repetida diverge; lista derivada não tem como.
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
export const PENDENTES = [
  // Tudo o que veio antes SAIU desta lista assim que o usuário colou e
  // confirmou — as seis do catálogo e da diretriz 2025 em 03/09, as duas do
  // encerramento e do mercado em 04/09. "Pendente" tem de significar pendente,
  // senão o arquivo pede para reaplicar o que já está no banco e a palavra
  // deixa de servir. Todas continuam em supabase/migrations/ para quem
  // reconstruir o banco do zero.
  "20260904120000_fontes_da_ia_na_diretriz_2025.sql",
];

const CABECALHO = `-- ===========================================================================
-- VALVEPATH — aplicação manual, ${new Date().toISOString().slice(0, 10)}
-- As fontes que a IA clínica cita
-- ===========================================================================
--
-- Cole ESTE ARQUIVO INTEIRO no SQL Editor do painel do Supabase e execute.
--
-- É SEGURO RODAR DUAS VEZES: um INSERT com ON CONFLICT e dois UPDATE
-- idempotentes. Nenhum dado de paciente é tocado.
--
-- DEPOIS DE RODAR: abra /app/admin/fhir (Base de conhecimento) e clique em
-- popular a base. Sem a linha de 2025 que este SQL cria, a função de seed pula
-- os sete trechos novos.
--
-- O QUE ELE FAZ
--
-- 1) CADASTRA A ESC/EACTS 2025 COMO FONTE
--
-- O motor de conduta passou para a diretriz de 2025 em 02/09. A base de trechos
-- que a IA consulta — que o próprio prompt chama de "a camada de maior peso para
-- conduta" — continuou em 2021. Na mesma tela do caso, o painel dizia
-- "ESC/EACTS 2025" e a IA respondia pela edição anterior, com TAVI a partir de
-- 75 anos (hoje 70) e estenose muito grave a Vmax 5,5 m/s (hoje 5,0).
--
-- Quem achou foi o senhor: "a parte médica ainda está desatualizada com a
-- diretriz antiga". Estava, em cinco camadas — esta é a que mora no banco.
--
-- 2) CORRIGE UMA CITAÇÃO QUE NINGUÉM PODIA CONFERIR
--
-- A fonte brasileira estava cadastrada como "SBC 2024", com a citação
-- \`Arq Bras Cardiol. 2024;122(5):e20240001\` — volume, fascículo e identificador
-- de artigo, tudo com aparência de conferido. Procurando essa edição para
-- citá-la direito, duas buscas (uma restrita ao site do próprio periódico)
-- encontram a linhagem 2011 → 2017 → 2020 e NENHUMA de 2024.
--
-- Busca não prova ausência, e o senhor resolve isto num segundo. Mas número de
-- fascículo inventado é exatamente o defeito que o \`npm run pmids\` existe para
-- impedir, e ele estava na tabela que alimenta as respostas da IA. Fica a edição
-- apontável: Arq Bras Cardiol. 2020;115(4):720-775.
--
-- SE EXISTIR MESMO UMA EDIÇÃO DE 2024, me diga e eu devolvo o rótulo — com a
-- citação real, não com a que estava lá.
--
-- 3) MARCA A ESC/EACTS 2021 COMO SUPERADA, SEM APAGÁ-LA
--
-- Decisão sua: manter 2021 onde 2025 não trouxe novidade. Diretriz antiga não é
-- informação falsa; apresentá-la como vigente é. A descrição passa a dizer isso,
-- porque é o texto que acompanha o trecho recuperado na resposta.
`;

const RODAPE = `
COMMIT;

-- ===========================================================================
-- CONFERÊNCIA — o resultado abaixo é o que prova que deu certo
-- ===========================================================================
--
-- "Success. No rows returned" não é prova de nada. O SELECT abaixo é.
--
-- Esperado:
--   fonte_2025_cadastrada ........ 1  ← sem isto o seed pula os sete trechos novos
--   sbc_com_edicao_apontavel ..... 1  ← ano 2020 e a citação com páginas reais
--   sbc_citacao_inventada ........ 0  ← a de 2024 com fascículo que não se acha
--   esc2021_marcada_superada ..... 1  ← fica na base, sem passar por vigente
--
-- Qualquer coluna fora disso significa que aquela parte NÃO foi aplicada.

SELECT
  (SELECT count(*) FROM public.knowledge_sources
    WHERE slug = 'esc-eacts-2025-vhd' AND year = 2025)                 AS fonte_2025_cadastrada,
  (SELECT count(*) FROM public.knowledge_sources
    WHERE slug = 'sbc-valvopatias-2024'
      AND year = 2020
      AND citation LIKE '%115(4):720-775%')                            AS sbc_com_edicao_apontavel,
  -- Contraprova: a citação inventada não pode ter sobrado em lugar nenhum.
  (SELECT count(*) FROM public.knowledge_sources
    WHERE citation LIKE '%2024;122(5)%')                               AS sbc_citacao_inventada,
  (SELECT count(*) FROM public.knowledge_sources
    WHERE slug = 'esc-eacts-2021-vhd'
      AND description ILIKE '%SUPERADA%')                              AS esc2021_marcada_superada;
`;

// O corpo abaixo só roda quando o script é EXECUTADO. Importado — que é como o
// `conferir-publicacao.mjs` pega a lista — ele não pode escrever arquivo nenhum.
const executando = process.argv[1]?.endsWith("gerar-sql-de-aplicacao.mjs");

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

if (executando && process.argv.includes("--conferir")) {
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

if (executando) {
  writeFileSync(SAIDA, conteudo);
  console.log(`${SAIDA} gerado a partir de ${PENDENTES.length} migrations, ${conteudo.split("\n").length} linhas.`);
}
