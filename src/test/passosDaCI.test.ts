// Este teste lê o disco; tsconfig.app.json restringe `types`, daí a referência.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

/**
 * Passo de workflow que NÃO CONSEGUE falhar é check que não confere.
 *
 * ## O defeito, duas vezes, em dois arquivos
 *
 * O GitHub roda cada `run:` com `bash -e` e **sem** `pipefail`. Numa cadeia
 * `A | B`, o bash devolve o status de `B`. Se `B` é `tee`, o status é sempre 0
 * — e o resultado de `A`, que é o comando que de fato confere alguma coisa,
 * desaparece.
 *
 * Conferido, e não suposto:
 *
 *     $ bash -e -c 'set -e; false | tee /dev/null; echo chegou'
 *     chegou                          exit 0
 *     $ bash -e -c 'set -e; set -o pipefail; false | tee /dev/null; echo chegou'
 *                                     exit 1
 *
 * A primeira vez foi no `rotas-autenticadas.yml`: a varredura das 39 telas
 * podia sair 1 (rota quebrada) ou 2 (não conferido) e o passo ficava verde.
 * Consertado — e a guarda escrita junto ficou presa **àquele arquivo**.
 *
 * A segunda vez estava no `db.yml`, que é o workflow que aplica SQL no banco de
 * PRODUÇÃO. Ali o comando engolido era um `curl --fail-with-body`, posto no
 * lugar exatamente para o passo falhar em HTTP de erro — o comentário logo
 * acima dele dizia, com todas as letras, *"sem o `--fail`, um 400 passaria como
 * sucesso"*. Passava assim mesmo, por causa do cano. SQL recusado, transação
 * abortada, permissão negada: o erro ia para o resumo e a bolinha ficava verde
 * do lado. Num banco de prontuário, "o banco não mudou e o relatório diz que
 * mudou" é o pior formato de defeito que este projeto persegue.
 *
 * ## Por que esta guarda é de DIRETÓRIO
 *
 * É a terceira vez nesta sessão que uma regra certa fica amarrada ao arquivo
 * onde o defeito apareceu — foi o `RAIZ = "src"` que deixou as vinte edge
 * functions fora da varredura de leitura, depois da de escrita, e agora o
 * `WORKFLOW = "rotas-autenticadas.yml"`. A correção durável nunca é consertar o
 * segundo arquivo: é apagar a lista.
 *
 * Então a regra aqui não tem lista e não tem exceção por nome: **todo passo com
 * cano precisa de `pipefail`**. Custa uma linha e remove o julgamento — o mesmo
 * raciocínio da varredura de escritas cegas, onde exigir "anúncio de sucesso"
 * teria deixado passar a maioria.
 *
 * ## O que ela NÃO prova
 *
 * Que o passo confere a coisa certa. Ela só garante que, se o comando da
 * esquerda falhar, alguém fica sabendo. É o piso.
 */

const DIR = ".github/workflows";

/**
 * Acha canos de verdade numa linha de shell.
 *
 * Quatro coisas parecem cano e não são. Confundir qualquer uma enche a guarda
 * de falso vermelho, e guarda que pune quem fez certo é guarda que alguém
 * desliga — o custo é o mesmo do falso verde, com um passo a mais:
 *
 *   · `run: |` — o `|` do YAML que abre bloco literal (e `|-`, `|+`);
 *   · `grep -E "a|b"` — alternância dentro de aspas;
 *   · `cmd || outro` — o OU do shell;
 *   · `*..*|/*)` — alternância de padrão de `case`, que NÃO está entre aspas.
 *
 * A quarta só apareceu quando a guarda rodou: ela acusou o passo "Conferir o
 * arquivo" do `db.yml`, que é justamente o que valida o caminho contra
 * travessia de diretório. Por isso ela precisa de contexto de bloco `case`, e
 * não dá para decidir olhando a linha sozinha.
 */
export function canosNaLinha(linha: string, dentroDeCase = false): boolean {
  let texto = linha.replace(/^\s*#.*$/, "");

  // Indicador de bloco YAML: o `|` é o último caractere não-branco da linha.
  if (/\|[-+]?\d*\s*$/.test(texto) && /^\s*[\w-]+:\s*\|/.test(texto)) return false;

  // Dentro de `case … esac`, o trecho ANTES do `)` é padrão, não comando. Corta
  // só o padrão e continua lexando o corpo do braço — um cano de verdade em
  // `*) node x | tee y ;;` tem de continuar sendo achado.
  if (dentroDeCase) {
    const fecha = indiceForaDeAspas(texto, ")");
    if (fecha >= 0) texto = texto.slice(fecha + 1);
  }

  let aspaSimples = false;
  let aspaDupla = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === "\\") { i++; continue; }
    if (c === "'" && !aspaDupla) { aspaSimples = !aspaSimples; continue; }
    if (c === '"' && !aspaSimples) { aspaDupla = !aspaDupla; continue; }
    if (c !== "|" || aspaSimples || aspaDupla) continue;
    if (texto[i + 1] === "|") { i++; continue; } // `||`
    if (texto[i - 1] === "|") continue;
    // Um `|` no fim da linha, fora de aspas, é o indicador de bloco do YAML
    // (`run: |`) muito mais vezes do que é um cano continuado.
    if (texto.slice(i + 1).trim() === "") return false;
    return true;
  }
  return false;
}

