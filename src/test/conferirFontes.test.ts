/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
// `.mjs` de verificação, sem tipos — e o import resolve sozinho sob
// `tsconfig.app.json`, então um `@ts-expect-error` aqui fica SEM uso e o
// próprio `tsc` acusa. Eu já acrescentei essa diretiva por reflexo duas vezes
// nesta sessão, e as duas vezes a CI a devolveu.
import {
  FORA_DE_ALCANCE, dispensaVale, dispensasSemMotivo, estadoDaResposta, hostDe,
  motivoDaDispensaBasta, urlsDoCatalogo, vereditoDasFontes,
} from "../../scripts/conferir-fontes.mjs";
import { semComentariosDeCodigo } from "./semComentariosDeCodigo";

/**
 * O conferidor de fontes do catálogo, e a razão de ele existir.
 *
 * ## O rótulo que media outra coisa
 *
 * A conferência diária tinha uma linha chamada **"catálogo: nenhuma EOA gravada
 * sem fonte citável"**, e o que ela media era `!l.eoa_source_url` — o campo
 * está preenchido ou não. Uma URL que devolve 404 passava por "citável".
 *
 * Não é defeito hipotético. O cabeçalho do `conferir-mmcts.mjs` registra, entre
 * as três vezes em que este projeto aprendeu a mesma lição:
 *
 *   > "links da Corcym que devolviam 404 depois de o site ser reorganizado"
 *
 * São 82 URLs únicas de fonte em 16 domínios, quase todas de fabricante. Quem
 * clica é um cardiologista conferindo a procedência da área efetiva de orifício
 * que ele usa para escolher tamanho de prótese. Fonte que não abre é pior do que
 * fonte nenhuma: a primeira afirma uma procedência que não existe, a segunda
 * não afirma nada.
 *
 * Medido na primeira execução: **82 de 82 resolvem**, zero mortas, zero não
 * conferidas. O conferidor guarda esse estado; o rótulo da diária passou a
 * dizer "presença, não alcance".
 *
 * ## Por que o 403 não é 404
 *
 * Página protegida não é página morta, e contorná-la está fora de questão —
 * este projeto já topou com o desafio do Cloudflare da ANVISA e com a parede de
 * navegador da Medtronic, e as duas vezes a decisão registrada foi a mesma. O
 * script devolve NÃO CONFERIDO (saída 2) para 403, 429, 5xx, erro de rede e
 * tempo esgotado, e DIVERGE (saída 1) só para 404 e 410.
 */

const SCRIPT = "scripts/conferir-fontes.mjs";

