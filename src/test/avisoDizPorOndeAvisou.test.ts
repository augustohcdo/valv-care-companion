/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * Guarda: a tela não afirma que alguém foi avisado sem dizer POR ONDE.
 *
 * ## O defeito
 *
 * O portal do hospital, ao registrar um pedido de acesso aos dados de um
 * paciente, respondia:
 *
 *     "Pedido enviado. O paciente foi notificado."
 *
 * O que acontece de verdade: um `insert` em `data_access_requests` dispara um
 * gatilho `AFTER INSERT` que cria uma linha em `notifications`. Essa linha
 * aparece no sino do app — **se e quando** o paciente abrir o ValvePath. Não há
 * e-mail, não há SMS, não há push. `weekly-digest` e `admin-digest` ESCREVEM
 * notificações; nenhuma função as converte em e-mail.
 *
 * A frase não era falsa, e é isso que a torna perigosa: existe a notificação.
 * O que ela faz é deixar quem opera o hospital concluir o que a frase sugere —
 * "ele já sabe, agora é esperar". Se o paciente não abrir o app, ninguém o
 * avisou de nada, e o pedido fica parado sem que o hospital entenda por quê.
 *
 * Em LGPD, informar o titular é dever do controlador (art. 9º). Dizer a um
 * terceiro que o titular foi informado é uma afirmação sobre o cumprimento
 * desse dever.
 *
 * ## O contraexemplo estava na própria base
 *
 * `AdminAcessos.tsx`, na decisão de acesso profissional, já faz o certo:
 *
 *     data?.email_enviado
 *       ? "O profissional foi avisado por e-mail."
 *       : `O e-mail não saiu (${motivo}). Avise por outro canal.`
 *
 * Condicionado no resultado do envio, com o caminho da falha escrito. O padrão
 * existia e era entendido; uma tela ficou de fora.
 *
 * ## A regra
 *
 * Todo texto de `toast` que afirme que alguém foi avisado/notificado precisa de
 * uma das duas coisas, na MESMA chamada:
 *
 *   1. depender do resultado do envio (`email_enviado`, `sent`, `enviado`) —
 *      aí a afirmação é sobre um fato medido; ou
 *   2. nomear o canal pelo que ele é (`no app`, `ao abrir`, `sino`) — aí quem
 *      lê sabe que é passivo e decide se avisa por outro meio.
 *
 * Não se cobra uma redação. Cobra-se que a afirmação venha com a informação que
 * a torna acionável — que é a diferença entre avisar e dar a impressão de ter
 * avisado.
 */

const raiz = resolve(__dirname, "../..");
const RAIZES = ["src/pages", "src/components"];

/**
 * Afirmação de que alguém foi — ou será — avisado.
 *
 * `verá o aviso` entrou depois do conserto, e por um motivo que vale escrever:
 * a primeira versão casava só com "notificado/avisado", e o texto corrigido do
 * portal do hospital ("o paciente verá o aviso no sino…") deixou de casar. Quer
 * dizer que a guarda parou de olhar justamente a linha que ela acabara de
 * consertar — e o piso reprovou, que é o que ele existe para fazer.
 *
 * Se a frase sair do conjunto classificado, apagar o nome do canal amanhã não
 * reprova nada. Cobertura é garantia só sobre o que a guarda olha.
 */
const AFIRMA_AVISO =
  /notificad[oa]s?\b|avisad[oa]s?\b|foi informad[oa]\b|\bavisamos\b|ver[áa] o aviso\b/i;

/** (1) A afirmação depende do resultado de um envio. */
const DEPENDE_DO_ENVIO = /email_enviado|\bsent\b|\benviado\b\s*\?|\?\s*["'`][^"'`]*avisad/i;

/** (2) A afirmação nomeia o canal passivo. */
const NOMEIA_O_CANAL = /\bno app\b|ao abrir\b|\bsino\b|dentro do ValvePath|no ValvePath/i;

function arquivos(dir: string, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivos(caminho, saida);
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

/**
 * O texto COMPLETO de cada chamada a `toast.*`, por balanceamento de
 * parênteses.
 *
 * Janela de N caracteres em volta do achado seria mais simples e erraria dos
 * dois lados: pegaria o `toast` de cima numa tela cheia deles, e cortaria o
 * `description` de uma chamada longa. Esta sessão já registrou as duas formas
 * desse erro — a fatia de 900 caracteres do `conferir-pmids` e a janela de 15
 * linhas da guarda das portas públicas.
 */
export function chamadasDeToast(fonte: string): { inicio: number; texto: string }[] {
  const saida: { inicio: number; texto: string }[] = [];
  const re = /toast\.(?:success|error|info|warning)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fonte))) {
    let i = m.index + m[0].length;
    let nivel = 1;
    let dentro: string | null = null;
    for (; i < fonte.length && nivel > 0; i++) {
      const c = fonte[i];
      if (dentro) {
        if (c === "\\") { i++; continue; }
        if (c === dentro) dentro = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") { dentro = c; continue; }
      if (c === "(") nivel++;
      else if (c === ")") nivel--;
    }
    saida.push({ inicio: m.index, texto: fonte.slice(m.index, i) });
  }
  return saida;
}

