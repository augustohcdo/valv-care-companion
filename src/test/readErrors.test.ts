// Este teste lê o disco; tsconfig.app.json restringe `types`, daí a referência.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guarda contra falha de LEITURA lida como conclusão.
 *
 * ## Por que um segundo arquivo, se já existe o `writeErrors.test.ts`
 *
 * Porque aquele varre `insert|update|upsert|delete` — só escrita. Nada cobria
 * leitura, e o vão era grande: **75 leituras** descartavam o `error` quando esta
 * varredura rodou pela primeira vez.
 *
 * A escrita cega mente sobre o passado ("salvei", quando não salvou). A leitura
 * cega é pior, porque mente sobre o **estado do paciente**. O cliente do
 * Supabase devolve `{ data: null, error }`; quem escreve `data ?? []` transforma
 * recusa de RLS e queda de rede em lista vazia — e a tela imprime a lista vazia
 * como fato:
 *
 *   · "Acessos ativos (0)" na tela de LGPD, com uma concessão vigente;
 *   · um PDF de prontuário sem a seção "Medicações ativas", lido depois, fora do
 *     aplicativo, como paciente sem anticoagulação;
 *   · "Nenhum compromisso futuro agendado" numa agenda que não carregou;
 *   · "Paciente não encontrado ou sem vínculo" — uma afirmação sobre o vínculo
 *     tirada de uma falha de rede.
 *
 * ## Duas exigências diferentes, de propósito
 *
 * Consertar as 75 de uma vez seria consertar mal. Então a guarda tem dois níveis:
 *
 *   1. **`SEM_TOLERANCIA`** — arquivos onde a falha vira conclusão clínica ou
 *      garantia de privacidade. Zero leituras cegas, sempre. Estes já foram
 *      corrigidos e não podem regredir.
 *   2. **A catraca** — no resto do projeto o número conhecido só pode cair.
 *      Uma leitura cega nova reprova; consertar as antigas nunca reprova.
 *
 * Catraca é confissão, não absolvição: o número abaixo é dívida declarada, com
 * a lista dos arquivos onde ela está.
 */

const RAIZ = "src";

/**
 * Arquivos onde ler errado muda conduta ou quebra promessa de privacidade.
 * Entrar nesta lista significa: nenhuma leitura cega, nem uma.
 */
const SEM_TOLERANCIA = [
  "src/pages/app/MedicoPacienteDetalhe.tsx",  // alimenta o PDF do prontuário
  "src/pages/app/PacienteIntegracoes.tsx",    // quem tem acesso aos meus dados
  "src/pages/app/HospitalPortal.tsx",         // o outro lado do mesmo consentimento
];

/**
 * Quantas leituras cegas o projeto ainda tem fora da lista acima.
 *
 * Só pode cair. Quando chegar a zero, esta constante sai e a exigência passa a
 * valer para o projeto inteiro.
 *
 * O número já nasceu corrigido uma vez: com o detector frouxo eram 56, com o
 * detector que amarra o `error` à variável são 60. Não é dívida nova — são
 * quatro que estavam escondidas atrás de um `error` que pertencia a outra coisa.
 */
const DIVIDA_CONHECIDA = 60;

function walk(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome === "dist") continue;
    const full = join(dir, nome);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(nome)) out.push(full);
  }
  return out;
}

/**
 * As leituras que descartam o erro.
 *
 * ## Por que não basta procurar a palavra `error` por perto
 *
 * A primeira versão desta varredura fazia isso, e a inversão a reprovou: eu
 * devolvi a leitura cega na tela de LGPD e **a guarda continuou verde**. O
 * motivo estava seis linhas acima da consulta —
 *
 *     const { data, isFetching: loading, error } = useQuery({
 *
 * — o `error` do `useQuery`, que não diz nada sobre a leitura lá dentro. Palavra
 * solta na vizinhança é coincidência, não checagem.
 *
 * Então o `error` precisa estar **amarrado à variável que recebe a chamada**:
 * ou desestruturado do próprio resultado, ou lido como `<variável>.error`.
 *
 * A folga de algumas linhas depois do statement não é frouxidão: num
 * `Promise.all` as chamadas ficam dentro do array e a checagem só pode vir
 * depois do `]);`. Sem ela, a varredura acusaria justamente o código corrigido
 * — e guarda que pune quem fez certo é guarda que alguém desliga.
 */
