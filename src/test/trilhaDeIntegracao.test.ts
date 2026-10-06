/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * A trilha de integração não perde linha em silêncio — e o canal que relata a
 * perda também não.
 *
 * ## O que foi medido
 *
 * `log_integration_event` é chamada SETE vezes nas edge functions —
 * `fhir-ingest` (3), `fhir-read` (3), `hospital-api-key-create` (1). **Nenhuma
 * das sete recebia o resultado.** Zero de sete.
 *
 * O cliente do Supabase devolve `{ error }` em vez de lançar, então um `await`
 * cru engole a recusa: o evento não entra, a requisição responde 200, e nada
 * diz. É o mesmo defeito que `src/lib/auditLog.ts` já conserta no frontend.
 *
 * ## Por que esta trilha e não outra
 *
 * Ela registra qual hospital leu ou gravou dados de qual paciente. O comentário
 * em `fhir-ingest`, três linhas acima de uma das chamadas, diz o que está em
 * jogo:
 *
 *   > "A trilha passaria a dizer que não havia consentimento numa noite em que
 *   >  havia, e é dela que sai a prova em auditoria de LGPD."
 *
 * O autor estava pensando na veracidade da trilha; faltava conferir a escrita
 * que a produz. E `integration_audit_log` está, de propósito, fora de toda
 * lista de expurgo desta base — é tratada como prova. Prova que perde linhas
 * sem avisar não é prova.
 *
 * ## A medição que eu tive de refazer
 *
 * A primeira varredura disse "18 de 21 RPCs conferem o erro". Ela decidia por
 * PROXIMIDADE — um `error` nos 150 caracteres anteriores — e contou o `error`
 * do INSERT logo acima como se fosse a conferência do RPC. Proximidade não é
 * posse.
 *
 * Refeita pela forma da chamada (`await x.rpc(` sem atribuição): zero de sete.
 * O número errado era mais tranquilizador que o certo, que é o motivo de valer
 * refazer.
 *
 * ## O que esta guarda NÃO garante
 *
 * Que a trilha esteja completa em produção — para isso o evento tem de ser
 * escrito e lido de volta, e nenhum teste de arquivo faz isso. O que ela fecha
 * é a classe: nenhuma chamada nova pode descartar o resultado.
 */

const FUNCOES = "supabase/functions";
const HELPER = `${FUNCOES}/_shared/trilhaDeIntegracao.ts`;
const LOG_ERROR = `${FUNCOES}/_shared/logError.ts`;

/** Tira comentários, preservando quebras de linha. */
function semComentarios(texto: string): string {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (_m, p1) => p1);
}

/** Os `index.ts` das edge functions, pelo git. */
function arquivosDeFuncoes(): string[] {
  return execFileSync("git", ["ls-files", FUNCOES], { encoding: "utf8" })
    .trim().split("\n")
    .filter((f) => f.endsWith("/index.ts"));
}