const linhaDe = (fonte: string, indice: number) => fonte.slice(0, indice).split("\n").length;

describe("quem avisa diz por onde avisou", () => {
  const encontrados = RAIZES.flatMap((r) => arquivos(resolve(raiz, r)))
    .flatMap((caminho) => {
      const fonte = readFileSync(caminho, "utf8");
      return chamadasDeToast(fonte)
        .filter((c) => AFIRMA_AVISO.test(c.texto))
        .map((c) => ({
          arquivo: relative(raiz, caminho),
          linha: linhaDe(fonte, c.inicio),
          texto: c.texto,
        }));
    });

  it("a varredura acha as afirmações de aviso que existem", () => {
    /**
     * O piso, sobre o que o LAÇO classificou — não sobre arquivos lidos. Um
     * extrator que parasse de casar devolveria lista vazia e as regras abaixo
     * passariam sobre nada, que é o defeito que esta sessão persegue.
     */
    expect(
      encontrados.length,
      "nenhuma afirmação de aviso encontrada — o extrator de `toast` parou de casar",
    ).toBeGreaterThanOrEqual(2);
  });

  it("o extrator pega a chamada inteira, não a primeira linha", () => {
    // Contraprova em material plantado: o `description` de uma chamada longa
    // precisa entrar, senão a regra julgaria metade do texto.
    const plantado = `
      toast.success("Acesso liberado", {
        description: resultado.email_enviado
          ? "O profissional foi avisado por e-mail."
          : "O e-mail não saiu. Avise por outro canal.",
        duration: 8000,
      });
      toast.error("Outra coisa");
    `;
    const achadas = chamadasDeToast(plantado);
    expect(achadas.length, "não separou as duas chamadas").toBe(2);
    expect(achadas[0].texto, "cortou o `description` da primeira chamada")
      .toContain("Avise por outro canal");
    expect(achadas[0].texto, "engoliu a chamada seguinte").not.toContain("Outra coisa");
  });

  it("toda afirmação de aviso diz por onde, ou depende do envio", () => {
    const sem = encontrados.filter(
      (e) => !DEPENDE_DO_ENVIO.test(e.texto) && !NOMEIA_O_CANAL.test(e.texto),
    );
    expect(
      sem.map((e) => `${e.arquivo}:${e.linha} — ${e.texto.replace(/\s+/g, " ").slice(0, 120)}`),
      "\nAfirma que alguém foi avisado sem dizer por onde nem medir o envio.\n" +
        "Quem lê conclui que a pessoa soube. Se o canal é o sino do app, diga isso;\n" +
        "se é e-mail, condicione no resultado — ver AdminAcessos.tsx.",
    ).toEqual([]);
  });

  it("as duas formas aceitas são de fato distinguidas", () => {
    // Contraprova das regras: sem isto, um `DEPENDE_DO_ENVIO` que casasse
    // sempre faria o caso acima passar com qualquer texto.
    const medido = `toast.success("ok", { description: data?.email_enviado ? "avisado por e-mail" : "não saiu" })`;
    const canal = `toast.success("Pedido enviado", { description: "O paciente verá o aviso no sino ao abrir o app." })`;
    const nenhum = `toast.success("Pedido enviado. O paciente foi notificado.")`;

    expect(DEPENDE_DO_ENVIO.test(medido), "não reconheceu a forma medida").toBe(true);
    expect(NOMEIA_O_CANAL.test(canal), "não reconheceu a forma que nomeia o canal").toBe(true);
    expect(
      DEPENDE_DO_ENVIO.test(nenhum) || NOMEIA_O_CANAL.test(nenhum),
      "aceitou a frase que não diz nada sobre o canal",
    ).toBe(false);
    expect(AFIRMA_AVISO.test(nenhum), "não reconheceu a afirmação de aviso").toBe(true);
  });
});