function indiceForaDeAspas(texto: string, alvo: string): number {
  let aspaSimples = false;
  let aspaDupla = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === "\\") { i++; continue; }
    if (c === "'" && !aspaDupla) { aspaSimples = !aspaSimples; continue; }
    if (c === '"' && !aspaSimples) { aspaDupla = !aspaDupla; continue; }
    if (c === alvo && !aspaSimples && !aspaDupla) return i;
  }
  return -1;
}

/** As linhas de um passo que têm cano de verdade, com contexto de `case`. */
export function linhasComCano(passo: string): string[] {
  const achadas: string[] = [];
  let dentroDeCase = false;
  for (const linha of passo.split("\n")) {
    if (/\besac\b/.test(linha)) dentroDeCase = false;
    if (canosNaLinha(linha, dentroDeCase)) achadas.push(linha);
    if (/\bcase\b.*\bin\b\s*$/.test(linha)) dentroDeCase = true;
  }
  return achadas;
}

const arquivos = readdirSync(DIR).filter((n) => n.endsWith(".yml") || n.endsWith(".yaml"));

describe("os passos dos workflows", () => {
  it("existem workflows para conferir", () => {
    // Sem isto, apagar a pasta deixaria este arquivo passando com zero iterações
    // — verde por não ter olhado nada, que é o defeito que ele persegue.
    expect(arquivos.length, `nenhum workflow em ${DIR}`).toBeGreaterThan(0);
  });

  for (const nome of arquivos) {
    const yml = readFileSync(`${DIR}/${nome}`, "utf8");
    // `defaults: run: shell: bash` já liga `pipefail` para o workflow inteiro —
    // é `bash --noprofile --norc -eo pipefail {0}`. Vale como conserto.
    const pipefailNoWorkflow = /defaults:[\s\S]{0,200}?shell:\s*bash\s*$/m.test(yml);

    it(`${nome}: nenhum cano engole o código de saída`, () => {
      const passos = yml.split(/\n {6}- name: /);
      const culpados: string[] = [];

      for (const passo of passos) {
        const linhas = passo.split("\n");
        const comCano = linhasComCano(passo);
        if (comCano.length === 0) continue;
        if (pipefailNoWorkflow || /set -o pipefail|set -eo pipefail|set -euo pipefail/.test(passo)) {
          continue;
        }
        culpados.push(`  · passo "${linhas[0].trim()}" → ${comCano[0].trim().slice(0, 90)}`);
      }

      expect(
        culpados,
        `\n${culpados.join("\n")}\n\n` +
          "O GitHub roda os passos com `bash -e` e SEM `pipefail`: numa cadeia\n" +
          "`A | B` o status que conta é o de `B`. Se `B` é `tee`, o passo fica\n" +
          "verde mesmo quando `A` falhou — e `A` costuma ser justamente o comando\n" +
          "que confere alguma coisa.\n\n" +
          "Conserto: `set -o pipefail` na primeira linha do `run:`, ou\n" +
          "`defaults: run: shell: bash` no workflow.",
      ).toEqual([]);
    });
  }

  it("o detector de cano não confunde bloco YAML, aspas, `||` nem padrão de `case`", () => {
    // A contraprova nos dois sentidos. Com zero culpados lá em cima, o teste
    // passaria tanto com os workflows corretos quanto com o detector cego.
    expect(canosNaLinha("        run: |"), "confundiu o bloco literal do YAML").toBe(false);
    expect(canosNaLinha("        run: |-"), "confundiu o bloco literal com chomping").toBe(false);
    expect(canosNaLinha('          grep -E "erro|falha" log'), "confundiu alternância entre aspas")
      .toBe(false);
    expect(canosNaLinha("          cmd || exit 1"), "confundiu o OU do shell").toBe(false);
    expect(canosNaLinha("          node script.mjs | tee saida.log"), "não viu um cano de verdade")
      .toBe(true);
    expect(canosNaLinha("          curl -sS url | jq ."), "não viu um cano de verdade").toBe(true);
  });

  it("padrão de `case` não é cano — e cano dentro do `case` ainda é", () => {
    // O falso vermelho real: esta linha é do passo do `db.yml` que barra
    // travessia de diretório. Acusá-la ensinaria a desligar a guarda.
    const caseComAlternancia = [
      '          case "$ARQUIVO" in',
      '            *..*|/*) echo "::error::Caminho inválido"; exit 1 ;;',
      "            *.sql) ;;",
      "          esac",
    ].join("\n");
    expect(linhasComCano(caseComAlternancia), "acusou alternância de padrão de case").toEqual([]);

    // E o outro lado, que é o que impede a correção acima de virar um buraco:
    // cortar o padrão não pode cegar o corpo do braço.
    const caseComCanoDeVerdade = [
      '          case "$MODO" in',
      "            varrer) node scripts/varre.mjs | tee /tmp/log ;;",
      "          esac",
    ].join("\n");
    expect(
      linhasComCano(caseComCanoDeVerdade).length,
      "cegou o corpo do braço do case junto com o padrão",
    ).toBe(1);
  });
});
