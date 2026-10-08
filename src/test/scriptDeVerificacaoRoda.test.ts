/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentariosDeCodigo } from "./semComentariosDeCodigo";

/**
 * Script de verificação que nenhum workflow executa é guarda que ninguém roda.
 *
 * ## O que foi achado
 *
 * `scripts/mobile.mjs` abre as páginas públicas em viewport de iPhone e falha
 * listando quem passa da largura da tela. Ele existe porque o `index.css` tinha
 * `overflow-x: hidden` em `html, body` com o comentário "bloqueia scroll
 * horizontal — evita vazamento de layout", e isso não conserta vazamento
 * nenhum: **converte um layout largo demais em texto apagado**. No iPhone as
 * linhas terminavam cortadas no meio da palavra, sem barra de rolagem para
 * denunciar, e o defeito atravessou semanas.
 *
 * O script foi escrito, segue a convenção de saída 0/1/2 desta base, é citado
 * nos comentários dos outros como irmão deles — e **nenhum workflow o
 * executava**. Quer dizer: o defeito que ele existe para pegar podia voltar sem
 * ninguém notar, com a CI verde e a agenda diária verde.
 *
 * Está ligado agora, em `verificacoes-periodicas.yml`, ao lado das
 * calculadoras. Esta guarda é a parte que impede o próximo.
 *
 * ## Como eu errei a medição, duas vezes
 *
 * Primeiro procurei `npm run <script>` nos workflows e concluí que `test` não
 * rodava em nenhum — a CI usa `npm test`, sem o `run`. Depois procurei o
 * BASENAME do arquivo e concluí que `conferir-migrations.mjs` não rodava — ele
 * roda como `npm run migrations`.
 *
 * As duas vezes o número saiu assustador e falso. São DUAS indireções, e quem
 * olha só uma mede outra coisa:
 *
 *   · o caminho aparece direto: `node scripts/x.mjs`;
 *   · ou via npm: `npm run x`, com o atalho `npm test` sem o `run`.
 *
 * Daí o núcleo desta guarda ser puro e ter casos plantados: foi o único jeito de
 * eu parar de acreditar na primeira medição que me ocorria.
 */

/** Tem veredito: sai com 1 (diverge) ou 2 (não conferido). */
const SAIDA_COM_VEREDITO = /process\.exit\(\s*(?:1|2)\s*\)/;

/** `npm <nome>` funciona sem o `run` só para estes. */
const ATALHOS_DO_NPM = new Set(["test", "start", "stop", "restart"]);

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface Workflow { nome: string; texto: string }

/**
 * Onde este script é executado — pelas DUAS indireções.
 *
 * Puro de propósito: recebe os workflows e os scripts do npm em vez de ler o
 * disco, para os casos plantados poderem exercitar cada caminho.
 */
export function ondeRoda(
  caminho: string,
  workflows: Workflow[],
  scriptsNpm: Record<string, string>,
): string[] {
  const onde = new Set<string>();
  const alvo = caminho.replace(/\\/g, "/");

  // 1) o caminho citado direto no workflow.
  for (const w of workflows) if (w.texto.includes(alvo)) onde.add(w.nome);

  // 2) via npm: o script do `package.json` referencia o arquivo, e algum
  //    workflow invoca esse script.
  for (const [nome, comando] of Object.entries(scriptsNpm)) {
    if (!comando.includes(alvo)) continue;
    const padroes = [new RegExp(`npm\\s+run\\s+${escapar(nome)}(?![\\w:-])`)];
    if (ATALHOS_DO_NPM.has(nome)) padroes.push(new RegExp(`npm\\s+${escapar(nome)}(?![\\w:-])`));
    for (const w of workflows) {
      if (padroes.some((p) => p.test(w.texto))) onde.add(`${w.nome} (npm run ${nome})`);
    }
  }
  return [...onde].sort();
}

/**
 * Ferramentas de uso manual, com o motivo — elas FAZEM algo, não CONFEREM.
 *
 * A distinção é a que importa: uma ferramenta que ninguém chamou hoje não
 * afirma nada sobre o sistema. Uma verificação que ninguém chamou afirma, pelo
 * silêncio, que está tudo bem.
 */
