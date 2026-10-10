/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  INVENTARIO,
  NAO_SAO_TABELAS,
  marcaDoEstado,
  vereditoDaRestauracao,
} from "../../scripts/lib/veredito-restauracao.mjs";
import { semComentariosDeCodigo } from "./semComentariosDeCodigo";

/**
 * O veredito da restauração, e o que ele não contava.
 *
 * ## O defeito, medido no código
 *
 * `restore.mjs` fechava com `exit(divergentes === 0 ? 0 : 1)`, e `divergentes`
 * era alimentado por duas coisas: as tabelas de `public` e uma linha de contas.
 * Três artefatos que a execução tocava ficavam fora da conta:
 *
 *   · **os anexos dos exames.** Com `--com-arquivos` o script baixa cada
 *     documento da origem e sobe no alvo, contando `copiados` e `faltando`.
 *     `faltando` era impresso e não entrava no veredito. Esquecer
 *     `ALVO_SERVICE_KEY` — que o script não exigia — faz todo upload voltar 401:
 *     nenhum exame chega, e a última linha era "Tudo bateu com o manifesto.",
 *     com saída 0;
 *
 *   · **os vínculos de login** (`auth.identities`). Carregados e nunca
 *     conferidos. Sem eles, quem entra com Google não entra;
 *
 *   · **as contas**, comparadas com elas mesmas: `contas === usuarios.length`,
 *     onde `usuarios` é o arquivo que o script acabou de baixar. Um
 *     `auth_users.ndjson` ausente dá `0 === 0` — bateu.
 *
 * ## Por que isto é grave aqui e não em outro script
 *
 * O RECOVERY.md manda rodar exatamente com `--com-arquivos` e diz, em negrito:
 *
 *   > "Se ele disser 'Tudo bateu', bateu de verdade; se não disser, não
 *   >  considere restaurado."
 *
 * É a única frase do procedimento que autoriza alguém a parar de conferir à
 * mão. E é lida uma vez na vida, no dia em que o projeto foi perdido, por
 * alguém com pressa.
 *
 * ## O que esta guarda cobra
 *
 * O veredito é função pura — recebe manifesto e medições, devolve linhas e
 * código de saída — então cada caso aqui é exercício de verdade, não leitura de
 * texto. Os dois últimos casos leem o `restore.mjs` porque função certa que
 * ninguém chama não conserta nada, e eles leem o CÓDIGO com os comentários
 * tirados: este arquivo, o módulo do veredito e o próprio script explicam o
 * defeito em prosa, e guarda que lê comentário não confere código.
 */

const SCRIPT = "scripts/restore.mjs";
const LIB = "scripts/lib/veredito-restauracao.mjs";

/** Um manifesto como o `weekly-export` grava. */
function manifestoDe(tables: Record<string, { rows?: number; error?: string }>) {
  return { generated_at: "2026-08-03T03:15:00.000Z", stamp: "2026-08-03", tables };
}

