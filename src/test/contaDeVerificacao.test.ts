// Este teste lê o disco; tsconfig.app.json restringe `types`, daí a referência.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

/**
 * A conta temporária que abre as 39 telas protegidas — e a porta que ela é.
 *
 * ## Por que isto é cobrado por teste
 *
 * Para varrer as rotas de `/app/` num navegador é preciso uma conta capaz de
 * ENTRAR na base de produção. É pouca coisa — sem vínculo nenhum, a RLS não
 * deixa ver nada, e ela vive minutos — mas é uma porta, e a diferença entre
 * "minutos" e "para sempre" é um passo de YAML.
 *
 * O `demo-seed.mjs` já registrou o raciocínio quando criou os três médicos
 * fictícios banidos até 2099: *"sem isso seriam três portas de entrada a
 * mais"*. Aqui a conta precisa entrar, então as garantias são outras — e são
 * estas, cobradas aqui em vez de confiadas à memória de quem for mexer:
 *
 *   1. a remoção roda SEMPRE, mesmo quando a varredura falha;
 *   2. a remoção é CONFERIDA, e não deduzida do 200 do DELETE;
 *   3. nenhum papel privilegiado é concedido;
 *   4. a senha não é escrita em lugar nenhum;
 *   5. a sessão não vira artefato do workflow.
 *
 * A 1 é a que mais importa e a mais fácil de perder: `if: always()` some numa
 * refatoração sem barulho nenhum, e o sintoma — uma conta de produção de pé —
 * não aparece em teste, em log nem em tela. Aparece num vazamento.
 */

const WORKFLOW = ".github/workflows/rotas-autenticadas.yml";
const SCRIPT = "scripts/conta-de-verificacao.mjs";

