/// <reference types="node" />
import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * `AdminDPO` é uma página: ela cria o cliente do Supabase e puxa a árvore de
 * componentes. A suíte roda sem `.env` de propósito (para rodar nas mesmas
 * condições do CI), então o import morre em "supabaseUrl is required" antes do
 * primeiro caso. `textoDaResposta` é pura e exportada; o resto não é exercitado
 * aqui e não é o que esta guarda afirma cobrir.
 */
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() } },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null, profile: null }) }));

import { textoDaResposta } from "@/pages/app/AdminDPO";
import ts from "typescript";
import { semComentariosDeCodigo } from "./semComentariosDeCodigo";
import { fonteDe } from "./valorEscritoEhLido";
import { sqlSemComentarios } from "./sqlDeMigrations";

/**
 * O encerramento promete o que faz — e diz o que não faz.
 *
 * ## O defeito, estabelecido no repositório
 *
 * `EncerrarContaDialog` lista, ANTES da confirmação irreversível:
 *
 *   > "O nome deixa de aparecer no prontuário, substituído por um código"
 *
 * e o `SecurityCenter` repetia a mesma frase, sem ressalva. Mas `encerrar_conta`
 * só troca o nome nos casos VINCULADOS à conta:
 *
 *     update public.clinical_cases
 *        set patient_name = 'Titular removido · ' || _codigo
 *      where patient_id = _paciente_id and patient_name not like 'Titular removido%';
 *
 * e o comentário acima dessa linha declara o limite:
 *
 *   > "Caso digitado à mão, sem vínculo de conta, não pode ser atribuído ao
 *   >  titular com segurança — e fingir cobertura total seria pior que declarar
 *   >  o limite."
 *
 * A decisão é certa — trocar por semelhança de nome alteraria o prontuário de
 * outra pessoa. O errado era ONDE o limite foi declarado: num comentário de SQL,
 * enquanto a tela prometia cobertura.
 *
 * E o limite não é raro. Medido: **nenhum caminho do aplicativo ou das
 * migrations escreve `clinical_cases.patient_id`** — `buildPayload` em
 * `NovoCaso.tsx` não o inclui, e nenhuma migration faz `set patient_id`. O
 * vínculo é sempre nulo, `casos_pseudonimizados` é sempre 0, e a promessa não se
 * cumpria nunca.
 *
 * ## O terceiro elo: a resposta oficial descartava o zero
 *
 * `AdminDPO.textoDaResposta` monta a RESPOSTA AO TITULAR a partir do relatório —
 * e o comentário dela diz por quê: "a resposta ao titular nasce do relatório do
 * próprio encerramento, em vez de ser redigida de memória". O filtro era
 * `v !== null && v !== undefined && v !== 0 && v !== ""`. O `v !== 0`
 * **descartava a contagem zero**, que é justamente a que diz que o nome
 * continua no prontuário. A resposta não falava do assunto, enquanto o bloco
 * `mantido` afirmava que "a correspondência do pseudônimo fica em base
 * restrita" — de onde se conclui que houve pseudônimo.
 *
 * ## O que esta guarda cobra
 *
 * Que os três textos declarem o limite, que o relatório o carregue, que a
 * resposta oficial não esconda contagem nenhuma, e — a parte que envelhece —
 * que a PREMISSA continue valendo: se alguém passar a preencher o vínculo, a
 * guarda reprova pedindo para reconferir a redação, porque aí a frase antiga
 * voltaria a ser verdadeira e a nova ficaria pessimista.
 */

const raiz = resolve(__dirname, "../..");
const ler = (p: string) => readFileSync(resolve(raiz, p), "utf8");
const DIALOGO = "src/components/EncerrarContaDialog.tsx";
const CENTRO = "src/components/SecurityCenter.tsx";
const MIGRATION = "supabase/migrations/20261011120000_encerramento_relata_o_que_fez.sql";

/** O corpo da versão VIGENTE de `encerrar_conta` — a da migration mais recente. */
function encerrarContaVigente(): string {
  const dir = resolve(raiz, "supabase/migrations");
  const comADefinicao = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => readFileSync(join(dir, f), "utf8").includes(
      "create or replace function public.encerrar_conta",
    ))
    .sort();
  expect(
    comADefinicao.length,
    "nenhuma migration define `encerrar_conta` — a varredura está errada",
  ).toBeGreaterThan(0);
  const ultima = comADefinicao[comADefinicao.length - 1];
  const sql = sqlSemComentarios(readFileSync(join(dir, ultima), "utf8"));
  const i = sql.indexOf("create or replace function public.encerrar_conta");
  return sql.slice(i, sql.indexOf("\nend;", i));
}

