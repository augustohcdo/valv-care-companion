import { describe, it, expect } from "vitest";
import {
  DIRETRIZ_BR_2026, FONTE_BR_2026, NOTAS_QUADRO_27, QUADRO_27_ESCOLHA_DA_INTERVENCAO,
  QUADRO_27_ESTENOSE_AORTICA, QUADRO_27_VALVOPLASTIA, TABELA_1_NOVIDADES,
  type RecomendacaoBr,
} from "./diretrizBr2026";
import { DIRETRIZ_2025 } from "./diretriz2025";

/**
 * A guarda que torna o arquivo de citações da diretriz brasileira verificável.
 *
 * Mesma regra do `diretriz2025.test.ts`, e pelo mesmo motivo: guardar a frase
 * ao lado do número não serve de nada se ninguém conferir que os dois combinam.
 * Um `limiares: [70]` embaixo de uma citação que diz 80 passaria por qualquer
 * revisão de código — e mudaria a conduta de um paciente de 75 anos.
 *
 * ## O que esta guarda tem a mais: duas transcrições do mesmo fato
 *
 * O Quadro 27 da diretriz brasileira imprime, ao lado da posição da SBC, a
 * posição da AHA e da ESC. É a leitura que os autores brasileiros fizeram das
 * outras duas diretrizes.
 *
 * Nós já tínhamos a nossa própria transcrição da ESC 2025, lida do documento
 * europeu em duas cópias independentes, meses antes e sem relação com esta.
 * Onde as duas falam da mesma recomendação, elas têm de dizer a mesma coisa —
 * e aqui isso é cobrado. Transcrição errada de qualquer um dos dois lados
 * aparece.
 *
 * ## O que esta guarda NÃO faz
 *
 * Não prova que a citação corresponde ao que a SBC publicou. Isso foi conferido
 * à mão, lendo as páginas renderizadas do PDF oficial do periódico, e está
 * registrado no cabeçalho do `diretrizBr2026.ts`. Guarda automática cuida da
 * consistência interna; a procedência é trabalho humano e fica documentada.
 */

const TODAS: [string, RecomendacaoBr][] = Object.entries(DIRETRIZ_BR_2026);

/**
 * O número aparece no texto?
 *
 * Como no arquivo da ESC, com uma diferença que não é detalhe: o texto
 * brasileiro escreve decimal com VÍRGULA — "0,7 cm²", "5,0 m/s". Um detector
 * copiado do outro arquivo sem isso não acharia nenhum decimal, e a guarda
 * reprovaria tudo (falso vermelho) ou, pior, seria afrouxada até parar de
 * cobrar.
 *
 * As bordas continuam: `4` casa com "≥4,0 m/s" e **não** com "40 mmHg".
 */
export function citaONumeroBr(texto: string, n: number): boolean {
  const base = String(n).replace(".", "[.,]");
  const comZeros = Number.isInteger(n) ? `${base}([.,]0+)?` : base;
  return new RegExp(`(?<![\\d.,])${comZeros}(?![\\d.,]*\\d)`).test(texto);
}

/**
 * As linhas em que a diretriz brasileira imprime a posição da ESC e nós temos a
 * nossa própria transcrição da mesma recomendação.
 *
 * Só entram pares em que a correspondência é inequívoca — é uma conferência,
 * não um exercício de interpretação. Onde a correspondência exigiria
 * julgamento, fica de fora: uma guarda que force correspondência duvidosa
 * produz vermelho sobre discordância que não existe.
 */
const MESMO_FATO: Array<{ br: string; esc: keyof typeof DIRETRIZ_2025; porque: string }> = [
  { br: "sintomas", esc: "eaSintomaticaAltoGradiente", porque: "EA importante sintomática" },
  { br: "assintomaticoFeReduzida", esc: "eaAssintomaticaFeBaixa", porque: "EA assintomática com FE baixa" },
  {
    br: "baixoFluxoComReservaContratil", esc: "eaSintomaticaBaixoFluxoFeReduzida",
    porque: "baixo fluxo/baixo gradiente com FE reduzida",
  },
  {
    br: "paradoxalSintomatica", esc: "eaSintomaticaBaixoFluxoFeNormal",
    porque: "EA paradoxal = baixo fluxo/baixo gradiente com FE normal",
  },
  { br: "baixoRiscoAbaixo70Cirurgia", esc: "eaModoCirurgia", porque: "cirurgia abaixo de 70 anos, risco baixo" },
  { br: "baixoRisco70a80Tavi", esc: "eaModoTavi", porque: "TAVI a partir de 70 anos" },
];