function encontrarCegas(): string[] {
  const achados: string[] = [];

  for (const arquivo of walk(RAIZ)) {
    const rel = arquivo.replace(/\\/g, "/");
    if (/\.test\.tsx?$/.test(rel)) continue;

    const linhas = readFileSync(arquivo, "utf8").split("\n");
    for (let i = 0; i < linhas.length; i++) {
      if (!/supabase\s*$|supabase\./.test(linhas[i])) continue;

      // O statement: daqui até o `;` que fecha, com um teto para não varrer o
      // arquivo inteiro quando falta ponto e vírgula.
      let fim = i;
      while (fim < linhas.length - 1 && fim < i + 12 && !/;\s*$/.test(linhas[fim])) fim++;
      const statement = linhas.slice(i, fim + 1).join("\n");

      // Escrita é assunto do writeErrors.test.ts.
      if (/\.(insert|update|upsert|delete)\(/.test(statement)) continue;
      if (!/\.select\(|\.rpc\(/.test(statement)) continue;

      // Quem recebe o resultado? A atribuição pode estar acima, quando a
      // chamada é um item de `Promise.all`.
      let alvo: string | null = null;
      for (let j = i; j >= Math.max(0, i - 6); j--) {
        const m = linhas[j].match(/(?:const|let|var)\s+(\[[^\]]*\]|\{[^}]*\}|\w+)\s*=/);
        if (m) { alvo = m[1]; break; }
      }
      if (!alvo) continue; // resultado descartado de propósito (fire-and-forget)

      const depois = Math.min(linhas.length, fim + 8);
      const regiao = linhas.slice(i, depois).join("\n");

      // 1) `{ data, error } = ...` — desestruturado do próprio resultado.
      if (/^\{/.test(alvo) && /\berror\b/.test(alvo)) continue;
      // 2) `const r = ...` / `const [r, g] = ...` — cobra `<nome>.error` depois.
      const nomes = alvo.replace(/^[[{]|[\]}]$/g, "")
        .split(",")
        .map((p) => p.split(":").pop()!.trim())
        .filter((n) => /^\w+$/.test(n));
      if (nomes.some((n) => new RegExp(`\\b${n}\\.error\\b`).test(regiao))) continue;
      // Não há regra 3. Eu tinha escrito uma — "um `throw` na região absolve" —
      // e ela reabria o mesmo buraco: o `throw` de uma leitura vizinha
      // absolvia esta. Quem confere o próprio erro já passa pela regra 1, que
      // reconhece tanto `{ data, error }` quanto `{ data: x, error: e }`.

      achados.push(`${rel}:${i + 1}`);
    }
  }
  return achados;
}

const cegas = encontrarCegas();
const foraDaLista = cegas.filter((c) => !SEM_TOLERANCIA.includes(c.split(":")[0]));
const naLista = cegas.filter((c) => SEM_TOLERANCIA.includes(c.split(":")[0]));

describe("leituras que viram conclusão", () => {
  it("nos arquivos onde ler errado muda conduta, nenhuma leitura ignora o erro", () => {
    expect(
      naLista,
      `\n${naLista.join("\n")}\n\n` +
        "Nestes arquivos a falha de leitura chega ao médico ou ao paciente como\n" +
        "afirmação: 'sem medicação', 'nenhum acesso ativo', 'sem vínculo'. Observe\n" +
        "o `error` e diga na tela que não foi possível ler — nunca deixe a lista\n" +
        "vazia falar pela falha.",
    ).toEqual([]);
  });

  it("a dívida do resto do projeto não cresce", () => {
    expect(
      foraDaLista.length,
      `\nLeituras cegas fora da lista sem tolerância: ${foraDaLista.length} (conhecidas: ${DIVIDA_CONHECIDA})\n\n` +
        foraDaLista.join("\n") +
        "\n\nSe o número SUBIU, uma leitura nova está descartando o erro.\n" +
        "Se CAIU, obrigado — baixe a constante DIVIDA_CONHECIDA para o novo valor.",
    ).toBeLessThanOrEqual(DIVIDA_CONHECIDA);
  });

  it("a lista sem tolerância aponta para arquivos que existem", () => {
    // Sem isto, renomear um arquivo esvaziaria a exigência em silêncio — a
    // lista continuaria "passando" por não encontrar nada.
    for (const caminho of SEM_TOLERANCIA) {
      expect(() => statSync(caminho), `SEM_TOLERANCIA aponta para ${caminho}`).not.toThrow();
    }
  });

  it("a varredura enxerga uma leitura cega de verdade", () => {
    // A contraprova da própria guarda. Um detector que não acha nada passaria
    // com o projeto inteiro corrigido e com o projeto inteiro quebrado.
    // Aqui se cobra que o mecanismo ainda encontra o padrão que ele procura.
    expect(
      cegas.length,
      "a varredura não achou NENHUMA leitura cega — provavelmente o detector quebrou",
    ).toBeGreaterThan(0);
  });
});