/**
 * Alguma chamada escreve `patient_id` numa gravação em `clinical_cases`?
 *
 * Pelo AST, e não por texto, porque `patient_id:` aparece em três formas que não
 * são escrita no prontuário: declaração de tipo (`patient_id: string | null`),
 * gravação em OUTRA tabela (`medications`, `patient_documents`,
 * `patient_link_requests` — sete arquivos fazem isso, legitimamente) e leitura
 * (`.eq("patient_id", …)`). A primeira versão deste caso casava
 * `/\bpatient_id\s*:/` em arquivo que mencionasse `clinical_cases`, e acusou um
 * arquivo que grava em outra tabela e lê o prontuário.
 *
 * O caminho certo é estrutural: achar `.insert`/`.update`/`.upsert` com uma
 * propriedade `patient_id` e descer a cadeia de chamadas até ver se o
 * `.from(...)` daquela cadeia é `clinical_cases`.
 */
/**
 * A carga de um `.insert`/`.update` contém `patient_id`?
 *
 * Segue três formas, e as três existem nesta base:
 *
 *   · objeto literal direto — `.insert({ patient_id, … })`;
 *   · objeto montado por um helper — `.insert(buildPayload(form))`, que é
 *     exatamente o que `NovoCaso.tsx` faz;
 *   · espalhamento — `.insert({ ...buildPayload(form), doctor_id })`.
 *
 * A primeira versão olhava só a primeira forma, e a inversão mostrou o preço:
 * acrescentar `patient_id` ao `buildPayload` do `NovoCaso` passava pela guarda.
 * Uma guarda que mede a forma mais fácil de escrever não mede a que o código
 * usa.
 *
 * `profundidade` para o caso de helpers que chamam helpers — e para não entrar
 * em recursão se alguém escrever um.
 */
function cargaTemPatientId(no: ts.Node, fonte: ts.SourceFile, profundidade: number): boolean {
  if (profundidade > 3) return false;

  if (ts.isArrayLiteralExpression(no)) {
    return no.elements.some((e) => cargaTemPatientId(e, fonte, profundidade + 1));
  }

  if (ts.isObjectLiteralExpression(no)) {
    return no.properties.some((p) => {
      if (
        (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) &&
        p.name && ts.isIdentifier(p.name) && p.name.text === "patient_id"
      ) return true;
      if (ts.isSpreadAssignment(p)) return cargaTemPatientId(p.expression, fonte, profundidade + 1);
      return false;
    });
  }

  /**
   * `x`: procura a variável `x` no arquivo e olha o que ela recebeu.
   *
   * É a forma que `NovoCaso.tsx` usa de verdade —
   * `const payload = { ...buildPayload(form), status: "draft" }` e depois
   * `.insert(payload)`. Sem este ramo, a inversão que acrescenta `patient_id` ao
   * `buildPayload` passava pela guarda: o detector cobria objeto literal e
   * chamada de helper, e o código deste repositório usa as duas com uma variável
   * no meio.
   */
  if (ts.isIdentifier(no)) {
    const nome = no.text;
    let achou = false;
    const procura = (n: ts.Node) => {
      if (achou) return;
      if (
        ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nome &&
        n.initializer && cargaTemPatientId(n.initializer, fonte, profundidade + 1)
      ) achou = true;
      ts.forEachChild(n, procura);
    };
    procura(fonte);
    return achou;
  }

  // `f(...)`: procura a função `f` no arquivo e olha o que ela devolve.
  if (ts.isCallExpression(no) && ts.isIdentifier(no.expression)) {
    const nome = no.expression.text;
    let achou = false;
    const procura = (n: ts.Node) => {
      if (achou) return;
      const corpo =
        ts.isFunctionDeclaration(n) && n.name?.text === nome
          ? n.body
          : ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nome &&
            n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))
            ? n.initializer.body
            : undefined;
      if (corpo) {
        if (ts.isBlock(corpo)) {
          const olhaRetorno = (b: ts.Node) => {
            if (achou) return;
            if (ts.isReturnStatement(b) && b.expression &&
                cargaTemPatientId(b.expression, fonte, profundidade + 1)) achou = true;
            ts.forEachChild(b, olhaRetorno);
          };
          olhaRetorno(corpo);
        } else if (cargaTemPatientId(corpo, fonte, profundidade + 1)) {
          achou = true;
        }
      }
      ts.forEachChild(n, procura);
    };
    procura(fonte);
    return achou;
  }

  return false;
}

