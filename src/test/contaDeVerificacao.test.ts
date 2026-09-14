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

  /**
   * Semanal, nunca por push.
   *
   * Este teste já cravou o contrário — exigia que NÃO houvesse `schedule`,
   * porque criar conta de produção sem ninguém olhando parecia troca ruim. A
   * troca real acabou sendo outra: sem agenda, as 39 telas passaram semanas sem
   * que nada as abrisse, e "de propósito" virou "quando alguém lembra". O dono
   * do projeto decidiu pela agenda semanal.
   *
   * O que NÃO mudou, e continua cobrado aqui: nada disso roda a cada push, e
   * nunca em `pull_request` — o repositório é público e o token é root.
   *
   * E o que a agenda passou a exigir está logo abaixo: a varredura de restos.
   */
  it("roda por agenda semanal, e nunca a cada push", () => {
    const gatilhos = yml.split(/\npermissions:|\njobs:/)[0];
    expect(gatilhos).toMatch(/workflow_dispatch/);
    expect(gatilhos, "sem agenda, as 39 telas voltam a depender de alguém lembrar")
      .toMatch(/^\s*schedule:/m);
    expect(gatilhos, "disparo a cada push abriria a porta o tempo todo")
      .not.toMatch(/^\s*push:/m);

    // Semanal, e não diária ou de hora em hora: o campo do dia da semana (o
    // quinto) precisa nomear um dia, senão o cron roda todo dia.
    const cron = gatilhos.match(/-\s*cron:\s*["']([^"']+)["']/)?.[1] ?? "";
    expect(cron, "não achei a expressão cron").not.toBe("");
    const diaDaSemana = cron.trim().split(/\s+/)[4];
    expect(
      diaDaSemana,
      `a agenda é "${cron}" — com "*" no dia da semana, a conta de produção nasce TODO DIA`,
    ).not.toBe("*");
  });

  /**
   * A garantia que a agenda trouxe junto.
   *
   * `if: always()` cobre falha de passo. Não cobre runner morto, job cancelado
   * pela infraestrutura, nem falha do próprio passo de remoção — e cada um
   * desses deixa uma conta capaz de entrar na produção de pé. Enquanto havia
   * alguém olhando o resultado, isso aparecia; rodando por agenda, não aparece:
   * a conta fica de pé para sempre e a semana seguinte cria outra.
   */
  it("varre contas que sobraram de execuções anteriores, e reprova quando acha", () => {
    expect(
      yml,
      "sem esta varredura, uma remoção que falhe uma vez vaza uma conta de produção para sempre",
    ).toMatch(/--varrer-restos/);

    // `slice(1)`: o elemento 0 é tudo que vem ANTES do primeiro passo — o
    // cabeçalho do arquivo, onde os comentários explicam esta varredura e citam
    // `if: always()`. Sem cortá-lo, as asserções abaixo passariam lendo a
    // explicação em vez do passo. Aconteceu com as duas, e é o motivo de este
    // comentário existir.
    const etapas = yml.split(/\n {6}- name: /).slice(1);
    const varredura = etapas.find((p) => /--varrer-restos/.test(p));
    expect(varredura, "não achei o passo").toBeTruthy();
    expect(
      varredura!,
      "o caso que mais interessa é aquele em que algo acima falhou",
    ).toMatch(/if:\s*always\(\)/);

    // Por último: reprovando, ele cancelaria o que viesse depois — e o que vem
    // depois seria a varredura das 39 telas, que é a razão de o workflow existir.
    //
    // A ordem se compara entre PASSOS, e não por `indexOf` no texto cru: a
    // primeira ocorrência de `--varrer-restos` no arquivo é o comentário do
    // cabeçalho que explica o passo, e comparar com ela deu 1995 > 9047 falso.
    // Guarda que mede a posição da explicação em vez da posição do código é a
    // mesma família de erro que casa com a palavra em vez da garantia.
    const iVarredura = etapas.findIndex((p) => /--varrer-restos/.test(p));
    const iRotas = etapas.findIndex((p) => /rotas-renderizam\.mjs/.test(p));
    expect(iRotas, "não achei o passo que varre as telas").toBeGreaterThanOrEqual(0);
    expect(
      iVarredura,
      "a varredura de restos precisa vir DEPOIS da varredura das telas",
    ).toBeGreaterThan(iRotas);
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

  /**
   * A `service_role` ignora toda a RLS: com ela se lê o prontuário de qualquer
   * paciente da base. Ela entrou neste workflow por escolha deliberada — é o
   * caminho oficial para criar e apagar a conta — e o risco que essa escolha
   * cria fica aqui, cobrado.
   *
   * O caminho do estrago é curto: o Vite embute no bundle **tudo** que tenha
   * prefixo `VITE_`. Basta alguém pôr a chave no `.env` do build, ou no `env:`
   * do passo que constrói, e ela passa a ser servida a cada visita ao site.
   * Não é hipótese exótica: é uma linha, e a linha parece inofensiva.
   */
  it("a service_role NÃO chega ao passo de build", () => {
    const passos = yml.split(/\n {6}- name: /);
    for (const passo of passos) {
      const nome = passo.split("\n")[0].trim();
      const temChave = /SUPABASE_SERVICE_ROLE_KEY/.test(passo);
      // A varredura de restos entra na lista porque ela APAGA conta pela API de
      // administração — é o mesmo trabalho do passo "Apagar a conta", sobre o
      // lixo de execuções anteriores. Não é alargamento: é o terceiro passo que
      // legitimamente mexe em conta, e nenhum deles constrói bundle.
      const podeTer =
        /Recusar sem as credenciais|Criar a conta|Apagar a conta|Sobrou conta/.test(nome);
      if (temChave && !podeTer) {
        throw new Error(
          `a service_role aparece no passo "${nome}", que não cria nem apaga conta. ` +
          "Se ela alcançar o build, vai embutida no bundle.",
        );
      }
    }
    // E a contraprova: ela precisa estar nos dois que de fato precisam dela,
    // senão este teste passaria com o workflow inteiro sem a chave.
    const criar = passos.find((p) => /^Criar a conta/.test(p.trim()));
    const apagar = passos.find((p) => /^Apagar a conta/.test(p.trim()));
    expect(criar, "não achei o passo de criação").toBeTruthy();
    expect(criar!).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(apagar, "não achei o passo de remoção").toBeTruthy();
    expect(apagar!).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  /**
   * O filtro do `--varrer-restos` não pode alcançar conta de gente.
   *
   * Ele roda sozinho, de madrugada, e termina num `delete`. Duas coisas o
   * prendem: o prefixo que só este script usa e o domínio `.invalid`, que a RFC
   * 2606 reserva — nenhum domínio real pode existir ali, hoje ou nunca. Um
   * filtro mais frouxo aqui apaga o prontuário de alguém.
   */
  it("a varredura de restos só alcança o domínio reservado", () => {
    const js = readFileSync(SCRIPT, "utf8");
    const corpo = js.slice(js.indexOf("async function varrerRestos("));
    expect(corpo.length, "não achei o corpo de varrerRestos").toBeGreaterThan(300);

    const consulta = corpo.slice(corpo.indexOf("from auth.users"), corpo.indexOf("order by"));
    expect(consulta, "a consulta precisa filtrar pelo domínio reservado")
      .toMatch(/PADRAO_DE_RESTO|valvepath\.invalid/);
    expect(js, "o padrão precisa terminar no domínio reservado")
      .toMatch(/PADRAO_DE_RESTO\s*=\s*["'][^"']*@valvepath\.invalid["']/);

    // E a janela de idade, que é o que impede um job da matriz de apagar a conta
    // que o outro acabou de criar — os dois rodam em paralelo no mesmo run.
    expect(consulta, "sem janela de idade, um job da matriz sabota o outro")
      .toMatch(/created_at\s*<\s*now\(\)\s*-\s*interval/);
  });

  it("o .env do build carrega só a chave PÚBLICA", () => {
    // O `.env` é escrito por `envDoBuild`. Ele monta três linhas, e nenhuma
    // delas pode ser a chave secreta — com prefixo `VITE_` ou sem.
    const js = readFileSync(SCRIPT, "utf8");
    const corpo = js.slice(
      js.indexOf("async function envDoBuild("),
      js.indexOf("// --------------------------------------------------------------- criar"),
    );
    expect(corpo.length, "não achei o corpo de envDoBuild").toBeGreaterThan(300);
    expect(corpo, "o .env do build menciona a chave secreta").not.toMatch(/service_role|SERVICE_ROLE/);
    expect(corpo, "o .env do build deve usar a chave publishable/anon")
      .toMatch(/publishable|anon/);
  });

  /**
   * O `| tee` que engolia o código de saída da varredura era guardado aqui, e
   * a guarda saiu deste arquivo de propósito.
   *
   * Ela estava presa a UM workflow — o mesmo erro do `RAIZ = "src"` que deixou
   * as vinte edge functions fora da varredura de leitura. E cobrou o preço
   * previsível: o `db.yml`, que aplica SQL no banco de produção, tinha o mesmo
   * defeito engolindo um `curl --fail-with-body`, e esta guarda não olhava para
   * lá.
   *
   * Agora a regra é de diretório, em `src/test/passosDaCI.test.ts`: todo passo
   * com cano, em qualquer workflow, precisa de `pipefail`. Ela cobre este
   * arquivo junto com os outros — conferido por inversão, tirando o `set -o
   * pipefail` daqui e vendo reprovar pelo nome.
   */

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
