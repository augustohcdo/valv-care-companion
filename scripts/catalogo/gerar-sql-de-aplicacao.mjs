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
  // Tudo o que veio antes saiu desta lista assim que foi aplicado — as seis do
  // catálogo e da diretriz 2025 em 03/09, as duas do encerramento e do mercado
  // em 04/09, e a do seed sem clique em 05/09, esta última pelo workflow
  // "Banco de dados" (a saída trouxe `segredo_criado: 1, seed_agendado: 1`).
  //
  // "Pendente" tem de significar pendente. A do seed ficou aqui depois de
  // aplicada e o arquivo gerado passou a pedir que a reaplicassem — inofensivo,
  // porque é idempotente, mas a palavra tinha deixado de servir. É o mesmo
  // defeito que esta lista já teve em 03/09.
  //
  // Todas continuam em supabase/migrations/ para quem reconstruir o banco.
  "20260906160000_sbc_2020_confirmada_com_doi.sql",
];

/**
 * O texto e a conferência DESTA rodada — ao lado da lista, de propósito.
 *
 * Estavam soltos, em duas constantes lá embaixo. Ao trocar `PENDENTES` por uma
 * migration nova, o arquivo gerado saía com o cabeçalho da rodada ANTERIOR
 * ("Semear a base da IA deixa de depender de um clique") e, pior, com o `SELECT`
 * de conferência da anterior — que provaria a coisa errada e ainda pareceria
 * prova. Aconteceu comigo nesta mesma sessão, uma vez já corrigida.
 *
 * Aqui os três andam juntos: quem mexe na lista tropeça no texto e na
 * conferência na mesma tela. Não impede o esquecimento, mas encurta a distância
 * entre o que muda e o que precisa mudar junto.
 */
const RODADA = {
  titulo: "A diretriz brasileira: confirmada como 2020, com DOI e link do artigo",
  resumo: `-- A linha da SBC em \`knowledge_sources\` tinha o ano certo e uma URL inútil:
-- apontava para \`https://abccardiol.org/\`, a home do periódico. Link que não
-- leva ao documento não serve de fonte — quem clicasse para conferir caía numa
-- lista de artigos.
--
-- A confirmação que o usuário pediu foi feita: quatro buscas independentes
-- (SciELO, PubMed, o domínio do próprio periódico e o portal de diretrizes da
-- SBC) e NENHUMA diretriz de valvopatias posterior a 2020. O portal lista
-- diretrizes de 2025 e 2026 de outros temas. Um artigo chamado "Nova diretriz
-- de valvopatias da SBC", que parecia contradizer tudo, é de 2011.
--
-- O DOI foi resolvido, não copiado: 10.36660/abc.20201047 leva a Tarasoutchi et
-- al., Arq Bras Cardiol 2020;115(4):720-775 — confere com o que já estava
-- gravado.`,
  conferencia: `-- Esperado:
--   ano .................. 2020
--   citacao_tem_doi ...... true   ← sem o DOI ninguém confere a citação
--   url_leva_ao_artigo ... true   ← a home do periódico não é fonte
--   trechos_da_sbc ....... 12     ← o slug não mudou, então nenhum trecho se perdeu

SELECT
  year                                             AS ano,
  citation LIKE '%10.36660/abc.20201047%'          AS citacao_tem_doi,
  url LIKE '%doi.org/10.36660%'                    AS url_leva_ao_artigo,
  (SELECT count(*) FROM public.knowledge_chunks c
    WHERE c.source_id = s.id)                      AS trechos_da_sbc
FROM public.knowledge_sources s
WHERE slug = 'sbc-valvopatias-2024';`,
};

/**
 * Quando não há migration pendente, o arquivo não pode continuar descrevendo a
 * última rodada — era o que aconteceria: cabeçalho e rodapé falavam do seed, e
 * um arquivo vazio de DDL com aquele texto anunciaria trabalho que não existe.
 *
 * O `select` no fim não é enfeite: o workflow "Banco de dados" pode ser
 * disparado com este arquivo a qualquer momento, e um `.sql` sem comando
 * nenhum faz a API de gestão devolver erro. Melhor devolver a frase.
 */