function escrevePatientIdEmCasos(fonte: ts.SourceFile): boolean {
  let achou = false;

  /** O `.from("X")` da cadeia desta chamada, se houver. */
  const tabelaDaCadeia = (no: ts.Node): string | null => {
    let atual: ts.Node | undefined = no;
    while (atual) {
      if (
        ts.isCallExpression(atual) &&
        ts.isPropertyAccessExpression(atual.expression) &&
        atual.expression.name.text === "from" &&
        atual.arguments.length === 1 &&
        ts.isStringLiteralLike(atual.arguments[0])
      ) {
        return (atual.arguments[0] as ts.StringLiteralLike).text;
      }
      atual = ts.isCallExpression(atual)
        ? atual.expression
        : ts.isPropertyAccessExpression(atual)
          ? atual.expression
          : undefined;
    }
    return null;
  };

  const anda = (no: ts.Node) => {
    if (
      ts.isCallExpression(no) &&
      ts.isPropertyAccessExpression(no.expression) &&
      ["insert", "update", "upsert"].includes(no.expression.name.text)
    ) {
      const temPatientId = no.arguments.some((arg) => cargaTemPatientId(arg, fonte, 0));
      if (temPatientId && tabelaDaCadeia(no.expression.expression) === "clinical_cases") {
        achou = true;
      }
    }
    ts.forEachChild(no, anda);
  };
  anda(fonte);
  return achou;
}

