/// <reference types="node" />
import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * `@/lib/consent` cria o cliente do Supabase no topo do módulo, e a suíte roda
 * sem `.env` de propósito (`envDir` aponta para `src/test/sem-env`, para rodar
 * nas mesmas condições do CI). Sem este duplo, o import morre em
 * "supabaseUrl is required" antes do primeiro caso — mesmo padrão de
 * `SolicitarAcessoForm.test.tsx`.
 *
 * O que esta guarda exercita são as funções PURAS; o caminho que fala com o
 * banco não é testável daqui e não é o que ela afirma cobrir.
 */
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import {
  AVISO_POR_ESTADO, CONSENT_CATALOG, estadoDoConsentimento, textoDoConsentimentoDeIA,
  versaoCobre, versaoDoConsentimento,
} from "@/lib/consent";
import {
  VERSAO_CONSENTIMENTO_IA,
  estadoDoConsentimento as estadoNoServidor,
  versaoCobre as versaoCobreNoServidor,
} from "../../supabase/functions/_shared/consentimentoIA";
import { semComentariosDeCodigo } from "./semComentariosDeCodigo";

/**
 * A versão do consentimento existia para o registro não mentir, e ninguém a lia.
 *
 * ## O defeito, medido no código
 *
 * `user_consents` tem `document_version TEXT NOT NULL DEFAULT '1.0'` desde a
 * primeira migration, `UNIQUE(user_id, consent_type)`, e a coluna é gravada em
 * todo registro. Os dois portões do consentimento de IA liam:
 *
 *     .select("granted, revoked_at")
 *
 * — o do cliente (`hasActiveConsent`) e o do servidor (`clinical-ai`). **A
 * versão não era lida por ninguém.**
 *
 * E o catálogo tem a regra escrita, com o teste que a cobra ao lado:
 *
 *   > "quando o texto de um consentimento muda de significado ele precisa andar
 *   >  por conta: subir a global re-versionaria Termos e Política que não
 *   >  mudaram, e o registro diria que a pessoa aceitou uma revisão que nunca
 *   >  existiu."
 *
 * A versão própria do `ai_processing` foi criada **para o registro não afirmar
 * um aceite que não houve** — e o portão que age sobre o consentimento ignorava
 * a versão. O registro ficou honesto; a decisão, não.
 *
 * ## Por que neste consentimento em particular
 *
 * O texto mudou de sentido. Dizia que os dados iam ao Google "— sem meu nome", e
 * isso era FALSO para um dos dois caminhos: quando o médico anexa o laudo para
 * leitura automática, o arquivo vai inteiro, com nome, data de nascimento e
 * número de registro impressos nele. Quem aceitou o texto antigo concordou com
 * um envio que não é o que acontece — e a LGPD, art. 8º §2º, põe sobre o
 * controlador o ônus de PROVAR o consentimento.
 *
 * ## O segundo defeito: falha de leitura virava "não consentiu"
 *
 * `if (error || !data) return false`. O servidor já havia consertado isso, com
 * o motivo escrito lá: "sem observar o erro, quem consentiu era informado de que
 * não consentiu, e o médico ia procurar na tela de privacidade do paciente uma
 * revogação que nunca houve". O cliente continuava fazendo exatamente isso, e o
 * remédio que oferecia — clicar para consentir — grava um "concedido" novo na
 * trilha de auditoria para um consentimento que nunca foi retirado.
 *
 * ## O terceiro: o muro tinha a sua própria redação, e ela era a frase falsa
 *
 * `ClinicalAIPanel` escrevia, de próprio punho, que os dados vão ao Google "sem
 * o seu nome" — a frase que esta base já identificou como falsa e tirou do
 * catálogo. A guarda proibia `/sem meu nome/` e varria só `src/lib/consent.ts`;
 * o muro dizia "sem o seu nome", quinta cópia do texto, no único lugar onde a
 * pessoa DECIDE. Agora ele renderiza o texto do catálogo — o mesmo que fica
 * registrado.
 *
 * ## Duas implementações, uma tabela de casos
 *
 * A decisão existe duas vezes: `src/lib/consent.ts` e
 * `supabase/functions/_shared/consentimentoIA.ts`. As duas bases não compilam
 * juntas — é o mesmo caso dos nomes de modo da IA —, então a cópia é estrutural.
 * O que não é estrutural é deixá-la divergir: **a mesma tabela de casos roda
 * contra as duas**, e qualquer diferença reprova.
 */

