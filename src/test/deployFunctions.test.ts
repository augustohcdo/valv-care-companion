// Este teste lê o disco; tsconfig.app.json restringe `types`, daí a referência.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";

/**
 * O caminho que leva as edge functions à produção — e o segredo que ele carrega.
 *
 * ## Os dois defeitos que este arquivo guarda
 *
 * 1. **Não havia deploy nenhum.** A Vercel publicava o front a cada push e as
 *    functions não subiam por caminho algum. Ninguém percebeu por semanas
 *    porque a CI ficava verde: ela roda os checks, não publica. O sintoma
 *    apareceu quando o seed devolveu `total: 11` com 18 trechos no repositório
 *    — e, junto, a descoberta de que a `clinical-ai` respondia por uma diretriz
 *    anterior à que o painel de conduta anunciava.
 *
 * 2. **O token é root, e o repositório é público.** `SUPABASE_ACCESS_TOKEN` dá
 *    controle sobre a conta inteira do Supabase. Num repositório público, um
 *    workflow que rode em `pull_request` com esse segredo no ambiente entrega o
 *    token a qualquer pessoa que abra um PR de um fork. É uma linha de YAML de
 *    distância, e é o tipo de linha que alguém acrescenta "para testar o deploy
 *    no PR".
 *
 * Por isso a propriedade de segurança é cobrada por teste, e não confiada à
 * memória de quem for mexer no arquivo.
 */

const WORKFLOW = ".github/workflows/deploy-functions.yml";

describe("o deploy das edge functions", () => {
  it("existe", () => {
    expect(
      existsSync(WORKFLOW),
      "sem este workflow, mexer em supabase/functions/ não muda nada em produção — " +
        "e a CI continua verde, que é o que esconde o problema",
    ).toBe(true);
  });

  const yml = existsSync(WORKFLOW) ? readFileSync(WORKFLOW, "utf8") : "";
  /** Só os gatilhos: o bloco entre `on:` e a próxima chave de topo. */
  const gatilhos = yml.split(/\npermissions:|\njobs:/)[0];

  it("NUNCA roda em pull_request", () => {
    // A regra que protege o token. Um PR de fork num repositório público
    // executaria o workflow com o segredo no ambiente.
    expect(
      gatilhos,
      "workflow de deploy disparando em pull_request: num repositório público " +
        "isso entrega o SUPABASE_ACCESS_TOKEN a quem abrir um PR de fork",
    ).not.toMatch(/^\s*pull_request/m);
    expect(gatilhos).not.toMatch(/pull_request_target/);
  });

  it("roda na main e pode ser disparado à mão", () => {
    expect(gatilhos, "sem push na main, o deploy volta a depender de alguém lembrar")
      .toMatch(/push:/);
    expect(gatilhos).toMatch(/branches:\s*\[main\]/);
    // O disparo manual é como se sai de uma situação já commitada e não
    // publicada — sem ele, seria preciso inventar um commit.
    expect(gatilhos, "sem workflow_dispatch não há como publicar o que já está commitado")
      .toMatch(/workflow_dispatch/);
  });

  it("pede permissão mínima", () => {
    expect(yml).toMatch(/permissions:\s*\n\s*contents:\s*read/);
    expect(yml, "permissão de escrita num workflow que carrega token root")
      .not.toMatch(/contents:\s*write/);
  });

  it("o token vem de secrets e não aparece em comando nenhum", () => {
    expect(yml).toMatch(/secrets\.SUPABASE_ACCESS_TOKEN/);
    // O CLI lê a variável de ambiente. Passar o valor num argumento o colocaria
    // na linha de comando — visível em log e em lista de processos.
    expect(yml, "token passado como argumento de comando").not.toMatch(
      /--token[= ]|supabase login --token/,
    );
  });

  it("recusa em vez de falhar torto quando o segredo não está cadastrado", () => {
    // Sem a parada explícita, o erro seria uma mensagem de autenticação
    // genérica, e a conclusão provável seria "problema do Supabase" — quando a
    // causa é o segredo faltando.
    expect(yml).toMatch(/Falta o segredo SUPABASE_ACCESS_TOKEN/);
  });

  it("confere o tipo das functions antes de publicar", () => {
    // O workflow pode ser disparado à mão, fora do fluxo da CI. Publicar sem
    // conferir seria publicar no escuro.
    expect(yml).toMatch(/deno check/);
  });

  it("publica TODAS as functions, não só a que mudou", () => {
    // A divergência acumulada é de várias rodadas. Publicar só a última
    // deixaria o resto para trás — que é como chegamos aqui.
    const linhaDeploy = yml.split("\n").find((l) => l.includes("functions deploy"));
    expect(linhaDeploy, "não achei o comando de deploy").toBeTruthy();
    expect(
      linhaDeploy!.replace(/--project-ref\s+\S+/, ""),
      "o deploy nomeia uma função específica; as demais ficariam para trás",
    ).toMatch(/functions deploy\s*$/);
  });

  it("aponta para o projeto certo", () => {
    // O ref não é segredo — já está em supabase/config.toml e nas URLs públicas
    // das functions. Mas apontar para o projeto errado publicaria o código numa
    // conta que não é a nossa.
    const config = readFileSync("supabase/config.toml", "utf8");
    const ref = config.match(/project_id\s*=\s*"([^"]+)"/)?.[1];
    expect(ref, "sem project_id em supabase/config.toml").toBeTruthy();
    expect(yml, `o workflow não usa o project_ref de config.toml (${ref})`).toContain(ref!);
  });

  it("dispara sozinho quando as functions mudam", () => {
    // Sem isto o deploy volta a depender de alguém lembrar de rodar — que é
    // exatamente o estado de onde saímos.
    expect(yml).toMatch(/paths:/);
    expect(yml).toMatch(/supabase\/functions/);
  });

  it("o repositório tem functions para publicar", () => {
    // Contraprova: as exigências acima passariam com a pasta vazia.
    const dirs = readdirSync("supabase/functions").filter(
      (n) => n !== "_shared" && n !== "node_modules" &&
        statSync(`supabase/functions/${n}`).isDirectory(),
    );
    expect(dirs.length).toBeGreaterThan(10);
    expect(dirs).toContain("clinical-ai");
    expect(dirs).toContain("knowledge-seed");
  });
});

