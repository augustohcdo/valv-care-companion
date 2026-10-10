/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BASE_NAO_CONSULTADA, MOTIVOS_DA_BASE, MOTIVOS_DA_LITERATURA,
} from "@/lib/aiMotivos";
import {
  AVISO_AO_MODELO, NAO_CONSULTOU, motivoSemTrecho,
  type MotivoSemTrecho,
} from "../../supabase/functions/_shared/motivoDaBase";
import { semComentariosDeCodigo } from "./semComentariosDeCodigo";

/**
 * "Não achei na base" e "não consegui olhar a base" não são a mesma frase.
 *
 * ## O defeito, medido no código
 *
 * A `clinical-ai` devolvia um booleano — `rag_hit: sourcesOut.length > 0` — e o
 * `ClinicalAIPanel` transformava o `false` neste aviso, fixo:
 *
 *   > "**Sem trecho ancorado.** A base ValvePath **não retornou referência para
 *   >  este tópico**. A resposta abaixo é conhecimento geral do modelo."
 *
 * Quatro caminhos chegam a esse `false`:
 *
 *   1. a base foi consultada e não tinha nada — a frase está certa;
 *   2. `embedQuery` devolveu `null` (429 de cota, 5xx, rede): o `if` interno
 *      nem roda e **a base nunca foi consultada**;
 *   3. falta `SUPABASE_SERVICE_ROLE_KEY`: o bloco é pulado, **idem**;
 *   4. o modo é a orientação de alta ao paciente, que não usa a base de
 *      propósito.
 *
 * Nos casos 2 e 3 a tela afirmava algo sobre o CONTEÚDO da base que ninguém
 * verificou. E a conduta de quem lê muda: "não existe recomendação sobre isto
 * aqui" convida a cadastrar a diretriz que falta, ou a concluir que as
 * diretrizes são silentes; "não deu para olhar" pede repetir em cinco minutos e
 * não autoriza nenhuma das duas.
 *
 * Pior era a assimetria do prompt. No caso 1 a função injetava um aviso
 * mandando o modelo abrir a resposta com o disclaimer. Nos casos 2 e 3 o modelo
 * recebia **nada** — respondia de conhecimento geral sem uma palavra a
 * respeito. A falha mais grave era a silenciosa.
 *
 * ## E o `DocumentGenerator` não olhava nada disso
 *
 * O painel mostrava o aviso; a tela que gera o documento que o médico ASSINA e
 * arquiva no prontuário lia `sources` e `truncado` e **ignorava `rag_hit`**. Um
 * parecer pré-operatório inteiro podia sair só com conhecimento geral do
 * modelo, sem uma linha dizendo isso — e é o texto copiado, não a tela, que
 * vira registro. A ressalva passou a ir junto no texto, como as outras duas.
 *
 * ## O padrão já existia, quatro linhas abaixo
 *
 * A camada EXTERNA de literatura resolveu isto com `MotivoSemLiteratura`, cinco
 * estados, e o comentário dela diz por quê: "'desligada' e 'não encontrei nada'
 * são estados diferentes, e confundi-los é o `ok: true, sent: 0` do digest, que
 * escondeu por semanas que ninguém recebia o resumo". A camada PRIMÁRIA — a das
 * diretrizes — tinha um booleano.
 */

const raiz = resolve(__dirname, "../..");
const ler = (p: string) => readFileSync(resolve(raiz, p), "utf8");
const FUNCAO = "supabase/functions/clinical-ai/index.ts";
const PAINEL = "src/components/ClinicalAIPanel.tsx";
const DOCUMENTO = "src/components/DocumentGenerator.tsx";

/**
 * Nomes de uma união `type X = "a" | "b" …` declarada num arquivo.
 *
 * Com os comentários TIRADOS, e isto não é zelo: a primeira versão lia o
 * arquivo cru e devolveu seis estados para a união de cinco da literatura. O
 * sexto era `"desligada"`, que aparece entre aspas dentro do comentário que
 * explica o quinto estado. É a décima segunda vez nesta sessão que um
 * analisador por texto lê comentário como código, e desta vez fui eu, no mesmo
 * arquivo em que escrevi a regra.
 */
function uniaoDe(caminho: string, nome: string): string[] {
  const fonte = semComentariosDeCodigo(ler(caminho), caminho);
  const i = fonte.indexOf(`export type ${nome} =`);
  if (i < 0) throw new Error(`não achei a união ${nome} em ${caminho}`);
  const fim = fonte.indexOf(";", i);
  return [...fonte.slice(i, fim).matchAll(/"([a-z_]+)"/g)].map((m) => m[1]).sort();
}

