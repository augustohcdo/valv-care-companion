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
  // As seis migrations do catálogo e da diretriz 2025 SAÍRAM daqui em 03/09,
  // depois de o usuário colar o SQL e a conferência sair 0 (17 de 17, 40
  // famílias, 9 colunas novas). Deixá-las na lista faria o próximo arquivo
  // pedir para reaplicar o que já está no banco — "pendente" tem de significar
  // pendente, senão a palavra não serve para nada. Elas continuam em
  // supabase/migrations/ para quem reconstruir o banco do zero.
  "20260903010000_encerramento_tabelas_restantes.sql",
];

const CABECALHO = `-- ===========================================================================
-- VALVEPATH — aplicação manual, ${new Date().toISOString().slice(0, 10)}
-- Encerramento de conta: as tabelas que ficavam para trás
-- ===========================================================================
--
-- Cole ESTE ARQUIVO INTEIRO no SQL Editor do painel do Supabase e execute.
--
-- É SEGURO RODAR DUAS VEZES: a única alteração é um CREATE OR REPLACE FUNCTION.
-- Nenhuma linha de dado é tocada AGORA — o que muda é o que vai acontecer no
-- PRÓXIMO encerramento de conta.
--
-- O QUE ELE FAZ
--
-- Uma varredura mostrou que 14 tabelas guardam \`user_id\` e a função de
-- encerramento tocava 5. Das nove restantes, quatro sobrevivem por decisão
-- registrada (trilha de auditoria, histórico de consentimento, prova de
-- consentimento e a base de reidentificação do DPO). As outras cinco passam a
-- ter destino:
--
--   APAGAR      user_roles       — papel de acesso não sobrevive ao titular.
--                                  Não é LGPD, é segurança: conta encerrada
--                                  continuava carregando o papel, inclusive admin
--               hospital_members — vínculo com hospital, sem função sem titular
--
--   ANONIMIZAR  access_requests  — a decisão administrativa fica; nome, e-mail,
--                                  telefone e CRM saem
--               dpo_requests     — o pedido é a PROVA de que o direito foi
--                                  exercido e atendido, então não se apaga;
--                                  o CPF, o nome e o e-mail saem
--               client_errors    — o erro serve de estatística; o vínculo com a
--                                  pessoa, não. Só o user_id é solto
--
-- O restante da função continua idêntico: pseudonimização do prontuário, limpeza
-- da camada de conta, revogação de autorizações e o registro em audit_logs.
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
-- Esperado: TODAS as colunas com valor 1. Zero em qualquer uma significa que a
-- função não ficou com aquele tratamento — e aí o encerramento seguinte deixaria
-- aquela tabela para trás de novo, em silêncio.

WITH def AS (
  SELECT pg_get_functiondef(p.oid) AS src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'encerrar_conta'
   LIMIT 1
)
SELECT
  (SELECT count(*) FROM def)                                                        AS funcao_encontrada,
  (SELECT count(*) FROM def WHERE src ILIKE '%delete from public.user_roles%')       AS apaga_papeis,
  (SELECT count(*) FROM def WHERE src ILIKE '%delete from public.hospital_members%') AS apaga_vinculos,
  (SELECT count(*) FROM def WHERE src ILIKE '%update public.access_requests%')       AS anonimiza_pedidos,
  (SELECT count(*) FROM def WHERE src ILIKE '%requester_cpf = null%')                AS anonimiza_dpo,
  (SELECT count(*) FROM def WHERE src ILIKE '%client_errors set user_id = null%')    AS anonimiza_erros,
  -- Contraprova: o pedido ao DPO NÃO pode ser apagado. Esta coluna tem de vir 0.
  (SELECT count(*) FROM def WHERE src ILIKE '%delete from public.dpo_requests%')     AS dpo_apagado_deve_ser_zero;
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