/**
 * A regra vale para TODO workflow que toca o token, não só o do deploy.
 *
 * O `deploy-functions.yml` nasceu com as três proteções escritas nele. Um dia
 * depois nasceu o `db.yml`, que executa SQL em produção com o MESMO token — e
 * um teste amarrado ao nome do primeiro arquivo não teria olhado para o
 * segundo. Guarda que cobre um caso nominal envelhece na primeira vez que
 * alguém acrescenta o caso seguinte.
 *
 * Então a varredura é sobre a PROPRIEDADE: qualquer workflow que carregue
 * `SUPABASE_ACCESS_TOKEN` obedece às mesmas regras, hoje e nos próximos.
 */
describe("todo workflow que carrega o token do Supabase", () => {
  const DIR = ".github/workflows";
  const comToken = readdirSync(DIR)
    .filter((n) => /\.ya?ml$/.test(n))
    .map((n) => ({ nome: `${DIR}/${n}`, yml: readFileSync(`${DIR}/${n}`, "utf8") }))
    .filter(({ yml }) => yml.includes("SUPABASE_ACCESS_TOKEN"));

  it("existe pelo menos um, senão a varredura cobre nada", () => {
    expect(comToken.map((w) => w.nome)).toContain(".github/workflows/deploy-functions.yml");
    expect(comToken.length).toBeGreaterThanOrEqual(2);
  });

  it.each(comToken.map((w) => [w.nome, w.yml] as const))(
    "%s nunca roda em pull_request",
    (_nome, yml) => {
      // Comentários fora: o `deploy-functions.yml` EXPLICA por que não roda em
      // pull_request, e a primeira versão desta varredura acusou justamente a
      // explicação. Guarda que casa com a palavra, e não com o gatilho, pune
      // quem documentou a regra — foi o mesmo erro que cometi hoje na varredura
      // da diretriz.
      const gatilhos = yml
        .split(/\npermissions:|\njobs:/)[0]
        .split("\n")
        .filter((l) => !/^\s*#/.test(l))
        .join("\n");
      expect(
        gatilhos,
        "num repositório público, um PR de fork rodaria este job com o token root no ambiente",
      ).not.toMatch(/^\s*pull_request/m);
    },
  );

  it.each(comToken.map((w) => [w.nome, w.yml] as const))(
    "%s pede permissão mínima",
    (_nome, yml) => {
      expect(yml).toMatch(/permissions:\s*\n\s*contents:\s*read/);
      expect(yml).not.toMatch(/contents:\s*write/);
    },
  );

  it.each(comToken.map((w) => [w.nome, w.yml] as const))(
    "%s não põe o token na linha de comando",
    (_nome, yml) => {
      // Argumento de comando aparece em log e em lista de processos. A variável
      // de ambiente, não.
      expect(yml).not.toMatch(/--token[= ]|-H "Authorization: Bearer \$\{\{/);
    },
  );

  it.each(comToken.map((w) => [w.nome, w.yml] as const))(
    "%s recusa explicitamente quando o segredo falta",
    (_nome, yml) => {
      expect(
        yml,
        "sem a recusa, o erro vira uma falha de autenticação genérica e a causa real se perde",
      ).toMatch(/Falta o segredo SUPABASE_ACCESS_TOKEN/);
    },
  );
});