describe("citações da diretriz brasileira de 2026", () => {
  it("todo limiar usado aparece no texto citado", () => {
    const orfaos: string[] = [];
    for (const [chave, r] of TODAS) {
      for (const n of r.limiares ?? []) {
        if (!citaONumeroBr(r.verbatim, n)) orfaos.push(`${chave}: ${n} não aparece na citação`);
      }
    }
    expect(
      orfaos,
      `\n${orfaos.join("\n")}\n\n` +
        "Um número no código sem respaldo na frase citada é um limiar inventado.\n" +
        "Corrija o número ou traga a citação certa da diretriz.",
    ).toEqual([]);

    // Piso: a varredura precisa ter olhado limiares de verdade. Um arquivo em
    // que ninguém declarou `limiares` passaria pelo laço acima sem olhar nada.
    const quantos = TODAS.reduce((s, [, r]) => s + (r.limiares?.length ?? 0), 0);
    expect(quantos, "nenhum limiar declarado: o laço acima não conferiu nada").toBeGreaterThanOrEqual(12);
  });

  it("o detector lida com a vírgula decimal e não confunde 5 com 50", () => {
    // Contraprova. Sem ela, um `citaONumeroBr` que devolvesse sempre `true`
    // faria o teste acima passar com qualquer besteira.
    expect(citaONumeroBr("velocidade máxima do jato ≥ 5,0 m/s", 5), "não achou 5 em 5,0").toBe(true);
    expect(citaONumeroBr("área valvar aórtica < 0,7 cm²", 0.7), "não achou 0,7").toBe(true);
    expect(citaONumeroBr("gradiente médio ≥ 60 mmHg", 6), "confundiu 6 com 60").toBe(false);
    expect(citaONumeroBr("Baixo risco > 80 anos", 8), "confundiu 8 com 80").toBe(false);
    expect(citaONumeroBr("Baixo risco entre 70 e 80 anos", 70)).toBe(true);
    expect(citaONumeroBr("Baixo risco entre 70 e 80 anos", 80)).toBe(true);
    expect(citaONumeroBr("FE < 50%", 5), "confundiu 5 com 50").toBe(false);
  });

  it("força e certeza são valores de diretriz, não texto livre", () => {
    for (const [chave, r] of TODAS) {
      expect(["Forte", "Fraca"], `${chave}: força fora do vocabulário GRADE`).toContain(r.forca);
      expect(["Alta", "Moderada", "Baixa"], `${chave}: certeza fora do vocabulário GRADE`)
        .toContain(r.certeza);
    }
  });

  it("a força e a certeza declaradas são as que o verbatim imprime", () => {
    /**
     * O vínculo que faz os campos valerem alguma coisa. `forca: "Forte"` com um
     * verbatim que diz "Fraca/Alta" é o mesmo defeito do limiar inventado, e
     * tão invisível quanto numa revisão de código.
     */
    for (const [chave, r] of TODAS) {
      expect(r.verbatim, `${chave}: o verbatim não traz "${r.forca}/${r.certeza}"`)
        .toContain(`${r.forca}/${r.certeza}`);
    }
  });

  it("nenhuma citação foi copiada por engano sobre outra", () => {
    const vistos = new Map<string, string>();
    for (const [chave, r] of TODAS) {
      const anterior = vistos.get(r.verbatim);
      expect(anterior, `${chave} tem a mesma citação de ${anterior}`).toBeUndefined();
      vistos.set(r.verbatim, chave);
    }
  });

  it("toda citação é substantiva e diz de que quadro e página saiu", () => {
    for (const [chave, r] of TODAS) {
      expect(r.verbatim.length, `${chave}: citação curta demais para ser verificável`).toBeGreaterThan(60);
      expect(r.quadro, `${chave}: sem quadro de origem`).toMatch(/^(Tabela|Quadro) \d+$/);
      expect(r.pagina, `${chave}: sem página de origem`).toBeGreaterThan(0);
      expect(r.pagina, `${chave}: página fora do documento`).toBeLessThanOrEqual(FONTE_BR_2026.paginas);
    }
  });

  it("a fonte declara DOI, PDF e quem assina", () => {
    expect(FONTE_BR_2026.doi).toBe("10.36660/abc.20260796");
    expect(FONTE_BR_2026.pdf, "o PDF citado não é do periódico").toContain("abccardiol.org");
    expect(FONTE_BR_2026.url).toContain(FONTE_BR_2026.doi);
    // Três sociedades, e não só a SBC: quem lê a conduta precisa saber que a
    // cirurgia cardiovascular e a hemodinâmica assinam junto.
    expect(FONTE_BR_2026.realizacao.length, "a realização perdeu uma sociedade").toBe(3);
    expect(FONTE_BR_2026.citacao, "a citação não traz o id do artigo").toContain("e20260796");
  });

  it("a Tabela 1 traz as oito situações que a diretriz diz trazer", () => {
    /**
     * A seção 1.4 diz: "a Diretriz de 2026 apresenta a Tabela 1, que sintetiza
     * as oito principais novas recomendações". São doze LINHAS para oito
     * SITUAÇÕES — três situações têm mais de uma intervenção (a escolha por
     * faixa etária na estenose aórtica e os três tipos de intervenção na
     * insuficiência tricúspide).
     *
     * Transcrição que perca uma linha muda essa conta, e é o tipo de perda que
     * ninguém nota lendo o arquivo.
     */
    const linhas = Object.values(TABELA_1_NOVIDADES);
    expect(linhas.length, "a Tabela 1 perdeu ou ganhou linhas").toBe(12);
    const situacoes = new Set(linhas.map((r) => r.condicao));
    expect(situacoes.size, "a Tabela 1 não tem oito situações distintas").toBe(8);
    for (const r of linhas) expect(r.quadro).toBe("Tabela 1");
  });

  it("o conjunto não perdeu nenhuma linha na junção", () => {
    // `DIRETRIZ_BR_2026` é o espalhamento dos quatro blocos. Chave repetida
    // entre blocos sumiria em silêncio — e a varredura acima passaria a olhar
    // menos do que existe, sem dizer.
    const soma = [
      TABELA_1_NOVIDADES, QUADRO_27_ESTENOSE_AORTICA,
      QUADRO_27_ESCOLHA_DA_INTERVENCAO, QUADRO_27_VALVOPLASTIA,
    ].reduce((s, bloco) => s + Object.keys(bloco).length, 0);
    expect(Object.keys(DIRETRIZ_BR_2026).length, "chave repetida entre blocos engoliu uma linha")
      .toBe(soma);
  });

  it("O CRUZAMENTO: a coluna ESC da diretriz brasileira bate com a nossa leitura da ESC", () => {
    /**
     * Duas transcrições independentes do mesmo fato: a dos autores brasileiros,
     * impressa no Quadro 27, e a nossa, lida do documento europeu em duas
     * cópias, meses antes.
     *
     * Divergência aqui não é opinião clínica — é erro de cópia de um dos dois
     * lados, e o teste diz qual par discorda para alguém ir conferir.
     */
    const divergencias: string[] = [];
    for (const { br, esc, porque } of MESMO_FATO) {
      const linhaBr = DIRETRIZ_BR_2026[br];
      const nossa = DIRETRIZ_2025[esc];
      expect(linhaBr, `${br} não existe no arquivo brasileiro`).toBeTruthy();
      expect(nossa, `${esc} não existe no arquivo da ESC`).toBeTruthy();
      const nossaForma = `${nossa.classe} ${nossa.nivel}`;
      if (linhaBr.esc !== nossaForma) {
        divergencias.push(
          `${porque}: a diretriz brasileira imprime ESC "${linhaBr.esc}", ` +
          `e o nosso arquivo da ESC diz "${nossaForma}" (${esc})`,
        );
      }
    }
    expect(
      divergencias,
      `\n${divergencias.join("\n")}\n\n` +
        "Uma das duas transcrições está errada. Confira a linha no PDF de cada\n" +
        "diretriz antes de mexer — não ajuste um lado para calar o teste.",
    ).toEqual([]);
    expect(MESMO_FATO.length, "o cruzamento ficou sem pares para conferir").toBeGreaterThanOrEqual(6);
  });

  it("as notas de rodapé do Quadro 27 estão presentes e são as duas", () => {
    // A primeira é pré-requisito OBRIGATÓRIO (Heart Team institucional). Mostrar
    // a recomendação sem ela é mostrar meia recomendação.
    expect(NOTAS_QUADRO_27.intervencao).toMatch(/Pré-requisito obrigatório/);
    expect(NOTAS_QUADRO_27.intervencao).toMatch(/Heart Team institucional/);
    expect(NOTAS_QUADRO_27.escolhaDaTecnica).toMatch(/experiência local e disponibilidade/);
  });

  it("as colunas AHA e ESC existem onde a tabela as imprime", () => {
    /**
     * O Quadro 27 é de três colunas; a Tabela 1 é só da SBC. Se uma linha do
     * Quadro 27 vier sem `aha`/`esc`, a transcrição perdeu coluna — e a tela
     * mostraria "a ESC não se posiciona" onde a ESC se posiciona.
     *
     * "–" é posição também: é a tabela dizendo que aquela sociedade não trata
     * daquela situação. Por isso o campo tem de EXISTIR, mesmo valendo "–".
     */
    const doQuadro27 = [
      ...Object.entries(QUADRO_27_ESTENOSE_AORTICA),
      ...Object.entries(QUADRO_27_ESCOLHA_DA_INTERVENCAO),
      ...Object.entries(QUADRO_27_VALVOPLASTIA),
    ];
    expect(doQuadro27.length, "o Quadro 27 ficou pequeno demais").toBeGreaterThanOrEqual(20);
    for (const [chave, r] of doQuadro27) {
      expect(r.aha, `${chave}: coluna AHA ausente`).toBeTruthy();
      expect(r.esc, `${chave}: coluna ESC ausente`).toBeTruthy();
    }
    // E a Tabela 1 não inventa colunas que a tabela não tem.
    for (const [chave, r] of Object.entries(TABELA_1_NOVIDADES)) {
      expect(r.aha, `${chave}: a Tabela 1 não traz coluna AHA`).toBeUndefined();
      expect(r.esc, `${chave}: a Tabela 1 não traz coluna ESC`).toBeUndefined();
    }
  });
});
