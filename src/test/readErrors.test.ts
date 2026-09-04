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
 *
 * Histórico da queda, para o número não virar folclore:
 *
 *   60 → 58  duas leituras de `PacienteAprender.tsx`, que transformavam falha
 *            de rede em "seu médico ainda não registrou nenhum caso";
 *   58 → 55  `MedicoAgenda` e `ListaCasos`;
 *   55 → 49  as sete de `MedicoRelatorios`, MAIS seis falsos positivos que o
 *            próprio detector criava: ele acusava
 *            `const [{ data, error }, { data, error }] = await Promise.all(…)`
 *            — código correto — porque a regra 1 exigia que o padrão começasse
 *            com `{`. Junto veio o falso NEGATIVO gêmeo, que era o grave: o
 *            mesmo padrão quebrado em várias linhas não casava com regex
 *            nenhuma e era absolvido como "resultado descartado de propósito".
 *   49 → 40  as telas do PACIENTE sobre ele mesmo. A pior era
 *            `PacientePerfil`: o formulário abria em branco com o botão Salvar
 *            ativo, e um clique gravava nome, telefone, data de nascimento e
 *            comorbidades VAZIOS por cima do cadastro real. Não era tela
 *            mostrando menos do que existe — era perda de dado. Junto,
 *            `PacienteHome` dizendo "Você ainda não vinculou um médico" a quem
 *            tem, e `PacienteJornada` mostrando "Nenhum caso clínico ainda"
 *            porque o `try/catch` que já existia nunca via falha (o cliente do
 *            Supabase não lança, devolve `{ data: null, error }`).
 */
const DIVIDA_CONHECIDA = 40;

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
/**
 * O padrão de destino da ÚLTIMA declaração do texto: o que vem entre
 * `const`/`let`/`var` e o `=`, com colchetes e chaves equilibrados, atravessando
 * quebras de linha. Devolve `null` quando não há declaração nenhuma.
 */
function padraoDeDestino(texto: string): string | null {
  const decls = [...texto.matchAll(/\b(?:const|let|var)\s+/g)];
  for (const d of decls.reverse()) {
    let k = d.index! + d[0].length;
    const abre: Record<string, string> = { "[": "]", "{": "}", "(": ")" };
    const pilha: string[] = [];
    const comeco = k;
    while (k < texto.length) {
      const c = texto[k];
      if (abre[c]) pilha.push(abre[c]);
      else if (pilha.length && c === pilha[pilha.length - 1]) pilha.pop();
      else if (pilha.length === 0 && (c === "=" || c === ";" || c === "\n")) break;
      k++;
    }
    if (texto[k] !== "=") continue; // `const x;` ou fim de linha: não é atribuição
    const padrao = texto.slice(comeco, k).trim();
    if (padrao) return padrao;
  }
  return null;
}

/** Os itens de primeiro nível de um padrão `[a, b, c]`. */
function itensDoArray(padrao: string): string[] {
  const dentro = padrao.slice(1, -1);
  const itens: string[] = [];
  let profundidade = 0;
  let atual = "";
  for (const c of dentro) {
    if ("[{(".includes(c)) profundidade++;
    if ("]})".includes(c)) profundidade--;
    if (c === "," && profundidade === 0) { itens.push(atual.trim()); atual = ""; continue; }
    atual += c;
  }
  if (atual.trim()) itens.push(atual.trim());
  return itens.filter((x) => x.length > 0);
}

/**
 * `[{ data, error }, { data, error }] = await Promise.all([…])` — absolve?
 *
 * Só quando TODOS os itens observam o erro. Um item cego entre dois corretos é
 * justamente a leitura que fica sem dono, e "algum deles confere" é a regra
 * frouxa que deixaria essa passar.
 */
