/// <reference types="node" />
import { readFileSync } from "node:fs";

/**
 * O texto EFETIVO de um workflow: ele mais as ações locais que ele usa.
 *
 * ## Por que isto existe
 *
 * As 89 linhas que exportavam as chaves públicas moravam dentro de
 * `verificacoes-periodicas.yml`. Quando a varredura semanal passou a precisar
 * das mesmas, elas saíram para `.github/actions/chaves-publicas` — e TRÊS
 * guardas reprovaram na hora, porque procuravam aquele texto no arquivo do
 * workflow.
 *
 * As três estavam certas em reprovar: do ponto de vista delas, o workflow havia
 * deixado de fazer aquilo. O que faltava era a noção de que `uses: ./…` é parte
 * do que o workflow faz.
 *
 * Concatenar preserva a ORDEM dentro de cada arquivo, que é o que as guardas de
 * sequência cobram ("tenta o site publicado ANTES de desistir"). E se alguém
 * tirar o `uses:` do workflow, o texto da ação deixa de entrar e as guardas
 * voltam a reprovar — que é exatamente o que se quer.
 */
/** O corpo de cada `run: |` de um arquivo de ação, em ordem. */
function corposDeRun(acao: string): string[] {
  for (const nome of ["action.yml", "action.yaml"]) {
    let texto: string;
    try {
      texto = readFileSync(`${acao}/${nome}`, "utf8");
    } catch {
      continue;
    }
    const linhas = texto.split("\n");
    const corpos: string[] = [];
    for (let i = 0; i < linhas.length; i++) {
      const m = /^(\s*)run:\s*\|/.exec(linhas[i]);
      if (!m) continue;
      const recuo = m[1].length;
      const corpo: string[] = [];
      for (let j = i + 1; j < linhas.length; j++) {
        const l = linhas[j];
        if (l.trim() === "") { corpo.push(""); continue; }
        const atual = l.length - l.trimStart().length;
        if (atual <= recuo) break;
        corpo.push(l);
      }
      corpos.push(corpo.join("\n"));
    }
    return corpos;
  }
  return [];
}

export function textoEfetivoDoWorkflow(caminho: string): string {
  const base = readFileSync(caminho, "utf8");
  /**
   * Embute só o CORPO DO `run:` da ação, no lugar da chamada.
   *
   * Duas versões anteriores não serviram, e as duas ensinaram algo:
   *
   *   · concatenar a ação no fim do arquivo não resolveu, porque as guardas
   *     deste repositório CORTAM o texto do passo ("do `- name: Exportar as
   *     chaves` até o passo seguinte") e cobram o conteúdo do corte;
   *   · embutir o arquivo inteiro da ação também não, porque ele traz o SEU
   *     próprio `- name: Exportar as chaves públicas` — o mesmo texto — e o
   *     corte terminava ali, antes do corpo. A asserção reprovava dizendo que o
   *     passo não chama o script, sobre um passo que chama.
   *
   * O que as guardas chamam de "o texto do passo" é, para o que elas cobram, o
   * corpo do `run:`. A ação é composta de um passo só, e o corpo dele é
   * exatamente o que morava inline antes da extração.
   */
  return base.replace(/^([ \t]*)-?\s*uses:\s*(\.\/[^\s#]+)[ \t]*$/gm, (linha, recuo, acao) => {
    const corpos = corposDeRun(acao);
    if (corpos.length === 0) return linha;
    return `${linha}\n${recuo}  # ---- corpo de ${acao} ----\n` + corpos.join("\n");
  });
}
