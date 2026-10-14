// Este teste lê o disco; tsconfig.app.json restringe `types`, daí a referência.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guarda contra dizer que deu certo sem ter olhado.
 *
 * O cliente do Supabase **não lança** em erro: devolve `{ error }`. Quem não
 * desestrutura não fica sabendo de recusa de RLS, violação de constraint nem
 * queda de rede — e segue direto para o `toast.success`.
 *
 * Sozinho isso já engana quem está usando. O que torna grave é a linha
 * seguinte: `logAudit(...)`. Num prontuário eletrônico a trilha de auditoria é
 * o registro de conformidade, e uma trilha que afirma o que não aconteceu é
 * pior que uma incompleta — quem for lê-la depois não tem como saber quais
 * linhas são verdade.
 *
 * Foi assim em treze lugares desta base: apagar exame, documento, evento,
 * compromisso, comentário, medicação, registro de sintoma.
 */

const RAIZ = "src";

/** Escritas: só elas mudam estado. `.select()` sozinho não entra. */
const ESCRITAS = /\.(insert|update|upsert|delete)\(/;

/** Quantas linhas depois da escrita ainda contam como "a mesma ação". */
const JANELA = 8;

/**
 * Exceções deliberadas. Cada uma precisa de motivo — se não dá para escrever o
 * motivo, é esquecimento, não decisão.
 */
const ALLOWLIST: Record<string, string> = {
  // O helper de auditoria é o único que pode falhar em silêncio para quem
  // chamou: a ação já aconteceu e travá-la depois é impossível. Ele não fica
  // cego, porém — reporta por `reportError`. Ver src/lib/auditLog.ts.
  "src/lib/auditLog.ts": "falha de auditoria não pode travar a ação; é reportada, não engolida",
  // A própria varredura cita os nomes.
  "src/test/writeErrors.test.ts": "é este teste",
};

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
 * Escritas que anunciam sucesso sem observar o erro.
 *
 * Devolve TAMBÉM quantas escritas o laço chegou a classificar. Sem esse número,
 * a guarda não tinha piso nenhum: se `walk` deixasse de achar arquivo, se
 * `ESCRITAS` parasse de casar, ou se a junção do statement quebrasse, a
 * varredura passaria a examinar ZERO escritas e a lista de achados ficaria
 * vazia — "nenhuma escrita cega" por não ter olhado escrita nenhuma. É o mesmo
 * formato do defeito que esta guarda existe para pegar, uma camada acima.
 */
function encontrarCegas(): { achados: string[]; examinadas: number } {
  const achados: string[] = [];
  let examinadas = 0;

  for (const arquivo of walk(RAIZ)) {
    const rel = arquivo.replace(/\\/g, "/");
    if (rel in ALLOWLIST) continue;
    if (/\.test\.tsx?$/.test(rel)) continue;

    const linhas = readFileSync(arquivo, "utf8").split("\n");
    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      if (!/await supabase/.test(linha)) continue;

      // A cadeia pode quebrar em várias linhas; junta até fechar o statement.
      const bloco = linhas.slice(i, i + JANELA).join("\n");
      const statement = bloco.slice(0, bloco.indexOf(";") + 1 || bloco.length);
      if (!ESCRITAS.test(statement)) continue;
      // Daqui para baixo a escrita FOI classificada: ela conta para o piso,
      // tenha sido acusada ou absolvida.
      examinadas++;

      // O `=` pode estar ACIMA do `await`, na forma ternária:
      //   const { error } = editingId
      //     ? await supabase.…update(…)
      //     : await supabase.…insert(…);
      // Olhar só do `await` para a frente marcaria como cega uma escrita que é
      // conferida. Foi o primeiro falso positivo desta varredura.
      // Só para TRÁS, e pouco: olhar para a frente faria a checagem de erro de
      // outra função contar como se fosse desta. Aconteceu com
      // `CaseCollaborators.remove`, que passou por conferido por causa do
      // `respond` sete linhas abaixo.
      const contexto = linhas.slice(Math.max(0, i - 3), i + 1).join("\n");
      const observaErro =
        /\{[^}]*\berror\b[^}]*\}\s*=/.test(contexto) || /=\s*await supabase/.test(linha);
      if (observaErro) continue;

      // A janela não pode atravessar o fim da função: um `toast.success` do
      // handler seguinte não diz nada sobre esta escrita. Foi o segundo falso
      // positivo — `updateStatus`, que não anuncia nada, herdava o sucesso do
      // `remove` logo abaixo.
      const janela: string[] = [];
      for (let j = i; j < Math.min(linhas.length, i + JANELA); j++) {
        if (j > i && /^ {2}\};?\s*$/.test(linhas[j])) break;
        janela.push(linhas[j]);
      }
      const afirmaSucesso = /toast\.success|logAudit\(/.test(janela.join("\n"));
      if (!afirmaSucesso) continue;

      achados.push(`${rel}:${i + 1} escreve sem checar o erro e anuncia sucesso`);
    }
  }
  return { achados, examinadas };
}

const { achados: cegas, examinadas } = encontrarCegas();

describe("escritas que anunciam sucesso", () => {
  it("a varredura de fato examinou escritas", () => {
    /**
     * O piso. Zero achados só significa algo se houve o que examinar — e esta
     * varredura depende de quatro coisas que podem quebrar caladas: o `walk`, o
     * casamento de `await supabase`, a junção do statement e o `ESCRITAS`.
     *
     * Medido: **19** escritas classificadas em `src/`. O número é baixo porque a
     * maior parte das escritas desta base passou a ir por `aplicar()`
     * (`src/lib/mutate.ts`), que confere o erro E a contagem de linhas por
     * construção — são 48 chamadas. Esta varredura cobre o que sobrou: quem
     * ainda escreve com `await supabase` direto.
     *
     * (Eu escrevi "139" aqui na primeira versão, sem medir. O piso reprovou e
     * mostrou 19. Número posto num comentário sem medição é o mesmo defeito que
     * esta guarda persegue, uma camada acima.)
     *
     * O piso é folgado para não reprovar quando alguém migra mais uma tela para
     * `aplicar()`, e apertado o bastante para pegar o colapso da varredura.
     */
    expect(examinadas, "a varredura não classificou escrita nenhuma").toBeGreaterThan(10);
  });

  it("nenhuma escreve sem checar o erro antes de dizer que deu certo", () => {
    expect(
      cegas,
      `\n${cegas.join("\n")}\n\n` +
        "O cliente do Supabase devolve { error } em vez de lançar. Cheque-o antes\n" +
        "do toast de sucesso — e nunca registre auditoria de algo que não ocorreu.",
    ).toEqual([]);
  });

  it("a allowlist só contém arquivos que existem", () => {
    for (const caminho of Object.keys(ALLOWLIST)) {
      expect(() => statSync(caminho), `allowlist aponta para ${caminho}`).not.toThrow();
    }
  });
});