describe("os motivos de a IA responder sem fonte", () => {
  it('"não consultei" nunca é classificado como "não achei"', () => {
    /**
     * O caso central, nos dois caminhos que produziam a frase errada.
     * `temEmbedding: false` é o 429 do provedor de embedding; `temCredencial:
     * false` é a função sem a chave de serviço.
     */
    expect(
      motivoSemTrecho({ pedeBase: true, temCredencial: true, temEmbedding: false, achou: false }),
      "embedding que falhou está sendo contado como base sem resultado",
    ).toBe("consulta_falhou");
    expect(
      motivoSemTrecho({ pedeBase: true, temCredencial: false, temEmbedding: false, achou: false }),
      "falta de credencial está sendo contada como base sem resultado",
    ).toBe("sem_credencial");
  });

  it('"não achei" só sai quando a base foi de fato consultada', () => {
    expect(
      motivoSemTrecho({ pedeBase: true, temCredencial: true, temEmbedding: true, achou: false }),
    ).toBe("sem_resultado");
    // E com trecho não há motivo nenhum: `null` é o estado bom.
    expect(
      motivoSemTrecho({ pedeBase: true, temCredencial: true, temEmbedding: true, achou: true }),
    ).toBeNull();
  });

  it("o modo do paciente não consulta a base, e isso não é falha", () => {
    // A decisão é antiga e tem motivo escrito: trecho de diretriz e regra de
    // citação são material do médico, e é deles que vinha "[Fonte: SBC 2024
    // (aguardando revisão médica)]" no papel que o paciente leva para casa.
    for (const credencial of [true, false]) {
      for (const embedding of [true, false]) {
        expect(
          motivoSemTrecho({
            pedeBase: false, temCredencial: credencial, temEmbedding: embedding, achou: false,
          }),
          "o modo que não pede a base está devolvendo outro motivo",
        ).toBe("nao_pedida");
      }
    }
  });

  it("todo motivo que pede aviso avisa, e o do paciente não", () => {
    /**
     * A assimetria consertada. Antes, só `sem_resultado` injetava aviso no
     * prompt; nos dois em que a base não foi consultada o modelo recebia nada e
     * respondia como se nada tivesse acontecido.
     *
     * E o do paciente continua `null` de propósito: a orientação de alta não
     * cita fonte nenhuma, e aviso sobre base de diretriz no prompt dela é
     * exatamente o material que não pode chegar ao papel do paciente.
     */
    expect(AVISO_AO_MODELO.nao_pedida, "o modo do paciente voltou a receber aviso de base").toBeNull();
    for (const motivo of ["sem_resultado", "consulta_falhou", "sem_credencial"] as const) {
      const aviso = AVISO_AO_MODELO[motivo];
      expect(aviso, `${motivo} não manda aviso nenhum ao modelo`).toBeTruthy();
      expect(aviso, `o aviso de ${motivo} não manda o modelo abrir com o disclaimer`)
        .toMatch(/INICIE sua resposta com o disclaimer/);
    }
  });

  it("o aviso de quem NÃO consultou proíbe afirmar que a base não tem o assunto", () => {
    /**
     * A regra pela garantia, e não pelo texto: o que não pode acontecer é o
     * modelo escrever, no corpo de um texto clínico, que a recomendação não
     * existe na base — quando ninguém olhou.
     */
    for (const motivo of ["consulta_falhou", "sem_credencial"] as const) {
      const aviso = AVISO_AO_MODELO[motivo]!;
      expect(aviso, `${motivo} não diz ao modelo que a base NÃO foi consultada`)
        .toMatch(/NÃO PÔDE SER CONSULTADA/);
      expect(aviso, `${motivo} não proíbe o modelo de afirmar ausência na base`)
        .toMatch(/Não afirme que a recomendação não existe/);
      expect(aviso, `o disclaimer de ${motivo} manda o modelo dizer que "não encontrou"`)
        .not.toMatch(/Não encontrei essa recomendação/);
    }
    // E o benigno continua dizendo "não encontrei", que ali é verdade.
    expect(AVISO_AO_MODELO.sem_resultado).toMatch(/Não encontrei essa recomendação/);
  });

  it("as duas listas de `não consultou` dizem a mesma coisa", () => {
    // Uma na função (decide o prompt), uma na tela (decide a cor e a frase).
    // Divergindo, a tela pinta de amarelo um estado em que ninguém olhou.
    expect([...BASE_NAO_CONSULTADA].sort()).toEqual([...NAO_CONSULTOU].sort());
    // E `sem_resultado` fica de fora das duas: ali a base FOI consultada.
    expect(NAO_CONSULTOU).not.toContain("sem_resultado");
  });

  it("a união da base é a mesma na tela e na função", () => {
    /**
     * O desencontro de `aiModes.ts` outra vez: duas bases de código que não
     * compilam juntas, contrato conferido só em tempo de execução. A tela usa a
     * união como chave de um `Record<MotivoDaBase, string>` — um estado novo na
     * função e a busca devolve `undefined`, com o parágrafo renderizando VAZIO.
     */
    const daFuncao = uniaoDe("supabase/functions/_shared/motivoDaBase.ts", "MotivoSemTrecho");
    expect(daFuncao.length, "a varredura da união não achou os estados").toBe(4);
    expect(daFuncao).toEqual([...MOTIVOS_DA_BASE].sort());
  });

  it("a união da literatura é a mesma na tela e na função", () => {
    // Esta estava escrita à mão em `ClinicalAIPanel` desde sempre, sem nada
    // ligando as duas cópias. Entra na mesma conferência.
    const daFuncao = uniaoDe("supabase/functions/_shared/pesquisaExterna.ts", "MotivoSemLiteratura");
    expect(daFuncao.length, "a varredura da união não achou os estados").toBe(5);
    expect(daFuncao).toEqual([...MOTIVOS_DA_LITERATURA].sort());
  });

  it("a tela tem texto para TODO motivo da base", () => {
    /**
     * `Record<MotivoDaBase, string>` garante isto no `tsc`, e a asserção existe
     * porque o `tsc` não roda sobre `supabase/functions/` no mesmo projeto: a
     * união pode crescer lá e o `Record` daqui continua satisfeito com a união
     * ANTIGA de `aiMotivos.ts`. A regra acima cobra a sincronia; esta cobra que
     * o texto exista para cada um.
     */
    const painel = semComentariosDeCodigo(ler(PAINEL), PAINEL);
    const i = painel.indexOf("MOTIVO_BASE_TEXTO");
    expect(i, "não achei o mapa de textos do aviso da base").toBeGreaterThan(0);
    const mapa = painel.slice(i, painel.indexOf("};", i));
    for (const motivo of MOTIVOS_DA_BASE) {
      /**
       * Ancorado no começo da linha, e não `toContain`.
       *
       * A primeira versão fazia `toContain(`${motivo}:`)`, e a inversão que
       * renomeia a chave para `_consulta_falhou:` PASSOU — porque
       * `_consulta_falhou:` contém `consulta_falhou:`. A regra era mais fraca
       * do que se lia, no arquivo que existe para cobrar que as coisas digam o
       * que medem.
       */
      expect(mapa, `a tela não tem texto para ${motivo}`)
        .toMatch(new RegExp(`^\\s+${motivo}:`, "m"));
    }
  });

  it("a função devolve o motivo, e o painel o lê", () => {
    // Função certa que ninguém chama não conserta nada. Lido no código, sem
    // comentário — os três arquivos explicam o defeito em prosa.
    const funcao = semComentariosDeCodigo(ler(FUNCAO), FUNCAO);
    expect(funcao, "a `clinical-ai` não classifica mais o motivo").toMatch(/motivoSemTrecho\(/);
    expect(funcao, "a resposta não carrega o motivo").toMatch(/rag_motivo:\s*ragMotivo/);
    expect(funcao, "o aviso ao modelo não é mais escolhido pelo motivo")
      .toMatch(/AVISO_AO_MODELO\[ragMotivo\]/);
    /**
     * E o texto do disclaimer não mora mais na `clinical-ai` — em NENHUM dos
     * dois lugares em que morava.
     *
     * Foi esta asserção que achou o segundo defeito, e o maior: a INSTRUÇÃO DE
     * SISTEMA tinha uma regra permanente dizendo "Se NENHUM trecho relevante
     * for retornado, escreva explicitamente: '⚠️ Não encontrei essa
     * recomendação na base carregada da ValvePath'". Quer dizer que o modelo
     * era mandado afirmar ausência na base nos QUATRO casos — inclusive nos
     * dois em que a base nunca foi consultada —, e essa regra fica no sistema,
     * acima do aviso que o pedido carrega. Consertar só o aviso por pedido
     * deixava a instrução permanente desfazendo o conserto.
     *
     * A regra agora manda o modelo usar o disclaimer que o aviso indicar, e
     * proíbe afirmar ausência quando a consulta não foi feita.
     */
    expect(funcao, "o texto do disclaimer voltou para dentro da `clinical-ai`")
      .not.toMatch(/Não encontrei essa recomendação/);
    const i = funcao.indexOf("AVISO PARA VOCÊ (assistente)");
    expect(i, "a instrução de sistema não fala do aviso por pedido").toBeGreaterThan(0);
    const regra = funcao.slice(i, i + 700);
    expect(regra, "a instrução de sistema não proíbe afirmar ausência sem ter consultado")
      .toMatch(/NUNCA afirme que a recomendação não existe na base/);

    const painel = semComentariosDeCodigo(ler(PAINEL), PAINEL);
    expect(painel, "o painel não lê o motivo").toMatch(/rag_motivo/);
    expect(painel, "o painel voltou a afirmar que a base foi consultada")
      .not.toMatch(/A base ValvePath não retornou referência para este tópico/);
  });

  it("o documento que o médico assina avisa, e a ressalva vai no texto copiado", () => {
    /**
     * O sítio que não olhava nada. E o aviso tem de entrar em
     * `textoParaCopiar`, não só na tela: o comentário daquela função já diz por
     * quê — "o aviso na tela não viaja com o documento. Quem copia e cola no
     * prontuário leva só o texto, e o prontuário é onde a afirmação passa a
     * valer."
     */
    const doc = semComentariosDeCodigo(ler(DOCUMENTO), DOCUMENTO);
    expect(doc, "o gerador de documento continua ignorando `rag_hit`").toMatch(/rag_hit/);
    expect(doc, "o gerador não lê o motivo").toMatch(/rag_motivo/);
    const i = doc.indexOf("const textoParaCopiar");
    expect(i, "não achei a função do texto copiado").toBeGreaterThan(0);
    const copiado = doc.slice(i, doc.indexOf("const copy", i));
    expect(copiado, "a ressalva da base não vai no texto que chega ao prontuário")
      .toMatch(/semAncora/);
    expect(copiado, "a ressalva não distingue consultada de não consultada")
      .toMatch(/BASE_NAO_CONSULTADA/);
    // O papel do paciente fica de fora, nos dois lugares.
    expect(copiado, "a orientação de alta ao paciente passou a carregar ressalva de base")
      .toMatch(/ragMotivo !== "nao_pedida"/);
  });

  it("os pisos: as três telas e o módulo continuam sendo os arquivos lidos", () => {
    for (const p of [FUNCAO, PAINEL, DOCUMENTO, "supabase/functions/_shared/motivoDaBase.ts"]) {
      expect(ler(p).length, `${p} encolheu para quase nada`).toBeGreaterThan(1500);
    }
    // E a união que esta guarda defende tem os quatro estados do lado da tela.
    expect([...MOTIVOS_DA_BASE].sort()).toEqual(
      ["consulta_falhou", "nao_pedida", "sem_credencial", "sem_resultado"],
    );
  });

  it("toda combinação de entradas produz um estado conhecido", () => {
    /**
     * Varredura das dezesseis combinações. Nenhuma pode cair em `undefined` —
     * um motivo desconhecido chegando à tela faz `MOTIVO_BASE_TEXTO[x]` virar
     * `undefined`, e o parágrafo sai vazio: o aviso desaparece sem erro.
     */
    const estados = new Set<MotivoSemTrecho | null>();
    for (const pedeBase of [true, false]) {
      for (const temCredencial of [true, false]) {
        for (const temEmbedding of [true, false]) {
          for (const achou of [true, false]) {
            const m = motivoSemTrecho({ pedeBase, temCredencial, temEmbedding, achou });
            expect(
              m === null || (MOTIVOS_DA_BASE as readonly string[]).includes(m),
              `combinação produziu estado fora da união: ${String(m)}`,
            ).toBe(true);
            estados.add(m);
          }
        }
      }
    }
    // E as dezesseis combinações alcançam os cinco desfechos possíveis: sem
    // isso, a varredura poderia estar exercitando sempre o mesmo caminho.
    expect(estados.size, "a varredura não alcançou todos os desfechos").toBe(5);
  });
});
