/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { motivoDaFuncao, funcaoRecusou } from "./respostaDeFuncao";

/**
 * O motivo que a edge function escreve, e que o cliente mostrava como
 * "Edge Function returned a non-2xx status code".
 *
 * ## O fato do SDK, conferido no fonte
 *
 * `@supabase/functions-js`, `FunctionsClient.js`:
 *
 *     if (!response.ok) { throw new FunctionsHttpError(response); }
 *     ...
 *     catch (error) { return { data: null, error, ... }; }
 *
 * e `types.js`:
 *
 *     super('Edge Function returned a non-2xx status code', 'FunctionsHttpError', context)
 *
 * Em qualquer resposta não-2xx: **`data` é `null`** e `error.message` é aquela
 * frase, invariável. O corpo fica em `error.context`, um `Response` não lido.
 *
 * ## O que isso custava
 *
 * Cinco telas faziam `data?.error ?? error?.message` ou `(error as Error)
 * ?.message`. A primeira metade nunca disparava (o `data` é nulo), e a segunda
 * mostrava a frase do SDK. Quer dizer: **o `data?.detail` que alguém escreveu
 * justamente para a recusa de regra era código morto**, e quem lia a tela
 * recebia uma frase em inglês sobre status HTTP.
 *
 * Caso a caso:
 *
 * · `EncerrarContaDialog` — a ação mais irreversível do sistema. A recusa
 *   "é a única conta de administrador" vem com 400, e o `data?.detail` escrito
 *   para ela nunca rodou;
 * · `AdminAcessos` — numa aprovação incompleta o `access-decide` devolve a
 *   lista do que não persistiu e um `o_que_fazer` redigido para este momento:
 *   "Corrija os itens acima à mão antes que ela tente entrar — sem o papel de
 *   médico ela será barrada". O administrador lia "Não foi possível aprovar"
 *   com a conta já criada e o e-mail já enviado, e tendia a clicar de novo. A
 *   guarda de duplicidade depende do `status` do pedido, que é justamente um
 *   dos itens que podem não ter persistido: segundo e-mail, segundo link;
 * · `AdminDPO` — pedido de titular do art. 18, sem saber se o documento saiu
 *   incompleto ou não saiu;
 * · `FhirSandbox` e `AdminIntegracoes`, pelo mesmo caminho.
 *
 * O `TurnstileWidget` já lia o `error.context` — foi o que deixou dizer "falta
 * a chave do Turnstile" quando o login caiu. Era o único.
 */

function resposta(corpo: unknown, status = 500): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** O formato exato que o `invoke` devolve num não-2xx. */
function erroHttp(corpo: unknown, status = 500) {
  return {
    name: "FunctionsHttpError",
    message: "Edge Function returned a non-2xx status code",
    context: resposta(corpo, status),
  };
}

