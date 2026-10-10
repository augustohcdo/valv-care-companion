/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Agenda que roda sozinha tem de ter como avisar.
 *
 * ## O defeito
 *
 * `rotas-autenticadas.yml` abre as 39 telas de `/app/*` com conta de verdade,
 * aos domingos, e reportava SÓ no `$GITHUB_STEP_SUMMARY` — que existe apenas
 * para quem abre a execução. Se ela reprovasse, ninguém era avisado.
 *
 * Não é hipótese. O cabeçalho da agenda diária registra o custo exato de ter
 * tido o mesmo defeito:
 *
 *   > "`$GITHUB_STEP_SUMMARY` só existe para quem abre a execução. Estas
 *   >  conferências falharam nos dias 14, 15, 16, 17, 18 e 19 de setembro e a
 *   >  primeira pessoa a notar foi quem foi procurar — seis dias depois."
 *
 * A diária ganhou aviso por issue por causa disso. A SEMANAL ficou sem, e lá o
 * mesmo silêncio custa sete dias por repetição em vez de um.
 *
 * ## As três regras, e por que cada uma
 *
 * 1. **Toda agenda avisa.** `schedule:` sem canal de aviso é verificação que
 *    roda para ninguém.
 * 2. **Dois avisos não brigam pela mesma issue.** Título e etiqueta iguais
 *    fariam uma agenda FECHAR a issue aberta pela outra — e o sinal mais
 *    valioso desta base, "issue aberta quer dizer está quebrado agora",
 *    viraria ruído. É o defeito mais fácil de introduzir ao copiar o passo.
 * 3. **O aviso roda mesmo quando a conferência falha.** Sem `always()`, um
 *    passo que depende do anterior é PULADO quando ele reprova: a verificação
 *    falha e o aviso não sai, que é a forma mais pura de falhar calado.
 *
 * ## O que esta guarda lê, e o que ela não lê
 *
 * Texto, não YAML — este projeto não tem parser de YAML, e as outras guardas de
 * workflow também leem texto. Linhas de comentário inteiras (`^\s*#`) são
 * descartadas, porque os workflows daqui carregam prosa longa que cita as
 * próprias chaves. Comentário no FIM da linha fica, e isso é aceitável: ele não
 * consegue produzir uma chave no começo de linha, que é a forma em que as
 * regras ancoram.
 */

const DIR = ".github/workflows";

