// Este teste lê o disco; tsconfig.app.json restringe `types`, daí a referência.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Tira o corpo do passo "Conferir" do YAML e troca as seis conferências reais
 * por chamadas sintéticas.
 *
 * Extrair do arquivo, em vez de redigitar o script aqui, é o que faz este teste
 * valer alguma coisa: uma cópia testaria a cópia, e o workflow poderia divergir
 * dela para sempre sem ninguém notar.
 */
function corpoDoPassoConferir(texto: string, chamadasSinteticas: string): string {
  const i = texto.indexOf("      - name: Conferir");
  if (i < 0) throw new Error('não achei o passo "Conferir" no workflow');
  const bloco = texto.slice(i);
  const j = bloco.indexOf("        run: |\n");
  if (j < 0) throw new Error('o passo "Conferir" não tem `run: |`');
  // O corpo termina no PRÓXIMO passo, não no fim do arquivo.
  //
  // A versão anterior fatiava até o fim, o que funcionava só porque o
  // `Conferir` era o último passo — uma dependência que ninguém tinha
  // escrito. Ao acrescentar o passo que avisa por issue, o extrator passou a
  // engolir o YAML dele e o `bash` reprovou sobre lixo, dizendo que a
  // conferência tinha saído 2. Guarda que depende de ordem não declarada
  // reprova a próxima pessoa que reordenar, pelo motivo errado.
  const depoisDoRun = bloco.slice(j + "        run: |\n".length);
  const k = depoisDoRun.search(/\n {6}- name: /);
  const corpo = (k < 0 ? depoisDoRun : depoisDoRun.slice(0, k))
    .split("\n")
    .map((l) => (l.startsWith("          ") ? l.slice(10) : l))
    .join("\n");
  // As chamadas reais saem; as sintéticas entram no mesmo lugar.
  const semChamadas = corpo.replace(/^roda ".*$/gm, "");
  const marca = '{\n  echo "## Verificações periódicas"';
  if (!semChamadas.includes(marca)) throw new Error("não achei onde inserir as chamadas");
  return semChamadas.replace(marca, `${chamadasSinteticas}\n\n${marca}`);
}

/**
 * As verificações que só existiam quando alguém lembrava.
 *
 * ## O que custou
 *
 * O projeto tinha seis conferências sérias — a porta de entrada do site, as 62
 * rotas publicadas, 17 conferências do estado publicado contra o banco, 26
 * citações do PubMed, 17 links de técnica cirúrgica e as três calculadoras
 * dirigidas num navegador de verdade. **Nenhuma rodava sozinha.** Eram comandos
 * que alguém digitava, e o número que aparecia no relatório ("26/26 PMIDs")
 * valia para o instante em que alguém digitou.
 *
 * Aí a `turnstile-config` parou de subir. O login ficou FECHADO para todo mundo
 * — sem site key o captcha não renderiza e o botão Entrar fica desabilitado — e
 * nada avisou. A CI seguia verde, porque ela confere o código e não o que está
 * no ar. O `smoke` também passaria: as rotas devolviam o shell normalmente, a
 * tela abria bonita, só não dava para entrar. Quem descobriu foi uma pessoa
 * tentando usar o site.
 *
 * ## O que este teste cobra
 *
 * Um workflow agendado não dá sinal de que morreu. Tirar o `schedule` e deixar
 * só o `workflow_dispatch` devolve o projeto ao estado anterior — verificação
 * que depende de alguém lembrar — e não aparece em log, em tela nem em teste.
 * Aparece meses depois, do mesmo jeito que apareceu da primeira vez.
 *
 * E cobra o que não pode entrar: este workflow roda sozinho, todo dia, sem
 * ninguém olhando. Segredo aqui dentro é segredo exercitado às cegas.
 */

const WORKFLOW = ".github/workflows/verificacoes-periodicas.yml";
const SAUDE = "scripts/saude-do-site.mjs";

const ler = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const yml = ler(WORKFLOW);
const saude = ler(SAUDE);

/**
 * O YAML sem os comentários.
 *
 * A primeira versão do teste de segredos reprovou este workflow por causa do
 * COMENTÁRIO que diz, em português, que ele não toca em
 * `SUPABASE_SERVICE_ROLE_KEY`. A guarda bateu na palavra em vez da garantia —
 * o mesmo erro que já custou duas vezes nesta sessão: uma guarda que cobrava a
 * ausência de uma dependência casando com o NOME dela escrito num comentário, e
 * o `seloDeRevisao` casando com `'reviewed'`. Documentar que algo é proibido
 * não pode ser o que reprova.
 *
 * (E a lição cobrou juros: a primeira versão deste comentário citava aquela
 * guarda pelo nome, e ela reprovou este arquivo. Ela está certa — a palavra não
 * deve se espalhar pelo repositório, e quem tinha de mudar era o texto aqui, não
 * a lista de exceções dela.)
 */
const ymlSemComentario = yml
  .split("\n")
  .filter((l) => !/^\s*#/.test(l))
  .join("\n");

describe("as verificações periódicas", () => {
  it("o workflow existe", () => {
    expect(
      yml,
      "sem ele, as seis conferências voltam a valer só no instante em que alguém digita o comando",
    ).not.toBe("");
  });

  it("roda por AGENDA, e não só quando alguém clica", () => {
    // A diferença inteira está aqui. `workflow_dispatch` sozinho é o estado de
    // antes com um botão a mais.
    expect(yml, "falta o gatilho `schedule`").toMatch(/^\s*schedule:/m);
    expect(yml, "falta a expressão cron").toMatch(/-\s*cron:\s*["'][^"']+["']/);
  });

  it("não carrega segredo nenhum", () => {
    // Roda diariamente, sozinho, sem ninguém olhando. O `SUPABASE_ACCESS_TOKEN`
    // é root sobre a conta inteira e a `service_role` ignora toda a RLS —
    // nenhum dos dois tem o que fazer numa conferência de leitura. A chave que
    // ele usa é a publishable, que já viaja em todo bundle público.
    expect(ymlSemComentario, "este workflow não deve tocar em segredo").not.toMatch(/secrets\./);
    expect(ymlSemComentario).not.toMatch(/SERVICE_ROLE/);
    expect(ymlSemComentario).not.toMatch(/SUPABASE_ACCESS_TOKEN/);
  });

  it("as permissões são exatamente as duas de que ele precisa", () => {
    /**
     * Este teste chamava-se "só lê — permissões mínimas" e cobrava apenas
     * `contents: read`. Quando o passo que avisa por issue entrou, precisei de
     * `issues: write` — e o teste continuou PASSANDO com o nome antigo, porque
     * a regex só exigia que `contents: read` estivesse lá.
     *
     * Guarda cujo nome afirma mais do que ela confere é pior que guarda
     * nenhuma: quem lê a lista de testes conclui que o workflow só lê.
     *
     * Agora ele enumera o conjunto: as duas que precisam existir, e nenhuma
     * outra. `issues: write` está aqui porque um vigia diário que falha em
     * silêncio não é vigia — ver o último passo do workflow.
     */
    const bloco = /permissions:\n((?:\s+#.*\n|\s+\w[\w-]*:\s*\w+\n)+)/.exec(yml);
    expect(bloco, "não achei o bloco `permissions:`").not.toBeNull();

    const concedidas = bloco![1]
      .split("\n")
      .filter((l) => l.trim() && !l.trim().startsWith("#"))
      .map((l) => l.trim());

    expect(concedidas.sort()).toEqual(["contents: read", "issues: write"]);
  });

  it("uma falha vira issue, e o sucesso a fecha", () => {
    // O defeito que motivou este passo: as conferências reprovaram nos dias 14
    // a 19 de setembro e ninguém soube. `$GITHUB_STEP_SUMMARY` só existe para
    // quem abre a execução, e ninguém abre a aba de Actions todo dia.
    const passo = yml.slice(yml.indexOf("- name: Avisar"));
    expect(passo, "o passo do aviso sumiu").toContain("github-script");
    expect(passo, "precisa rodar mesmo com o job vermelho").toMatch(/if:\s*always\(\)/);
    expect(passo, "sem isto, abre uma issue nova por dia").toContain("issues.createComment");
    expect(
      passo,
      'issue que fica aberta depois de consertado ensina a ignorar issue',
    ).toContain('state: "closed"');
  });

  it("sem as chaves públicas o job NÃO morre — as outras conferências rodam", () => {
    /**
     * O defeito de verdade, e o mais caro desta sessão.
     *
     * O passo das chaves terminava com `exit 1` quando não as achava. Como
     * elas vinham de um `.env` que o `.gitignore` exclui, na CI o passo morria
     * SEMPRE — e matava o job antes do passo `Conferir`. As cinco conferências
     * que não dependem de chave nenhuma (porta de entrada, rotas do site,
     * PubMed, MMCTS, calculadoras) não rodaram uma única vez em seis dias.
     *
     * Pior: o `conferir-publicacao.mjs` JÁ sai 2 (NÃO CONFERIDO) sozinho
     * quando falta a chave, e o `roda()` já sabe pintar isso de ⚠️. O sistema
     * de três estados estava pronto; eu pus um portão de dois estados na
     * frente dele.
     *
     * Falta de credencial é "não conferido", não "está errado".
     */
    const i = yml.indexOf("- name: Exportar as chaves públicas");
    expect(i, "o passo das chaves sumiu").toBeGreaterThan(0);
    const passo = yml.slice(i, yml.indexOf("\n      - name: ", i + 10));

    expect(
      passo,
      "voltou o `exit 1`: falta de chave mata o job e nenhuma conferência roda",
    ).not.toMatch(/^\s*exit 1\s*$/m);

    expect(passo, "as chaves públicas moram em `vars`, não em `.env` versionado")
      .toContain("vars.VITE_SUPABASE_URL");
    expect(passo, "sem chave, o passo precisa AVISAR em vez de morrer")
      .toContain("::warning::");
  });

  /**
   * A lista das seis. Se uma sair daqui, ela volta a não ser conferida por
   * ninguém — e o resumo do workflow continua verde, agora sobre menos coisa.
   */
  const CONFERENCIAS: [string, string][] = [
    ["a porta de entrada do site", "scripts/saude-do-site.mjs"],
    ["as rotas do site publicado", "npm run smoke"],
    ["o estado publicado contra o banco", "npm run publicacao"],
    ["as citações do PubMed", "npm run pmids"],
    ["os links do MMCTS", "npm run mmcts"],
    ["as calculadoras num navegador", "scripts/ferramentas-verificar.mjs"],
  ];

  for (const [oQue, comando] of CONFERENCIAS) {
    it(`confere ${oQue}`, () => {
      expect(yml, `${comando} saiu do workflow`).toContain(comando);
    });
  }

  /**
   * O veredito, EXECUTADO — não procurado como texto.
   *
   * A primeira versão deste teste procurava a linha
   * `[ "$diverge" -eq 0 ] && [ "$naoConferido" -eq 0 ]` dentro do YAML. A
   * inversão mostrou o buraco na hora: essa mesma expressão aparece DUAS vezes
   * no arquivo — no `if` que escolhe a frase do resumo e no veredito final — e
   * enfraquecer o veredito deixava a outra ocorrência no lugar, com o teste
   * passando. É a terceira vez nesta sessão que uma guarda minha casa com o
   * vocabulário em vez da garantia.
   *
   * Então aqui o bloco `run:` é extraído do próprio YAML, as seis conferências
   * de verdade são trocadas por comandos sintéticos com código de saída
   * escolhido, e o que se afirma é o código de saída do passo.
   */
  const cenarios: [string, string, "passa" | "reprova"][] = [
    ["tudo ok", 'roda "a" true\nroda "b" true', "passa"],
    ["uma diverge", 'roda "a" true\nroda "b" bash -c "exit 1"', "reprova"],
    ["uma NÃO CONFERIDA", 'roda "a" true\nroda "b" bash -c "exit 2"', "reprova"],
    ["saída inesperada (7)", 'roda "a" true\nroda "b" bash -c "exit 7"', "reprova"],
  ];

  for (const [nome, chamadas, esperado] of cenarios) {
    it(`veredito executado: ${nome} → ${esperado}`, () => {
      const dir = mkdtempSync(join(tmpdir(), "verif-"));
      try {
        const script = join(dir, "conferir.sh");
        writeFileSync(script, corpoDoPassoConferir(yml, chamadas));
        const r = spawnSync("bash", ["-e", script], {
          encoding: "utf8",
          timeout: 60_000,
          env: { ...process.env, GITHUB_STEP_SUMMARY: join(dir, "resumo.md") },
        });
        expect(r.error, "não consegui executar `bash`").toBeUndefined();
        const passou = r.status === 0;
        expect(
          passou,
          `esperava que o passo ${esperado === "passa" ? "passasse" : "reprovasse"}, ` +
            `e ele saiu ${r.status}.\n\n` +
            "Um `2` que passa verde é o resumo dizendo 'está tudo bem' sobre o que\n" +
            "ninguém olhou — a mentira exata que este repositório persegue.\n\n" +
            (r.stdout ?? "").slice(-400),
        ).toBe(esperado === "passa");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
      // Sobe `bash`: prazo próprio, maior que o do filho, senão quem estoura
      // primeiro é o Vitest (5 s no padrão) e o vermelho sai sem causa.
    }, 90_000);
  }

  it("o resumo separa DIVERGE de NÃO CONFERIDO", () => {
    // As duas coisas reprovam, mas só uma é urgente. Quem abrir o resumo tem de
    // saber, na primeira olhada, se o site quebrou ou se a fonte estava fora do
    // ar — senão o vermelho de terceiro vira ruído e alguém desliga a agenda.
    const dir = mkdtempSync(join(tmpdir(), "verif-"));
    try {
      const script = join(dir, "conferir.sh");
      const resumo = join(dir, "resumo.md");
      writeFileSync(
        script,
        corpoDoPassoConferir(yml, 'roda "x" bash -c "exit 1"\nroda "y" bash -c "exit 2"'),
      );
      spawnSync("bash", ["-e", script], {
        encoding: "utf8",
        timeout: 60_000,
        env: { ...process.env, GITHUB_STEP_SUMMARY: resumo },
      });
      const texto = readFileSync(resumo, "utf8");
      expect(texto, "a linha que diverge precisa aparecer como DIVERGE").toMatch(/\| x \|.*DIVERGE/);
      expect(texto, "a não conferida precisa aparecer como NÃO CONFERIDO")
        .toMatch(/\| y \|.*NÃO CONFERIDO/);
      // E a tabela não pode ser cortada ao meio pelos blocos de detalhe — foi o
      // que a primeira versão fazia, escrevendo `<details>` entre as linhas.
      const linhasDaTabela = texto.split("\n").filter((l) => /^\| [xy] \|/.test(l));
      expect(linhasDaTabela.length, "a tabela perdeu linhas").toBe(2);
      const iPrimeira = texto.indexOf("| x |");
      const iSegunda = texto.indexOf("| y |");
      const iDetalhe = texto.indexOf("<details>");
      expect(iDetalhe, "o bloco de detalhe entrou no meio da tabela").toBeGreaterThan(iSegunda);
      expect(iSegunda).toBeGreaterThan(iPrimeira);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    // Sobe `bash`: prazo próprio, pelo mesmo motivo do bloco acima.
  }, 90_000);

  it("uma conferência que falha não esconde as seguintes", () => {
    // Passo que falha encerra o job. Se as seis estivessem em passos separados,
    // a primeira que quebrasse esconderia todas as outras — e o resumo diria
    // menos do que se sabe.
    const passosComRoda = yml.split(/\n {6}- name: /).filter((p) => /^\s*roda /m.test(p));
    expect(
      passosComRoda.length,
      "as conferências devem rodar todas dentro de um passo só",
    ).toBe(1);
  });
});

describe("o script da porta de entrada", () => {
  it("existe", () => {
    expect(saude, `${SAUDE} não existe`).not.toBe("");
  });

  it("separa os três estados, e o 2 não é 0 nem 1", () => {
    // Conferido rodando contra servidores falsos: BOOT_ERROR → 1,
    // missing_site_key → 1, 200 com siteKey vazia → 1, 200 sem o campo → 1,
    // 500 sem JSON → 1, 200 com a chave → 0, porta fechada → 2.
    expect(saude).toMatch(/process\.exit\(1\)/);
    expect(saude, "rede inalcançável é NÃO CONFERIDO, não 'está quebrado'")
      .toMatch(/process\.exit\(2\)/);
  });

  it("não aceita 200 como prova — a prova é a chave", () => {
    // O caso mais traiçoeiro: 200 com corpo vazio parece sucesso para qualquer
    // verificação que olhe só o código HTTP, e fecha o login do mesmo jeito. O
    // widget trata `siteKey: ""` e erro de rede exatamente igual.
    expect(saude).toMatch(/siteKey.*length === 0|length === 0.*siteKey/s);
  });

  it("chama só a function que não tem efeito colateral", () => {
    // A varredura de boot em TODAS as functions custou uma linha de lixo em
    // `client_errors`: a `report-error` é pública por construção e grava o que
    // recebe. Conferir saúde não pode escrever nada.
    expect(saude).toContain("turnstile-config");
    for (const comEfeito of ["report-error", "knowledge-seed", "weekly-digest", "welcome-email"]) {
      expect(
        saude.replace(/\/\*[\s\S]*?\*\//g, ""),
        `${comEfeito} tem efeito colateral e não pode entrar numa sonda diária`,
      ).not.toContain(`functions/v1/${comEfeito}`);
    }
  });
});