describe("o workflow que abre as telas protegidas", () => {
  it("existe", () => {
    expect(
      existsSync(WORKFLOW),
      "sem ele, as 39 rotas de /app/ continuam sem nenhuma prova de que montam",
    ).toBe(true);
  });

  const yml = existsSync(WORKFLOW) ? readFileSync(WORKFLOW, "utf8") : "";

  it("NUNCA roda em pull_request", () => {
    // Mesma regra do deploy, e pelo mesmo motivo: o repositório é público e o
    // SUPABASE_ACCESS_TOKEN é root sobre a conta inteira do Supabase. Um PR de
    // fork executaria isto com o segredo no ambiente.
    const gatilhos = yml.split(/\npermissions:|\njobs:/)[0];
    expect(gatilhos, "workflow com token root disparando em pull_request").not.toMatch(
      /^\s*pull_request/m,
    );
    expect(gatilhos).not.toMatch(/pull_request_target/);
  });

  it("é só manual — criar conta de produção não acontece a cada push", () => {
    const gatilhos = yml.split(/\npermissions:|\njobs:/)[0];
    expect(gatilhos).toMatch(/workflow_dispatch/);
    expect(gatilhos, "disparo automático abriria a porta a cada push").not.toMatch(/^\s*push:/m);
    expect(gatilhos, "disparo por agenda abriria a porta sem ninguém olhando")
      .not.toMatch(/schedule:/);
  });

  it("pede permissão mínima", () => {
    expect(yml).toMatch(/permissions:\s*\n\s*contents:\s*read/);
    expect(yml).not.toMatch(/contents:\s*write/);
  });

  /**
   * A garantia central. Sem `if: always()`, qualquer falha da varredura pula a
   * remoção e a conta fica de pé na produção — justamente no caso em que
   * alguém já foi olhar outra coisa.
   */
  it("apaga a conta SEMPRE, inclusive quando a varredura falha", () => {
    const passos = yml.split(/\n {6}- name: /);
    const remocao = passos.find((p) => /Apagar a conta/.test(p));
    expect(remocao, "não achei o passo que apaga a conta").toBeTruthy();
    expect(
      remocao!,
      "o passo de remoção não tem `if: always()` — uma falha na varredura deixaria " +
        "uma conta com acesso à produção de pé",
    ).toMatch(/if:\s*always\(\)/);
  });

  it("cada tipo de conta é um job, para cada um ter a própria remoção", () => {
    // Num job só com laço, a falha do primeiro tipo pularia a remoção da conta
    // dele — o `if: always()` cobre o passo, não a iteração.
    expect(yml).toMatch(/strategy:/);
    expect(yml).toMatch(/fail-fast:\s*false/);
  });

  it("não concede papel privilegiado", () => {
    // O vigia deste projeto dispara alerta por concessão de papel privilegiado
    // nas últimas 24h. Um workflow que concede `admin` para varrer tela faria o
    // alarme tocar toda vez — e alarme que toca à toa é alarme que se ignora.
    const tudo = yml + readFileSync(SCRIPT, "utf8");
    expect(tudo, "concessão de papel privilegiado para varrer tela").not.toMatch(
      /user_roles|has_role|_role:\s*['"]admin|'admin'\s*\)/,
    );
  });

  it("a sessão não vira artefato", () => {
    // O arquivo carrega um access_token válido. Artefato de workflow fica
    // baixável por quem tem acesso ao repositório, por dias.
    const passos = yml.split(/\n {6}- name: /);
    const artefato = passos.find((p) => /upload-artifact/.test(p));
    expect(artefato, "não achei o passo de artefato").toBeTruthy();
    expect(artefato!, "o arquivo da sessão está indo para artefato").not.toMatch(
      /path:.*sessao/,
    );
  });
});

describe("o script da conta de verificação", () => {
  const js = readFileSync(SCRIPT, "utf8");

  /**
   * Só o corpo da função `apagar`, e não o arquivo inteiro.
   *
   * A primeira versão deste teste procurava as consultas no arquivo todo — e a
   * inversão a reprovou antes mesmo de rodar: `public.profiles where user_id`
   * também aparece na função `criar`, que confere se o perfil nasceu. Quer
   * dizer que a guarda passaria com a conferência da REMOÇÃO removida,
   * satisfeita por uma consulta de outro assunto.
   *
   * É o mesmo erro de mira que esta sessão já cometeu três vezes: casar com o
   * texto em vez de com a coisa. Aqui o recorte é o que dá sentido à busca.
   */
  const corpoDoApagar = js.slice(
    js.indexOf("async function apagar("),
    js.indexOf("// ---------------------------------------------------------------- main"),
  );

  it("o recorte da função apagar não veio vazio", () => {
    // Sem isto, renomear a função faria `slice` devolver "" e os dois testes
    // abaixo passariam a procurar em lugar nenhum — verdes por não terem olhado.
    expect(corpoDoApagar.length, "não achei o corpo de `apagar` no script").toBeGreaterThan(300);
    expect(corpoDoApagar).toContain("method: \"DELETE\"");
  });

  it("CONFERE a remoção em vez de confiar no DELETE", () => {
    // O ponto inteiro deste arquivo. Um DELETE que responde 200 diz que a
    // requisição foi aceita, não que a linha sumiu — e aqui a diferença entre
    // as duas coisas é uma conta de produção viva sem ninguém saber.
    expect(corpoDoApagar, "a remoção não reconsulta auth.users").toMatch(
      /from auth\.users where id/,
    );
    expect(corpoDoApagar, "a remoção não reconsulta public.profiles").toMatch(
      /from public\.profiles where user_id/,
    );
    // E o resultado da reconsulta tem de MUDAR a saída do script: reconsultar e
    // ignorar seria o mesmo defeito com um passo a mais.
    expect(corpoDoApagar, "a reconsulta não leva a lugar nenhum").toMatch(/A CONTA NÃO FOI APAGADA/);
    expect(corpoDoApagar, "a reconsulta não faz o script falhar").toMatch(/process\.exit\(1\)/);
  });

  it("grava o id da conta antes das conferências, não depois", () => {
    // Se uma conferência reprovar depois da criação, a conta já existe. É o
    // arquivo do id que o passo `if: always()` usa para achá-la — gravá-lo só
    // no fim deixaria ponta solta exatamente quando algo deu errado.
    const posId = js.indexOf(".id`, criado.id");
    const posPerfil = js.indexOf("public.profiles where user_id");
    // `await cunharSessao(` e não `cunharSessao(`: a segunda casa com a
    // DEFINIÇÃO da função, que fica acima, e o teste comparava posição de
    // declaração com posição de chamada. Reprovou na primeira execução — por um
    // defeito meu, no teste, não no script.
    const posSessao = js.indexOf("await cunharSessao(");
    expect(posId, "não achei a gravação do arquivo de id").toBeGreaterThan(0);
    expect(posSessao, "não achei a chamada de cunharSessao").toBeGreaterThan(0);
    expect(posId, "o id é gravado depois da checagem de perfil").toBeLessThan(posPerfil);
    expect(posId, "o id é gravado depois de cunhar a sessão").toBeLessThan(posSessao);
  });

  it("a senha é aleatória e não é impressa", () => {
    expect(js).toMatch(/randomBytes\(\s*32\s*\)/);
    // Nenhum `console.log` pode receber a senha. A conta é temporária, mas o
    // log do workflow fica.
    for (const linha of js.split("\n")) {
      if (/console\.(log|error)/.test(linha)) {
        expect(linha, `senha em log: ${linha.trim().slice(0, 90)}`).not.toMatch(/\bsenha\b/);
      }
    }
  });

  it("o e-mail diz o que a conta é e usa domínio que não recebe nada", () => {
    // `.invalid` é reservado pela RFC 2606: não resolve, ninguém recebe. E o
    // prefixo existe para quem abrir auth.users não levar susto com uma conta
    // anônima no meio dos usuários reais.
    expect(js).toMatch(/verificacao-de-rotas-apagar/);
    expect(js).toMatch(/@valvepath\.invalid/);
  });

  it("não contorna o captcha do login", () => {
    // O formulário exige Turnstile. A sessão vem da API de administração — que
    // é o caminho previsto — e não de um atalho em volta da proteção.
    expect(js).toMatch(/admin\/generate_link|grant_type=password/);
    expect(js, "sinal de captcha forjado").not.toMatch(/captcha[_-]?token\s*[:=]\s*['"]/i);
  });
});
