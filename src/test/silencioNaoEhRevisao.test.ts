/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { arquivosDeCodigo } from "./astDeChamadas";
import { semComentariosDeCodigo } from "./semComentariosDeCodigo";

/**
 * Silêncio não é revisão médica.
 *
 * ## O defeito, medido
 *
 * `review_status` admite TRÊS valores — `reviewed`, `ai_generated`, `pending` —
 * e os dois lugares que avisam o leitor condicionavam o aviso a
 * `=== "ai_generated"`:
 *
 *   · `ClinicalAIPanel` só marcava "· gerado por IA · base em diretriz" para
 *     `ai_generated`;
 *   · `DocumentGenerator` só listava como PRELIMINAR as fontes `ai_generated` —
 *     num documento cujo cabeçalho afirma que as listadas são as preliminares,
 *     e que é o documento que um médico assina.
 *
 * E `knowledge_sources.review_status` tem **`DEFAULT 'pending'`**. Quer dizer:
 * uma fonte inserida sem estado explícito — o caso normal — saía sem aviso no
 * painel e fora da lista de preliminares do documento, exatamente como uma
 * revisada por médico com CRM.
 *
 * `pending` quer dizer, nas palavras do próprio selo desta base, "cadastrado,
 * ainda não revisado".
 *
 * Medido em produção quando isto foi escrito: as 5 fontes estão `ai_generated`,
 * `content_review_status` está vazia. Alcance zero hoje — e garantido pelo
 * padrão da coluna no próximo insert.
 *
 * ## Por que a regra é pela garantia, e não pelo valor
 *
 * `Referencias.tsx` já escreveu o princípio, sobre a própria página:
 *
 *   > "A frase sobre revisão médica FICA, e não depende de nome nenhum. (…)
 *   >  silêncio nesse ponto é lido como 'revisado' — o mesmo engano do selo,
 *   >  por omissão."
 *
 * Então: a marcação sai para tudo que NÃO É exatamente `reviewed`. Comparar com
 * `ai_generated` é amarrar a garantia a um vocabulário de três palavras que já
 * tem uma quarta por omissão — e esta sessão trocou vocabulário por garantia
 * várias vezes pelo mesmo motivo.
 *
 * `AdminConteudo` já fazia certo, e serve de modelo: `revisado ? "reviewed" :
 * "ai_generated"` mapeia tudo que não é revisado para o selo vermelho.
 *
 * ## O que esta guarda NÃO cobre
 *
 * Ela não confere se o aviso aparece na TELA — isso é teste de componente, e os
 * dois arquivos têm os seus. Ela confere que nenhuma decisão de MOSTRAR OU
 * OMITIR aviso de revisão é tomada comparando com `ai_generated`.
 */

const RAIZES = ["src", "supabase/functions"];