/** Descarta linhas que são só comentário de YAML, preservando a contagem. */
function semComentarioDeLinha(texto: string): string {
  return texto.split("\n").map((l) => (/^\s*#/.test(l) ? "" : l)).join("\n");
}

interface Fluxo {
  nome: string;
  texto: string;
  agendado: boolean;
  /** O título da issue que o aviso usa, se houver aviso. */
  titulo: string | null;
  etiqueta: string | null;
  criaIssue: boolean;
  temIssuesWrite: boolean;
  /** Os jobs do workflow, pela chave na indentação de job. */
  jobs: string[];
  /** O `needs` do job que avisa; `[]` quando ele não declara nenhum. */
  needsDoAviso: string[] | null;
  nomeDoJobDoAviso: string | null;
}

export function lerFluxo(nome: string, bruto: string): Fluxo {
  const texto = semComentarioDeLinha(bruto);
  return {
    nome,
    texto,
    // A chave no começo da linha, com a indentação do bloco `on:`.
    agendado: /^\s{2,6}schedule:\s*$/m.test(texto),
    titulo: /const\s+TITULO\s*=\s*"([^"]+)"/.exec(texto)?.[1] ?? null,
    etiqueta: /const\s+ETIQUETA\s*=\s*"([^"]+)"/.exec(texto)?.[1] ?? null,
    criaIssue: /issues\.create\s*\(/.test(texto),
    temIssuesWrite: /^\s*issues:\s*write\s*$/m.test(texto),
    // Só a partir de `jobs:`: `schedule:` e `workflow_dispatch:` moram na
    // MESMA indentação, dentro de `on:`, e a primeira versão desta extração os
    // contou como jobs — a regra passou a exigir que o aviso esperasse por
    // `schedule`. Chave na indentação certa, na seção errada.
    jobs: (() => {
      const i = texto.search(/^jobs:\s*$/m);
      if (i < 0) return [];
      return [...texto.slice(i).matchAll(/^ {2}([A-Za-z_][\w-]*):\s*$/gm)].map((m) => m[1]);
    })(),
    // `needs: [a, b]` ou `needs: a`, do job que contém o `issues.create`.
    needsDoAviso: (() => {
      const i = texto.indexOf("issues.create");
      if (i < 0) return null;
      const antes = texto.slice(0, i);
      const linhas = antes.split("\n");
      let inicio = 0;
      for (let n = linhas.length - 1; n >= 0; n--) {
        if (/^ {2}[A-Za-z_][\w-]*:\s*$/.test(linhas[n])) { inicio = n; break; }
      }
      const m = /^ {4}needs:\s*(.+)$/m.exec(linhas.slice(inicio).join("\n"));
      if (!m) return [];
      return m[1].replace(/[[\]]/g, "").split(",").map((x) => x.trim()).filter(Boolean);
    })(),
    nomeDoJobDoAviso: (() => {
      const i = texto.indexOf("issues.create");
      if (i < 0) return null;
      const linhas = texto.slice(0, i).split("\n");
      for (let n = linhas.length - 1; n >= 0; n--) {
        const m = /^ {2}([A-Za-z_][\w-]*):\s*$/.exec(linhas[n]);
        if (m) return m[1];
      }
      return null;
    })(),
  };
}

/**
 * Agendas que podem rodar sem canal de aviso, com o motivo.
 *
 * Vazia, e é o estado a defender. Para acrescentar uma entrada, escreva como
 * alguém fica sabendo que aquela agenda reprovou.
 */
const PODEM_NAO_AVISAR: Record<string, string> = {};

const fluxos = readdirSync(DIR)
  .filter((f) => /\.ya?ml$/.test(f))
  .sort()
  .map((nome) => lerFluxo(nome, readFileSync(join(DIR, nome), "utf8")));

const agendados = fluxos.filter((f) => f.agendado);
const comAviso = fluxos.filter((f) => f.criaIssue);