function arrayObservaTodosOsErros(padrao: string): boolean {
  const itens = itensDoArray(padrao);
  const objetos = itens.filter((x) => x.startsWith("{"));
  return objetos.length > 0 && objetos.length === itens.length &&
    objetos.every((o) => /\berror\b/.test(o));
}

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
      // chamada é um item de `Promise.all`, e o padrão pode ocupar VÁRIAS
      // linhas — daí a busca ser sobre o texto junto, e não linha a linha.
      //
      // A versão anterior usava `/(?:const|let|var)\s+(\[[^\]]*\]|\{[^}]*\}|\w+)\s*=/`
      // em cada linha isolada, e errava dos dois lados:
      //
      //   · `const [{ data: a, error: eA }, { data: b, error: eB }] = ...`
      //     — código CORRETO — era acusado, porque a regra 1 exigia que o
      //     padrão começasse com `{` e este começa com `[`. Guarda que pune
      //     quem fez certo é guarda que alguém desliga;
      //   · `const [\n  { data: a },\n ...\n] = ...` — código CEGO — era
      //     ABSOLVIDO, porque nenhuma linha sozinha casava e a varredura
      //     concluía "resultado descartado de propósito". Falso negativo, que é
      //     o defeito grave.
      const contexto = linhas.slice(Math.max(0, i - 6), fim + 1).join("\n");
      const alvo = padraoDeDestino(contexto);
      if (!alvo) continue; // resultado descartado de propósito (fire-and-forget)

      const depois = Math.min(linhas.length, fim + 8);
      const regiao = linhas.slice(i, depois).join("\n");

      // 1) `{ data, error } = ...` — desestruturado do próprio resultado.
      if (/^\{/.test(alvo) && /\berror\b/.test(alvo)) continue;
      // 1b) `[{ data, error }, { data, error }] = await Promise.all([...])` —
      //     cada item do array recebe o resultado de UMA das chamadas. Só
      //     absolve quando TODOS observam o erro: um item cego entre dois
      //     corretos é exatamente a leitura que fica sem dono.
      if (/^\[/.test(alvo) && arrayObservaTodosOsErros(alvo)) continue;
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

/**
 * O detector, conferido nas duas direções.
 *
 * Estes testes existem porque o detector errou dos DOIS lados de uma vez, e os
 * dois erros são invisíveis olhando só o total: o falso positivo enche a dívida
 * de código correto (e convida a desligar a guarda), e o falso negativo abaixa
 * a dívida sem ninguém ter consertado nada — que é a mentira que esta sessão
 * inteira persegue.
 *
 * Um teste do TOTAL não pega nenhum dos dois. Estes pegam.
 */
describe("as duas peças do detector", () => {
  it("acha o padrão de destino mesmo quebrado em várias linhas", () => {
    // Este era o falso negativo: nenhuma linha sozinha casava, e a varredura
    // concluía "resultado descartado de propósito" — absolvendo uma leitura
    // cega de verdade.
    const texto = "const [\n  { data: p },\n  { data: q },\n] = await Promise.all([";
    expect(padraoDeDestino(texto)).toBe("[\n  { data: p },\n  { data: q },\n]");
  });

  it("pega a última declaração, não a primeira", () => {
    // A chamada pertence à declaração mais próxima acima dela.
    const texto = "const { data: outro, error: e } = await x;\nconst { data } = await supabase";
    expect(padraoDeDestino(texto)).toBe("{ data }");
  });

  it("não confunde `const x;` com atribuição", () => {
    expect(padraoDeDestino("const nada;\nfoo()")).toBeNull();
    expect(padraoDeDestino("nada aqui")).toBeNull();
  });

  it("só absolve o array quando TODOS os itens observam o erro", () => {
    // A regra frouxa — "algum item confere" — não muda o total de hoje, porque
    // não existe esse padrão misto no projeto agora. Um teste do total passaria
    // com ela, e a primeira leitura cega escrita nesse formato entraria
    // absolvida. Por isso a regra é cobrada aqui, direto.
    expect(arrayObservaTodosOsErros("[{ data: a, error: e }, { data: b, error: f }]")).toBe(true);
    expect(
      arrayObservaTodosOsErros("[{ data: a, error: e }, { data: b }]"),
      "um item cego ao lado de um correto foi absolvido",
    ).toBe(false);
    expect(arrayObservaTodosOsErros("[{ data: a }, { data: b }]")).toBe(false);
    // Array de nomes simples não é este caso — cai na regra do `<nome>.error`.
    expect(arrayObservaTodosOsErros("[um, dois]")).toBe(false);
  });

  it("separa os itens do array sem se perder no aninhamento", () => {
    // A vírgula de dentro de `{ data: a, error: e }` não é separador de item.
    expect(itensDoArray("[{ data: a, error: e }, { data: b, error: f }]")).toEqual([
      "{ data: a, error: e }",
      "{ data: b, error: f }",
    ]);
    expect(itensDoArray("[um, dois]")).toEqual(["um", "dois"]);
  });
});
