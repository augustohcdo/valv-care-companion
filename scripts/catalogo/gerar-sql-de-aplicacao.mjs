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
  "20260905030000_semear_base_da_ia_sem_clique.sql",
];

const CABECALHO = `-- ===========================================================================
-- VALVEPATH — aplicação, ${new Date().toISOString().slice(0, 10)}
-- Semear a base da IA deixa de depender de um clique
-- ===========================================================================
--
-- Este arquivo é executado pelo workflow "Banco de dados" (Actions), com o
-- token que já está no cofre do GitHub. Não é mais preciso colar nada no
-- painel do Supabase.
--
-- É SEGURO RODAR DUAS VEZES: o segredo só é criado se não existir, e o próprio
-- seed pula trecho que já está na base.
--
-- O QUE ELE FAZ
--
-- Sete trechos da ESC/EACTS 2025 estão no código e não estão na base que a IA
-- consulta. Entrariam com um clique em Administração → Base da IA e FHIR — e é
-- esse clique que sai de cena.
--
-- O banco passa a chamar a função \`knowledge-seed\` sozinho, por \`pg_net\`, com
-- um segredo lido de \`internal_secrets\` — o mesmo mecanismo que o backup
-- semanal e o resumo administrativo já usam. A função aceita esse segredo sem
-- perder o caminho do administrador logado.
--
-- A tarefa se desagenda depois de rodar: é uma vez só, não um agendamento
-- esquecido no banco.
--
-- O QUE CONFERIR
--
-- O SELECT do fim roda ANTES de o seed terminar, então ele prova o que dá para
-- provar agora: segredo criado, URL base presente, tarefa na fila. A prova de
-- que os trechos entraram é a contagem de \`knowledge_chunks\` alguns minutos
-- depois — ou a faixa verde na tela de administração.
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
--   segredo_criado ....... 1  ← sem ele o banco não consegue chamar a função
--   url_base_existe ...... 1  ← sem ela a chamada não tem para onde ir
--   seed_agendado ........ 1  ← a tarefa entrou na fila
--   trechos_agora ........ 11 ← ainda os antigos; o seed roda no minuto seguinte
--
-- \`trechos_agora\` é o número ANTES do seed. A prova de que os sete novos
-- entraram vem depois: 18 nesta mesma contagem, ou a faixa verde na tela de
-- administração. Rodar isto e ver 11 não é falha — é o retrato do instante.

SELECT
  (SELECT count(*) FROM public.internal_secrets
    WHERE key = 'seed_cron_secret')              AS segredo_criado,
  (SELECT count(*) FROM public.internal_secrets
    WHERE key = 'functions_base_url')            AS url_base_existe,
  (SELECT count(*) FROM cron.job
    WHERE jobname = 'valvepath-seed-unico')      AS seed_agendado,
  (SELECT count(*) FROM public.knowledge_chunks) AS trechos_agora;
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
