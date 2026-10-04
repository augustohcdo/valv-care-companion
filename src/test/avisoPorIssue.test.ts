/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  decidirAviso, assinaturaDoCorpo, diferencas, corpoDaIssue, textoDoComentario,
} from "../../.github/scripts/avisoPorIssue.mjs";

/**
 * O aviso que virou ruído.
 *
 * ## O que aconteceu
 *
 * A agenda diária reprovou **oito dias seguidos** pela mesma causa — duas
 * *Variables* do repositório que ainda não foram configuradas — e o passo de
 * aviso comentou na issue todos os dias:
 *
 *     2026-10-02  "Reprovou de novo."
 *     2026-10-03  "Reprovou de novo."
 *     2026-10-04  "Reprovou de novo."
 *
 * Dezoito comentários idênticos, nenhum deles dizendo O QUE reprovou. Quem
 * quisesse saber se algo NOVO quebrou tinha de abrir cada execução.
 *
 * E o cabeçalho do próprio workflow já havia escrito o princípio, ao decidir
 * reaproveitar a mesma issue em vez de abrir uma por dia:
 *
 *   > "uma pilha de seis issues idênticas é outro jeito de não avisar"
 *
 * A mesma frase, em forma de comentário. A lição estava escrita no arquivo e
 * aplicada à issue; faltava no comentário dela.
 *
 * ## O que esta guarda cobra
 *
 * Que a decisão seja a de três situações distintas, e não a de duas:
 * conjunto NOVO de vereditos → comenta dizendo o que mudou; conjunto IGUAL →
 * atualiza o corpo e cala; voltou a passar → fecha.
 *
 * E que ela seja testável: estava como texto dentro de `script: |` no YAML,
 * onde nenhum teste alcança. Agora mora em `.github/scripts/avisoPorIssue.mjs`,
 * pelo mesmo motivo que o caminho do Chromium e o limiar de tela vazia saíram
 * dos arquivos onde estavam.
 */

const ONTEM = [
  "Porta de entrada (turnstile-config)=2",
  "Rotas do site publicado (smoke)=0",
  "Estado publicado (publicacao)=2",
  "Citações PubMed (pmids)=0",
  "Links MMCTS (mmcts)=0",
  "Calculadoras no navegador=2",
].join("\n");

const comCorpo = (assinatura: string | null, numero = 3) => ({
  number: numero,
  body: assinatura === null
    ? "corpo antigo, de antes desta mudança"
    : corpoDaIssue({ assinatura, link: "https://exemplo/1", tabela: "" }),
});