const raiz = resolve(__dirname, "../..");
const ler = (p: string) => readFileSync(resolve(raiz, p), "utf8");
const PAINEL = "src/components/ClinicalAIPanel.tsx";
const FUNCAO = "supabase/functions/clinical-ai/index.ts";

/** As duas implementações da mesma decisão. */
const IMPLEMENTACOES = [
  { nome: "cliente", estado: estadoDoConsentimento, cobre: versaoCobre },
  { nome: "servidor", estado: estadoNoServidor, cobre: versaoCobreNoServidor },
] as const;

const linha = (p: Partial<{ granted: boolean | null; revoked_at: string | null; document_version: string | null }> = {}) => ({
  granted: true, revoked_at: null, document_version: "2.3", ...p,
});

/** A tabela de casos. Roda contra as duas implementações. */
const CASOS: Array<{
  nome: string;
  entrada: Parameters<typeof estadoDoConsentimento>[0];
  estado: string;
}> = [
  {
    nome: "concedido na versão vigente",
    entrada: { linha: linha(), versaoVigente: "2.3" },
    estado: "ok",
  },
  {
    nome: "O DEFEITO: concedido numa versão anterior do texto",
    entrada: { linha: linha({ document_version: "2.2" }), versaoVigente: "2.3" },
    estado: "versao_antiga",
  },
  {
    nome: "concedido na versão padrão da coluna, que é 1.0",
    entrada: { linha: linha({ document_version: "1.0" }), versaoVigente: "2.3" },
    estado: "versao_antiga",
  },
  {
    nome: "versão POSTERIOR cobre a vigente (frontend publicado antes das functions)",
    entrada: { linha: linha({ document_version: "2.4" }), versaoVigente: "2.3" },
    estado: "ok",
  },
  {
    nome: "2.10 é posterior a 2.9 — a comparação é numérica, não alfabética",
    entrada: { linha: linha({ document_version: "2.10" }), versaoVigente: "2.9" },
    estado: "ok",
  },
  {
    nome: "versão nula não prova que cobre o texto de hoje",
    entrada: { linha: linha({ document_version: null }), versaoVigente: "2.3" },
    estado: "versao_antiga",
  },
  {
    nome: "versão ilegível também não prova",
    entrada: { linha: linha({ document_version: "duas ponto três" }), versaoVigente: "2.3" },
    estado: "versao_antiga",
  },
  {
    nome: "sem linha: nunca decidiu",
    entrada: { linha: null, versaoVigente: "2.3" },
    estado: "ausente",
  },
  {
    nome: "revogado, mesmo na versão vigente (LGPD art. 8º §5º)",
    entrada: { linha: linha({ revoked_at: "2026-10-01T00:00:00Z" }), versaoVigente: "2.3" },
    estado: "revogado",
  },
  {
    nome: "revogação pesa mais que versão antiga",
    entrada: {
      linha: linha({ revoked_at: "2026-10-01T00:00:00Z", document_version: "2.2" }),
      versaoVigente: "2.3",
    },
    estado: "revogado",
  },
  {
    nome: "granted false é ausência de consentimento",
    entrada: { linha: linha({ granted: false }), versaoVigente: "2.3" },
    estado: "ausente",
  },
  {
    nome: "O OUTRO DEFEITO: falha de leitura NÃO é ausência de consentimento",
    entrada: { linha: null, erro: { message: "canceling statement due to statement timeout" }, versaoVigente: "2.3" },
    estado: "nao_conferido",
  },
  {
    nome: "falha de leitura pesa mais que qualquer linha que tenha voltado",
    entrada: { linha: linha(), erro: { message: "falhou" }, versaoVigente: "2.3" },
    estado: "nao_conferido",
  },
];

