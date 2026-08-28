/**
 * Limpa a notação matemática que o modelo às vezes devolve.
 *
 * Achado medindo, não supondo: o modo `trends`, chamado contra um caso real,
 * respondeu **`$60\% \rightarrow 58\%$`**. As telas usam `react-markdown` sem
 * plugin de matemática, então o médico lia exatamente isso — a marcação crua no
 * meio da análise de tendência.
 *
 * ## Por que duas camadas
 *
 * O `SYSTEM_PROMPT` da `clinical-ai` passou a proibir LaTeX. Só que instrução a
 * modelo **não é garantia verificável**: ela reduz a frequência e não a
 * possibilidade, e um teste não consegue afirmar que o modelo obedeceu. Esta
 * função é a metade que dá para medir — determinística, e coberta por teste.
 *
 * ## O que ela deliberadamente NÃO faz
 *
 * Não tenta interpretar LaTeX de verdade (frações, somatórios, subscritos). Se
 * aparecer algo assim, o texto sai como veio: escrever um interpretador
 * pela metade produziria número transformado errado dentro de conteúdo clínico,
 * que é bem pior que uma barra invertida na tela. Ela cobre o conjunto pequeno e
 * fechado de comandos que o modelo de fato usa em prosa.
 */

/** Comandos de símbolo, em ordem: os mais longos antes, senão `\le` come `\leq`. */
const SIMBOLOS: [RegExp, string][] = [
  [/\\rightarrow/g, "→"],
  [/\\leftarrow/g, "←"],
  [/\\uparrow/g, "↑"],
  [/\\downarrow/g, "↓"],
  [/\\approx/g, "≈"],
  [/\\times/g, "×"],
  [/\\cdot/g, "·"],
  [/\\pm/g, "±"],
  [/\\leq/g, "≤"],
  [/\\geq/g, "≥"],
  [/\\neq/g, "≠"],
  [/\\le\b/g, "≤"],
  [/\\ge\b/g, "≥"],
  [/\\%/g, "%"],
  [/\\\$/g, "$"],
  [/\\_/g, "_"],
  [/\\&/g, "&"],
];

/** `\text{...}`, `\mathrm{...}` e afins: fica o conteúdo, some o embrulho. */
const EMBRULHOS = /\\(?:text|textrm|mathrm|mathbf|textbf|mathit|textit|operatorname)\{([^{}]*)\}/g;

/**
 * `$...$` e `\(...\)` em linha, e `$$...$$` e `\[...\]` em bloco.
 *
 * Só desembrulha quando o conteúdo **não tem mais nada de LaTeX dentro** depois
 * da limpeza de símbolos — sobrou chave, barra invertida ou circunflexo, o
 * trecho fica intacto, porque aí é matemática de verdade e não prosa.
 */
const EM_LINHA = /\$([^$\n]+)\$/g;
const BLOCO = /\$\$([^$]+)\$\$/g;
const PARENTESES = /\\\(([^)]*)\\\)/g;
const COLCHETES = /\\\[([^\]]*)\\\]/g;

const aindaTemLatex = (s: string) => /[\\{}^_]/.test(s);

/**
 * O par de cifrões é mesmo matemática, ou são dois preços?
 *
 * O teste pegou isto e o defeito era real: **"custa R$ 1.200 e o outro R$ 900"**
 * tem dois `$`, e a versão ingênua os tratava como delimitadores, devolvendo
 * "custa R1.200 e o outro R 900". Num texto clínico que pode citar valor, isso
 * é pior do que a barra invertida que a função existe para tirar.
 *
 * Duas condições, e as duas vêm de como LaTeX é escrito de verdade:
 *
 * 1. **sem espaço colado ao delimitador** — `$x$`, nunca `$ x $`. É a convenção,
 *    e é o que separa `$60% → 58%$` de `R$ 1.200`;
 * 2. **sem palavra dentro** — nenhuma sequência de 3+ letras minúsculas. Fórmula
 *    não tem "outro"; `AVA = 0,8` e `mmHg` passam, prosa não.
 *
 * Errar para o lado de não desembrulhar deixa uma marcação feia na tela. Errar
 * para o outro lado altera o texto. Só o segundo é grave.
 */
const PARECE_FORMULA = (dentro: string) =>
  !/^\s|\s$/.test(dentro) && !/[a-zà-ÿ]{3,}/.test(dentro);

function desembrulhar(texto: string, padrao: RegExp, exigirFormula = true): string {
  return texto.replace(padrao, (inteiro, dentro: string) => {
    if (aindaTemLatex(dentro)) return inteiro;
    if (exigirFormula && !PARECE_FORMULA(dentro)) return inteiro;
    return dentro.trim();
  });
}

/**
 * @param texto o conteúdo devolvido pela `clinical-ai`.
 * @returns o mesmo texto, sem a notação que a tela não renderiza.
 */
export function limparNotacaoMatematica(texto: string): string {
  if (!texto) return texto;

  let saida = texto.replace(EMBRULHOS, "$1");
  for (const [padrao, simbolo] of SIMBOLOS) saida = saida.replace(padrao, simbolo);

  // Blocos antes dos delimitadores simples: `$$x$$` não pode ser lido como dois
  // `$...$` vazios.
  //
  // `$$`, `\(` e `\[` não têm ambiguidade nenhuma — ninguém escreve preço
  // assim —, então eles não passam pela heurística de fórmula. O cifrão
  // solitário passa, porque é o único que colide com "R$".
  saida = desembrulhar(saida, BLOCO, false);
  saida = desembrulhar(saida, COLCHETES, false);
  saida = desembrulhar(saida, PARENTESES, false);
  saida = desembrulhar(saida, EM_LINHA);

  return saida;
}