describe("o aviso por issue", () => {
  it("dia igual ao anterior: atualiza o corpo e NÃO comenta", () => {
    /**
     * O defeito. Oito dias de "Reprovou de novo" idêntico treinaram quem lê a
     * ignorar a issue — e quando a divergência de verdade aparecer, ninguém vai
     * olhar.
     */
    const d = decidirAviso({ falhou: true, assinatura: ONTEM, issue: comCorpo(ONTEM) });
    expect(d.acao, "comentou sobre um dia idêntico ao anterior").toBe("atualizar");
    expect(d.numero).toBe(3);
  });

  it("conjunto NOVO: comenta, e diz o que mudou", () => {
    const hoje = ONTEM.replace("Links MMCTS (mmcts)=0", "Links MMCTS (mmcts)=1");
    const d = decidirAviso({ falhou: true, assinatura: hoje, issue: comCorpo(ONTEM) });
    expect(d.acao).toBe("comentar");
    expect(d.mudancas).toHaveLength(1);
    expect(
      d.mudancas![0],
      "o comentário precisa nomear a conferência e os dois estados — era isso que " +
        "faltava em 'Reprovou de novo'",
    ).toContain("Links MMCTS (mmcts)");
    expect(d.mudancas![0]).toMatch(/era .*ok.*agora.*DIVERGE/);
  });

  it("uma que VOLTOU a passar também é mudança", () => {
    // Avisar só sobre piora deixaria a issue dizendo que algo falha depois de
    // ter parado de falhar — e o corpo é o que a pessoa lê.
    const hoje = ONTEM.replace("Estado publicado (publicacao)=2", "Estado publicado (publicacao)=0");
    const d = decidirAviso({ falhou: true, assinatura: hoje, issue: comCorpo(ONTEM) });
    expect(d.acao).toBe("comentar");
    expect(d.mudancas![0]).toMatch(/Estado publicado.*NÃO CONFERIDO.*ok/);
  });

  it("conferência que SAI da lista aparece no comentário", () => {
    // Sumir em silêncio é a pilha de avisos idênticos ao contrário: a lista
    // encolhe e o resumo passa a falar de menos coisas sem dizer que encolheu.
    const hoje = ONTEM.split("\n").filter((l) => !l.startsWith("Links MMCTS")).join("\n");
    const d = decidirAviso({ falhou: true, assinatura: hoje, issue: comCorpo(ONTEM) });
    expect(d.acao).toBe("comentar");
    expect(d.mudancas!.join("\n")).toMatch(/Links MMCTS.*saiu da lista/);
  });

  it("sem issue aberta, cria", () => {
    expect(decidirAviso({ falhou: true, assinatura: ONTEM, issue: null }).acao).toBe("criar");
  });

  it("voltou a passar: fecha a issue, e sem issue não faz nada", () => {
    // A issue aberta tem de significar "está quebrado AGORA". Deixá-la aberta
    // depois de consertado ensina a ignorar issue — e é o que já está escrito
    // no cabeçalho do workflow.
    expect(decidirAviso({ falhou: false, assinatura: ONTEM, issue: comCorpo(ONTEM) }))
      .toEqual({ acao: "fechar", numero: 3 });
    expect(decidirAviso({ falhou: false, assinatura: ONTEM, issue: null }).acao).toBe("nada");
  });

  it("issue SEM marcador comenta uma vez — não sei não é era igual", () => {
    /**
     * A issue #3 foi aberta antes desta mudança e não tem assinatura no corpo.
     * Tratar ausência de marcador como "igual ao de hoje" engoliria a primeira
     * mudança depois da atualização — a mesma confusão entre "não sei" e "está
     * tudo bem" que esta base separa em todo script com a saída 2.
     */
    const d = decidirAviso({ falhou: true, assinatura: ONTEM, issue: comCorpo(null) });
    expect(d.acao).toBe("comentar");
    expect(d.primeiraVez).toBe(true);
    // O texto quebra em linhas; a asserção normaliza em vez de depender de
    // onde a quebra caiu — asserção amarrada à largura da linha reprova quem
    // reformatou o parágrafo.
    const umaLinha = textoDoComentario({ ...d, link: "https://exemplo/9" }).replace(/\s+/g, " ");
    expect(umaLinha).toMatch(/só aparece quando o conjunto de vereditos mudar/);
  });
});

describe("a assinatura", () => {
  it("vai e volta pelo corpo da issue", () => {
    const corpo = corpoDaIssue({ assinatura: ONTEM, link: "https://exemplo/1", tabela: "" });
    expect(assinaturaDoCorpo(corpo)).toBe(ONTEM);
  });

  it("corpo sem marcador devolve `null`, e não string vazia", () => {
    // `null` e `""` precisam ser distinguíveis: o primeiro é "não sei o que
    // havia", o segundo seria "havia um conjunto vazio".
    expect(assinaturaDoCorpo("qualquer texto")).toBeNull();
    expect(assinaturaDoCorpo("")).toBeNull();
    expect(assinaturaDoCorpo(undefined)).toBeNull();
  });

  it("o corpo leva a tabela de hoje, e o rodapé explica o silêncio", () => {
    const corpo = corpoDaIssue({
      assinatura: ONTEM,
      link: "https://exemplo/7",
      tabela: "| Links MMCTS (mmcts) | ✅ ok |",
    });
    expect(corpo).toContain("| Verificação | Estado |");
    expect(corpo).toContain("Links MMCTS (mmcts)");
    expect(
      corpo.replace(/\s+/g, " "),
      "quem abre a issue precisa saber que o silêncio é deliberado",
    ).toMatch(/só aparece quando o conjunto de vereditos muda/);
  });

  it("linha malformada não vira conferência fantasma", () => {
    expect(diferencas("=5", "Porta=2")).toEqual([
      "- **Porta** — nova nesta execução: ⚠️ NÃO CONFERIDO",
    ]);
  });
});