const NADA_PENDENTE = `-- ===========================================================================
-- VALVEPATH — nada pendente, ${new Date().toISOString().slice(0, 10)}
-- ===========================================================================
--
-- Este arquivo é gerado a partir de \`PENDENTES\`, em
-- scripts/catalogo/gerar-sql-de-aplicacao.mjs. A lista está VAZIA: toda
-- migration do repositório já foi aplicada em produção.
--
-- Não é um arquivo para rodar — é o registro de que não há o que rodar. Se
-- alguém o executar pelo workflow "Banco de dados", a resposta abaixo diz
-- exatamente isso, em vez de um erro de SQL vazio.
--
-- Quando entrar migration nova: acrescente o nome em \`PENDENTES\`, rode
-- \`node scripts/catalogo/gerar-sql-de-aplicacao.mjs\` e commite o resultado.
-- A CI reprova se este arquivo divergir da lista.

select 'nada pendente' as situacao,
       'toda migration do repositorio ja foi aplicada' as observacao;
`;

const CABECALHO = `-- ===========================================================================
-- VALVEPATH — aplicação, ${new Date().toISOString().slice(0, 10)}
-- ${RODADA.titulo}
-- ===========================================================================
--
-- Este arquivo é executado pelo workflow "Banco de dados" (Actions), com o
-- token que já está no cofre do GitHub. Não é preciso colar nada no painel.
--
-- É SEGURO RODAR DUAS VEZES: toda migration que entra nesta lista é conferida
-- como idempotente antes de entrar.
--
-- O QUE ELE FAZ
--
${RODADA.resumo}
`;

const RODAPE = `
-- ===========================================================================
-- CONFERÊNCIA — o resultado abaixo é o que prova que deu certo
-- ===========================================================================
--
-- "Success. No rows returned" não é prova de nada. O SELECT abaixo é.
--
${RODADA.conferencia}
`;

// O corpo abaixo só roda quando o script é EXECUTADO. Importado — que é como o
// `conferir-publicacao.mjs` pega a lista — ele não pode escrever arquivo nenhum.
const executando = process.argv[1]?.endsWith("gerar-sql-de-aplicacao.mjs");

let conteudo;
if (PENDENTES.length === 0) {
  conteudo = NADA_PENDENTE;
} else {
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
  conteudo = partes.join("");
}

/**
 * O corpo, sem a linha de data — ela muda todo dia e não diz nada sobre as
 * migrations.
 *
 * A versão anterior recortava a partir de `BEGIN;`. Quando a lista esvaziou,
 * `BEGIN;` deixou de existir no arquivo, `indexOf` devolveu −1 e `slice(-1)`
 * passou a comparar **o último caractere** dos dois lados — que é `\n` em
 * ambos. A guarda continuaria verde com qualquer conteúdo no arquivo.
 *
 * Guarda cuja âncora some junto com o conteúdo que ela deveria vigiar para de
 * vigiar em silêncio, e no melhor momento para não se notar: quando não há mais
 * nada pendente. Agora o recorte é por remoção da linha de data, que não
 * depende de o arquivo ter DDL.
 */
const corpo = (t) => t.split("\n").filter((l) => !/^-- VALVEPATH — .*\d{4}-\d{2}-\d{2}$/.test(l)).join("\n");

if (executando && process.argv.includes("--conferir")) {
  // Modo usado pela guarda: o arquivo entregue tem de refletir as migrations. Se
  // alguém editar uma migration e esquecer de regerar, o SQL passa a descrever
  // um estado que o repositório não tem mais.
  const atual = existsSync(SAIDA) ? readFileSync(SAIDA, "utf8") : "";
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
