/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  vereditoDoPaciente, vereditoDoMedico, userIdDaSessao,
} from "../../scripts/lib/cercaDeDoctors.mjs";

/**
 * A cerca de `doctors`, conferida em PRODUÇÃO e não só na bancada.
 *
 * ## A distância que isto fecha
 *
 * A migration `20260923140000_doctors_sem_leitura_aberta` foi provada numa
 * bancada PostgreSQL 16 — réplica das tabelas, das políticas e dos dados, com
 * os quatro estados medidos. Bancada prova que o SQL faz o que diz. Não prova
 * que o SQL que faz isso é o que está rodando em produção, e esta sessão já
 * encontrou o caso contrário mais de uma vez: código sabendo de um estado que o
 * banco não tinha.
 *
 * `scripts/cercaDeDoctors.mjs` fecha a distância pelo caminho do usuário: a
 * sessão que o `rotas-autenticadas.yml` já cunha, contra o PostgREST de
 * produção, com a chave PÚBLICA.
 *
 * ## O buraco que o terceiro estado tapa
 *
 * "O paciente leu 0 linhas de `doctors`" parece prova de cerca — e não é. Lê 0
 * também quem consulta uma tabela vazia. Por isso a decisão exige, como
 * evidência independente, que o `diretorio_medicos()` (que é `security
 * definer`, e portanto passa pela cerca) tenha devolvido pelo menos um médico.
 * Sem isso o veredito é 2, e não 0.
 *
 * Era o jeito mais fácil de esta conferência ficar verde sem conferir nada.
 */

const WORKFLOW = ".github/workflows/rotas-autenticadas.yml";

describe("a cerca de `doctors` pelo lado do paciente", () => {
  it("paciente sem vínculo lendo 0, com o diretório povoado: a cerca está no lugar", () => {
    const v = vereditoDoPaciente({ noDiretorio: 3, lidasNaTabela: 0 });
    expect(v.estado).toBe(0);
    expect(v.mensagem).toContain("3 médico(s) existem");
  });

  it("paciente lendo QUALQUER linha é divergência, e a mensagem diz quantas", () => {
    const v = vereditoDoPaciente({ noDiretorio: 3, lidasNaTabela: 12 });
    expect(v.estado).toBe(1);
    expect(v.mensagem).toContain("12 linha(s)");
    // A mensagem precisa nomear a promessa quebrada, não só o número: quem lê
    // o log de uma CI vermelha precisa saber o que está em jogo.
    expect(v.mensagem.replace(/\s+/g, " ")).toContain("Aparecer no diretório");
  });

  it("diretório vazio é NÃO CONFERIDO, e não aprovação", () => {
    /**
     * O coração desta guarda. Com o diretório vazio, zero linhas na tabela não
     * distingue "cercado" de "não tem o que ler" — e tratar como 0 (ok) seria
     * a conferência relatando sucesso sem ter feito o trabalho, que é o defeito
     * que ela existe para caçar.
     */
    const v = vereditoDoPaciente({ noDiretorio: 0, lidasNaTabela: 0 });
    expect(v.estado, "diretório vazio virou aprovação").toBe(2);
    // Normalizado em vez de amarrado à quebra de linha: asserção que depende de
    // onde o parágrafo quebrou reprova quem reformatou o texto, e esta base já
    // pagou por isso no teste do aviso por issue.
    expect(v.mensagem.replace(/\s+/g, " ")).toContain("prova tabela vazia");
  });

  it("diretório vazio E leitura aberta: continua NÃO CONFERIDO", () => {
    // A ordem das perguntas importa. Se a decisão olhasse `lidasNaTabela`
    // primeiro, diria DIVERGE — e estaria afirmando uma comparação que não pode
    // fazer, porque sem diretório não se sabe o que deveria estar escondido.
    const v = vereditoDoPaciente({ noDiretorio: 0, lidasNaTabela: 5 });
    expect(v.estado).toBe(2);
  });
});

describe("a cerca de `doctors` pelo lado do médico", () => {
  const EU = "11111111-1111-1111-1111-111111111111";
  const OUTRO = "22222222-2222-2222-2222-222222222222";

  it("o médico lendo a própria linha: a porta 1 está aberta", () => {
    const v = vereditoDoMedico({
      lidasNaTabela: 2, meuUserId: EU, userIdsLidos: [EU, OUTRO],
    });
    expect(v.estado).toBe(0);
  });

  it("o médico SEM a própria linha é divergência — falso vermelho custa igual", () => {
    /**
     * A cerca apertada além da conta deixa o médico sem o próprio registro, e o
     * `MedicoPerfil` abre o formulário em branco sobre um cadastro que existe —
     * convidando a reescrever o CRM por cima. A tela tem uma barreira para a
     * falha de LEITURA (`FalhaDeLeitura`), mas não para "a leitura foi bem e
     * devolveu nada".
     */
    const v = vereditoDoMedico({
      lidasNaTabela: 1, meuUserId: EU, userIdsLidos: [OUTRO],
    });
    expect(v.estado).toBe(1);
    expect(v.mensagem).toContain("porta 1");
  });

  it("o NÚMERO de linhas não é afirmado", () => {
    /**
     * Deliberado: a porta 5 ("quem é médico vê qualquer médico") ainda está
     * aberta em produção e sai na etapa 2 de `20261005121000`. Um veredito que
     * cravasse a contagem reprovaria no dia em que a cerca melhorasse — e
     * guarda que pune quem fez certo é guarda que alguém desliga.
     */
    const muitas = vereditoDoMedico({
      lidasNaTabela: 40, meuUserId: EU, userIdsLidos: [EU, OUTRO],
    });
    const poucas = vereditoDoMedico({
      lidasNaTabela: 1, meuUserId: EU, userIdsLidos: [EU],
    });
    expect(muitas.estado, "40 linhas reprovou — a contagem está sendo afirmada").toBe(0);
    expect(poucas.estado, "1 linha reprovou — a contagem está sendo afirmada").toBe(0);
  });

  it("sem `user_id` na sessão é NÃO CONFERIDO", () => {
    const v = vereditoDoMedico({ lidasNaTabela: 3, meuUserId: null, userIdsLidos: [EU] });
    expect(v.estado).toBe(2);
  });
});

