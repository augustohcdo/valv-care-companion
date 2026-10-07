/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { sqlSemComentarios } from "./sqlDeMigrations";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Ausência de evidência não volta a ser afirmação de ausência.
 *
 * ## A decisão que esta guarda protege
 *
 * `prosthesis_catalog.mercado_br` admite `'confirmado'` e `'nao_confirmado'`,
 * e NULO quer dizer "não há afirmação". Em 2026-09-03 a migration
 * `20260903020000_mercado_br_sem_afirmacao_de_ausencia` apagou **dezenove**
 * `nao_confirmado`, e o cabeçalho dela diz por quê:
 *
 *   > "`confirmado` vem de prova positiva — uma página brasileira que lista o
 *   >  produto. `nao_confirmado` vinha de **não ter achado nada**, que é outra
 *   >  coisa. E a tela mostrava isso ao cardiologista como 'registro brasileiro
 *   >  não confirmado', ao lado do tipo e da posição da prótese: no lugar de
 *   >  maior atenção do cartão, uma dúvida sobre produtos que ele implanta
 *   >  toda semana."
 *
 *   > "A base da ANVISA está atrás de desafio do Cloudflare e não se contorna.
 *   >  O que restou foram catálogos de distribuidor, que provam presença e
 *   >  **nunca provam ausência**. Um método que só consegue confirmar não pode
 *   >  produzir a informação 'não vendida no Brasil'."
 *
 * ## Por que uma guarda, e não só o cabeçalho
 *
 * Porque eu reabri o assunto. A conferência periódica dizia
 * `mercado BR: quantas famílias já foram conferidas (21 de 40)` — rótulo que
 * lê-se como barra de progresso —, e eu carreguei "19 famílias pendentes, sem
 * bloqueio técnico" numa fila por uma sessão inteira, reportando ao usuário
 * como tarefa em aberto. Fui conferir e achei a migration: não era pendência,
 * era recuo deliberado, e o bloqueio era real e documentado.
 *
 * Quem faz o caminho que eu fiz chega ao mesmo lugar: olha 19 nulas, procura
 * distribuidor, não acha, e escreve `nao_confirmado`. Com as melhores
 * intenções, repõe o defeito que a migration removeu — e desta vez com mais
 * confiança, porque "já foi conferido antes".
 *
 * O rótulo foi corrigido. Esta guarda é a parte que não depende de ninguém
 * reler um cabeçalho.
 *
 * ## O que ela NÃO proíbe
 *
 * `nao_confirmado` continua existindo no esquema de propósito: o dia em que
 * alguém tiver acesso ao registro oficial, ausência passa a ser demonstrável e
 * o estado volta a ter uso legítimo. A guarda não trava esse dia — ela obriga a
 * declarar, por escrito, que a prova mudou de natureza. Marco que não se
 * consegue justificar é esquecimento com cara de decisão.
 */

const DIR = "supabase/migrations";

/** A migration que removeu as dezenove afirmações. O corte temporal. */
const O_RECUO = "20260903020000_mercado_br_sem_afirmacao_de_ausencia.sql";

/**
 * Migrations que PODEM escrever `nao_confirmado`, com o motivo.
 *
 * Vazia, e é o estado a defender. Para acrescentar uma entrada, escreva de onde
 * veio a prova de AUSÊNCIA — não "procurei e não achei", que é o que o recuo de
 * 2026-09-03 recusou, mas uma fonte que afirme a não comercialização.
 */
const PODEM_AFIRMAR_AUSENCIA: Record<string, string> = {};

// `sqlSemComentarios` vem de `sqlDeMigrations.ts`, importado no topo. Era
// definido aqui e em `acessoProfissional.test.ts`, as duas iguais; a canônica
// preserva as POSIÇÕES ao apagar o comentário de linha, que é o que esta guarda
// precisa — ela classifica a ocorrência pelo índice dela na instrução.

/**
 * Apaga o CONTEÚDO dos literais de texto, preservando as posições.
 *
 * Sem isto, um `(` dentro de `'Edwards (PERIMOUNT)'` conta como abertura de
 * parêntese e um `WHERE` dentro de uma mensagem conta como cláusula. Os índices
 * ficam iguais aos do SQL original de propósito: a busca pela ocorrência roda no
 * original (o alvo É um literal) e a classificação roda nesta máscara.
 */
export function mascararTextos(sql: string): string {
  return sql.replace(/'(?:[^']|'')*'/g, (lit) => `'${" ".repeat(lit.length - 2)}'`);
}