describe("toda agenda tem como avisar", () => {
  it("nenhum workflow agendado fica sem canal de aviso", () => {
    const mudos = agendados
      .filter((f) => !f.criaIssue && !(f.nome in PODEM_NAO_AVISAR))
      .map((f) => `  · ${f.nome}`);
    expect(
      mudos,
      `\n${mudos.join("\n")}\n\n` +
        "Este workflow roda sozinho, por `schedule`, e não abre issue nenhuma\n" +
        "quando reprova. O `$GITHUB_STEP_SUMMARY` só existe para quem abre a\n" +
        "execução — e a agenda diária desta base já passou SEIS DIAS reprovando\n" +
        "em silêncio por esse motivo exato.\n\n" +
        "Reuse `.github/scripts/avisoPorIssue.mjs`, que é puro e tem teste, com\n" +
        "título e etiqueta próprios.",
    ).toEqual([]);
  });

  it("dois avisos não brigam pela mesma issue", () => {
    /**
     * O defeito mais fácil de introduzir copiando o passo: com o mesmo título e
     * a mesma etiqueta, a agenda que PASSA fecha a issue que a outra abriu, e
     * "issue aberta = está quebrado agora" deixa de valer.
     */
    const porTitulo = new Map<string, string[]>();
    const porEtiqueta = new Map<string, string[]>();
    for (const f of comAviso) {
      if (f.titulo) porTitulo.set(f.titulo, [...(porTitulo.get(f.titulo) ?? []), f.nome]);
      if (f.etiqueta) porEtiqueta.set(f.etiqueta, [...(porEtiqueta.get(f.etiqueta) ?? []), f.nome]);
    }
    const repetidos = [
      ...[...porTitulo].filter(([, q]) => q.length > 1)
        .map(([t, q]) => `  · título "${t}" em ${q.join(" e ")}`),
      ...[...porEtiqueta].filter(([, q]) => q.length > 1)
        .map(([e, q]) => `  · etiqueta "${e}" em ${q.join(" e ")}`),
    ];
    expect(
      repetidos,
      `\n${repetidos.join("\n")}\n\n` +
        "Duas agendas usando o mesmo título ou a mesma etiqueta de issue: a que\n" +
        "passar vai FECHAR a issue aberta pela que falhou.",
    ).toEqual([]);
  });

  it("todo aviso declara o título e a etiqueta que usa", () => {
    // Sem os dois extraíveis, a regra acima não tem o que comparar e passaria
    // por vazio — a forma de burlar a regra sem desligá-la.
    const semIdentidade = comAviso
      .filter((f) => !f.titulo || !f.etiqueta)
      .map((f) => `  · ${f.nome} (título: ${f.titulo ?? "—"}, etiqueta: ${f.etiqueta ?? "—"})`);
    expect(
      semIdentidade,
      `\n${semIdentidade.join("\n")}\n\n` +
        "Este workflow abre issue e não declara `const TITULO`/`const ETIQUETA`\n" +
        "em texto que a guarda ache. Sem isso a regra de colisão acima não\n" +
        "compara nada e passa por vazio.",
    ).toEqual([]);
  });

  it("todo workflow que abre issue pede `issues: write`", () => {
    const semPermissao = comAviso.filter((f) => !f.temIssuesWrite).map((f) => `  · ${f.nome}`);
    expect(
      semPermissao,
      `\n${semPermissao.join("\n")}\n\n` +
        "Abre issue e não declara `issues: write`. O passo falha na hora de\n" +
        "avisar — e a falha dele é justamente o que ninguém vai ver.",
    ).toEqual([]);
  });

  it("o aviso roda mesmo quando a conferência reprova", () => {
    /**
     * Sem `always()`, um passo (ou job) que depende do anterior é PULADO quando
     * ele falha. Quer dizer: a verificação reprova e o aviso não sai — a forma
     * mais pura de falhar calado, e invisível: o workflow apareceria como
     * "falhou", sem issue, exatamente como antes de haver aviso.
     *
     * ## A primeira versão desta regra era teatro
     *
     * Ela recuava 4000 caracteres do `issues.create` e aceitava um
     * `if: always()` em qualquer lugar do recuo. O job `varrer` da varredura
     * semanal tem quatro passos com `always()`, então o recuo sempre achava um
     * — e tirar o `always()` do job de AVISO não derrubava nada. A inversão
     * mostrou isso; o teste passava sem conferir o que o nome dele promete.
     *
     * Agora o `always()` é cobrado no CONSTRUTO que contém a chamada: o job que
     * a contém (no cabeçalho, antes de `steps:`) ou o passo que a contém.
     * `always()` em outro passo qualquer não protege este.
     */
    const semSempre: string[] = [];
    for (const f of comAviso) {
      const i = f.texto.indexOf("issues.create");
      const antes = f.texto.slice(0, i);
      const linhas = antes.split("\n");

      // O JOB que contém a chamada: a última linha `^  <nome>:` antes dela.
      let inicioDoJob = 0;
      for (let n = linhas.length - 1; n >= 0; n--) {
        if (/^ {2}[A-Za-z_][\w-]*:\s*$/.test(linhas[n])) { inicioDoJob = n; break; }
      }
      const doJob = linhas.slice(inicioDoJob);
      const ondeSteps = doJob.findIndex((l) => /^ {4}steps:\s*$/.test(l));
      const cabecalhoDoJob = ondeSteps >= 0 ? doJob.slice(0, ondeSteps) : doJob;
      const jobTemSempre = cabecalhoDoJob.some((l) => /^ {4}if:.*always\(\)/.test(l));

      // O PASSO que contém a chamada: a última linha `^      - ` antes dela.
      const doStep = ondeSteps >= 0 ? doJob.slice(ondeSteps) : [];
      let inicioDoPasso = -1;
      for (let n = doStep.length - 1; n >= 0; n--) {
        if (/^ {6}- /.test(doStep[n])) { inicioDoPasso = n; break; }
      }
      const passo = inicioDoPasso >= 0 ? doStep.slice(inicioDoPasso) : [];
      const passoTemSempre = passo.some((l) => /^ {8}if:.*always\(\)/.test(l));

      if (!jobTemSempre && !passoTemSempre) semSempre.push(`  · ${f.nome}`);
    }
    expect(
      semSempre,
      `\n${semSempre.join("\n")}\n\n` +
        "O passo (ou job) que abre a issue não tem `always()`. Quando a\n" +
        "conferência reprova, ele é PULADO: a verificação falha e o aviso não\n" +
        "sai. O workflow aparece como falhou, sem issue — igual a antes de\n" +
        "existir aviso.\n\n" +
        "`always()` em outro passo do mesmo job não serve: cada passo tem a sua\n" +
        "própria condição.",
    ).toEqual([]);
  });

  it("o aviso espera por TODOS os jobs do workflow", () => {
    /**
     * O buraco que isto fecha, e ele apareceu nesta própria rodada.
     *
     * A varredura semanal ganhou um job novo — as fontes do catálogo. O aviso
     * dela declarava `needs: varrer`, e com isso o job novo poderia reprovar
     * sem o aviso nem esperar por ele: a issue não abriria, e o workflow
     * apareceria como "falhou" em silêncio, que é o estado de antes de existir
     * aviso.
     *
     * Não é hipótese: foi a primeira versão do job de fontes, antes de eu
     * corrigir o `needs`. E o mesmo vale para a assinatura, que filtrava os
     * jobs por `name.startsWith("Varrer as rotas como ")` — o job novo
     * disparava o aviso e não aparecia na tabela.
     *
     * Filtro ou `needs` escrito à mão envelhece a cada job novo. A regra é:
     * todo job, menos o próprio aviso.
     *
     * ## O que esta regra NÃO cobre
     *
     * Ela cobra o `needs` — que é a metade que decide se o aviso RODA. A outra
     * metade, se o job novo aparece na ASSINATURA e na tabela, está no
     * JavaScript do passo e não é conferível daqui sem executá-lo. O que fiz em
     * vez de prometer: o filtro da assinatura passou a ser por exclusão do
     * próprio aviso, de modo que job novo entra sozinho — e o comentário de lá
     * registra por quê. Guarda que promete mais do que confere é pior do que
     * guarda nenhuma, então fica dito: aqui se confere o `needs`.
     */
    const descobertos: string[] = [];
    // Conta quantos pares (workflow, job) o LAÇO de fato comparou. O piso
    // abaixo lê esta variável, e não `comAviso`: a primeira versão do piso
    // media a lista de entrada, então esvaziar o laço passava por fora dele.
    let comparados = 0;
    for (const f of comAviso) {
      if (f.needsDoAviso === null) continue;
      const esperados = f.jobs.filter((j) => j !== f.nomeDoJobDoAviso).sort();
      comparados += esperados.length;
      const faltando = esperados.filter((j) => !f.needsDoAviso!.includes(j));
      if (faltando.length) {
        descobertos.push(`  · ${f.nome}: o aviso não espera por ${faltando.join(", ")}`);
      }
    }
    /**
     * O PISO, e ele veio de uma inversão que a regra não derrubava.
     *
     * Esvaziar o laço — um `continue` logo na entrada — fazia a regra passar
     * por construção: sem nada examinado, `descobertos` fica vazio e o
     * `toEqual([])` aprova. É o verde vazio que esta sessão persegue, dentro da
     * regra recém-escrita.
     *
     * Então a regra declara quanto examinou: pelo menos um workflow com um
     * `needs` de verdade, e pelo menos um job esperado.
     */
    expect(
      comparados,
      "o laço não comparou par nenhum (workflow, job) — a regra passaria por " +
        "vazio, aprovando qualquer `needs`",
    ).toBeGreaterThan(0);

    expect(
      descobertos,
      `\n${descobertos.join("\n")}\n\n` +
        "O job que abre a issue não declara `needs` para todos os outros jobs\n" +
        "deste workflow. O job de fora pode reprovar sem o aviso esperar por\n" +
        "ele: a issue não abre, e o workflow aparece como falhou em silêncio.\n\n" +
        "Um workflow de job único passa por aqui sem exigência — não há por\n" +
        "quem esperar.",
    ).toEqual([]);
  });

  it("toda dispensa aponta para uma agenda que existe", () => {
    for (const [nome, motivo] of Object.entries(PODEM_NAO_AVISAR)) {
      expect(motivo.length, `a dispensa de ${nome} não tem motivo escrito`).toBeGreaterThan(40);
      expect(
        agendados.map((f) => f.nome),
        `PODEM_NAO_AVISAR aponta para ${nome}, que não é workflow agendado`,
      ).toContain(nome);
    }
  });
});