describe("o motivo que a função escreveu", () => {
  it("lê o corpo do `error.context` em vez da frase do SDK", async () => {
    const motivo = await motivoDaFuncao(
      erroHttp({ error: "rpc_failed", detail: "é a única conta de administrador" }, 400),
      null,
      "A conta não foi encerrada.",
    );
    expect(motivo.texto).toContain("única conta de administrador");
    expect(
      motivo.texto,
      "vazou a frase do SDK para a tela",
    ).not.toContain("non-2xx");
    expect(motivo.codigo).toBe("rpc_failed");
  });

  it("prefere o `o_que_fazer` ao código de erro", async () => {
    // Quem lê a tela precisa saber o que fazer agora, não o nome interno da
    // falha. `access-decide` escreve as duas coisas; esta é a ordem.
    const motivo = await motivoDaFuncao(
      erroHttp({
        ok: false,
        status: "aprovacao_incompleta",
        conta_criada: true,
        nao_persistiu: ["papel de médico (user_roles): recusado pela RLS"],
        o_que_fazer: "Corrija os itens acima à mão antes que ela tente entrar.",
      }),
      null,
      "A aprovação não foi concluída.",
    );
    expect(motivo.texto).toContain("Corrija os itens acima");
    expect(motivo.texto, "a lista do que não persistiu precisa vir junto")
      .toContain("papel de médico");
    expect(motivo.corpo?.conta_criada, "o corpo inteiro fica disponível").toBe(true);
  });

  it("a lista do que não persistiu não some quando é a única coisa que há", async () => {
    // Sem o `o_que_fazer`, o genérico entra — mas a lista continua sendo a
    // informação que resolve, e é ela que diz QUAIS itens ficaram para trás.
    const motivo = await motivoDaFuncao(
      erroHttp({ ok: false, nao_persistiu: ["consentimento de listagem (user_consents)"] }),
      null,
      "A aprovação não foi concluída.",
    );
    expect(motivo.texto).toContain("A aprovação não foi concluída.");
    expect(motivo.texto).toContain("consentimento de listagem");
  });

  it("recusa que vem em 200, no corpo, também é lida", async () => {
    // `knowledge-ingest` devolve `ok: false` com HTTP 200 quando parte dos
    // trechos falhou. `invoke` não marca erro nenhum nesse caso.
    const data = { ok: false, fonte: "esc-2025", gravados: 0, error: "fonte não cadastrada" };
    expect(funcaoRecusou(null, data), "um `ok: false` em 200 passaria como sucesso").toBe(true);
    const motivo = await motivoDaFuncao(null, data, "A base não foi populada.");
    expect(motivo.texto).toContain("fonte não cadastrada");
  });

  it("sucesso não é confundido com recusa", async () => {
    // Guarda que acusa quem fez certo é guarda que alguém desliga.
    expect(funcaoRecusou(null, { ok: true, inserted: 18 })).toBe(false);
    expect(funcaoRecusou(null, { url: "https://x/y", tables: {} })).toBe(false);
    expect(funcaoRecusou(null, null)).toBe(false);
    // `error: ""` não é recusa: é campo vazio.
    expect(funcaoRecusou(null, { ok: true, error: "" })).toBe(false);
  });

  it("corpo que não é JSON não vira exceção — sobra o genérico", async () => {
    // Uma página de erro do gateway, por exemplo. O genérico já é verdade.
    const erro = {
      message: "Edge Function returned a non-2xx status code",
      context: new Response("<html>502 Bad Gateway</html>", {
        status: 502, headers: { "Content-Type": "text/html" },
      }),
    };
    const motivo = await motivoDaFuncao(erro, null, "O documento não foi gerado.");
    expect(motivo.texto).toContain("O documento não foi gerado.");
    expect(motivo.texto).not.toContain("non-2xx");
  });

  it("distingue 'a função recusou' de 'não chegou resposta'", async () => {
    // Rede caída, CORS, função fora do ar: não há `context`. Dizer só "não foi
    // possível" esconde que o problema pode não ser o pedido.
    const motivo = await motivoDaFuncao(
      { message: "Failed to send a request to the Edge Function" },
      null,
      "O pedido não foi enviado.",
    );
    expect(motivo.semResposta).toBe(true);
    expect(motivo.texto).toContain("Não chegou resposta do servidor");
  });

  it("o `context` pode ser lido de novo por quem chamou", async () => {
    // `clone()`, não o corpo original: o `Response` só pode ser lido uma vez, e
    // quem chamou pode precisar dele.
    const erro = erroHttp({ error: "forbidden" }, 403);
    await motivoDaFuncao(erro, null, "x");
    await expect(erro.context.json()).resolves.toEqual({ error: "forbidden" });
  });
});

/**
 * A regra: nenhuma tela mostra a frase do SDK a quem está olhando.
 *
 * Ela é sobre a classe, não sobre os cinco arquivos onde o defeito apareceu —
 * erro que esta sessão já cometeu três vezes. O próximo `invoke` escrito à mão
 * entra sozinho.
 */
