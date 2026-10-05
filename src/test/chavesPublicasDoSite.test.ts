/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  candidatosDeBundle, chavesDoTexto, refDoConfig, conferirProjeto,
} from "../../scripts/lib/chavesPublicas.mjs";

/**
 * As chaves públicas vindas do site publicado, e o que isso NÃO pode custar.
 *
 * ## O defeito que isto fecha
 *
 * A agenda diária reprovou todo dia desde 2026-10-02 — dezenove comentários na
 * issue #3 pela mesma causa. Três das seis conferências precisam de
 * `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` para montar um preview,
 * e nenhuma das duas está cadastrada nas *Variables* do repositório.
 *
 * O cabeçalho do workflow dizia que as chaves "saem do `.env` versionado".
 * **Não existe `.env` versionado** — o `.gitignore` o exclui. O ramo que lê
 * `.env` nunca encontrava arquivo nenhum em CI, caía no aviso, e os três ⚠️
 * eram o resultado. Um comentário que afirma uma fonte inexistente é pior que
 * nenhum: faz quem lê procurar o defeito no lugar errado.
 *
 * ## Por que do site, e não pela API de gestão
 *
 * O `rotas-autenticadas.yml` resolve o mesmo problema com
 * `SUPABASE_ACCESS_TOKEN`. Aqui não serve, e o motivo está escrito no cabeçalho
 * da agenda: aquele token é root sobre a conta inteira, e este workflow "roda
 * sozinho, todo dia, sem ninguém olhando". Três conferências em NÃO CONFERIDO é
 * posição melhor que um job diário desassistido carregando a chave da conta.
 *
 * A chave publishable, por outro lado, vai embutida em todo bundle que qualquer
 * visitante baixa. Lê-la do site é HTTP sem credencial — nada novo é exposto.
 *
 * ## A objeção, e por que ela não fica de pé
 *
 * Um verificador tirando configuração do artefato que verifica tem ponto cego:
 * um site apontando para OUTRO projeto faria as conferências falarem com o
 * banco errado e passarem. Por isso o script compara o host extraído com o
 * `project_id` de `supabase/config.toml` e reprova com saída 1 se divergirem.
 *
 * ## Provado por execução, nos cinco estados
 *
 *     caminho feliz (valvepath.com.br)          → 0
 *     projeto diferente do config.toml          → 1  DIVERGE
 *     site fora do ar                           → 2  NÃO CONFERIDO
 *     bundle servido sem as chaves              → 2
 *     index.html sem nenhum .js                 → 2
 */

const WORKFLOW = ".github/workflows/verificacoes-periodicas.yml";

/** Um `index.html` como o que o Vite gera, com nomes em hash. */
const INDEX_REAL = [
  '<!doctype html><html><head>',
  '<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">',
  '<script type="module" crossorigin src="/assets/index-Csujk0K9.js"></script>',
  '<link rel="modulepreload" crossorigin href="/assets/client-CwSRObAw.js">',
  '<link rel="modulepreload" crossorigin href="/assets/client-CwSRObAw.js">',
  '<link rel="stylesheet" crossorigin href="/assets/index-BOKOLOGW.css">',
  '</head><body><div id="root"></div></body></html>',
].join("\n");