describe("os pisos e a contraprova", () => {
  it("achou os workflows, os agendados e os avisos", () => {
    expect(fluxos.length, "nenhum workflow lido").toBeGreaterThan(3);
    expect(
      agendados.map((f) => f.nome).sort(),
      "a detecção de `schedule:` parou de casar — as regras passariam por vazio",
    ).toEqual(["rotas-autenticadas.yml", "verificacoes-periodicas.yml"]);
    expect(
      comAviso.length,
      "nenhum aviso encontrado — a detecção de `issues.create` quebrou",
    ).toBeGreaterThanOrEqual(2);
  });

  it("o extrator lê `schedule`, título, etiqueta e permissão em material plantado", () => {
    const comTudo = lerFluxo("p.yml", [
      "on:",
      "  schedule:",
      '    - cron: "0 1 * * *"',
      "permissions:",
      "  issues: write",
      "jobs:",
      "  x:",
      "    steps:",
      "      - name: Avisar",
      "        if: always()",
      "        uses: actions/github-script@v7",
      "        with:",
      "          script: |",
      '            const TITULO = "🔴 algo";',
      '            const ETIQUETA = "algo";',
      "            await github.rest.issues.create({ title: TITULO });",
    ].join("\n"));
    expect(comTudo.agendado).toBe(true);
    expect(comTudo.titulo).toBe("🔴 algo");
    expect(comTudo.etiqueta).toBe("algo");
    expect(comTudo.criaIssue).toBe(true);
    expect(comTudo.temIssuesWrite).toBe(true);
  });

  it("o extrator NÃO aceita `schedule` nem `issues: write` de dentro de comentário", () => {
    // A prosa dos workflows daqui cita as próprias chaves — o cabeçalho da
    // semanal explica o `schedule` dela em comentário. Sem descartar a linha de
    // comentário, um workflow que só FALA de agenda contaria como agendado, e a
    // regra passaria a exigir aviso de quem não roda sozinho.
    const soComentario = lerFluxo("p.yml", [
      "# on:",
      "#   schedule:",
      "#     - cron: 0 1 * * *",
      "# permissions:",
      "#   issues: write",
      "on:",
      "  workflow_dispatch:",
    ].join("\n"));
    expect(soComentario.agendado, "comentário virou agenda").toBe(false);
    expect(soComentario.temIssuesWrite, "comentário virou permissão").toBe(false);
  });

  it("o extrator distingue `schedule:` de uma chave que só contém a palavra", () => {
    const parecido = lerFluxo("p.yml", [
      "on:",
      "  workflow_dispatch:",
      "jobs:",
      "  x:",
      "    steps:",
      '      - run: echo "schedule: isto é texto, não chave"',
    ].join("\n"));
    expect(parecido.agendado, "texto dentro de `run` virou agenda").toBe(false);
  });
});