export type Posicao =
  /** Depois do `WHERE`: filtra linhas, não afirma nada sobre nenhuma. */
  | "leitura"
  /** Dentro de `CHECK (…)`: declara qual valor o esquema admite. */
  | "valor-admitido"
  /** Dentro do `SET`. */
  | "escrita"
  /** Nem `SET` nem `WHERE` antes — `INSERT … VALUES`, `DEFAULT`, ou forma que
   *  esta guarda não sabe ler. Tratada como escrita, de propósito. */
  | "forma-nao-reconhecida";

/** Último índice em que `padrao` casa em `texto`, ou -1. */
function ultimoIndice(texto: string, padrao: RegExp): number {
  let fim = -1;
  for (const m of texto.matchAll(padrao)) fim = m.index;
  return fim;
}

/**
 * Onde, dentro da própria instrução, está a ocorrência do literal.
 *
 * ## Por que posicional, e não por presença
 *
 * A primeira versão desta função decidia por presença — "é leitura se houver
 * `WHERE` antes e **não** houver `SET`" — e acusou a instrução que o próprio
 * recuo de 2026-09-03 executa:
 *
 *     UPDATE public.prosthesis_catalog SET
 *       mercado_br = NULL, …
 *      WHERE mercado_br = 'nao_confirmado';
 *
 * Tem `SET` e tem `WHERE`, nessa ordem, e a ocorrência está depois do `WHERE`:
 * é leitura, e é exatamente o jeito de LIMPAR a afirmação. A guarda reprovava
 * quem fizesse de novo o acerto que ela existe para defender — e guarda que
 * pune quem fez certo é guarda que alguém desliga.
 *
 * O que decide é a posição relativa: a cláusula que vale é a ÚLTIMA aberta
 * antes da ocorrência.
 *
 * ## O que ela faz quando não sabe
 *
 * Acusa. `INSERT … VALUES ('nao_confirmado')` e `DEFAULT 'nao_confirmado'` são
 * escritas e caem aqui; qualquer forma nova também cai, e o relatório diz com
 * todas as letras que não reconheceu a forma — em vez de passar calado, que
 * seria a guarda dizendo "conferi" sobre o que não olhou.
 */