describe("a trilha de integração", () => {
  it("nenhuma função chama `log_integration_event` direto", () => {
    /**
     * A regra é sobre a classe: a decisão de conferir mora no helper, e sete
     * sítios chamando o RPC na mão são sete chances de esquecer — foram sete de
     * sete.
     */
    const culpadas: string[] = [];
    let varridos = 0;
    for (const arquivo of arquivosDeFuncoes()) {
      varridos++;
      const limpo = semComentarios(readFileSync(arquivo, "utf8"));
      for (const m of limpo.matchAll(/\.rpc\(\s*["'`]log_integration_event["'`]/g)) {
        const linha = limpo.slice(0, m.index).split("\n").length;
        culpadas.push(`  · ${arquivo}:${linha}`);
      }
    }

    expect(varridos, "a varredura não achou função nenhuma").toBeGreaterThanOrEqual(10);
    expect(
      culpadas,
      `\n${culpadas.join("\n")}\n\n` +
        "Chamada direta a `log_integration_event`. O cliente do Supabase devolve\n" +
        "`{ error }` em vez de lançar: um `await` cru engole a recusa, o evento não\n" +
        "entra na trilha, a requisição responde 200 e nada diz.\n\n" +
        "Esta é a trilha de onde sai a prova em auditoria de LGPD — qual hospital\n" +
        "leu ou gravou dados de qual paciente —, e `integration_audit_log` está\n" +
        "fora de toda lista de expurgo justamente porque é tratada como prova.\n\n" +
        "Use `registrarEventoDeIntegracao(admin, { … })` de\n" +
        "`../_shared/trilhaDeIntegracao.ts`.",
    ).toEqual([]);
  }, 30_000);

  it("o helper existe, confere o `error` e grita quando não grava", () => {
    const helper = semComentarios(readFileSync(HELPER, "utf8"));
    expect(helper, "o helper não chama o RPC").toMatch(/\.rpc\(\s*"log_integration_event"/);
    expect(
      helper,
      "o helper não recebe o `error` — seria o mesmo `await` cru com outro nome",
    ).toMatch(/\{\s*error\s*\}\s*=\s*await/);
    /**
     * O grito, nos dois canais — e ALCANÇÁVEL, não só presente.
     *
     * A primeira versão desta asserção era `toMatch(/\blogError\(/)`. A
     * inversão passou: envolvi a chamada num `if (false)` e a guarda aprovou,
     * porque o texto continuava lá. Guarda que confere a presença do texto não
     * confere que ele roda — é a mesma lição que o teste da assinatura do aviso
     * por issue já registrou, e eu a repeti.
     *
     * Agora: depois de saber que HÁ erro (`if (!error) return true;`), o
     * caminho até o relato não tem condicional nenhuma.
     */
    expect(helper, "o helper não relata por `logError`").toMatch(/\blogError\(/);
    expect(helper, "o helper não grita no log da função").toMatch(/console\.error\(/);
    // Depois do marcador, não a partir dele: o próprio `if (!error)` é um `if`,
    // e incluí-lo no recorte fazia a guarda acusar a si mesma.
    const MARCADOR = "if (!error) return true;";
    const depoisDoErro = helper.slice(helper.indexOf(MARCADOR) + MARCADOR.length);
    const ateORelato = depoisDoErro.slice(0, depoisDoErro.indexOf("logError("));
    expect(ateORelato.length, "não achei o trecho entre o erro e o relato").toBeGreaterThan(10);
    expect(
      ateORelato,
      "há um `if` entre descobrir o erro e relatá-lo: o relato deixou de ser " +
        "incondicional, e uma perda de trilha pode passar calada",
    ).not.toMatch(/\bif\s*\(/);
    expect(
      helper,
      "o helper passou a devolver `void` — quem chama perde o jeito de saber",
    ).toMatch(/Promise<boolean>/);
  });

  it("o helper NÃO manda o `patient_id` para `client_errors`", () => {
    /**
     * `client_errors` é o que o painel de admin mostra e o que o resumo semanal
     * manda por e-mail. Identificar o paciente ali não ajuda a consertar a
     * trilha e espalha o dado por um caminho que não foi desenhado para ele.
     * O `hospital_id` basta para localizar o problema.
     */
    const helper = semComentarios(readFileSync(HELPER, "utf8"));
    const metadata = helper.slice(helper.indexOf("metadata:"), helper.indexOf("});", helper.indexOf("metadata:")));
    expect(metadata.length, "não achei o `metadata` do relato").toBeGreaterThan(20);
    expect(
      /patient_id/.test(metadata),
      "o `patient_id` entrou no metadata do relato — ele vai para `client_errors`, " +
        "que o painel de admin mostra e o resumo semanal manda por e-mail",
    ).toBe(false);
    expect(metadata, "o relato precisa dizer de qual hospital").toMatch(/hospital_id/);
  });
});

describe("o canal que relata as perdas", () => {
  it("`logError` confere as DUAS escritas e devolve se gravou", () => {
    /**
     * O defeito que quase me fez relatar para dentro de um buraco.
     *
     * O docstring de `logError` raciocina com cuidado sobre a LEITURA de
     * agrupamento poder degradar em silêncio, e promete que nesse caso "o erro
     * CONTINUA sendo registrado". As duas ESCRITAS não olhavam o `error`: a
     * promessa não tinha nada por trás, e a função cujo trabalho é tornar
     * falhas visíveis podia perder a falha.
     */
    const logError = semComentarios(readFileSync(LOG_ERROR, "utf8"));

    expect(logError, "`logError` não devolve mais se gravou").toMatch(/Promise<boolean>/);

    /**
     * CADA escrita, separadamente — e as duas inversões que me cobraram isto.
     *
     *  · a primeira versão checava `toMatch(/erroInsert/)`. Renomear a variável
     *    para `erroInsertIgnorado` passava: substring não é identificador;
     *  · e checava `.select("id")` no ARQUIVO. Tirando o `.select` de UMA das
     *    duas escritas, a outra ainda satisfazia a busca — a guarda dizia
     *    "nenhuma das escritas pede as linhas" sobre uma que não pedia mais.
     *
     * Agora o trecho de cada escrita é recortado e conferido por si.
     */
    const trechoDoUpdate = logError.slice(
      logError.indexOf("if (recente) {"),
      logError.indexOf("return true;", logError.indexOf("if (recente) {")),
    );
    const trechoDoInsert = logError.slice(logError.indexOf('.insert({', logError.indexOf("const { data: inseridas")) - 200);

    for (const [nome, trecho, variavel] of [
      ["o UPDATE de repetição", trechoDoUpdate, "erroUpdate"],
      ["o INSERT da linha nova", trechoDoInsert, "erroInsert"],
    ] as const) {
      expect(trecho.length, `não achei o trecho de ${nome}`).toBeGreaterThan(100);
      // Recebido no destructuring E usado numa condição. Só o nome aparecer não
      // basta: foi assim que `erroInsertIgnorado` passou pela versão anterior.
      expect(trecho, `${nome} não recebe o erro`)
        .toMatch(new RegExp(`error:\\s*${variavel}\\s*\\}`));
      expect(trecho, `${nome} recebe o erro e não o usa`)
        .toMatch(new RegExp(`if\\s*\\(\\s*${variavel}\\b`));
      // E as linhas de volta: numa recusa de RLS o PostgREST responde 200 com
      // `error: null` e ZERO linhas.
      expect(
        trecho,
        `${nome} não pede as linhas de volta — sem \`.select(...)\` a recusa de ` +
          "RLS (200 com zero linhas) passa por gravação",
      ).toMatch(/\.select\("id"\)/);
    }

    // E o caminho sem credencial: devolver `true` ali afirmaria um registro
    // que não existe.
    expect(
      logError,
      "o caminho sem SUPABASE_URL/SERVICE_ROLE_KEY ainda devolve sucesso",
    ).toMatch(/SERVICE_ROLE_KEY[\s\S]{0,400}return false/);
  });

  it("`report-error` responde se REGISTROU, não se a requisição chegou", () => {
    const fonte = semComentarios(readFileSync(`${FUNCOES}/report-error/index.ts`, "utf8"));
    expect(
      fonte,
      "`report-error` voltou a responder `{ ok: true }` fixo: o endpoint cujo " +
        "trabalho é tornar falhas visíveis diria sucesso sobre o próprio fracasso",
    ).not.toMatch(/JSON\.stringify\(\{\s*ok:\s*true\s*\}\)/);
    expect(fonte, "a resposta não usa o retorno do `logError`")
      .toMatch(/ok:\s*registrou/);
  });
});