describe("o workflow usa a decisão, e não uma segunda cópia dela", () => {
  const yml = readFileSync(".github/workflows/verificacoes-periodicas.yml", "utf8");

  it("a assinatura é escrita para TODA conferência, inclusive as que passam", () => {
    // Se só as que falham entrassem na assinatura, "voltou a passar" nunca
    // apareceria como mudança: a linha simplesmente sumiria, e sumir em
    // silêncio é o defeito que esta rodada conserta.
    const roda = yml.slice(yml.indexOf("roda() {"), yml.indexOf("roda \"Porta de entrada"));
    const linhas = roda.split("\n");
    const i = linhas.findIndex((l) => /assinatura\.txt/.test(l));
    expect(i, "a assinatura não é escrita dentro do `roda()`").toBeGreaterThan(0);

    /**
     * INCONDICIONAL de verdade, e não por aproximação.
     *
     * A primeira versão desta asserção checava "não está dentro de um `case`".
     * A inversão passou: envolvi a linha num `if [ "$estado" -ne 0 ]; then …;
     * fi` e a guarda aprovou, porque o texto do `echo` continuava intacto e não
     * havia `case` depois dele. Aproximação de "incondicional" não é
     * "incondicional".
     *
     * Agora: a linha está sozinha (nada de `if` de uma linha em volta) e todo
     * `if`/`case` aberto antes dela já foi fechado.
     */
    expect(
      linhas[i],
      "a escrita da assinatura tem condicional na mesma linha",
    ).toMatch(/^\s*echo "\$rotulo=\$estado" >> \/tmp\/assinatura\.txt\s*$/);

    const antes = linhas.slice(0, i).join("\n");
    const conta = (re: RegExp) => (antes.match(re) ?? []).length;
    expect(
      conta(/^\s*if\s/gm) - conta(/^\s*fi\s*$/gm),
      "há um `if` aberto antes da escrita da assinatura: ela deixou de valer para " +
        "todas as conferências, e 'voltou a passar' pararia de aparecer como mudança",
    ).toBe(0);
    expect(
      conta(/^\s*case\s/gm) - conta(/^\s*esac\s*$/gm),
      "há um `case` aberto antes da escrita da assinatura",
    ).toBe(0);
  });

  it("o passo de aviso importa o módulo em vez de reimplementar", () => {
    const passo = yml.slice(yml.indexOf("- name: Avisar"));
    expect(passo).toMatch(/avisoPorIssue\.mjs/);
    expect(passo).toMatch(/decidirAviso/);
    // A conta de três situações não pode voltar para dentro do YAML.
    expect(
      passo,
      "o passo voltou a decidir por conta própria; a decisão mora no módulo",
    ).not.toMatch(/assinaturaDoCorpo\s*\(|anterior\s*===\s*assinatura/);
  });

  it("o caso 'atualizar' não cria comentário", () => {
    /**
     * O coração do conserto. Se o `case "atualizar"` chamar `createComment`, a
     * pilha diária volta — e é o tipo de regressão que passa batida numa
     * revisão rápida, porque o nome do caso continua certo.
     */
    const passo = yml.slice(yml.indexOf("- name: Avisar"));
    const trecho = passo.slice(passo.indexOf('case "atualizar"'), passo.indexOf('case "comentar"'));
    expect(trecho.length, "não achei o ramo `atualizar`").toBeGreaterThan(50);
    expect(trecho, "o ramo que deveria ficar calado cria comentário").not.toMatch(/createComment/);
  });
});