/** A comparação proibida, em aspas simples ou duplas. */
const COMPARACAO_PROIBIDA = /review_status\s*(===|==|!==|!=)\s*["']ai_generated["']/g;

/**
 * Arquivos que podem comparar com `ai_generated`, com o motivo.
 *
 * Vazio, e é o estado a defender. Para acrescentar uma entrada, escreva por que
 * ali o valor específico importa mais do que a garantia "não é `reviewed`".
 */
const PODEM_COMPARAR: Record<string, string> = {};

const arquivos = arquivosDeCodigo(RAIZES);

interface Achado { arquivo: string; linha: number; trecho: string }
const achados: Achado[] = [];
for (const arquivo of arquivos) {
  // Sem comentário: este arquivo e os dois consertados EXPLICAM a comparação
  // proibida em prosa, e guarda que lê comentário não confere código.
  const limpo = semComentariosDeCodigo(readFileSync(arquivo, "utf8"), arquivo);
  for (const m of limpo.matchAll(COMPARACAO_PROIBIDA)) {
    achados.push({
      arquivo,
      linha: limpo.slice(0, m.index).split("\n").length,
      trecho: m[0],
    });
  }
}

describe("silêncio não é revisão médica", () => {
  it("nenhuma decisão de aviso compara `review_status` com `ai_generated`", () => {
    const culpados = achados
      .filter((a) => !(a.arquivo in PODEM_COMPARAR))
      .map((a) => `  · ${a.arquivo}:${a.linha} — ${a.trecho}`);
    expect(
      culpados,
      `\n${culpados.join("\n")}\n\n` +
        "`review_status` tem TRÊS valores, e `knowledge_sources` nasce com\n" +
        "`DEFAULT 'pending'`. Comparar com `ai_generated` deixa a fonte `pending`\n" +
        "— não revisada — sair sem aviso, igual a uma revisada por médico com\n" +
        "CRM.\n\n" +
        "Compare com a GARANTIA: `!== \"reviewed\"`. Só esse valor significa\n" +
        "revisado, e o selo desta base chama `pending` de \"cadastrado, ainda não\n" +
        "revisado\".\n\n" +
        "`AdminConteudo` é o modelo: `revisado ? \"reviewed\" : \"ai_generated\"`.",
    ).toEqual([]);
  });

  it("os dois lugares que avisam continuam comparando com `reviewed`", () => {
    /**
     * Nominal, além da regra geral. A regra proíbe a comparação errada; esta
     * cobra que a certa esteja lá. Sem ela, apagar o aviso inteiro passaria —
     * não haveria comparação proibida porque não haveria comparação nenhuma.
     */
    const painel = semComentariosDeCodigo(
      readFileSync("src/components/ClinicalAIPanel.tsx", "utf8"), "ClinicalAIPanel.tsx",
    );
    expect(
      painel,
      "o painel da IA deixou de marcar a fonte não revisada",
    ).toMatch(/review_status\s*!==\s*"reviewed"/);

    const documento = semComentariosDeCodigo(
      readFileSync("src/components/DocumentGenerator.tsx", "utf8"), "DocumentGenerator.tsx",
    );
    expect(
      documento,
      "o gerador de documento deixou de listar a fonte não revisada como preliminar",
    ).toMatch(/review_status\s*!==\s*"reviewed"/);
  });

  it("a instrução do modelo cobra o estado por exclusão, não por valor", () => {
    /**
     * O terceiro sítio, e o mais fácil de esquecer: a instrução do sistema
     * imprimia "(revisão: X)" com o valor cru e só mandava marcar o trecho
     * `ai_generated`. Um trecho `pending` chegava ao modelo com um estado sobre
     * o qual ele nunca foi instruído — e a leitura segura, "não me disseram
     * para avisar", é a perigosa.
     */
    const fonte = semComentariosDeCodigo(
      readFileSync("supabase/functions/clinical-ai/index.ts", "utf8"), "index.ts",
    );
    const i = fonte.indexOf("(revisão: X)");
    expect(i, "não achei a instrução sobre o estado de revisão").toBeGreaterThan(0);
    const instrucao = fonte.slice(i, i + 900);
    expect(
      instrucao,
      'a instrução precisa dizer que só o valor exato "reviewed" conta',
    ).toMatch(/exato "reviewed"/);
    expect(
      instrucao,
      "a instrução precisa cobrir o valor desconhecido, não só `pending`",
    ).toMatch(/não reconheça|nao reconheca/);
  });

  it("toda dispensa aponta para arquivo que de fato compara", () => {
    for (const [arquivo, motivo] of Object.entries(PODEM_COMPARAR)) {
      expect(motivo.length, `a dispensa de ${arquivo} não tem motivo escrito`).toBeGreaterThan(40);
      expect(
        achados.map((a) => a.arquivo),
        `${arquivo} está dispensado e não compara mais — tire a dispensa`,
      ).toContain(arquivo);
    }
  });

  it("os pisos: a varredura leu o projeto e o padrão da coluna segue sendo `pending`", () => {
    expect(arquivos.length, "a varredura achou quase nada").toBeGreaterThan(200);
    /**
     * A PREMISSA remedida. A regra existe porque `knowledge_sources` nasce
     * `pending`. Se algum dia o padrão virar `ai_generated`, a regra continua
     * certa — há três valores e um deles não é revisão —, mas o motivo escrito
     * aqui envelhece, e motivo envelhecido é o que faz a próxima pessoa
     * desligar a guarda.
     */
    const migration = readFileSync(
      "supabase/migrations/20260719140621_a1588dff-7fa0-4593-bdb3-beec7c197416.sql", "utf8",
    );
    expect(
      migration,
      "o padrão de `review_status` mudou — reconfira o motivo escrito nesta guarda",
    ).toMatch(/review_status TEXT NOT NULL DEFAULT 'pending'/);
    expect(
      migration,
      "o CHECK de `review_status` mudou de valores — a regra fala de três",
    ).toMatch(/review_status IN \('pending', 'reviewed', 'ai_generated'\)/);
  });
});