describe("o veredito da restauração", () => {
  it("os anexos que não chegaram reprovam a restauração", () => {
    /**
     * O caso central. 37 exames no inventário, zero no alvo — o que acontece
     * com `ALVO_SERVICE_KEY` ausente, chave sem permissão de escrita, ou bucket
     * que não existe no projeto novo.
     */
    const v = vereditoDaRestauracao({
      manifesto: manifestoDe({ clinical_cases: { rows: 50 }, [INVENTARIO]: { rows: 37 } }),
      medido: { clinical_cases: 50, [INVENTARIO]: 0 },
      pediuArquivos: true,
    });
    const linha = v.linhas.find((l) => l.nome === INVENTARIO);
    expect(linha?.estado, "o inventário passou por ok com zero anexos copiados").toBe("divergente");
    expect(v.divergentes).toBe(1);
    expect(v.codigo, "a restauração sem nenhum exame saiu com código de sucesso").toBe(1);
  });

  it("sem `--com-arquivos`, o inventário aparece e não reprova", () => {
    /**
     * O outro lado, e ele importa tanto quanto: falso vermelho custa o mesmo que
     * falso verde. O RECOVERY.md diz que "sem a flag, só os dados voltam" — uma
     * restauração de dados que reprovasse por não ter copiado o que ninguém
     * pediu ensinaria o operador a ignorar o veredito justamente aqui.
     *
     * E a linha continua no relatório: "não pedi" e "veio" não podem sair iguais.
     */
    const v = vereditoDaRestauracao({
      manifesto: manifestoDe({ clinical_cases: { rows: 50 }, [INVENTARIO]: { rows: 37 } }),
      medido: { clinical_cases: 50 },
      pediuArquivos: false,
    });
    expect(v.codigo).toBe(0);
    expect(v.divergentes).toBe(0);
    expect(v.naoConferidos).toBe(0);
    const linha = v.linhas.find((l) => l.nome === INVENTARIO);
    expect(linha?.estado, "o inventário desapareceu do relatório").toBe("nao-pedido");
    expect(linha?.obtido, 'o relatório afirma uma contagem de anexos que não mediu').toBeNull();
  });

  it("pedir os anexos sem inventário no backup não passa em silêncio", () => {
    /**
     * A mesma omissão pela outra porta. Sem `storage_inventory` no manifesto, o
     * laço de cópia roda zero vezes: "Copiando 0 arquivo(s)", nenhum aviso, e
     * nenhuma linha para mostrar. Zero de zero tem a cara de um acerto.
     */
    const v = vereditoDaRestauracao({
      manifesto: manifestoDe({ clinical_cases: { rows: 50 } }),
      medido: { clinical_cases: 50 },
      pediuArquivos: true,
    });
    const linha = v.linhas.find((l) => l.nome === INVENTARIO);
    expect(linha?.estado, "pediram os anexos e o veredito não falou do assunto").toBe("sem-backup");
    expect(v.naoConferidos).toBe(1);
    expect(v.codigo).toBe(2);
  });

  it("as contas são comparadas com o MANIFESTO, não com o arquivo baixado", () => {
    /**
     * O manifesto foi escrito no dia do export, pelo lado que tinha as contas.
     * O arquivo baixado é o que chegou hoje — e se não chegou, comparar com ele
     * é comparar o nada com o nada.
     */
    const v = vereditoDaRestauracao({
      manifesto: manifestoDe({ auth_users: { rows: 4 }, auth_identities: { rows: 2 } }),
      medido: { auth_users: 0, auth_identities: 0 },
    });
    expect(v.divergentes, "quatro contas no backup, nenhuma no alvo, e bateu").toBe(2);
    expect(v.codigo).toBe(1);
  });

  it("os vínculos de login entram no veredito", () => {
    // Nominal: `auth.identities` não era conferido de jeito nenhum. Com as
    // contas certas e os vínculos perdidos, quem usa Google não entra — e o
    // veredito anterior dizia que tudo bateu.
    const v = vereditoDaRestauracao({
      manifesto: manifestoDe({ auth_users: { rows: 4 }, auth_identities: { rows: 4 } }),
      medido: { auth_users: 4, auth_identities: 0 },
    });
    expect(v.linhas.find((l) => l.nome === "auth_identities")?.estado).toBe("divergente");
    expect(v.codigo).toBe(1);
  });

  it("erro registrado no manifesto é NÃO CONFERIDO, mesmo com zero dos dois lados", () => {
    /**
     * O export falhou naquele arquivo, então `rows` é 0 e o alvo também é 0. A
     * comparação "bate" e não significa nada: o dado não existe no backup. É a
     * convenção desta base — 0 ok, 1 DIVERGE, 2 NÃO CONFERIDO — e é a diferença
     * entre "restaurei tudo" e "não havia o que restaurar".
     */
    const v = vereditoDaRestauracao({
      manifesto: manifestoDe({
        clinical_cases: { rows: 0, error: "permission denied for table clinical_cases" },
      }),
      medido: { clinical_cases: 0 },
    });
    const linha = v.linhas[0];
    expect(linha.estado, "tabela que o export não gravou passou por ok").toBe("sem-backup");
    expect(linha.detalhe, "o veredito não diz que o erro é do export").toMatch(/export falhou/);
    expect(v.divergentes).toBe(0);
    expect(v.naoConferidos).toBe(1);
    expect(v.codigo).toBe(2);
  });

  it("artefato do manifesto que ninguém mediu é NÃO CONFERIDO", () => {
    // "Não sei" não é "está tudo bem". Um artefato que o manifesto lista e a
    // execução não contou não pode somar ao lado dos que bateram.
    const v = vereditoDaRestauracao({
      manifesto: manifestoDe({ clinical_cases: { rows: 50 }, audit_logs: { rows: 900 } }),
      medido: { clinical_cases: 50 },
    });
    expect(v.linhas.find((l) => l.nome === "audit_logs")?.estado).toBe("nao-medido");
    expect(v.codigo).toBe(2);
  });

  it("o código de saída diz a pior coisa que aconteceu", () => {
    // Divergência e não-conferido juntos: sai 1. Mesma ordem do
    // `conferir-fontes.mjs`, pelo mesmo motivo — ⚠️ não é ❌.
    const v = vereditoDaRestauracao({
      manifesto: manifestoDe({
        clinical_cases: { rows: 50 },
        audit_logs: { rows: 900, error: "timeout" },
      }),
      medido: { clinical_cases: 1 },
    });
    expect(v.divergentes).toBe(1);
    expect(v.naoConferidos).toBe(1);
    expect(v.codigo).toBe(1);
  });

  it("manifesto sem o bloco `tables` para o veredito em vez de aprovar", () => {
    /**
     * Um manifesto truncado, ou um JSON de erro salvo com o nome do manifesto,
     * daria `Object.keys(undefined)`. Devolver "zero divergências" sobre nada
     * seria o falso verde mais puro possível: nenhuma comparação feita, todas
     * aprovadas.
     */
    for (const m of [{}, { tables: null }, null, { tables: "nada" }]) {
      expect(
        () => vereditoDaRestauracao({ manifesto: m as never, medido: {} }),
        `${JSON.stringify(m)} não parou o veredito`,
      ).toThrow(/sem o bloco/);
    }
  });

  it("todo estado tem marca, e ok é o único silencioso", () => {
    // O relatório é lido com os olhos. Um estado sem marca sairia alinhado com
    // os que passaram.
    for (const e of ["divergente", "nao-pedido", "sem-backup", "nao-medido", "inventado"]) {
      expect(marcaDoEstado(e), `o estado ${e} saiu sem marca`).not.toBe(" ");
    }
    expect(marcaDoEstado("ok")).toBe(" ");
  });

  it("a lista de não-tabelas é uma só, e o script usa a dela", () => {
    /**
     * `NAO_SAO_TABELAS` decide o que é tabela de `public` e o que é arquivo
     * avulso. Havia uma cópia no `restore.mjs`; agora é a do módulo. Duas cópias
     * de uma decisão é onde ela começa a divergir — e aqui divergir significa
     * `select count(*) from public.storage_inventory`, que derruba a
     * restauração inteira.
     */
    expect([...NAO_SAO_TABELAS].sort()).toEqual(["auth_identities", "auth_users", "storage_inventory"]);
    const codigo = semComentariosDeCodigo(readFileSync(SCRIPT, "utf8"), SCRIPT);
    expect(codigo, "o restore voltou a declarar a própria lista").not.toMatch(/const NAO_SAO_TABELAS\s*=/);
    expect(codigo, "o restore não importa a lista do módulo").toMatch(/NAO_SAO_TABELAS/);
  });

  it("o `restore.mjs` fecha pelo veredito, e os anexos chegam até ele", () => {
    /**
     * Função certa que ninguém chama não conserta nada. Lido no código, sem
     * comentário:
     *
     *   · o único `exit` do fim usa o código do veredito, e não um contador
     *     montado à mão;
     *   · a contagem de anexos copiados é o que alimenta a linha do inventário;
     *   · a comparação antiga, `contas === usuarios.length`, não voltou.
     */
    const codigo = semComentariosDeCodigo(readFileSync(SCRIPT, "utf8"), SCRIPT);
    expect(codigo, "o restore não chama o veredito").toMatch(/vereditoDaRestauracao\(/);
    expect(codigo, "o fim do restore não sai pelo código do veredito")
      .toMatch(/exit\(\s*veredito\.codigo\s*\)/);
    expect(codigo, "os anexos copiados não entram na medição")
      .toMatch(/medido\[INVENTARIO\]\s*=\s*arquivos\.copiados/);
    // As contas e os vínculos, nominalmente. Tirar uma destas linhas degrada
    // para "não conferido" (saída 2) em vez de para falso verde — o desenho do
    // módulo garante isso —, mas uma medição que desaparece em silêncio troca
    // uma prova por um aviso, e a prova é o que o RECOVERY.md promete.
    expect(codigo, "as contas não são medidas no alvo").toMatch(/medido\.auth_users\s*=/);
    expect(codigo, "os vínculos de login não são medidos no alvo")
      .toMatch(/medido\.auth_identities\s*=/);
    expect(codigo, "as contas voltaram a ser comparadas com o arquivo baixado")
      .not.toMatch(/contas\s*===?\s*usuarios\.length/);
    expect(codigo, "o restore voltou a contar divergências por fora do veredito")
      .not.toMatch(/divergentes\+\+/);
  });

  it("o restore recusa `--com-arquivos` sem a chave do alvo", () => {
    // A causa mais provável do zero-de-37, e a mais barata de evitar: sem
    // `ALVO_SERVICE_KEY` todo upload volta 401. Recusar na partida poupa
    // descobrir isso depois de carregar 38 tabelas.
    const codigo = semComentariosDeCodigo(readFileSync(SCRIPT, "utf8"), SCRIPT);
    expect(codigo, "o restore aceita copiar anexos sem a chave de escrita do alvo")
      .toMatch(/COM_ARQUIVOS\s*&&\s*!env\.ALVO_SERVICE_KEY/);
  });

  it("o motivo da recusa de uma tabela é impresso, não guardado num mapa", () => {
    /**
     * A conferência mostra "esperado 50, no alvo 0" e o `insert` tinha dito
     * exatamente por quê — numa string que o script gravava em `carregado[t]` e
     * jogava fora. Resultado escrito e não lido é a forma mais pura do tema
     * desta sessão, e às três da manhã o motivo é a metade útil.
     */
    const codigo = semComentariosDeCodigo(readFileSync(SCRIPT, "utf8"), SCRIPT);
    expect(codigo, "o mapa que ninguém lia voltou").not.toMatch(/carregado\[/);
    expect(codigo, "o motivo da recusa não é mais registrado").toMatch(/erroDeCarga\[/);
    // E é LIDO: gravar noutro mapa esquecido seria o mesmo defeito com outro
    // nome. A âncora é um trecho de CÓDIGO — a primeira versão deste caso
    // ancorava na palavra "Conferência", que só existe num comentário e sai no
    // limpador; `indexOf` devolvia -1, `slice(-1)` devolvia uma quebra de linha,
    // e o caso reprovava sobre nada.
    const chamada = codigo.indexOf("vereditoDaRestauracao({");
    expect(chamada, "não achei a chamada do veredito").toBeGreaterThan(0);
    expect(
      codigo.slice(chamada),
      "o motivo é registrado antes do veredito e nunca impresso depois",
    ).toMatch(/erroDeCarga\[/);
  });

  it("a promessa do RECOVERY.md é a frase que o script imprime", () => {
    /**
     * A frase do procedimento é o que autoriza alguém a parar de conferir à
     * mão. Ela só pode continuar lá enquanto o script de fato a imprimir — e só
     * a imprime quando nada divergiu e nada ficou sem conferir.
     */
    const doc = readFileSync("RECOVERY.md", "utf8");
    expect(
      doc.indexOf('Se ele disser "Tudo bateu"'),
      "a promessa do RECOVERY.md sumiu — ou o script sumiu com a frase",
    ).toBeGreaterThan(0);
    const codigo = semComentariosDeCodigo(readFileSync(SCRIPT, "utf8"), SCRIPT);
    expect(codigo, "o script não imprime mais a frase que o documento promete")
      .toContain("Tudo bateu com o manifesto.");
  });

  it("todo código de saída que o operador pode receber está documentado", () => {
    /**
     * A regra anterior aqui media vocabulário: procurava `/anexo|arquivo/` numa
     * janela de 1800 caracteres em volta da promessa. A inversão mostrou o que
     * isso valia — apaguei o parágrafo inteiro que lista o que o veredito
     * compara, e a regra continuou passando, porque a palavra "arquivo" aparece
     * em outra frase da mesma página. Guarda que procura palavra aceita
     * qualquer página que use a palavra.
     *
     * Esta cobra uma propriedade: **o veredito tem três saídas e o documento
     * explica as três.** Uma saída 2 na mão de quem está restaurando às três da
     * manhã, sem nada que diga o que ela significa, é pior do que saída 1 — ele
     * vai supor que é um detalhe.
     *
     * O que esta guarda NÃO cobra: que a prosa do documento descreva certo o
     * que entra na conta. Isso não se mede em texto, e quem cobra é o conjunto
     * de regras sobre o CÓDIGO deste arquivo — o veredito só sai 0 quando todo
     * artefato do manifesto bateu.
     */
    const doc = readFileSync("RECOVERY.md", "utf8");
    const i = doc.indexOf('Se ele disser "Tudo bateu"');
    const trecho = doc.slice(i, i + 1200);
    for (const [codigo, oQueDiz] of [
      ["0", /bateu/i],
      ["1", /diverg/i],
      ["2", /n[ãa]o (deu para |d[áa] para )?conferir|n[ãa]o conferido/i],
    ] as const) {
      const linha = trecho.split("\n").find((l) => new RegExp(`^\\|\\s*${codigo}\\s*\\|`).test(l));
      expect(linha, `a saída ${codigo} não está na tabela do RECOVERY.md`).toBeTruthy();
      expect(linha, `a saída ${codigo} está na tabela e não diz o que significa`).toMatch(oQueDiz);
    }
  });

  it("o piso: o módulo do veredito é o módulo lido", () => {
    // Um `expect` sobre um arquivo que não existe mais passaria por vazio.
    const lib = readFileSync(LIB, "utf8");
    expect(lib.length, "o módulo do veredito encolheu para quase nada").toBeGreaterThan(2000);
    expect(lib).toContain("export function vereditoDaRestauracao");
  });
});