describe("a versão do consentimento decide, nas duas implementações", () => {
  for (const impl of IMPLEMENTACOES) {
    describe(impl.nome, () => {
      for (const caso of CASOS) {
        it(caso.nome, () => {
          expect(impl.estado(caso.entrada as never).estado).toBe(caso.estado);
        });
      }
    });
  }

  it("as duas implementações concordam em TODOS os casos", () => {
    // A regra que impede a cópia de divergir. Acima cada uma é conferida contra
    // o esperado; aqui uma contra a outra, inclusive na versão aceita devolvida.
    for (const caso of CASOS) {
      const a = estadoDoConsentimento(caso.entrada);
      const b = estadoNoServidor(caso.entrada as never);
      expect(b, `cliente e servidor divergem em: ${caso.nome}`).toEqual(a);
    }
  });

  it("`versaoCobre` concorda nas duas, inclusive nos casos de borda", () => {
    const pares: Array<[string | null, string]> = [
      ["2.3", "2.3"], ["2.2", "2.3"], ["2.4", "2.3"], ["2.10", "2.9"], ["2.9", "2.10"],
      ["3", "2.3"], ["2", "2.3"], ["2.3.1", "2.3"], ["2.3", "2.3.1"],
      ["", "2.3"], [null, "2.3"], ["x", "2.3"], ["2.3", "x"], [" 2.3 ", "2.3"],
    ];
    for (const [aceita, vigente] of pares) {
      expect(
        versaoCobreNoServidor(aceita, vigente),
        `divergem em versaoCobre(${JSON.stringify(aceita)}, ${JSON.stringify(vigente)})`,
      ).toBe(versaoCobre(aceita, vigente));
    }
    // E as respostas que dão sentido às outras: igual cobre, anterior não.
    expect(versaoCobre("2.3", "2.3")).toBe(true);
    expect(versaoCobre("2.2", "2.3")).toBe(false);
    expect(versaoCobre("2.10", "2.9")).toBe(true);
    expect(versaoCobre(null, "2.3")).toBe(false);
  });

  it("a versão vigente é a mesma no catálogo e na função", () => {
    /**
     * Terceira cópia da mesma decisão se ninguém conferir: a do catálogo, a da
     * função, e a que a pessoa aceitou. A primeira divergência faria a função
     * recusar quem o cliente diz estar em ordem — ou o contrário, que é pior.
     */
    expect(versaoDoConsentimento("ai_processing")).toBe(VERSAO_CONSENTIMENTO_IA);
    // E o catálogo continua dando versão própria a este consentimento: cair na
    // global faria a conta voltar a ser sobre um texto que não mudou.
    const def = CONSENT_CATALOG.find((c) => c.type === "ai_processing");
    expect(def?.version, "`ai_processing` perdeu a versão própria").toBeTruthy();
  });

  it("os dois portões leem `document_version`", () => {
    // Lido no código, sem comentário: os três arquivos explicam o defeito em
    // prosa, e guarda que lê comentário não confere código.
    const funcao = semComentariosDeCodigo(ler(FUNCAO), FUNCAO);
    expect(funcao, "a função voltou a ler o consentimento sem a versão")
      .toMatch(/select\("granted, revoked_at, document_version"\)/);
    expect(funcao, "a função não usa mais o veredito compartilhado")
      .toMatch(/estadoDoConsentimento\(/);
    const cliente = semComentariosDeCodigo(ler("src/lib/consent.ts"), "consent.ts");
    expect(cliente, "o cliente voltou a ler o consentimento sem a versão")
      .toMatch(/select\("granted, revoked_at, document_version"\)/);
  });

  it("a função recusa a versão antiga com código próprio", () => {
    /**
     * "Nunca consentiu" e "consentiu com outro texto" pedem telas diferentes, e
     * dizer a primeira a quem fez a segunda é o sistema negando uma decisão que
     * a pessoa tomou. O código próprio é o que permite à tela acertar.
     */
    const funcao = semComentariosDeCodigo(ler(FUNCAO), FUNCAO);
    expect(funcao, "a recusa por versão antiga não tem código próprio")
      .toMatch(/error: "consent_outdated"/);
    expect(funcao, "a recusa não diz qual versão foi aceita e qual é a vigente")
      .toMatch(/versao_aceita/);
    // E a recusa continua vindo ANTES de qualquer chamada ao provedor: recusa
    // depois do envio seria decorativa.
    const i = funcao.indexOf('"consent_outdated"');
    const primeira = Math.min(
      ...["callGemini(", "embedQuery("]
        .map((t) => funcao.indexOf(t, funcao.indexOf("Deno.serve")))
        .filter((x) => x > 0),
    );
    expect(i).toBeGreaterThan(0);
    expect(i, "a recusa por versão antiga ficou depois do envio ao provedor").toBeLessThan(primeira);
  });

  it("cada estado tem o seu aviso, e nenhum repete o do vizinho", () => {
    /**
     * Quatro recusas, quatro providências: consentir, consentir de novo, ler o
     * texto novo e confirmar, e tentar outra vez mais tarde. Um texto só para os
     * quatro — que era o estado anterior — manda a pessoa fazer a coisa errada
     * em três deles.
     */
    const estados = ["ausente", "revogado", "versao_antiga", "nao_conferido"] as const;
    const descricoes = new Set<string>();
    for (const e of estados) {
      const aviso = AVISO_POR_ESTADO[e];
      expect(aviso?.titulo, `o estado ${e} não tem aviso`).toBeTruthy();
      expect(aviso.descricao.length, `o aviso de ${e} é curto demais para explicar`).toBeGreaterThan(60);
      descricoes.add(aviso.descricao);
    }
    expect(descricoes.size, "dois estados compartilham a mesma explicação").toBe(estados.length);
    // E o de leitura falha não pode sugerir que faltou consentimento.
    expect(AVISO_POR_ESTADO.nao_conferido.descricao)
      .toMatch(/NÃO quer dizer que o consentimento não exista/);
  });

  it("o muro de consentimento não tem redação própria sobre o envio", () => {
    /**
     * O terceiro defeito. O muro afirmava "sem o seu nome" — a frase falsa que
     * foi tirada do catálogo —, no único lugar onde a pessoa decide.
     *
     * A regra não é "não escreva essa frase": é que o muro RENDERIZE o texto do
     * catálogo. Proibir a frase deixaria a sexta cópia nascer com outras
     * palavras, que é como esta nasceu.
     */
    const painel = semComentariosDeCodigo(ler(PAINEL), PAINEL);
    expect(painel, "o muro não renderiza mais o texto do catálogo")
      .toMatch(/textoDoConsentimentoDeIA\(\)/);
    expect(painel, "o muro voltou a afirmar, por conta própria, que o nome não é enviado")
      .not.toMatch(/sem o seu nome|sem seu nome|sem o nome do paciente/);
    // E o texto do catálogo é o que de fato chega: a função existe e devolve o
    // texto do `ai_processing`, não uma string montada à parte.
    expect(textoDoConsentimentoDeIA()).toBe(
      CONSENT_CATALOG.find((c) => c.type === "ai_processing")?.description,
    );
    expect(textoDoConsentimentoDeIA(), "o texto do catálogo perdeu o aviso do laudo anexado")
      .toMatch(/enviado como está/);
  });

  it("nenhuma tela de IA escreve o próprio texto de recusa", () => {
    /**
     * `DocumentGenerator` tinha o seu: "Ative 'Processamento por IA clínica' em
     * Privacidade e segurança para gerar documentos com IA" — quarta cópia da
     * mesma frase, com outras palavras. Era por isso que elas divergiam.
     */
    const telas = arquivosDe(resolve(raiz, "src"))
      .filter((f) => readFileSync(f, "utf8").includes('invoke("clinical-ai"'));
    expect(telas.length, "não achei as telas da IA para varrer").toBeGreaterThanOrEqual(3);
    for (const f of telas) {
      const t = semComentariosDeCodigo(readFileSync(f, "utf8"), f);
      expect(t, `${f.replace(raiz + "/", "")} escreve o próprio texto de recusa`)
        .not.toMatch(/toast\.error\(\s*"Consentimento necessário"/);
      expect(t, `${f.replace(raiz + "/", "")} não usa os avisos compartilhados`)
        .toMatch(/AVISO_POR_ESTADO/);
    }
  });
});

function arquivosDe(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivosDe(caminho);
    return /\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}