describe("as chaves públicas lidas do site publicado", () => {
  it("acha os `.js` do index.html, sem repetir e sem pegar css", () => {
    const achados = candidatosDeBundle(INDEX_REAL);
    expect(achados).toEqual(["/assets/index-Csujk0K9.js", "/assets/client-CwSRObAw.js"]);
    // O `.css` fica fora: baixá-lo é custo sem chance de achado.
    expect(achados.some((c) => c.endsWith(".css"))).toBe(false);
    // E a fonte do Google também — ela não é `/assets/`.
    expect(achados.some((c) => c.includes("googleapis"))).toBe(false);
  });

  it("nenhum `.js` no index.html é um resultado, não um erro silencioso", () => {
    // O script sai 2 nesse caso. Devolver `[]` aqui é o que permite aquilo.
    expect(candidatosDeBundle("<!doctype html><html><body>nada</body></html>")).toEqual([]);
  });

  /**
   * As fixtures NÃO carregam prefixo de chave real, e o motivo tem data.
   *
   * A primeira versão deste teste usava os oito primeiros caracteres da chave
   * de produção, copiados do bundle que eu tinha acabado de baixar. A chave é
   * pública — vai em todo navegador —, mas este repositório é público também, e
   * prefixo real commitado faz qualquer busca pela chave acertar o repositório.
   * Foi a conferência `git diff --cached | grep` que pegou, antes do commit.
   *
   * O valor aqui tem a FORMA que o detector precisa reconhecer e nenhum
   * caractere do segredo de verdade.
   */
  it("acha as duas formas de chave que este projeto já usou", () => {
    const nova = chavesDoTexto(
      'const u="https://qwiojyfxzvdcfbbexyxg.supabase.co",k="sb_publishable_EXEMPLO_NAO_E_CHAVE_REAL_00";',
    );
    expect(nova.url).toBe("https://qwiojyfxzvdcfbbexyxg.supabase.co");
    expect(nova.chave).toMatch(/^sb_publishable_/);

    // O JWT legado: trocar de formato não é defeito, e recusar o antigo faria a
    // leitura reprovar numa reversão legítima.
    const legado = chavesDoTexto(
      'const u="https://abcdefghij12.supabase.co",k="eyJEXEMPLO_NAO_E_CHAVE_REAL_0000.' +
        'EXEMPLO_NAO_E_CHAVE_REAL_0000000.EXEMPLO_NAO_E_CHAVE_REAL_000000";',
    );
    expect(legado.chave).toMatch(/^eyJ/);
  });

  it("texto sem chave devolve `null`, e não string vazia", () => {
    // `null` e `""` precisam ser distinguíveis: o primeiro é "não achei", o
    // segundo seria "achei uma chave vazia" — e o script decide a saída 2 por
    // essa diferença.
    const nada = chavesDoTexto("console.log('nada aqui');");
    expect(nada.url).toBeNull();
    expect(nada.chave).toBeNull();
  });

  it("o `project_id` sai do config.toml de verdade", () => {
    const toml = readFileSync("supabase/config.toml", "utf8");
    const ref = refDoConfig(toml);
    expect(ref, "não achei `project_id` em supabase/config.toml").not.toBeNull();
    expect(ref).toMatch(/^[a-z0-9]+$/);
    expect(refDoConfig("# só comentário\n"), "inventou um project_id").toBeNull();
  });

  it("o projeto do site é comparado com o do repositório", () => {
    const ref = refDoConfig(readFileSync("supabase/config.toml", "utf8"))!;
    expect(conferirProjeto(`https://${ref}.supabase.co`, ref)).toEqual({ ok: true, ref });

    const diverge = conferirProjeto("https://outroprojeto1.supabase.co", ref);
    expect(diverge.ok).toBe(false);
    // A mensagem nomeia OS DOIS. "Projeto errado" sem dizer qual manda quem lê
    // abrir o painel para descobrir o que o script já sabia.
    expect(diverge.motivo).toContain("outroprojeto1");
    expect(diverge.motivo).toContain(ref);
  });

  it("sem url ou sem project_id é recusa, não aprovação por omissão", () => {
    // O jeito mais fácil de uma comparação passar é não ter com o que comparar.
    expect(conferirProjeto(null, "qualquer").ok).toBe(false);
    expect(conferirProjeto("https://x1234567890.supabase.co", null).ok).toBe(false);
  });
});