const FERRAMENTAS_MANUAIS: Record<string, string> = {
  "scripts/cnes-import.mjs":
    "importa um recorte da base pública do DATASUS para `cnes_profissionais`. " +
    "Roda à mão quando a base é atualizada; não confere nada.",
  "scripts/demo-seed.mjs":
    "semeia e limpa os dados fictícios de demonstração. Rodar sozinho, todo " +
    "dia, mexeria no banco sem ninguém pedir.",
  "scripts/generate-supabase-types.mjs":
    "gera `src/integrations/supabase/types.ts` do banco. Precisa de credencial " +
    "e produz um arquivo que entra em commit — não é conferência.",
  "scripts/gerar-revisao-biblioteca.mjs":
    "gera a página de revisão da biblioteca clínica para um cardiologista " +
    "conferir afirmação por afirmação. Produz documento; não dá veredito sobre o sistema.",
  "scripts/workspace.mjs":
    "sobe, lista, baixa e apaga os arquivos de trabalho no bucket. É ferramenta " +
    "de linha de comando, e pede `SUPABASE_ACCESS_TOKEN` — que não entra em " +
    "workflow que roda sozinho, todo dia, sem ninguém olhando.",
};

function lerWorkflows(): Workflow[] {
  const dir = ".github/workflows";
  return readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()
    .map((nome) => ({ nome, texto: readFileSync(join(dir, nome), "utf8") }));
}

const workflows = lerWorkflows();
const scriptsNpm = (JSON.parse(readFileSync("package.json", "utf8")).scripts ?? {}) as
  Record<string, string>;

const verificacoes = readdirSync("scripts")
  .filter((f) => /\.(mjs|ts)$/.test(f))
  .sort()
  .map((f) => ({ caminho: `scripts/${f}`, texto: readFileSync(join("scripts", f), "utf8") }))
  // Sem comentário: esta é uma busca por TEXTO, e um docstring que explique a
  // convenção `process.exit(2)` faria uma ferramenta passar por verificação.
  .filter((s) => SAIDA_COM_VEREDITO.test(semComentariosDeCodigo(s.texto, s.caminho)))
  .map((s) => ({ ...s, onde: ondeRoda(s.caminho, workflows, scriptsNpm) }));

describe("toda verificação é executada por alguém", () => {
  it("nenhum script de verificação fica sem workflow", () => {
    const orfaos = verificacoes
      .filter((s) => s.onde.length === 0 && !(s.caminho in FERRAMENTAS_MANUAIS))
      .map((s) => `  · ${s.caminho}`);
    expect(
      orfaos,
      `\n${orfaos.join("\n")}\n\n` +
        "Este script dá veredito (sai com 1 ou 2) e NENHUM workflow o executa.\n" +
        "Ele existe, é linted, é citado como irmão dos que rodam — e o defeito\n" +
        "que ele pega pode voltar sem ninguém notar, com tudo verde.\n\n" +
        "Foi o caso de `mobile.mjs`, que media transbordo de layout no celular\n" +
        "sobre um defeito que já tinha atravessado semanas escondido por um\n" +
        "`overflow-x: hidden`.\n\n" +
        "Ligue no workflow que couber, ou declare em FERRAMENTAS_MANUAIS\n" +
        "dizendo por que ele FAZ algo em vez de CONFERIR algo.",
    ).toEqual([]);
  });

  it("toda ferramenta declarada manual existe e continua dando veredito", () => {
    // Dispensa órfã é permissão que ninguém revisa. Se o arquivo sumiu ou
    // deixou de ter veredito, a entrada tem de sair — senão ela fica valendo
    // para o próximo script com o mesmo nome.
    for (const [caminho, motivo] of Object.entries(FERRAMENTAS_MANUAIS)) {
      expect(motivo.length, `a dispensa de ${caminho} não tem motivo escrito`)
        .toBeGreaterThan(40);
      expect(
        verificacoes.map((s) => s.caminho),
        `${caminho} está em FERRAMENTAS_MANUAIS e não é mais um script com ` +
          "veredito (sumiu, ou parou de sair com 1/2) — tire a entrada",
      ).toContain(caminho);
    }
  });

  it("`mobile.mjs` continua ligado — foi o achado que motivou esta guarda", () => {
    /**
     * Nomeado, e não só coberto pela regra acima. A regra geral protege a
     * classe; esta linha protege o caso, porque alguém que ache o passo lento
     * pode tirá-lo do workflow e pôr o arquivo em FERRAMENTAS_MANUAIS — o que
     * passaria pela regra geral e desfaria o conserto.
     *
     * Se a decisão for mesmo tirá-lo, esta asserção é o lugar de registrar por
     * quê.
     */
    const mobile = verificacoes.find((s) => s.caminho === "scripts/mobile.mjs");
    expect(mobile, "`scripts/mobile.mjs` desapareceu").toBeDefined();
    expect(
      mobile!.onde,
      "`mobile.mjs` saiu dos workflows. Ele mede transbordo de layout no " +
        "celular, e o defeito que ele pega — texto cortado no iPhone, escondido " +
        "por `overflow-x: hidden` — atravessou semanas sem ninguém ver.",
    ).not.toEqual([]);
    expect(
      "scripts/mobile.mjs" in FERRAMENTAS_MANUAIS,
      "`mobile.mjs` foi declarado ferramenta manual. Ele não faz nada: ele " +
        "confere. Dispensá-lo é desligar a guarda pela porta de trás.",
    ).toBe(false);
  });
});