describe("o conferidor de fontes do catálogo", () => {
  it("junta as URLs por valor, guardando campo e família", () => {
    const mapa = urlsDoCatalogo([
      {
        manufacturer: "Edwards", model_name: "Inspiris",
        eoa_source_url: "https://ex.invalid/a", image_url: "https://ex.invalid/b",
      },
      {
        manufacturer: "Edwards", model_name: "Perimount",
        // A MESMA url de outro campo e de outra família: tem de virar uma só
        // entrada, senão o conferidor bate duas vezes no mesmo link e o
        // relatório conta duas mortas onde há uma.
        reference_url: "https://ex.invalid/a",
      },
      { manufacturer: "Abbott", model_name: "Epic", eoa_source_url: null },
      // Valor que não é URL não entra: a coluna `mercado_br_fonte` guarda, em
      // algumas linhas, o nome do distribuidor em vez do endereço.
      { manufacturer: "Meril", model_name: "Hydra", mercado_br_fonte: "catálogo impresso" },
    ]);
    expect([...mapa.keys()].sort()).toEqual(["https://ex.invalid/a", "https://ex.invalid/b"]);
    const a = mapa.get("https://ex.invalid/a");
    expect([...a.campos].sort()).toEqual(["eoa_source_url", "reference_url"]);
    expect([...a.familias].sort()).toEqual(["Edwards Inspiris", "Edwards Perimount"]);
  });

  it("só 404 e 410 são MORTAS", () => {
    expect(estadoDaResposta({ status: 404 }).estado).toBe("morta");
    expect(estadoDaResposta({ status: 410 }).estado).toBe("morta");
  });

  it("2xx é ok, e o redirecionamento já foi seguido antes de chegar aqui", () => {
    for (const status of [200, 204, 206, 299]) {
      expect(estadoDaResposta({ status }).estado, `${status} não passou por ok`).toBe("ok");
    }
  });

  it("proteção e erro do outro lado são NÃO CONFERIDO", () => {
    /**
     * A distinção que o script existe para fazer. Um 403 da Medtronic e um 404
     * da Corcym são fatos diferentes: o primeiro diz "não deixei você olhar", o
     * segundo diz "a página não existe". Tratar os dois como quebra encheria a
     * agenda de falso vermelho sobre sites que estão de pé — e guarda que pune
     * quem fez certo é guarda que alguém desliga.
     *
     * E contornar a proteção para descobrir não está em questão.
     */
    for (const status of [401, 403, 429, 500, 502, 503]) {
      expect(
        estadoDaResposta({ status }).estado,
        `${status} foi tratado como morta`,
      ).toBe("naoConferido");
    }
  });

  it("falha de REDE é um quarto estado, e não o mesmo que proteção", () => {
    /**
     * O defeito que a primeira execução na CI mostrou: 68 ok, 0 mortas, **14 não
     * conferidas** — todas `fetch failed`, em dois domínios brasileiros. Medido
     * no mesmo dia de uma rede com alcance ao Brasil: os dois respondem 200.
     *
     * A diferença é de fato, não de grau: num 403 o host RESPONDEU e recusou; num
     * `fetch failed` ninguém falou com ele. Misturados, a lista de "não
     * conferidas" juntava "o site me barrou" com "não cheguei no site" — e só o
     * segundo é propriedade do executor, não da fonte.
     */
    expect(estadoDaResposta({ erro: "fetch failed" }).estado).toBe("naoAlcancado");
    expect(estadoDaResposta({ erro: "getaddrinfo ENOTFOUND" }).estado).toBe("naoAlcancado");
    expect(estadoDaResposta({ erro: "sem resposta em 20s" }).estado).toBe("naoAlcancado");
  });

  it("o detalhe acompanha o veredito, para o relatório poder dizer o motivo", () => {
    // Sem o detalhe, a issue diria "não conferida" sem dizer se foi 403, DNS ou
    // tempo esgotado — e os três pedem providências diferentes.
    expect(estadoDaResposta({ status: 403 }).detalhe).toContain("403");
    expect(estadoDaResposta({ erro: "boom" }).detalhe).toBe("boom");
  });

  it("o código de saída diz a PIOR coisa que aconteceu", () => {
    /**
     * Agora é função PURA, e não a ordem dos `process.exit` lida no texto: a
     * primeira versão deste caso comparava índices de `indexOf`, que prova a
     * ordem das linhas e não o veredito.
     *
     * Morta (1) antes de não conferida (2): com a ordem trocada, uma execução
     * com uma morta e uma protegida sairia 2 — e ⚠️ não é ❌. A agenda trataria
     * "a procedência sumiu" como "não deu para olhar".
     */
    const v = (p: Partial<Record<string, number>>) =>
      vereditoDasFontes({ mortas: 0, naoConferidas: 0, foraDeAlcance: 0, voltaramAoAlcance: 0, ...p });

    expect(v({ mortas: 1, naoConferidas: 5, foraDeAlcance: 9 }).codigo).toBe(1);
    expect(v({ naoConferidas: 1, foraDeAlcance: 9 }).codigo).toBe(2);
    expect(v({}).codigo).toBe(0);
  });

  it("fora de alcance DECLARADO não reprova, e aparece no veredito", () => {
    /**
     * A única concessão, e para quê: um limite de ambiente que PERSISTE faria a
     * varredura semanal sair 2 toda semana pelas mesmas URLs — verdade e
     * inútil, porque aviso que nunca muda é como se ensina alguém a ignorar o
     * aviso.
     *
     * Só que a primeira vez que eu usei esta concessão, o limite não persistia:
     * eram 14 `fetch failed` de um dia, e a execução seguinte alcançou os dois
     * hosts. A lista está vazia por causa disso, e `motivoDaDispensaBasta`
     * passou a cobrar duas medições em datas distintas de quem for usá-la.
     *
     * Mesmo com entrada, não é "conferido": é limite declarado, com motivo
     * escrito e medição. O relatório o grita, com o denominador à vista.
     */
    const v = vereditoDasFontes({
      mortas: 0, naoConferidas: 0, foraDeAlcance: 14, voltaramAoAlcance: 0,
    });
    expect(v.codigo, "limite declarado passou a reprovar").toBe(0);
    expect(v.motivo, "o veredito não distingue ok de ok-com-limite").toBe("okComLimite");
    // E sem limite nenhum o motivo é outro: os dois casos não podem sair iguais.
    expect(vereditoDasFontes({ mortas: 0, naoConferidas: 0, foraDeAlcance: 0, voltaramAoAlcance: 0 }).motivo)
      .toBe("ok");
  });

  it("host declarado fora de alcance que RESPONDE reprova a lista", () => {
    /**
     * A outra metade, e a que impede a dispensa de virar permanente por inércia:
     * se o host voltar a ser alcançável, a declaração perdeu o motivo e precisa
     * sair. Sai 2, não 1 — não há nada quebrado nas fontes.
     */
    const v = vereditoDasFontes({
      mortas: 0, naoConferidas: 0, foraDeAlcance: 0, voltaramAoAlcance: 1,
    });
    expect(v.codigo).toBe(2);
    expect(v.motivo).toBe("listaEnvelhecida");
  });

  it("host FORA da lista que não é alcançado continua reprovando", () => {
    // A dispensa é por host nomeado. Um host novo inalcançável é notícia.
    expect(hostDe("https://fabricante-novo.example/x")).toBe("fabricante-novo.example");
    expect(hostDe("https://fabricante-novo.example/x") in FORA_DE_ALCANCE).toBe(false);
    // E o fluxo o classifica como `naoConferida`, que reprova:
    expect(vereditoDasFontes({ mortas: 0, naoConferidas: 1, foraDeAlcance: 0, voltaramAoAlcance: 0 }).codigo)
      .toBe(2);
  });

  it("a dispensa vale SÓ no ambiente que o motivo nomeia", () => {
    /**
     * O motivo escrito tem de dizer "o executor do GitHub Actions não alcança
     * este host". Então a dispensa só pode valer lá.
     *
     * Isto saiu de uma execução de verdade: rodado do contêiner de
     * desenvolvimento — que alcança o Brasil —, o script entrou no ramo "a lista
     * envelheceu" e saiu 2 por dois hosts que o runner do GitHub, naquele dia,
     * de fato não alcançava. Limite de ambiente que não diz de qual ambiente é
     * vira alarme no ambiente errado.
     *
     * A lista real está VAZIA (ver o caso adiante), e por isso este caso corre
     * sobre uma lista sintética: amarrar a guarda a um host real a deixaria sem
     * nada a afirmar justamente quando a lista esvaziou.
     */
    const lista = {
      "exemplo.invalid":
        "o executor do GitHub Actions não alcança este host — `fetch failed` nas 3 URLs. "
        + "Conferido à mão em 2026-01-02 e de novo em 2026-01-09, de rede com alcance: HTTP 200.",
    };
    expect(
      dispensaVale({ host: "exemplo.invalid", noExecutorDoGitHub: true, lista }),
      "a dispensa deixou de valer no executor do GitHub",
    ).toBe(true);
    expect(
      dispensaVale({ host: "exemplo.invalid", noExecutorDoGitHub: false, lista }),
      "a dispensa passou a valer fora do executor do GitHub — ali as URLs são alcançáveis",
    ).toBe(false);
    // Host fora da lista não é dispensado em ambiente nenhum.
    expect(dispensaVale({ host: "outro.example", noExecutorDoGitHub: true, lista })).toBe(false);
    // E host ilegível também não.
    expect(dispensaVale({ host: null, noExecutorDoGitHub: true, lista })).toBe(false);
  });

  it("host anotado com motivo insuficiente NÃO é dispensado", () => {
    /**
     * É o motivo que sustenta a dispensa, não o host estar escrito. Anotar um
     * host e deixar o motivo pela metade é esquecimento com cara de decisão, e
     * aqui falha FECHADA: a URL volta a reprovar como NÃO CONFERIDO, que é o
     * pior dos dois vereditos e o certo quando não se sabe.
     */
    const fraca = { "exemplo.invalid": "o executor não alcança este host." };
    expect(
      dispensaVale({ host: "exemplo.invalid", noExecutorDoGitHub: true, lista: fraca }),
      "dispensou por motivo que não se sustenta",
    ).toBe(false);
    // E o script tem como DIZER isso, em vez de só falhar fechado em silêncio.
    const problemas = dispensasSemMotivo(fraca);
    expect(problemas.map((p: { host: string }) => p.host)).toEqual(["exemplo.invalid"]);
    expect(problemas[0].faltas.join(" "), "não diz o que falta no motivo").toMatch(/datas|medição/);
  });

  it("a regra do motivo cobra as quatro coisas, e a quarta é a lição da lista anterior", () => {
    /**
     * Esta era uma regra DENTRO do teste, varrendo `FORA_DE_ALCANCE`. Com a
     * lista vazia o laço não roda e a guarda ficaria verde sem olhar nada —
     * cobertura não é garantia, é garantia só sobre o que a guarda olha. Virou
     * função: conferível com entradas sintéticas, aplicável às reais, haja uma
     * ou nenhuma.
     *
     * A quarta exigência — DUAS datas distintas — é o conserto de 2026-10-15.
     * A lista anterior foi escrita com UMA observação, e uma observação não
     * distingue limite de ambiente de indisponibilidade passageira. Era
     * passageira.
     */
    const completo =
      "o executor do GitHub Actions não alcança este host — `fetch failed` nas 9 URLs. "
      + "Conferido à mão em 2026-01-02 e em 2026-01-09, de rede com alcance: HTTP 200.";
    expect(motivoDaDispensaBasta(completo).basta, "motivo completo foi recusado").toBe(true);

    const faltando = (m: string) => motivoDaDispensaBasta(m).faltas.join(" | ");
    // Uma data só: é justamente o motivo que eu escrevi, e ele não basta mais.
    expect(
      faltando(completo.replace(" e em 2026-01-09", "")),
      "uma observação única passou pela regra",
    ).toMatch(/duas datas/);
    // A mesma data repetida também não são duas observações.
    expect(faltando(completo.replace("2026-01-09", "2026-01-02"))).toMatch(/duas datas/);
    // Sem dizer o que a medição de fora achou, a lista estaria declarando a URL
    // conferida — que é exatamente o que ela não faz.
    expect(faltando(completo.replace("HTTP 200", "tudo certo"))).toMatch(/medição/);
    // Sem dizer que o executor não alcança, o motivo não é de alcance.
    expect(faltando(completo.replace("não alcança", "prefere não ler").replace("`fetch failed` nas 9 URLs", "9 URLs")))
      .toMatch(/não alcança/);
    // E texto curto não é motivo.
    expect(faltando("fora de alcance")).toMatch(/motivo escrito/);
    // Lixo não estoura.
    expect(motivoDaDispensaBasta(undefined).basta).toBe(false);
  });

  it("a lista real está vazia, e toda entrada que houver se sustenta", () => {
    /**
     * O conserto de 2026-10-15, medido: a execução em `main` devolveu 82 de 82
     * ok e o detector de lista envelhecida acusou os dois hosts que eu havia
     * declarado fora de alcance. As 14 `fetch failed` da primeira execução eram
     * PASSAGEIRAS. Eu tinha uma observação e escrevi uma exceção permanente,
     * com um "para sempre" que era previsão, não medição.
     *
     * A guarda não exige que a lista continue vazia — exige que o que estiver
     * nela se sustente, pela regra acima. Hoje isso dá zero problemas sobre zero
     * entradas; amanhã, com entrada, dá a mesma conta sobre ela.
     */
    expect(dispensasSemMotivo(), "há dispensa real sem motivo que a sustente").toEqual([]);
    // E os dois hosts que a execução desmentiu não estão de volta.
    for (const h of ["braile.com.br", "medicicor.com.br"]) {
      expect(h in FORA_DE_ALCANCE, `${h} voltou à lista; a execução em main o alcançou`).toBe(false);
    }
  });

  it("o script lê o ambiente do executor, e não assume", () => {
    // A ponta solta: a função aceitar o parâmetro e o fluxo não o passar
    // deixaria o caso acima verde sobre um script que dispensa em todo lugar.
    const codigo = semComentariosDeCodigo(readFileSync(SCRIPT, "utf8"), SCRIPT);
    expect(codigo, "o script não lê `GITHUB_ACTIONS`").toMatch(/GITHUB_ACTIONS/);
    /**
     * Ancorado na CHAMADA (`= dispensaVale({`), e não no nome: a primeira versão
     * casava `/dispensaVale\(\{\s*host,\s*noExecutorDoGitHub/`, que é também o
     * texto da DEFINIÇÃO — `export function dispensaVale({ host,
     * noExecutorDoGitHub })`. A inversão que troca a chamada por um teste
     * embutido passou pela regra, porque a definição continuava lá. Quarta vez
     * nesta sessão que uma regra minha mede a declaração em vez do uso.
     */
    expect(codigo, "o fluxo não passa o ambiente para a dispensa")
      .toMatch(/=\s*dispensaVale\(\{[^}]*noExecutorDoGitHub/);
  });

  it("`hostDe` tira o `www.` e não estoura em lixo", () => {
    // A lista é por host; sem normalizar, `www.braile.com.br` escaparia dela.
    expect(hostDe("https://www.braile.com.br/x")).toBe("braile.com.br");
    expect(hostDe("https://braile.com.br/x")).toBe("braile.com.br");
    expect(hostDe("não é url"), "lixo virou host").toBeNull();
    expect(hostDe(""), "string vazia virou host").toBeNull();
  });

  it("o script confere a própria lista antes de conferir URL alguma", () => {
    /**
     * A ponta solta das duas regras acima: a função existir e o fluxo não a
     * chamar deixaria tudo verde sobre um script que dispensa por host anotado
     * sem motivo. A regra é ancorada na CHAMADA, não no nome — é a quinta vez
     * nesta sessão que isso importa, e as quatro anteriores foram regras minhas
     * que casavam com a DEFINIÇÃO da função e passavam pela inversão.
     */
    const codigo = semComentariosDeCodigo(readFileSync(SCRIPT, "utf8"), SCRIPT);
    expect(codigo, "o fluxo não confere as dispensas antes de usá-las")
      .toMatch(/=\s*dispensasSemMotivo\(\)/);
    expect(codigo, "o fluxo não para quando uma dispensa não se sustenta")
      .toMatch(/semMotivo\.length[\s\S]{0,400}process\.exit\(2\)/);
  });

  it("o relatório mostra o DENOMINADOR, não só os que passaram", () => {
    /**
     * "68 ok" sozinho é lido como "68 de 68". São 68 de 82, e as outras 14 não
     * foram conferidas. A linha de resumo tem de trazer o total.
     */
    const codigo = semComentariosDeCodigo(readFileSync(SCRIPT, "utf8"), SCRIPT);
    expect(codigo, "o resumo não diz quantas URLs havia no catálogo")
      .toMatch(/alvos\.length\} URL\(s\) no catálogo/);
    expect(codigo, "o resumo não conta as fora de alcance")
      .toMatch(/fora de alcance deste executor/);
  });

  it("o script não tenta de novo depois de um 403", () => {
    // A linha que separa "identificar-se como navegador" de "furar proteção".
    // Um laço de retentativa em cima de 403/429 seria insistir contra uma
    // recusa explícita, e esta base decidiu duas vezes que não se contorna.
    const codigo = semComentariosDeCodigo(readFileSync(SCRIPT, "utf8"), SCRIPT);
    expect(codigo, "apareceu retentativa no conferidor").not.toMatch(/for\s*\([^)]*tentativa/i);
    expect(codigo).not.toMatch(/retry|tentarDeNovo/i);
  });

  it("o conferidor é chamado por algum workflow", () => {
    // A guarda `scriptDeVerificacaoRoda` já cobra isto para a classe inteira.
    // Aqui é nominal, pelo mesmo motivo do `mobile.mjs`: quem achar as 82
    // requisições lentas pode tirar o passo e declarar o script manual, o que
    // passaria pela regra geral.
    const semanal = readFileSync(".github/workflows/rotas-autenticadas.yml", "utf8");
    expect(semanal, "o conferidor de fontes saiu da varredura semanal")
      .toContain("scripts/conferir-fontes.mjs");
  });

  it("o rótulo da diária não promete mais alcance", () => {
    /**
     * O outro lado do conserto. Se o rótulo voltar a dizer "fonte citável"
     * medindo presença, a mentira volta — e desta vez com um conferidor de
     * verdade ao lado, o que a tornaria mais convincente.
     */
    const diaria = readFileSync("scripts/ferramentas-verificar.mjs", "utf8");
    const i = diaria.indexOf("catálogo: toda EOA gravada");
    expect(i, "não achei o rótulo da conferência de EOA").toBeGreaterThan(0);
    const rotulo = diaria.slice(i, diaria.indexOf('"', i + 20) + 1);
    expect(rotulo, "o rótulo voltou a prometer que a fonte é citável")
      .not.toMatch(/fonte citável/);
    expect(rotulo, "o rótulo não diz que mede presença").toMatch(/presença/);
  });
});