const RAIZ = "src";
const IGNORAR = new Set(["node_modules", "dist", "coverage"]);

function varrer(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue;
    const full = join(dir, nome);
    if (statSync(full).isDirectory()) varrer(full, out);
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) {
      out.push(full.replace(/\\/g, "/"));
    }
  }
  return out;
}

/**
 * Tira comentários: menção a `error.message` num comentário não é código.
 *
 * O bloco `/* *\/` é trocado pelas MESMAS quebras de linha que ocupava, e não
 * por vazio. Removendo-as, tudo abaixo sobe, e a guarda passa a apontar uma
 * linha que não é a do defeito — conferido: com a mutação na linha 158, ela
 * dizia 150. Mensagem que aponta a causa errada custa mais que mensagem
 * nenhuma; é a mesma lição do `functionsCarregam` mandando instalar um Deno
 * que já estava instalado.
 */
function semComentarios(texto: string): string {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => "\n".repeat((bloco.match(/\n/g) ?? []).length))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("nenhuma tela mostra a frase do SDK", () => {
  it("quem chama `functions.invoke` não renderiza `error.message` cru", () => {
    const ruins: string[] = [];
    let comInvoke = 0;

    for (const arquivo of varrer(RAIZ)) {
      const texto = semComentarios(readFileSync(arquivo, "utf8"));
      if (!/functions\s*\.\s*invoke\s*\(/.test(texto)) continue;
      comInvoke++;

      // A regra ancora na CHAMADA, não no arquivo.
      //
      // A primeira versão selecionava o arquivo por conter um `invoke` em
      // algum lugar e depois acusava qualquer `error.message` dentro dele —
      // e pegou dois erros de PostgREST que nada têm a ver com edge function:
      // um `insert` em `hospital_members` e uma mensagem montada à mão no
      // `NovoCaso`, 280 linhas abaixo do `invoke` daquele arquivo. Ali o
      // `error.message` é a mensagem do Postgres, que é útil e específica.
      //
      // Reprovar quem fez certo por vizinhança de arquivo é o erro de sempre.
      const linhas = texto.split("\n");
      const JANELA = 25;
      for (let i = 0; i < linhas.length; i++) {
        if (!/functions\s*\.\s*invoke\s*\(/.test(linhas[i])) continue;

        const fim = Math.min(linhas.length, i + JANELA);
        for (let j = i; j < fim; j++) {
          // `description:` ou `toast.error(` recebendo o `message` do erro do
          // invoke. `traduzirFalhaIA` fica de fora: ela traduz pelo STATUS e
          // devolve texto próprio, e quem fez certo não pode ser reprovado.
          if (!/\berror\s*(?:as\s+\w+\s*)?\)?\s*\??\.\s*message\b/.test(linhas[j])) continue;
          const regiao = linhas.slice(Math.max(i, j - 6), j + 2).join("\n");
          if (!/toast\s*\.\s*(error|warning|message)|description\s*:/.test(regiao)) continue;
          if (/traduzirFalhaIA|motivoDaFuncao/.test(regiao)) continue;
          ruins.push(`  · ${arquivo}:${j + 1}`);
        }
      }
    }

    expect(
      comInvoke,
      "nenhum arquivo chama `functions.invoke` — a varredura conferiu nada",
    ).toBeGreaterThanOrEqual(8);
    expect(
      ruins,
      `\n${ruins.join("\n")}\n\n` +
        "`error.message` de um `invoke` é SEMPRE \"Edge Function returned a non-2xx\n" +
        "status code\" — conferido no fonte do SDK. O motivo que a função escreveu\n" +
        "está no corpo, dentro de `error.context`.\n\n" +
        "Use `motivoDaFuncao(error, data, \"<o genérico, em português>\")`.",
    ).toEqual([]);
  });
});