describe("os pisos e a contraprova desta varredura", () => {
  it("achou os scripts de verificação e os workflows", () => {
    expect(
      verificacoes.length,
      `só ${verificacoes.length} scripts com veredito — eram 17 quando esta ` +
        "guarda foi escrita; o filtro de `process.exit` parou de casar",
    ).toBeGreaterThan(10);
    expect(workflows.length, "nenhum workflow lido").toBeGreaterThan(3);
    // E a maioria roda: se `ondeRoda` passasse a devolver lista vazia para
    // todos, a regra acima acusaria tudo — mas se passasse a devolver algo para
    // todos, ela aprovaria tudo. Este piso mata o segundo caso.
    const rodando = verificacoes.filter((s) => s.onde.length > 0);
    expect(
      rodando.length,
      "nenhuma verificação consta de workflow nenhum — `ondeRoda` quebrou",
    ).toBeGreaterThan(8);
  });

  it("`ondeRoda` reconhece as duas indireções, e não inventa uma terceira", () => {
    /**
     * A contraprova. Eu errei a medição dos dois jeitos antes de escrever isto:
     * procurando só `npm run <nome>` (e perdendo o atalho `npm test`) e
     * procurando só o basename (e perdendo o `npm run migrations`).
     */
    const wf = (texto: string): Workflow[] => [{ nome: "w.yml", texto }];

    // Caminho citado direto.
    expect(ondeRoda("scripts/x.mjs", wf("        run: node scripts/x.mjs --flag\n"), {}))
      .toEqual(["w.yml"]);

    // Via `npm run <nome>`.
    expect(ondeRoda("scripts/x.mjs", wf("        run: npm run conferir\n"), {
      conferir: "node scripts/x.mjs",
    })).toEqual(["w.yml (npm run conferir)"]);

    // O atalho `npm test`, sem o `run` — o erro nº 1.
    expect(ondeRoda("scripts/x.mjs", wf("        run: npm test\n"), {
      test: "node scripts/x.mjs",
    })).toEqual(["w.yml (npm run test)"]);

    // E `npm run x` NÃO conta como `npm run x:algo`: nome parecido não é o
    // mesmo script, e a fronteira `(?![\w:-])` é o que separa os dois.
    expect(ondeRoda("scripts/x.mjs", wf("        run: npm run conferir:tudo\n"), {
      conferir: "node scripts/x.mjs",
    })).toEqual([]);

    // Nem o contrário: o script invocado é outro.
    expect(ondeRoda("scripts/x.mjs", wf("        run: npm run outro\n"), {
      conferir: "node scripts/x.mjs",
      outro: "node scripts/y.mjs",
    })).toEqual([]);

    // Script do npm que referencia o arquivo mas que NENHUM workflow invoca.
    expect(ondeRoda("scripts/x.mjs", wf("        run: npm run lint\n"), {
      conferir: "node scripts/x.mjs",
    })).toEqual([]);
  });
});
