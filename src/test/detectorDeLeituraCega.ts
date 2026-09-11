// Este módulo lê o disco; tsconfig.app.json restringe `types`, daí a referência.
/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * O detector de leitura cega, num lugar só.
 *
 * ## Por que ele saiu de dentro do teste
 *
 * Ele nasceu dentro de `readErrors.test.ts` varrendo `src`. Quando a varredura
 * chegou às edge functions, a saída óbvia era copiar o arquivo e trocar a raiz —
 * e duas cópias divergem. Esta base já pagou por isso uma vez: a lista de
 * tabelas do backup ficou quinze tabelas atrasada porque existia em dois
 * lugares.
 *
 * ## O que ele mede, dito com precisão
 *
 * Quantas leituras **ignoram o erro por completo**: o `error` não é
 * desestruturado junto da chamada nem lido como `<variável>.error` logo abaixo.
 *
 * Ele NÃO mede se alguém fez algo com o erro. Observar e engolir passa. Separar
 * as duas coisas exige entender o fluxo depois da leitura, e um detector que
 * tenta isso por texto erra dos dois lados — defeito que este aqui já teve.
 * É o piso, não o teto.
 *
 * ## O cliente não se chama "supabase" em todo lugar
 *
 * Em `src` ele é sempre `supabase`, importado de um módulo só. Nas edge
 * functions ele é criado com `createClient` e se chama **`admin` em quinze
 * lugares**, `userClient` em três, `adminDoc` em um. Por isso quem chama passa
 * `nomesDoCliente`: mirar na palavra "supabase" acharia menos da metade das
 * leituras e devolveria um número tranquilizador e falso — o erro de guardar o
 * vocabulário em vez da coisa, que esta sessão já cometeu duas vezes.
 */

export interface Varredura {
  /** Diretório raiz, relativo à raiz do projeto. */
  raiz: string;
  /**
   * Os nomes que ESTE arquivo dá ao cliente do banco. Lista vazia = o arquivo
   * não fala com o banco e é pulado inteiro.
   */
  nomesDoCliente: (texto: string, caminho: string) => string[];
}

export function walk(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome === "dist") continue;
    const full = join(dir, nome);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(nome)) out.push(full);
  }
  return out;
}

/**
 * O padrão de destino da ÚLTIMA declaração do texto: o que vem entre
 * `const`/`let`/`var` e o `=`, com colchetes e chaves equilibrados, atravessando
 * quebras de linha. Devolve `null` quando não há declaração nenhuma.
 *
 * A versão anterior casava linha a linha e errava dos dois lados: acusava
 * `const [{ data: a, error: eA }, { data: b, error: eB }] = …` (correto) e
 * absolvia o mesmo padrão quebrado em várias linhas (cego) — o falso negativo,
 * que é o grave.
 */
export function padraoDeDestino(texto: string): string | null {
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
export function itensDoArray(padrao: string): string[] {
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
export function arrayObservaTodosOsErros(padrao: string): boolean {
  const itens = itensDoArray(padrao);
  const objetos = itens.filter((x) => x.startsWith("{"));
  return objetos.length > 0 && objetos.length === itens.length &&
    objetos.every((o) => /\berror\b/.test(o));
}

/**
 * Os nomes que um arquivo de edge function dá ao cliente, achados pelo
 * `createClient` que os cria. É a forma de mirar na coisa e não na palavra.
 */
export function clientesCriadosNoArquivo(texto: string): string[] {
  return [
    ...texto.matchAll(/\b(?:const|let|var)\s+(\w+)\s*(?::[^=]+?)?=\s*createClient\b/g),
  ].map((m) => m[1]);
}

/** Escapa um nome de variável para entrar numa regex. */
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * As leituras que descartam o erro, em `caminho:linha`.
 *
 * ## Por que não basta procurar a palavra `error` por perto
 *
 * A primeira versão fazia isso e a inversão a reprovou: devolvi a leitura cega
 * na tela de LGPD e a guarda continuou verde, por causa de um
 * `const { data, isFetching: loading, error } = useQuery({` seis linhas acima —
 * o `error` do `useQuery`, que não diz nada sobre a leitura lá dentro. Palavra
 * solta na vizinhança é coincidência, não checagem.
 *
 * Por isso o `error` precisa estar **amarrado à variável que recebe a chamada**.
 */
export function encontrarCegas({ raiz, nomesDoCliente }: Varredura): string[] {
  const achados: string[] = [];

  for (const arquivo of walk(raiz)) {
    const rel = arquivo.replace(/\\/g, "/");
    if (/\.test\.tsx?$/.test(rel)) continue;

    const texto = readFileSync(arquivo, "utf8");
    const clientes = nomesDoCliente(texto, rel);
    if (clientes.length === 0) continue;

    // `cliente` no fim da linha (a chamada continua abaixo) ou `cliente.algo`.
    const nomes = clientes.map(escapar).join("|");
    const ehChamada = new RegExp(`\\b(?:${nomes})\\s*$|\\b(?:${nomes})\\.`);

    const linhas = texto.split("\n");
    for (let i = 0; i < linhas.length; i++) {
      if (!ehChamada.test(linhas[i])) continue;

      // O statement: daqui até o `;` que fecha, com um teto para não varrer o
      // arquivo inteiro quando falta ponto e vírgula.
      let fim = i;
      while (fim < linhas.length - 1 && fim < i + 12 && !/;\s*$/.test(linhas[fim])) fim++;
      const statement = linhas.slice(i, fim + 1).join("\n");

      // Escrita é assunto do writeErrors.test.ts.
      if (/\.(insert|update|upsert|delete)\(/.test(statement)) continue;
      if (!/\.select\(|\.rpc\(/.test(statement)) continue;

      // Quem recebe o resultado? A atribuição pode estar acima, quando a
      // chamada é um item de `Promise.all`, e o padrão pode ocupar várias
      // linhas — daí a busca ser sobre o texto junto, e não linha a linha.
      const contexto = linhas.slice(Math.max(0, i - 6), fim + 1).join("\n");
      const alvo = padraoDeDestino(contexto);
      if (!alvo) continue; // resultado descartado de propósito (fire-and-forget)

      // A folga de algumas linhas depois do statement não é frouxidão: num
      // `Promise.all` as chamadas ficam dentro do array e a checagem só pode vir
      // depois do `]);`. Sem ela, a varredura acusaria o código corrigido — e
      // guarda que pune quem fez certo é guarda que alguém desliga.
      const regiao = linhas.slice(i, Math.min(linhas.length, fim + 8)).join("\n");

      // 1) `{ data, error } = ...` — desestruturado do próprio resultado.
      if (/^\{/.test(alvo) && /\berror\b/.test(alvo)) continue;
      // 1b) `[{ data, error }, { data, error }] = await Promise.all([...])`.
      if (/^\[/.test(alvo) && arrayObservaTodosOsErros(alvo)) continue;
      // 2) `const r = ...` / `const [r, g] = ...` — cobra `<nome>.error` depois.
      const recebem = alvo.replace(/^[[{]|[\]}]$/g, "")
        .split(",")
        .map((p) => p.split(":").pop()!.trim())
        .filter((n) => /^\w+$/.test(n));
      if (recebem.some((n) => new RegExp(`\\b${escapar(n)}\\.error\\b`).test(regiao))) continue;
      // Não há regra 3. Eu tinha escrito uma — "um `throw` na região absolve" —
      // e ela reabria o mesmo buraco: o `throw` de uma leitura vizinha absolvia
      // esta. Quem confere o próprio erro já passa pela regra 1.

      achados.push(`${rel}:${i + 1}`);
    }
  }
  return achados;
}
