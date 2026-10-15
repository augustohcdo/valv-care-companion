import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MODOS_IA, MODOS_DOCUMENTO } from "@/lib/aiModes";

/**
 * Guarda: todo modo que a tela manda tem que existir na edge function.
 *
 * Nasceu de um defeito ativo em produção. O botão "Gerar Orientação de Alta
 * (Paciente)" mandava `mode: "alta"`; a função implementa `patient_discharge`
 * e devolve **"modo inválido"** para qualquer outro nome. Ou seja: o único
 * documento do sistema destinado ao paciente nunca funcionou, e a rotina que
 * existia no servidor não tinha chamador nenhum.
 *
 * Nada quebrava no `tsc`, no lint ou no build — a tela compila, a função
 * compila, e as duas não compilam juntas. O nome só é conferido em tempo de
 * execução, por uma pessoa que clique no botão. Esta guarda faz a conferência
 * antes, lendo a união de tipos declarada na função. Sem credencial: é leitura
 * de arquivo, roda no CI como as outras nove.
 */

const raiz = resolve(__dirname, "../..");
const fonte = readFileSync(
  resolve(raiz, "supabase/functions/clinical-ai/index.ts"), "utf8",
);

/** A união `mode: "a" | "b" | ...` declarada em `interface ReqBody`. */
function modosDaFuncao(): string[] {
  const corpo = fonte.slice(fonte.indexOf("interface ReqBody {"));
  const uniao = corpo.slice(corpo.indexOf("mode:"), corpo.indexOf(";", corpo.indexOf("mode:")));
  return [...uniao.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
}

describe("modos da IA clínica", () => {
  const daFuncao = modosDaFuncao();

  it("a união de modos foi de fato encontrada na função", () => {
    // Sem esta asserção, um refactor no arquivo da função faria a varredura
    // devolver lista vazia e o teste passaria sem conferir nada — foi assim
    // que a guarda do `revisar_trecho` chegou a inspecionar o trecho errado.
    expect(daFuncao.length).toBeGreaterThanOrEqual(8);
    expect(daFuncao).toContain("summary");
  });

  it("todo modo usado pelo cliente existe na edge function", () => {
    const orfaos = MODOS_IA.filter((m) => !daFuncao.includes(m));
    expect(orfaos, `modos que a tela manda e a função não conhece: ${orfaos.join(", ")}`)
      .toEqual([]);
  });

  it("todo modo da função tem alguém que o chame", () => {
    // A outra direção do mesmo desencontro: uma rotina publicada que nenhuma
    // tela alcança é dívida com aparência de recurso.
    const semChamador = daFuncao.filter((m) => !(MODOS_IA as readonly string[]).includes(m));
    expect(semChamador, `modos publicados sem chamador: ${semChamador.join(", ")}`)
      .toEqual([]);
  });

  it("a orientação de alta ao paciente está entre os modos de documento", () => {
    expect(MODOS_DOCUMENTO).toContain("patient_discharge");
  });
});

describe("instrução de sistema do paciente", () => {
  it("a orientação de alta usa a instrução do paciente, não a do médico", () => {
    expect(fonte).toContain(
      'system: mode === "patient_discharge" ? SYSTEM_PROMPT_PACIENTE : SYSTEM_PROMPT',
    );
  });

  it("a orientação de alta não recebe o bloco de RAG", () => {
    // Era da regra de citação que vinha "[Fonte: SBC 2024 (texto gerado por IA
    // ... aguardando revisão médica)]" no papel que o paciente leva para casa.
    expect(fonte).toContain('if (SERVICE_ROLE && mode !== "patient_discharge")');
  });
});

describe("a escala da diretriz brasileira no prompt", () => {
  /**
   * A Diretriz Brasileira de Valvopatias 2026 usa GRADE — força Forte/Fraca e
   * certeza Alta/Moderada/Baixa/Muito baixa. Não usa Classe I–III nem Nível
   * A–C.
   *
   * O prompt mandava o modelo escrever a comparação no formato
   *
   *     "ESC/EACTS 2025: Classe I | SBC: Classe IIa — motivo: X"
   *
   * — isto é, mandava inventar, para a diretriz brasileira, uma notação que ela
   * não usa. O modelo obedeceria: pedir Classe IIa da SBC é pedir um número que
   * não existe no documento, e ele sairia com cara de citado.
   *
   * É o defeito desta sessão na forma mais direta possível: a ferramenta
   * afirmando, com confiança, uma procedência que não tem.
   */
  it("o prompt não manda o modelo dar Classe à SBC", () => {
    /**
     * Esta regra pegou o PRÓPRIO conserto na primeira execução. A frase que eu
     * havia escrito para proibir o formato errado o citava entre aspas —
     * `Escrever "SBC: Classe IIa" é inventar…` —, e uma regra de texto não
     * distingue "faça" de "nunca faça". É a quinta vez nesta sessão que uma
     * regra minha casa com a menção em vez do uso.
     *
     * E o defeito não era só do teste: pôr o formato proibido entre aspas
     * dentro de um prompt entrega ao modelo o template exato do que não fazer.
     * A proibição foi reescrita sem citar a forma errada — o que conserta os
     * dois problemas de uma vez.
     */
    expect(fonte, "o prompt voltou a pedir notação de Classe para a SBC")
      .not.toMatch(/SBC[^"\n]{0,20}:\s*Classe/);
  });

  it("o prompt diz qual é a escala da brasileira e proíbe a conversão", () => {
    expect(fonte, "o prompt não nomeia o GRADE da diretriz brasileira").toMatch(/GRADE/);
    expect(fonte, "o prompt não lista os níveis de certeza do GRADE")
      .toMatch(/Alta, Moderada, Baixa, Muito baixa/);
    expect(fonte, "o prompt não proíbe converter uma escala na outra")
      .toMatch(/NÃO converta uma escala na outra/);
  });

  it("o prompt nomeia a edição de 2026, com o artigo", () => {
    // Rótulo errado de fonte é procedência errada afirmada com confiança — o
    // mesmo defeito que levou o bloco "SBC 2024" a ser corrigido duas vezes.
    expect(fonte, "o prompt não nomeia a diretriz brasileira de 2026")
      .toMatch(/Diretriz Brasileira de Valvopatias 2026/);
    expect(fonte, "o prompt não traz o identificador do artigo").toMatch(/e20260796/);
  });

  it("o prompt manda considerar a etiologia reumática", () => {
    // A divisão reumático/não reumático é a razão de existir uma diretriz
    // brasileira na insuficiência mitral: no reumático a plástica cai para
    // Fraca/Baixa e a troca é que é Forte/Moderada. Um modelo que responda pela
    // ESC nessa pergunta recomenda plástica a quem a diretriz local não
    // recomenda.
    expect(fonte, "o prompt não avisa da divisão reumático/não reumático")
      .toMatch(/REUMÁTICO de NÃO REUMÁTICO/);
  });
});