describe("o `user_id` da sessão", () => {
  it("sai do objeto `user` quando ele vem", () => {
    expect(userIdDaSessao({ user: { id: "abc" }, access_token: "x" })).toBe("abc");
  });

  it("cai para o `sub` do token quando não vem", () => {
    /**
     * O `/token?grant_type=password` do Supabase devolve `user`, mas o
     * `/verify` do magic link — o segundo caminho que
     * `conta-de-verificacao.mjs` tenta — já respondeu sem ele nesta base. Sem
     * esta queda, a conferência do médico sairia 2 por um detalhe do caminho de
     * autenticação, e NÃO CONFERIDO repetido ensina a ignorar o aviso.
     */
    const payload = Buffer.from(JSON.stringify({ sub: "do-token" })).toString("base64url");
    expect(userIdDaSessao({ access_token: `cabecalho.${payload}.assinatura` })).toBe("do-token");
  });

  it("token ilegível devolve `null`, e não uma string qualquer", () => {
    // `null` é o que faz o veredito sair 2 em vez de comparar com lixo.
    expect(userIdDaSessao({ access_token: "nada.disto.e-base64-de-json" })).toBeNull();
    expect(userIdDaSessao({ access_token: "semponto" })).toBeNull();
    expect(userIdDaSessao({})).toBeNull();
    expect(userIdDaSessao(null)).toBeNull();
  });
});

describe("o workflow conferiu a cerca nos dois tipos de conta", () => {
  const yml = readFileSync(WORKFLOW, "utf8");

  it("o passo roda para a matriz inteira, e não só para um tipo", () => {
    const passo = yml.slice(yml.indexOf("- name: Conferir a cerca de doctors"));
    const corpo = passo.slice(0, passo.indexOf("- name:", 10));
    expect(corpo, "o passo não chama o script").toMatch(/cercaDeDoctors\.mjs/);
    expect(
      corpo,
      "o tipo está cravado em vez de vir da matriz — a conferência valeria para " +
        "um lado só, e é justamente o lado do PACIENTE que faltava",
    ).toMatch(/--tipo "\$\{\{ matrix\.tipo \}\}"/);
    // A matriz precisa continuar tendo os dois.
    const matriz = yml.slice(yml.indexOf("matrix:"), yml.indexOf("steps:"));
    expect(matriz).toMatch(/tipo:\s*medico/);
    expect(matriz).toMatch(/tipo:\s*paciente/);
  });

  it("a `service_role` NÃO entra no passo da cerca", () => {
    /**
     * A tentação é usar a chave que já está no workflow. Com `service_role` o
     * script leria a tabela inteira por construção: a conferência mediria a
     * própria chave e passaria sempre — verde absoluto sobre nada.
     */
    const passo = yml.slice(yml.indexOf("- name: Conferir a cerca de doctors"));
    const corpo = passo.slice(0, passo.indexOf("- name:", 10));
    expect(corpo, "a `service_role` entrou no passo da cerca").not.toMatch(/SERVICE_ROLE/);
    expect(corpo, "o token de gestão entrou no passo da cerca").not.toMatch(/ACCESS_TOKEN/);
    expect(corpo, "o passo precisa da chave PÚBLICA").toMatch(/VITE_SUPABASE_PUBLISHABLE_KEY/);
  });

  it("o passo roda ANTES de a conta ser apagada", () => {
    // Depois da remoção, a sessão não vale mais e o script sairia 2 para
    // sempre: uma conferência que nunca confere, com cara de conferência.
    const ondeCerca = yml.indexOf("- name: Conferir a cerca de doctors");
    const ondeApagar = yml.indexOf("- name: Apagar a conta temporária");
    expect(ondeCerca).toBeGreaterThan(0);
    expect(ondeApagar).toBeGreaterThan(0);
    expect(
      ondeCerca < ondeApagar,
      "a cerca é conferida depois de a conta ser apagada — a sessão já não vale",
    ).toBe(true);
  });
});