describe("o workflow da agenda diária", () => {
  const yml = readFileSync(WORKFLOW, "utf8");

  it("tenta o site publicado ANTES de desistir", () => {
    /**
     * A ordem é a regra. Chamar o script depois do aviso seria tê-lo no
     * repositório e nunca executá-lo — e o passo continuaria caindo nos três
     * ⚠️, com um script novo ao lado para dar a impressão de resolvido.
     */
    const passo = yml.slice(yml.indexOf("- name: Exportar as chaves públicas"));
    const corpo = passo.slice(0, passo.indexOf("- name:", 10));
    const ondeScript = corpo.indexOf("chavesPublicasDoSite.mjs");
    const ondeAviso = corpo.indexOf("::warning::sem VITE_SUPABASE");
    expect(ondeScript, "o passo não chama `chavesPublicasDoSite.mjs`").toBeGreaterThan(0);
    expect(ondeAviso, "não achei o aviso de chaves ausentes").toBeGreaterThan(0);
    expect(
      ondeScript < ondeAviso,
      "a leitura do site vem DEPOIS do aviso — ela nunca rodaria",
    ).toBe(true);
  });

  it("os TRÊS caminhos mascaram o valor nos logs", () => {
    /**
     * A execução 29 passou — e imprimiu a chave em texto claro no bloco `env:`
     * de cada passo seguinte, num repositório público:
     *
     *     env:
     *       VITE_SUPABASE_PUBLISHABLE_KEY: sb_publishable_…
     *
     * A chave é pública e isso não expõe nada de novo. O motivo de mascarar é
     * outro: este passo é o FUNIL ÚNICO por onde qualquer chave futura vai
     * passar para `$GITHUB_ENV`. Quem acrescentar ali um valor que NÃO seja
     * público herda o mascaramento em vez de ter de lembrar dele.
     *
     * O `rotas-autenticadas.yml` já escreve o princípio sobre o token de
     * sessão: "cinto e suspensório — o script não imprime o token, mas se
     * algum dia imprimir, sai mascarado".
     *
     * A regra é sobre os TRÊS ramos, não sobre o que eu acrescentei: um ramo
     * sem máscara é a chave aparecendo de novo pelo caminho que ninguém olhou.
     */
    const passo = yml.slice(yml.indexOf("- name: Exportar as chaves públicas"));
    const corpo = passo.slice(0, passo.indexOf("- name:", 10));

    expect(
      corpo,
      "o passo não define a função que mascara o valor escrito",
    ).toMatch(/mascarar_o_que_foi_escrito\(\)\s*\{[\s\S]*?add-mask/);

    // Cada `exit 0` de sucesso precisa ter sido precedido por uma chamada.
    const ramos = corpo.split(/\n\s*exit 0\b/).slice(0, -1);
    expect(ramos.length, "não achei os três ramos de sucesso").toBeGreaterThanOrEqual(3);
    const semMascara = ramos
      .map((trecho, i) => ({ i, chama: /mascarar_o_que_foi_escrito\s*$|mascarar_o_que_foi_escrito\n/.test(trecho) }))
      .filter((r) => !r.chama)
      .map((r) => `  · o ramo ${r.i + 1} sai sem mascarar`);
    expect(
      semMascara,
      `\n${semMascara.join("\n")}\n\n` +
        "Um ramo que escreve em `$GITHUB_ENV` sem mascarar faz o valor aparecer\n" +
        "em texto claro no bloco `env:` de todos os passos seguintes — e este\n" +
        "repositório é público.",
    ).toEqual([]);
  });

  it("continua sem tocar no token de gestão nem na service_role", () => {
    /**
     * A frase do cabeçalho — "não deve passar a tocar: ele roda sozinho, todo
     * dia, sem ninguém olhando" — vira asserção aqui.
     *
     * É a tentação óbvia de quem for mexer nisto depois: o
     * `rotas-autenticadas.yml` busca as mesmas chaves pela API de gestão, e
     * copiar aquele passo para cá "resolveria". Resolveria pondo a chave root
     * da conta num job diário e desassistido, num repositório PÚBLICO — trocar
     * três ⚠️ por isso é piorar.
     */
    for (const segredo of ["SUPABASE_ACCESS_TOKEN", "SUPABASE_SERVICE_ROLE_KEY"]) {
      expect(
        yml.includes(`secrets.${segredo}`),
        `a agenda diária passou a carregar ${segredo}. Ela roda sozinha todo dia: ` +
          "esse token é root sobre a conta inteira, e as chaves que ela precisa são " +
          "públicas e saem do próprio site.",
      ).toBe(false);
    }
  });

  it("os gatilhos continuam sendo os que não vêm de fora", () => {
    // Complemento do bloco acima: mesmo sem segredo, um workflow que rode em
    // `pull_request_target` executa código de terceiros com as permissões do
    // repositório. A agenda é `schedule` + `workflow_dispatch`, e assim fica.
    const gatilhos = yml.slice(yml.indexOf("\non:"), yml.indexOf("\npermissions:"));
    expect(gatilhos).toMatch(/schedule:/);
    expect(gatilhos, "a agenda passou a rodar em evento de pull request").not.toMatch(
      /pull_request(_target)?:/,
    );
  });
});