/** Arquivos de código de `src/`, sem testes. */
function arquivosDe(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivosDe(caminho);
    return /\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

const vigente = encerrarContaVigente();

describe("o encerramento promete o que faz", () => {
  it("a PREMISSA: nada escreve `clinical_cases.patient_id`", () => {
    /**
     * É disto que o texto das telas depende. Se um dia o aplicativo passar a
     * vincular o caso à conta do paciente, a pseudonimização do prontuário
     * começa a alcançar linhas de verdade — e aí a redação atual, que destaca o
     * limite, fica pessimista. A reprovação aqui pede para reconferir a redação,
     * não para desfazer o vínculo.
     *
     * A varredura é por escrita: `patient_id` como CHAVE de objeto num payload,
     * ou num `set patient_id` de SQL. Ler a coluna é o uso normal e não conta.
     */
    const escritasNoApp: string[] = [];
    for (const f of arquivosDe(resolve(raiz, "src"))) {
      const t = readFileSync(f, "utf8");
      if (!t.includes("clinical_cases")) continue;
      if (escrevePatientIdEmCasos(fonteDe(f, t))) escritasNoApp.push(f.replace(raiz + "/", ""));
    }
    expect(
      escritasNoApp,
      "alguém passou a vincular o caso à conta do paciente.\n\n" +
        "Isso é uma MELHORA: a pseudonimização do prontuário passa a alcançar\n" +
        "casos de verdade no encerramento. Mas a redação do diálogo e do centro de\n" +
        "segurança destaca o limite de hoje — reconfira os dois textos e este caso.",
    ).toEqual([]);

    const dir = resolve(raiz, "supabase/migrations");
    const emSql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .filter((f) => {
        const sql = sqlSemComentarios(readFileSync(join(dir, f), "utf8"));
        /**
         * Só a cláusula SET conta, e é por isso que o trecho é cortado entre o
         * `set` e o `where`: a própria pseudonimização do prontuário faz
         * `where patient_id = _paciente_id`, que é LEITURA. A primeira versão
         * desta regra casava `update … clinical_cases … patient_id =` e acusou
         * as três migrations que a implementam — inclusive a desta rodada.
         */
        for (const m of sql.matchAll(
          /update\s+(?:public\.)?clinical_cases\s+set\s+([\s\S]*?)(?:\bwhere\b|;)/gi,
        )) {
          if (/\bpatient_id\s*=/i.test(m[1])) return true;
        }
        return /insert\s+into\s+(?:public\.)?clinical_cases\s*\([^)]*\bpatient_id\b/i.test(sql);
      });
    expect(emSql, "uma migration passou a preencher o vínculo — reconfira os textos").toEqual([]);
  });

  it("a pseudonimização do prontuário continua sendo só pelo VÍNCULO", () => {
    /**
     * O outro lado da premissa, e o que torna o limite necessário: se o critério
     * virasse casamento por NOME, o encerramento de uma pessoa alteraria o
     * prontuário de qualquer homônimo. O limite existe para impedir isso, e a
     * guarda cobra que ele não seja "consertado" por esse caminho.
     */
    expect(vigente, "a pseudonimização do prontuário mudou de critério")
      .toMatch(/update public\.clinical_cases[\s\S]{0,200}?where patient_id = _paciente_id/);
    expect(vigente, "o critério passou a casar por nome — isso alteraria registro de terceiro")
      .not.toMatch(/where[^;]*patient_name\s*=\s*_nome_perfil/);
  });

  it("os três textos declaram o limite do prontuário", () => {
    const dialogo = semComentariosDeCodigo(ler(DIALOGO), DIALOGO);
    // A frase sem ressalva não pode voltar.
    expect(
      dialogo,
      "o diálogo voltou a prometer que o nome sai do prontuário, sem ressalva",
    ).not.toMatch(/O nome deixa de aparecer no prontuário/);
    expect(dialogo, "o diálogo não diz que a troca vale só para os casos vinculados")
      .toMatch(/casos vinculados a esta conta/i);
    expect(dialogo, "o diálogo não diz o que acontece com o caso digitado à mão")
      .toMatch(/digitou o nome à mão|digitado à mão/i);
    expect(dialogo, "o diálogo não aponta o caminho do DPO para esses casos")
      .toMatch(/pedido ao DPO/i);

    const centro = semComentariosDeCodigo(ler(CENTRO), CENTRO);
    expect(centro, "o centro de segurança voltou a prometer sem ressalva")
      .not.toMatch(/seu nome deixa de aparecer nele, substituído por um código/);
    expect(centro, "o centro de segurança não diz que a troca vale só para os vinculados")
      .toMatch(/vinculados a esta conta/i);
  });

  it("o relatório carrega o limite e as contagens", () => {
    expect(vigente, "o relatório não declara mais o limite").toMatch(/'limites', jsonb_build_object/);
    expect(vigente, "o limite não fala do caso não vinculado")
      .toMatch(/casos VINCULADOS a esta conta/);
    expect(vigente, "o limite não diz o que fazer quando a contagem é zero")
      .toMatch(/passa por pedido ao DPO/);
    expect(vigente, "o relatório não traz as contagens").toMatch(/'linhas', jsonb_build_object/);
  });

  it("toda frase do `apagado` só sai quando mudou linha", () => {
    /**
     * Era prosa fixa: `'perfil', 'nome, telefone e data de nascimento'` saía
     * sempre, inclusive quando o `update` não encontrou linha. Afirmação sobre
     * trabalho que pode não ter acontecido.
     */
    const apagado = vigente.slice(vigente.indexOf("'apagado', jsonb_build_object"));
    const bloco = apagado.slice(0, apagado.indexOf("'linhas'"));
    const frases = [...bloco.matchAll(/'(\w+)',\s*(case when|')/g)];
    expect(frases.length, "não li o bloco `apagado`").toBeGreaterThan(4);
    for (const [, chave, forma] of frases) {
      expect(forma, `a frase de \`${chave}\` volta a sair sem medir`).toBe("case when");
    }
  });

  it("cada passo mede o que fez — nenhum `update`/`delete` sem `get diagnostics`", () => {
    /**
     * A regra pela garantia: não é "existe `get diagnostics` no arquivo", é que
     * cada escrita tenha a sua medição. Uma única que não meça volta a ser
     * afirmada sem base.
     *
     * Os dois `insert into public.pseudonym_map` ficam fora de propósito: são
     * trabalho auxiliar, e o número que importa deles é o `_casos` do `update`
     * que vem logo depois. O `insert` em `audit_logs` também: ele É o registro.
     */
    const linhas = vigente.split("\n").map((l) => l.trim()).filter(Boolean);
    const semMedicao: string[] = [];
    for (let i = 0; i < linhas.length; i++) {
      if (!/^(update|delete from) public\./.test(linhas[i])) continue;
      // Procura o `get diagnostics` antes da próxima escrita.
      let achou = false;
      for (let j = i + 1; j < linhas.length; j++) {
        if (/^(update|delete from|insert into) public\./.test(linhas[j])) break;
        if (/^get diagnostics/.test(linhas[j])) { achou = true; break; }
      }
      if (!achou) semMedicao.push(linhas[i]);
    }
    expect(
      semMedicao,
      `escritas sem \`get diagnostics\`:\n  ${semMedicao.join("\n  ")}\n\n` +
        "Sem medir, o relatório volta a afirmar o passo em prosa fixa — e é esse\n" +
        "relatório que vira a resposta oficial ao titular.",
    ).toEqual([]);
  });

  it("a resposta oficial NÃO esconde contagem zero", () => {
    /**
     * O defeito que fechava a cadeia. `casos_pseudonimizados: 0` é o número que
     * diz que o nome continua no prontuário, e o filtro `v !== 0` o descartava.
     */
    const texto = textoDaResposta({
      codigo: "ABC123",
      apagado: { perfil: "nome, telefone e data de nascimento do cadastro", paciente: null },
      linhas: { casos_pseudonimizados: 0, filtros_apagados: 3, notificacoes_apagadas: 0 },
      mantido: { prontuario: "registro clínico preservado por 20 anos" },
      limites: {
        prontuario_nao_vinculado: "A substituição do nome no prontuário alcança apenas os casos VINCULADOS a esta conta.",
        casos_pseudonimizados: 0,
      },
    });
    expect(texto, "a contagem zero do prontuário não aparece na resposta")
      .toMatch(/Casos do prontuário com o nome substituído por código: 0/);
    expect(texto, "a contagem zero de notificações desapareceu")
      .toMatch(/Notificações apagadas: 0/);
    expect(texto, "a contagem diferente de zero desapareceu").toMatch(/Filtros salvos apagados: 3/);
    expect(texto, "o limite não chega à resposta").toMatch(/Limite desta operação/);
    expect(texto, "o texto do limite não chega à resposta").toMatch(/casos VINCULADOS a esta conta/);
    // E o passo que NÃO aconteceu não é afirmado: `paciente: null` fica fora.
    expect(texto, "a resposta afirma um passo que o relatório não reportou")
      .not.toMatch(/cidade e UF/);
  });

  it("contagem com chave desconhecida sai com o nome cru, não desaparece", () => {
    // Descartar seria o mesmo defeito com outro nome: a resposta ficaria mais
    // curta e mais bonita, sem dizer que houve um número que ninguém nomeou.
    const texto = textoDaResposta({
      apagado: { perfil: "algo" },
      linhas: { chave_nova_sem_rotulo: 7 },
      mantido: { prontuario: "fica" },
    });
    expect(texto, "a contagem sem rótulo foi descartada").toMatch(/chave_nova_sem_rotulo: 7/);
  });

  it("relatório sem os blocos não inventa resposta", () => {
    expect(textoDaResposta(null)).toBe("Conta encerrada.");
    expect(textoDaResposta({})).toBe("Conta encerrada.");
  });

  it("todo rótulo de contagem aponta para chave que o relatório emite", () => {
    /**
     * A terceira cópia da decisão: os nomes das contagens vivem no SQL e os
     * rótulos no frontend. Um rótulo órfão é inofensivo; uma chave sem rótulo
     * sai com o nome cru, o que é feio mas honesto. O que esta regra impede é a
     * divergência silenciosa dos dois lados.
     */
    const dpo = semComentariosDeCodigo(ler("src/pages/app/AdminDPO.tsx"), "AdminDPO.tsx");
    const i = dpo.indexOf("const ROTULO_DA_CONTAGEM");
    expect(i, "não achei o mapa de rótulos").toBeGreaterThan(0);
    const rotulos = [...dpo.slice(i, dpo.indexOf("};", i)).matchAll(/^\s{2}(\w+):/gm)]
      .map((m) => m[1]);
    expect(rotulos.length, "o mapa de rótulos está vazio").toBeGreaterThan(8);

    /**
     * Ancorado no bloco de RETORNO, e não no primeiro `'linhas'` do arquivo: a
     * função monta o mesmo objeto duas vezes — uma em `audit_logs.metadata` e
     * uma na resposta. A primeira versão desta regra cortava do primeiro ao
     * `'mantido'`, pegando os dois blocos de uma vez, e acusou nove contagens
     * "sem rótulo" que eram as chaves abreviadas da trilha.
     */
    const sql = ler(MIGRATION);
    const retorno = sql.slice(sql.indexOf("return jsonb_build_object"));
    const bloco = retorno.slice(
      retorno.indexOf("'linhas', jsonb_build_object"),
      retorno.indexOf("'mantido'"),
    );
    const chaves = [...bloco.matchAll(/'(\w+)',\s*_/g)].map((m) => m[1]);
    expect(chaves.length, "não li as chaves de contagem do relatório").toBeGreaterThan(8);

    const orfaos = rotulos.filter((r) => !chaves.includes(r));
    expect(orfaos, `rótulos que o relatório não emite mais: ${orfaos.join(", ")}`).toEqual([]);
    const semRotulo = chaves.filter((c) => !rotulos.includes(c));
    expect(semRotulo, `contagens sem rótulo legível: ${semRotulo.join(", ")}`).toEqual([]);
  });
});