export function posicaoDaOcorrencia(sqlMascarado: string, indice: number): Posicao {
  const inicioDaInstrucao = sqlMascarado.lastIndexOf(";", indice) + 1;
  const antes = sqlMascarado.slice(inicioDaInstrucao, indice).toUpperCase();

  // `CHECK (…)` ainda aberto na ocorrência: `CHECK (mercado_br IN ('confirmado',
  // 'nao_confirmado'))` é o esquema dizendo qual valor é aceito, não uma
  // afirmação sobre linha nenhuma — e o `mercado_brasileiro.sql` tem esse CHECK.
  for (const m of antes.matchAll(/\bCHECK\s*\(/g)) {
    const daAberturaAteAqui = antes.slice(m.index + m[0].length - 1);
    const saldo =
      (daAberturaAteAqui.match(/\(/g)?.length ?? 0) - (daAberturaAteAqui.match(/\)/g)?.length ?? 0);
    if (saldo > 0) return "valor-admitido";
  }

  const ondeSet = ultimoIndice(antes, /\bSET\b/g);
  const ondeWhere = ultimoIndice(antes, /\bWHERE\b/g);
  if (ondeWhere > ondeSet) return "leitura";
  if (ondeSet >= 0) return "escrita";
  return "forma-nao-reconhecida";
}

describe("`mercado_br` não volta a afirmar ausência", () => {
  const arquivos = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

  it("a migration do recuo continua no repositório", () => {
    /**
     * Sem ela, o corte temporal abaixo não tem referência e a varredura
     * passaria a olhar o repositório inteiro — incluindo as migrations antigas
     * que escreveram `nao_confirmado` legitimamente, antes da decisão. A guarda
     * viraria falso vermelho e alguém a desligaria.
     */
    expect(arquivos, `${O_RECUO} desapareceu`).toContain(O_RECUO);
    const corpo = readFileSync(join(DIR, O_RECUO), "utf8");
    expect(
      sqlSemComentarios(corpo),
      "a migration do recuo não limpa mais os `nao_confirmado`",
    ).toMatch(/mercado_br\s*=\s*NULL[\s\S]*WHERE\s+mercado_br\s*=\s*'nao_confirmado'/i);
  });

  it("a classificação de posição sabe distinguir escrita de leitura", () => {
    /**
     * As formas são copiadas das migrations reais deste repositório, não
     * inventadas: foi justamente uma forma real — a do recuo — que a primeira
     * versão desta classificação acusou de ser escrita.
     *
     * Testar a classificação direto, e não só pela varredura, é o que torna
     * visível ONDE ela erra. A inversão de ponta a ponta diz "acusou"; esta
     * tabela diz "acusou porque leu a cláusula errada".
     */
    const casos: Array<[Posicao, string]> = [
      // O recuo, textual. Tem SET e tem WHERE, e a ocorrência é do WHERE.
      ["leitura", "UPDATE t SET\n  mercado_br = NULL,\n  x = NULL\n WHERE mercado_br = 'nao_confirmado';"],
      // A varredura de 2026-08-31, textual: dentro do SET.
      ["escrita", "UPDATE t SET\n  anvisa_registro = NULL,\n  mercado_br = 'nao_confirmado'\n WHERE manufacturer = 'Edwards';"],
      // O CHECK do esquema de 2026-08-30, textual.
      ["valor-admitido", "ALTER TABLE t ADD CONSTRAINT c\n    CHECK (mercado_br IS NULL OR mercado_br IN ('confirmado', 'nao_confirmado'));"],
      // Escrita sem SET: é o buraco que a versão estreita desta guarda tinha,
      // porque procurava `mercado_br = 'nao_confirmado'` e isto não casa.
      ["forma-nao-reconhecida", "INSERT INTO t (model_name, mercado_br) VALUES ('Trifecta', 'nao_confirmado');"],
      // `SET DEFAULT` tem um SET de verdade antes do literal, e é escrita: as
      // linhas novas passariam a nascer afirmando ausência.
      ["escrita", "ALTER TABLE t ALTER COLUMN mercado_br SET DEFAULT 'nao_confirmado';"],
      // A instrução anterior não contamina a seguinte: o `;` corta. Sem isto, o
      // `SET` de cima classificaria o INSERT de baixo como escrita — mesmo
      // veredito, pelo motivo errado, e o relatório mentiria sobre a causa.
      ["forma-nao-reconhecida", "UPDATE t SET x = 1 WHERE y = 2;\nINSERT INTO t (mercado_br) VALUES ('nao_confirmado');"],
      // Parêntese DENTRO de literal não fecha o `CHECK (`. Sem a máscara, o
      // `)` de `'a)b'` zera o saldo e o CHECK vira acusação.
      ["valor-admitido", "ALTER TABLE t ADD CONSTRAINT c CHECK (mercado_br_fonte <> 'a)b' OR mercado_br IN ('confirmado', 'nao_confirmado'));"],
      // E um `WHERE` dentro de literal não é cláusula.
      ["escrita", "UPDATE t SET mercado_br_fonte = 'veja o WHERE', mercado_br = 'nao_confirmado';"],
    ];

    for (const [esperada, sql] of casos) {
      const mascara = mascararTextos(sql);
      const indice = sql.lastIndexOf("'nao_confirmado'");
      expect(indice, `o caso não contém o literal: ${sql}`).toBeGreaterThan(0);
      expect(posicaoDaOcorrencia(mascara, indice), `classificação errada em:\n${sql}`)
        .toBe(esperada);
    }
  });

  it("nenhuma migration POSTERIOR escreve `nao_confirmado`", () => {
    const culpadas: string[] = [];
    let posteriores = 0;

    for (const arquivo of arquivos) {
      // O recuo em si, e tudo antes dele, ficam de fora: eles são a história.
      if (arquivo <= O_RECUO) continue;
      posteriores++;
      if (arquivo in PODEM_AFIRMAR_AUSENCIA) continue;

      const sql = sqlSemComentarios(readFileSync(join(DIR, arquivo), "utf8"));
      const mascara = mascararTextos(sql);
      /**
       * O literal inteiro, e não `mercado_br = 'nao_confirmado'`.
       *
       * A forma com o nome da coluna à esquerda é só UMA das formas de escrever
       * a afirmação: `INSERT … VALUES (…, 'nao_confirmado')` e
       * `ALTER COLUMN … SET DEFAULT 'nao_confirmado'` escrevem o mesmo estado e
       * não casariam. Guarda que promete mais do que confere é pior do que
       * guarda nenhuma — então ela procura o valor, e a POSIÇÃO decide.
       */
      for (const m of sql.matchAll(/'nao_confirmado'/gi)) {
        const posicao = posicaoDaOcorrencia(mascara, m.index);
        if (posicao === "leitura" || posicao === "valor-admitido") continue;
        const linha = sql.slice(0, m.index).split("\n").length;
        culpadas.push(
          `  · ${arquivo}:${linha} — ${
            posicao === "escrita"
              ? "dentro da cláusula SET"
              : "nem SET nem WHERE antes (INSERT/VALUES, DEFAULT, ou forma que a guarda não reconhece)"
          }`,
        );
      }
    }

    // Piso: se não houver migration posterior nenhuma, a varredura não olhou
    // nada e passaria por vazio. Hoje há várias; uma já basta para ela ter
    // exercitado o corte temporal.
    expect(
      posteriores,
      `nenhuma migration depois de ${O_RECUO} — a varredura não conferiu nada`,
    ).toBeGreaterThanOrEqual(1);

    expect(
      culpadas,
      `\n${culpadas.join("\n")}\n\n` +
        "Esta migration escreve `mercado_br = 'nao_confirmado'`, e a decisão de\n" +
        "2026-09-03 removeu DEZENOVE dessas afirmações pelo motivo que segue valendo:\n\n" +
        "  `confirmado` vem de prova positiva — uma página brasileira que lista o\n" +
        "  produto. `nao_confirmado` vinha de NÃO TER ACHADO NADA, e a tela mostrava\n" +
        "  isso ao cardiologista como 'registro brasileiro não confirmado' sobre\n" +
        "  produtos que ele implanta toda semana.\n\n" +
        "A base da ANVISA está atrás de desafio do Cloudflare e não se contorna.\n" +
        "Catálogo de distribuidor prova presença e NUNCA prova ausência: um método\n" +
        "que só confirma não produz a informação 'não vendida no Brasil'.\n\n" +
        "Se a prova mudou de natureza — acesso ao registro oficial —, declare o\n" +
        "arquivo em PODEM_AFIRMAR_AUSENCIA dizendo de onde veio a prova de ausência.",
    ).toEqual([]);
  });

  it("toda dispensa aponta para arquivo que existe e que de fato afirma", () => {
    // Dispensa órfã é permissão que ninguém revisa, e a próxima afirmação no
    // mesmo arquivo entra de graça. Mesma regra do `escritasCegasNasFunctions`.
    for (const [arquivo, motivo] of Object.entries(PODEM_AFIRMAR_AUSENCIA)) {
      expect(arquivos, `PODEM_AFIRMAR_AUSENCIA aponta para ${arquivo}, que não existe`)
        .toContain(arquivo);
      expect(motivo.length, `a dispensa de ${arquivo} não tem motivo escrito`)
        .toBeGreaterThan(30);
      // Pela MESMA classificação da varredura, e não por um padrão próprio: se
      // "afirma" aqui quisesse dizer outra coisa do que lá, uma dispensa ficaria
      // válida para um arquivo que a varredura nem acusaria.
      const sql = sqlSemComentarios(readFileSync(join(DIR, arquivo), "utf8"));
      const mascara = mascararTextos(sql);
      const afirma = [...sql.matchAll(/'nao_confirmado'/gi)].some((m) => {
        const posicao = posicaoDaOcorrencia(mascara, m.index);
        return posicao === "escrita" || posicao === "forma-nao-reconhecida";
      });
      expect(
        afirma,
        `${arquivo} está dispensada mas não afirma ausência — tire a dispensa`,
      ).toBe(true);
    }
  });

  it("a conferência periódica não chama as nulas de `não conferidas`", () => {
    /**
     * O rótulo que me enganou: `quantas famílias já foram conferidas (21 de
     * 40)`, com limiar "qualquer número acima de zero". Lê-se como barra de
     * progresso rumo a 40, e as duas palavras estão erradas — as 19 FORAM
     * olhadas, e 40 não volta a ser meta por este caminho.
     *
     * Rótulo que convida à leitura errada de um estado deliberado é defeito do
     * rótulo, e a prova de que ele engana é que enganou quem escreveu as outras
     * conferências do mesmo arquivo.
     */
    const script = readFileSync("scripts/ferramentas-verificar.mjs", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/[^\n]*/gm, "");
    /**
     * O argumento INTEIRO, e não o primeiro pedaço dele.
     *
     * A primeira versão usava /`mercado BR: [^`]*`/ e parou no backtick que
     * fecha a primeira parte — o rótulo é concatenado em três, e "NULAS de
     * propósito" está na terceira. A guarda reprovou dizendo que o rótulo não
     * diz o que ele diz.
     *
     * É a mesma classe de erro que eu cometi hoje no extrator de
     * `MARCAS_DE_CARREGAMENTO`: expressão regular parando num delimitador que
     * está DENTRO do que ela deveria capturar.
     */
    const inicio = script.indexOf("mercado BR: famílias");
    const fim = script.indexOf("comMercado.size,", inicio);
    const rotulo = inicio >= 0 && fim > inicio ? script.slice(inicio, fim) : "";
    expect(rotulo.length, "não achei o rótulo da conferência de mercado").toBeGreaterThan(20);
    expect(
      rotulo,
      "o rótulo voltou a dizer que as nulas não foram conferidas — elas foram; " +
        "o que não existe é a afirmação",
    ).not.toMatch(/já foram conferidas/);
    expect(
      rotulo,
      "o rótulo precisa dizer que as outras ficam NULAS de propósito, senão a " +
        "próxima pessoa reabre a fila que eu reabri",
    ).toMatch(/NULAS de propósito/);
  });
});
