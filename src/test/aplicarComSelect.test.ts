// Este teste lê o disco; tsconfig.app.json restringe `types`, daí a referência.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Toda escrita que a RLS pode recusar em silêncio encadeia `.select(...)`.
 *
 * ## Duas regras, e o que separa uma da outra
 *
 * A primeira versão deste arquivo cobrava duas coisas: quem passa por
 * `aplicar()` encadeia `.select(...)`, e quem **anuncia** sucesso precisa ter
 * olhado as linhas. A segunda tinha um defeito que só apareceu depois:
 * "anuncia" era uma lista de duas palavras, `toast.success` e `logAudit(`.
 *
 * Quatro escritas anunciavam de outros jeitos e nunca foram olhadas —
 * `toast({ title: "Perfil atualizado" })` da outra biblioteca de toast deste
 * mesmo repositório, `onSuccess: invalidate` do react-query, e uma que não
 * anunciava nada e também não lia o `error`. "46 escritas varridas, 0
 * acusadas" era verdade sobre o vocabulário que a regra conhecia, e é
 * exatamente a forma de relatar sucesso sem ter feito o trabalho — aqui dentro
 * da ferramenta que existe para pegar isso.
 *
 * A regra que ficou é sobre a garantia: **toda** escrita pede as linhas, tenha
 * ou não anúncio, ou está dispensada por escrito. O vocabulário saiu da conta.
 *
 * ## O buraco que o próprio helper documentava
 *
 * `aplicar()` existe porque dez lugares desta base ignoravam o retorno da
 * escrita e emendavam direto no `toast.success` — e, pior, no `logAudit`. Ele
 * trata as DUAS formas de falhar, e a segunda é a que ninguém espera: quando a
 * RLS recusa um UPDATE ou DELETE, o PostgREST responde **200 com `error: null`
 * e zero linhas**. Para ele, alterar nada é sucesso.
 *
 * Só que o helper só enxerga essas zero linhas se o chamador tiver pedido
 * `.select(...)`. Sem isso o `data` vem `undefined`, e o comentário dele diz o
 * que acontece então, com todas as letras:
 *
 *   > "`data` só é undefined quando o chamador não pediu `.select(...)`. Nesse
 *   >  caso não dá para saber quantas linhas mudaram, e o helper não inventa —
 *   >  **segue como sucesso**, que é o que o `error: null` diz."
 *
 * Honesto da parte dele, e é exatamente o ponto: a garantia dependia de cada
 * chamador lembrar. **Cinco não lembravam** — dois `delete` e três `insert`, em
 * `AdminArquivos` e `AdminBiblioteca`. Numa recusa de RLS, o administrador lia
 * "Arquivo removido" com a linha intacta no banco.
 *
 * ## Por que o teste tira os comentários antes de olhar
 *
 * Porque a primeira medição que eu fiz acusou o `CaseTimeline`, que está
 * correto nas três chamadas — o que ela pegou foi a MENÇÃO a `aplicar()` dentro
 * de um comentário que explica por que o `.select` está ali. Guarda que casa
 * com a palavra pune quem documentou a regra, e este repositório já pagou esse
 * preço meia dúzia de vezes.
 *
 * (A mesma medição, antes disso, acusou 21 de 28 — porque eu cortava o
 * argumento no primeiro `{`, que é justamente o objeto do `.update({...})`, e
 * escondia o `.select` que vinha depois. Parser que não equilibra delimitadores
 * não lê código: lê texto.)
 */

const RAIZ = "src";
const HELPER = "src/lib/mutate.ts";
const IGNORAR = new Set(["node_modules", "dist", "coverage"]);

function varrer(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue;
    const full = join(dir, nome);
    if (statSync(full).isDirectory()) varrer(full, out);
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) out.push(full.replace(/\\/g, "/"));
  }
  return out;
}

/** Tira comentários de linha e de bloco, preservando o tamanho das strings. */
export function semComentarios(texto: string): string {
  let fora = "";
  let i = 0;
  let aspa: string | null = null;
  while (i < texto.length) {
    const c = texto[i];
    const prox = texto[i + 1];
    if (aspa) {
      if (c === "\\") { fora += texto.slice(i, i + 2); i += 2; continue; }
      if (c === aspa) aspa = null;
      fora += c; i++; continue;
    }
    if (c === '"' || c === "'" || c === "`") { aspa = c; fora += c; i++; continue; }
    if (c === "/" && prox === "/") { while (i < texto.length && texto[i] !== "\n") i++; continue; }
    if (c === "/" && prox === "*") {
      i += 2;
      while (i < texto.length && !(texto[i] === "*" && texto[i + 1] === "/")) i++;
      i += 2; continue;
    }
    fora += c; i++;
  }
  return fora;
}

/**
 * O PRIMEIRO argumento de cada `aplicar(...)` — equilibrando `()`, `{}`, `[]` e
 * aspas até a vírgula de nível zero. É o encadeamento da escrita; o segundo
 * argumento é o objeto de mensagens e não interessa aqui.
 */
/**
 * Os dois pontos de entrada do helper.
 *
 * `aplicarEmSilencio` nasceu depois desta guarda, e por um descuido meu ela
 * quase não o viu: a busca era `indexOf("aplicar(")`, e em
 * `"aplicarEmSilencio("` a substring `"aplicar("` não existe — depois de
 * `aplicar` vem `E`, não `(`. Quer dizer que o segundo ponto de entrada
 * atravessaria a regra do `.select` sem ser olhado, que é abrir um caminho em
 * volta da guarda ao consertar o defeito que ela guarda.
 *
 * A alternativa mais longa vem primeiro na alternância de propósito.
 */
const CHAMADA_DO_HELPER = /\b(aplicarEmSilencio|aplicar)\s*\(/g;

export function escritasPassadasParaAplicar(texto: string): string[] {
  const limpo = semComentarios(texto);
  const achadas: string[] = [];
  for (const m of limpo.matchAll(CHAMADA_DO_HELPER)) {
    const k = m.index + m[0].length;
    // `function aplicar(` é a definição, não uma chamada.
    if (/\bfunction\s+$/.test(limpo.slice(Math.max(0, m.index - 20), m.index))) continue;

    let nivel = 0;
    let i = k;
    let aspa: string | null = null;
    for (; i < limpo.length; i++) {
      const c = limpo[i];
      if (aspa) {
        if (c === "\\") { i++; continue; }
        if (c === aspa) aspa = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") { aspa = c; continue; }
      if ("({[".includes(c)) nivel++;
      else if (")}]".includes(c)) { if (nivel === 0) break; nivel--; }
      else if (c === "," && nivel === 0) break;
    }
    achadas.push(limpo.slice(k, i));
  }
  return achadas;
}

/**
 * UPDATE, DELETE e UPSERT do Supabase — a classe em que a recusa é silenciosa.
 *
 * Ancorada no encadeamento (`supabase…from("x").update(`) e não no nome do
 * método, porque `.delete(` sozinho casa com `Set.prototype.delete` — e casou,
 * no `CaseLaudoReader`, num `proximo.delete(key)` sobre um Set em memória.
 *
 * INSERT fica de fora, e não por esquecimento: uma inserção recusada pela RLS
 * **levanta** (`new row violates row-level security policy`), então chega como
 * `error` e conferir só o `error` basta. É em UPDATE/DELETE que a RLS filtra as
 * linhas e o PostgREST responde 200 com `error: null` e zero.
 *
 * Conferido contra um detector solto (`/\.(update|upsert|delete)\s*\(/` com
 * `supabase` em até 800 caracteres antes): 46 de 46, nenhuma escrita vista pelo
 * solto e perdida por esta — a âncora não custa alcance.
 */
export const MUTACAO_DE_ESCRITA =
  /\bsupabase\s*(?:\.\w+)*\.from\(\s*"[^"]+"\s*\)\s*\.(update|delete|upsert)\s*\(/gs;

/** O `)` que fecha o `(` de `abertura`, respeitando aspas. */
function fechaParentese(texto: string, abertura: number): number {
  let nivel = 0;
  let aspa: string | null = null;
  for (let i = abertura; i < texto.length; i++) {
    const c = texto[i];
    if (aspa) {
      if (c === "\\") { i++; continue; }
      if (c === aspa) aspa = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { aspa = c; continue; }
    if (c === "(") nivel++;
    else if (c === ")") { nivel--; if (nivel === 0) return i; }
  }
  return -1;
}

/**
 * O encadeamento inteiro a partir da escrita: `.update({…}).eq(…).select("id")`.
 *
 * Lido equilibrando delimitadores em vez de recortar uma janela de N
 * caracteres. A versão por janela desta guarda deixava o alvo escapar quando
 * alguém quebrava a escrita em mais linhas — e guarda que perde o alvo porque
 * o código foi reformatado não guarda nada.
 */
export function encadeamentoDaEscrita(texto: string, inicioDaEscrita: number): string {
  const abre = texto.indexOf("(", inicioDaEscrita);
  let i = fechaParentese(texto, abre);
  if (i < 0) return texto.slice(inicioDaEscrita, inicioDaEscrita + 200);
  i += 1;
  for (;;) {
    const m = /^\s*\.\s*\w+\s*\(/.exec(texto.slice(i, i + 200));
    if (!m) return texto.slice(inicioDaEscrita, i);
    const fecha = fechaParentese(texto, i + m[0].length - 1);
    if (fecha < 0) return texto.slice(inicioDaEscrita, i);
    i = fecha + 1;
  }
}

/**
 * Escrita em que ZERO linhas **não** é falha — uma entrada por sítio, com o
 * custo escrito e um trecho que a identifica.
 *
 * `naCadeia` existe para a dispensa não valer para o arquivo inteiro: o
 * `NovoCaso` tem duas escritas, e a outra — a promoção do rascunho a caso
 * clínico, que é a que importa — confere as linhas. Dispensa por arquivo
 * cobriria a próxima escrita que alguém acrescentasse ali, sem ninguém decidir.
 */
const ZERO_LINHAS_NAO_E_FALHA: { arquivo: string; naCadeia: string; motivo: string }[] = [
  {
    arquivo: "src/components/CaseChat.tsx",
    naCadeia: "read_at",
    motivo:
      "recibo de leitura, marcado num efeito, sem anunciar nada e sem ramo de " +
      "falha. Zero linhas é o caso NORMAL aqui: outro dispositivo já marcou, ou a " +
      "lista chegou com nada por ler. Custo aceito e escrito: uma recusa de RLS " +
      "neste ponto não aparece em lugar nenhum — o que se perde é o recibo, não " +
      "dado clínico, e a próxima renderização tenta de novo.",
  },
  {
    arquivo: "src/pages/app/NovoCaso.tsx",
    naCadeia: 'status", "draft',
    motivo:
      "`persistDraft` grava o rascunho com `.eq(\"status\", \"draft\")` exatamente " +
      "para NUNCA sobrescrever um caso já promovido. Zero linhas é a trava " +
      "funcionando, não a RLS recusando — exigir conferência aqui seria falso " +
      "vermelho no caminho pretendido, e guarda que pune quem fez certo é guarda " +
      "que alguém desliga. Custo conhecido: nesse caminho o indicador mostra " +
      "'salvo' sem ter gravado.",
  },
];

/**
 * A **declaração** do helper de escrita dos testes, não uma menção a ele.
 *
 * Ancorada na coluna 0 (`^`) porque as catorze cópias são funções de topo do
 * arquivo de teste, e porque a primeira versão desta guarda acusou a si mesma:
 * o `indexOf("function escrita(")` casava com a própria string de busca, aqui
 * dentro, indentada dentro do laço. Guarda que se acusa é guarda que ninguém
 * acredita — e é a mesma distinção entre declaração e menção que o teste do
 * `CaseTimeline`, logo abaixo, já cobrava.
 */
const DECLARACAO_DE_ESCRITA = /^function escrita\s*\(/m;

/**
 * O corpo do helper, pulando a lista de parâmetros.
 *
 * O "pulando" é o conserto do segundo falso vermelho desta guarda. A assinatura
 * é `function escrita(resultado: { error: … } | null, afetadas = 1)`: o tipo do
 * primeiro parâmetro é um **objeto literal**, então a primeira `{` depois do
 * nome abre a ANOTAÇÃO DE TIPO, não o corpo. Equilibrando chaves a partir dali,
 * o "corpo" extraído era `{ error: { message: string } | null }` — que
 * naturalmente não define `.select`, e por isso onze arquivos corretos foram
 * acusados de não definir.
 */
export function corpoDoHelperDeEscrita(texto: string): string | null {
  const m = DECLARACAO_DE_ESCRITA.exec(texto);
  if (!m) return null;

  let i = texto.indexOf("(", m.index);
  let parenteses = 0;
  for (; i < texto.length; i++) {
    if (texto[i] === "(") parenteses++;
    else if (texto[i] === ")") { parenteses--; if (parenteses === 0) break; }
  }
  const inicio = texto.indexOf("{", i);
  if (inicio < 0) return null;

  let nivel = 0;
  let k = inicio;
  for (; k < texto.length; k++) {
    if (texto[k] === "{") nivel++;
    else if (texto[k] === "}") { nivel--; if (nivel === 0) break; }
  }
  return texto.slice(inicio, k + 1);
}

/**
 * A única propriedade que este mock não pode perder: **sem `.select(...)` não
 * vem `data`**. É ela que deixa o `aplicar()` separar "a RLS recusou" (200 com
 * zero linhas) de "ninguém pediu as linhas".
 */
export function falhasDoMockDeEscrita(corpo: string): string[] {
  const falhas: string[] = [];
  const ondeSelect = corpo.indexOf(".select");

  if (ondeSelect < 0) {
    // Sem `.select` não há o que separar — e sem este `return` o recorte
    // abaixo viraria `slice(0, -1)`, quase o corpo inteiro, medindo outra coisa.
    return ["não define `.select`"];
  }
  if (/Promise\.resolve\(\s*\{[^}]*\bdata\b/.test(corpo.slice(0, ondeSelect))) {
    falhas.push("a promessa nua já devolve `data`");
  }
  if (!/\.select\s*=/.test(corpo)) {
    falhas.push("cita `.select` mas não o define");
  }
  return falhas;
}

const arquivos = varrer(RAIZ).filter((f) => f !== HELPER);

describe("as escritas que passam por aplicar()", () => {
  it("existem escritas para conferir", () => {
    // Sem isto, renomear o helper deixaria zero iterações e o teste abaixo
    // passaria por não ter olhado nada.
    const total = arquivos.reduce(
      (n, f) => n + escritasPassadasParaAplicar(readFileSync(f, "utf8")).length,
      0,
    );
    expect(total, "nenhuma chamada a aplicar() encontrada em src").toBeGreaterThan(10);
  });

  it("todas encadeiam .select(...)", () => {
    const sem: string[] = [];
    for (const arquivo of arquivos) {
      for (const escrita of escritasPassadasParaAplicar(readFileSync(arquivo, "utf8"))) {
        if (!/\.select\(/.test(escrita)) {
          sem.push(`  · ${arquivo} — ${escrita.replace(/\s+/g, " ").trim().slice(0, 100)}`);
        }
      }
    }

    expect(
      sem,
      `\n${sem.join("\n")}\n\n` +
        "Sem `.select(...)`, o `aplicar()` não recebe as linhas afetadas e NÃO\n" +
        "consegue ver o caso em que a RLS recusa: o PostgREST responde 200 com\n" +
        "`error: null` e zero linhas, e a tela anuncia sucesso sobre uma escrita\n" +
        "que não aconteceu — com `logAudit` em seguida, afirmando na trilha de\n" +
        "conformidade um fato que não ocorreu.\n\n" +
        "Encadeie `.select(\"id\")` no fim da operação.",
    ).toEqual([]);
  });

  it("o helper continua tratando as duas formas de falhar", () => {
    // A regra acima só vale porque o helper faz alguma coisa com as zero linhas.
    // Se ele parar de olhar o `data`, todo `.select` do repositório vira enfeite.
    const helper = readFileSync(HELPER, "utf8");
    expect(helper, "o helper não confere mais o `error`").toMatch(/if \(error\)/);
    expect(
      helper,
      "o helper não trata mais a lista vazia — é o caso da RLS recusando com 200",
    ).toMatch(/Array\.isArray\(data\) && data\.length === 0/);

    /**
     * E os DOIS pontos de entrada passam pela MESMA conferência.
     *
     * `aplicarEmSilencio` nasceu para os casos em que o toast de sucesso é
     * ruído. Se ele conferisse por conta própria, a segunda forma de falhar
     * seria esquecida na segunda cópia — que é precisamente como dez lugares
     * desta base vieram a conferir `error` e nenhum a conferir linhas.
     *
     * Aqui só a estrutura é cobrada; que os vereditos sejam iguais está provado
     * por execução em `mutate.test.ts`, caso por caso.
     */
    const semComent = semComentarios(helper);
    for (const entrada of ["aplicar", "aplicarEmSilencio"]) {
      const i = semComent.indexOf(`export async function ${entrada}(`);
      expect(i, `não achei o ponto de entrada \`${entrada}\``).toBeGreaterThan(0);
      const corpo = semComent.slice(i, i + 600);
      expect(
        corpo,
        `\`${entrada}\` não chama \`conferir\` — a conferência das duas formas de falhar ` +
          "se duplicou, e cópia de decisão divergiu toda vez nesta base",
      ).toMatch(/\bconferir\s*\(/);
    }
  });

  /**
   * E o nível de fora: escrita que anuncia sucesso SEM passar pelo helper.
   *
   * O `.select` obrigatório acima só vale para quem já usa `aplicar()`. Havia
   * dezessete UPDATE/DELETE/UPSERT que nem passavam por ele — conferiam só o
   * `error` e emendavam no `toast.success`, às vezes com `logAudit` junto. Para
   * a recusa de RLS, que chega como 200 com zero linhas, isso é sucesso.
   *
   * Os piores três, e é por eles que esta regra existe:
   *
   *   · `CasoDetalhe` gravava `case_updated` na trilha de auditoria sobre um
   *     caso que não mudou — a trilha afirmando o que não aconteceu;
   *   · `AdminDPO` gravava `dpo_status_updated` sobre um pedido de titular que
   *     seguia no status antigo, com os prazos do art. 18 correndo;
   *   · `PacienteIntegracoes` dizia "Acesso revogado." com a concessão viva — o
   *     paciente acreditando que o hospital perdeu acesso aos dados dele.
   *
   * O décimo sétimo só apareceu quando ESTA regra rodou: a promoção do rascunho
   * a caso clínico, em `NovoCaso`. Minha contagem à mão tinha parado em
   * dezesseis porque a janela que eu usei não alcançava o `toast.success`, vinte
   * linhas abaixo. Contagem à mão erra; regra que roda, não.
   *
   * A regra é a mesma do outro lado da moeda: quem ANUNCIA sucesso precisa ter
   * olhado as linhas. Por `aplicar()` ou conferindo na mão; o caminho não
   * importa, a garantia sim.
   */
  it("nenhuma escrita anuncia sucesso sem ter olhado as linhas", () => {
    // Ancorado no encadeamento do Supabase, e não no nome do método: `.delete(`
    // sozinho casa com `Set.prototype.delete`, e foi o que a versão anterior
    // acusou no `CaseLaudoReader` — um `proximo.delete(key)` num Set.
    //
    // E a janela é larga (1500) porque a estreita tinha o defeito oposto: ao
    // reformatar uma escrita em várias linhas, o `toast.success` saía dela e o
    // site deixava de ser CONFERIDO, em vez de passar conferido. Guarda que
    // perde o alvo quando alguém quebra a linha não guarda nada.
    //
    // Com as duas correções: 46 escritas do Supabase varridas, 0 acusadas.
    //
    // ## O que esta regra NÃO alcança, e por isso existe a regra seguinte
    //
    // O `anuncia` abaixo é uma lista de DUAS palavras. Ela cobria os sítios
    // conhecidos no dia em que foi escrita, e eu só descobri o tamanho do
    // buraco depois: `MedicoPerfil` e `PacientePerfil` anunciavam com
    // `toast({ title: "Perfil atualizado" })` — a OUTRA biblioteca de toast
    // deste mesmo repositório, montada no mesmo `App.tsx` — e as duas gravavam
    // sem conferir linha nenhuma. "46 varridas, 0 acusadas" era verdade sobre
    // as palavras que esta regra conhece.
    //
    // Alargar a lista não resolve: seria a mesma aposta, com mais palavras.
    // `onSuccess:` do react-query também anuncia, e `setSaveStatus("saved")`
    // também. A regra seguinte troca o vocabulário pela garantia.
    const MUTACAO = MUTACAO_DE_ESCRITA;
    const JANELA = 1500;
    const culpadas: string[] = [];

    for (const arquivo of arquivos) {
      const limpo = semComentarios(readFileSync(arquivo, "utf8"));
      for (const m of limpo.matchAll(MUTACAO)) {
        const antes = limpo.slice(Math.max(0, m.index! - 300), m.index!);
        // dentro de um `aplicar(...)`? então a regra de cima já cobre.
        const dentroDeAplicar =
          antes.includes("aplicar(") &&
          antes.lastIndexOf("aplicar(") > Math.max(antes.lastIndexOf(";"), antes.lastIndexOf("}"));
        if (dentroDeAplicar) continue;

        const depois = limpo.slice(m.index! + m[0].length, m.index! + m[0].length + JANELA);
        const anuncia = depois.includes("toast.success") || depois.includes("logAudit(");
        if (!anuncia) continue;

        const janela = limpo.slice(m.index!, m.index! + m[0].length + JANELA);
        const olhouAsLinhas = janela.includes(".select(") && /\blength\b/.test(janela);
        if (olhouAsLinhas) continue;

        const linha = limpo.slice(0, m.index!).split("\n").length;
        culpadas.push(`  · ${arquivo}:${linha}`);
      }
    }

    expect(
      culpadas,
      `\n${culpadas.join("\n")}\n\n` +
        "Esta escrita anuncia sucesso — `toast.success` ou `logAudit` logo depois —\n" +
        "sem ter olhado quantas linhas mudaram.\n\n" +
        "Quando a RLS recusa um UPDATE ou DELETE, o PostgREST devolve 200 com\n" +
        "`error: null` e ZERO linhas: conferir só o `error` lê isso como sucesso.\n" +
        "Com `logAudit` em seguida, a trilha de conformidade passa a afirmar um\n" +
        "fato que não ocorreu — e quem for lê-la depois não tem como saber quais\n" +
        "linhas valem.\n\n" +
        "Passe por `aplicar(<escrita>.select(\"id\"), { sucesso, falha })`.",
    ).toEqual([]);
  });

  /**
   * A mesma regra, agora pela GARANTIA em vez do vocabulário.
   *
   * ## Por que esta regra foi preciso existir
   *
   * A regra acima pergunta "anuncia sucesso?" e só sabe reconhecer dois jeitos
   * de anunciar. Quatro escritas desta base anunciavam de outros jeitos e
   * passaram por ela sem serem olhadas:
   *
   *   · `MedicoPerfil` e `PacientePerfil` — `toast({ title: "Perfil
   *     atualizado", description: "Suas informações foram salvas." })`, a outra
   *     biblioteca de toast, montada no mesmo `App.tsx`;
   *   · `useNotifications.markAsRead` — `onSuccess: invalidate`, sem toast
   *     nenhum: o contador de não-lidas caía na tela com a notificação ainda
   *     por ler no banco. E as DUAS mutações vizinhas, no mesmo arquivo, já
   *     conferiam as linhas, com o motivo escrito ao lado;
   *   · `PacienteMedicacoes.logTake` — não anunciava nada e também não lia o
   *     `error`: o registro de adesão a medicamento sumia em silêncio.
   *
   * O `MedicoPerfil` é o pior dos quatro porque o estado é alcançável de
   * propósito: o gatilho de cadastro só cria a linha de `doctors`
   * `IF v_account_type = 'medico' AND v_meta->>'crm' IS NOT NULL`, e
   * `admin_definir_papel(u, 'medico', true)` concede o papel sem criar linha
   * nenhuma. Nesse estado o UPDATE acerta zero linhas, o médico lê "Suas
   * informações foram salvas", recarrega e o formulário volta vazio.
   *
   * ## A regra
   *
   * Não "quem anuncia precisa ter olhado", que depende de reconhecer o anúncio.
   * **Toda** escrita que a RLS pode recusar em silêncio encadeia `.select(...)`
   * — ou está na lista acima, com o custo escrito.
   *
   * ## O que esta regra NÃO garante, dito em voz alta
   *
   * `.select(...)` torna as linhas PERGUNTÁVEIS; não prova que alguém leu a
   * resposta. Quem lê é o `aplicar()`/`aplicarEmSilencio()` — e aí vale o teste
   * de unidade deles — ou o próprio chamador, nos cinco sítios que conferem na
   * mão (`CaseAppointments`, `CaseDocuments`, `NovoCaso` na promoção e as três
   * mutações de `useNotifications`). O que esta regra fecha é o caso em que
   * conferir era IMPOSSÍVEL, porque ninguém pediu as linhas. Guarda cujo nome
   * promete mais do que ela confere é pior que nenhuma.
   */
  it("toda escrita que a RLS pode recusar em silêncio pede as linhas", () => {
    const sem: string[] = [];
    const dispensasUsadas = new Set<number>();
    const raizes = new Set<string>();
    let total = 0;

    for (const arquivo of arquivos) {
      const limpo = semComentarios(readFileSync(arquivo, "utf8"));
      for (const m of limpo.matchAll(MUTACAO_DE_ESCRITA)) {
        total++;
        raizes.add(arquivo.split("/")[1] ?? arquivo);
        const cadeia = encadeamentoDaEscrita(limpo, m.index);
        if (/\.select\s*\(/.test(cadeia)) continue;

        const dispensa = ZERO_LINHAS_NAO_E_FALHA.findIndex(
          (d) => d.arquivo === arquivo && cadeia.includes(d.naCadeia),
        );
        if (dispensa >= 0) { dispensasUsadas.add(dispensa); continue; }

        const linha = limpo.slice(0, m.index).split("\n").length;
        /**
         * Se o arquivo TEM dispensa declarada e ela não casou, diga isso.
         *
         * Sem esta linha a mensagem manda a pessoa para a caça errada: a
         * inversão em que eu troquei o `naCadeia` do `CaseChat` por um trecho
         * inexistente reprovou aqui, acusando "o `CaseChat` não pede as linhas"
         * — sobre um sítio que está dispensado de propósito. O veredito estava
         * certo; o texto, não.
         */
        const declarada = ZERO_LINHAS_NAO_E_FALHA.find((d) => d.arquivo === arquivo);
        const nota = declarada
          ? ` (há dispensa para este arquivo, mas o trecho "${declarada.naCadeia}" não casa com esta cadeia)`
          : "";
        sem.push(`  · ${arquivo}:${linha}${nota} — ${cadeia.replace(/\s+/g, " ").slice(0, 110)}`);
      }
    }

    // Pisos. Não "46", que é o número de hoje: apagar um componente apaga as
    // escritas dele, e guarda que reprova quem removeu código legítimo é guarda
    // que alguém desliga. O que estes dois pegam é a varredura que deixou de
    // casar com tudo e passou a conferir quase nada.
    expect(total, "a varredura achou pouca escrita — o detector pode ter parado de casar")
      .toBeGreaterThanOrEqual(30);
    expect(
      [...raizes].sort(),
      "a varredura ficou presa a um diretório de `src/` — regra amarrada à pasta onde " +
        "o defeito apareceu é o próprio defeito, e esta base já pagou por isso",
    ).not.toHaveLength(1);

    expect(
      sem,
      `\n${sem.join("\n")}\n\n` +
        "Esta escrita não pede as linhas afetadas, então NINGUÉM — nem o helper,\n" +
        "nem o chamador — tem como saber se ela aconteceu.\n\n" +
        "Quando a RLS recusa um UPDATE ou DELETE, o PostgREST responde 200 com\n" +
        "`error: null` e ZERO linhas: para ele, alterar nada é sucesso. A tela\n" +
        "segue em frente anunciando o que quer que anuncie — um toast, um\n" +
        "`onSuccess`, um contador que zera — sobre uma escrita que não ocorreu.\n\n" +
        'Encadeie `.select("id")` e passe por `aplicar(...)` ou\n' +
        "`aplicarEmSilencio(...)`. Se zero linhas aqui NÃO for falha, declare o\n" +
        "sítio em `ZERO_LINHAS_NAO_E_FALHA` com o motivo e o custo escritos.",
    ).toEqual([]);

    const velhas = ZERO_LINHAS_NAO_E_FALHA
      .filter((_, i) => !dispensasUsadas.has(i))
      .map((d) => `  · ${d.arquivo} — trecho "${d.naCadeia}"`);
    expect(
      velhas,
      `\n${velhas.join("\n")}\n\n` +
        "Esta dispensa não casa com escrita nenhuma. Ou o sítio foi consertado — e\n" +
        "aí a dispensa some —, ou ele mudou de forma e deixou de ser o que foi\n" +
        "dispensado. Dispensa que sobrevive ao seu motivo é a regra se afrouxando\n" +
        "sem ninguém decidir.",
    ).toEqual([]);
  });

  it("a dispensa é estreita: não cobre a outra escrita do mesmo arquivo", () => {
    /**
     * A inversão que importa na lista de dispensas. `NovoCaso` tem duas
     * escritas: o autossalvamento do rascunho (dispensado, porque o
     * `.eq("status","draft")` faz de zero linhas a trava funcionando) e a
     * promoção a caso clínico, que é a escrita que importa e confere as linhas.
     *
     * Chaveando a dispensa por ARQUIVO, tirar o `.select` da promoção passaria
     * em silêncio — a dispensa do vizinho cobriria o defeito.
     */
    const rascunho = 'supabase.from("clinical_cases").update(p).eq("id", d).eq("status", "draft" as any)';
    const promocao = 'supabase.from("clinical_cases").update(p).eq("id", caseId)';
    const dispensa = ZERO_LINHAS_NAO_E_FALHA.find((d) => d.arquivo === "src/pages/app/NovoCaso.tsx")!;

    expect(dispensa, "a dispensa do rascunho desapareceu").toBeDefined();
    expect(rascunho.includes(dispensa.naCadeia), "a dispensa não reconhece o rascunho").toBe(true);
    expect(
      promocao.includes(dispensa.naCadeia),
      "a dispensa do rascunho também cobre a promoção do caso — é dispensa larga demais",
    ).toBe(false);
  });

  it("o encadeamento é lido por delimitador, não por janela", () => {
    // O `.select` vem depois de um objeto com chaves aninhadas e de uma quebra
    // de linha: recortar uma janela de N caracteres, ou parar na primeira `{`,
    // esconde-o — e foi assim que uma versão anterior desta família acusou 21
    // arquivos corretos de 28.
    const texto = [
      "const r = await supabase",
      '  .from("clinical_cases")',
      "  .update({",
      "    campo: 1,",
      "    outro: { aninhado: { fundo: true } },",
      "  })",
      '  .eq("id", caseId)',
      '  .select("id");',
    ].join("\n");
    const [m] = [...texto.matchAll(MUTACAO_DE_ESCRITA)];
    expect(m, "o detector não viu a escrita").toBeDefined();
    const cadeia = encadeamentoDaEscrita(texto, m.index);
    expect(cadeia, "não chegou ao fim do encadeamento").toContain('.select("id")');

    // E o outro lado: sem `.select`, a cadeia não pode inventá-lo — e não pode
    // invadir a instrução seguinte, que é onde um `.select` alheio moraria.
    const semSelect = [
      'await supabase.from("notifications").update({ read: true }).eq("id", id);',
      'const outra = await supabase.from("x").select("id");',
    ].join("\n");
    const [n] = [...semSelect.matchAll(MUTACAO_DE_ESCRITA)];
    const cadeiaCurta = encadeamentoDaEscrita(semSelect, n.index);
    expect(/\.select\s*\(/.test(cadeiaCurta), "capturou o `.select` da instrução seguinte").toBe(false);
  });

  /**
   * Os catorze mocks de escrita dos testes modelam a MESMA distinção.
   *
   * O helper `escrita()` aparece copiado em catorze arquivos de teste, em cinco
   * variantes — não por desleixo: o `vi.mock` é içado, e uma função importada de
   * fora não está inicializada quando a fábrica do mock roda.
   *
   * Conferido: as cinco variantes de hoje estão corretas. O risco não é o que
   * existe, é a próxima cópia — e eu mesmo escrevi uma errada nesta rodada, que
   * devolvia `data` sem `.select()` e fazia a inversão PASSAR, provando o
   * contrário do que eu queria.
   *
   * A propriedade que não pode se perder é uma só: **sem `.select(...)` não vem
   * `data`**. É ela que deixa o `aplicar()` distinguir "a RLS recusou" (200 com
   * zero linhas) de "ninguém pediu as linhas". Um mock que devolvesse `data` nos
   * dois casos faz a conferência passar vazia — e o teste fica verde sobre nada.
   */
  it("todo mock de escrita separa o `data` do `.select`", () => {
    const arquivosDeTeste: string[] = [];
    const varrerTestes = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        if (IGNORAR.has(nome)) continue;
        const full = join(dir, nome);
        if (statSync(full).isDirectory()) varrerTestes(full);
        else if (/\.test\.tsx?$/.test(nome)) arquivosDeTeste.push(full.replace(/\\/g, "/"));
      }
    };
    varrerTestes(RAIZ);

    const ruins: string[] = [];
    let copias = 0;
    for (const arquivo of arquivosDeTeste) {
      const corpo = corpoDoHelperDeEscrita(readFileSync(arquivo, "utf8"));
      if (corpo === null) continue;
      copias++;
      for (const falha of falhasDoMockDeEscrita(corpo)) {
        ruins.push(`  · ${arquivo} — ${falha}`);
      }
    }

    // São catorze hoje. O piso é dez, e não catorze, porque apagar um
    // componente apaga o teste dele junto — e guarda que reprova quem fez certo
    // é guarda que alguém desliga. Dez ainda pega o que realmente importa: um
    // detector que deixou de casar com tudo e passou a varrer nada.
    expect(copias, "a varredura encolheu — poucas cópias do helper encontradas")
      .toBeGreaterThanOrEqual(10);
    expect(
      ruins,
      `\n${ruins.join("\n")}\n\n` +
        "Um mock de escrita precisa separar os dois casos, como o cliente real:\n" +
        "  · aguardado direto  → devolve só { error }\n" +
        "  · com `.select(...)` → devolve { data, error }\n\n" +
        "Modelando os dois iguais, a conferência de linhas do `aplicar()` passa\n" +
        "sem ninguém ter pedido as linhas — e o teste fica verde sobre nada.",
    ).toEqual([]);
  });

  /**
   * As três inversões da guarda acima, e a regressão do falso vermelho.
   *
   * O mock bom é escrito em linhas separadas de propósito: se a declaração
   * `function escrita(` ficasse na coluna 0 dentro de um template literal, ela
   * estaria na coluna 0 deste arquivo também — e a varredura de disco acharia
   * a PRÓPRIA FIXTURE, exatamente o erro que a âncora `^` veio consertar.
   */
  const MOCK_BOM = [
    "function escrita(resultado: { error: { message: string } | null }, afetadas = 1) {",
    "  const p: any = Promise.resolve(resultado);",
    "  p.select = () =>",
    "    Promise.resolve({",
    "      data: resultado.error ? [] : Array.from({ length: afetadas }, () => ({ id: 'r' })),",
    "      error: resultado.error,",
    "    });",
    "  return p;",
    "}",
  ].join("\n");

  it("o corpo extraído pula a anotação de tipo do parâmetro", () => {
    // O falso vermelho que esta guarda produziu na primeira tentativa: onze
    // arquivos CORRETOS acusados de "não define `.select`", porque a primeira
    // `{` depois do nome abre o tipo do parâmetro, não o corpo. O corpo
    // extraído era `{ error: { message: string } | null }` — e nele, de fato,
    // não há `.select` nenhum.
    const corpo = corpoDoHelperDeEscrita(MOCK_BOM);
    expect(corpo, "não achou a declaração do helper").not.toBeNull();
    expect(corpo, "extraiu a anotação de tipo em vez do corpo").toContain("p.select =");
    expect(corpo!.startsWith("{\n  const p")).toBe(true);
    expect(falhasDoMockDeEscrita(corpo!), "acusou um mock correto").toEqual([]);
  });

  it("acusa a promessa nua que já devolve `data`", () => {
    // O defeito de verdade: modelando os dois casos iguais, `aplicar()` recebe
    // uma lista vazia sem ninguém ter pedido `.select(...)`, e a conferência de
    // linhas passa sobre nada.
    const corpo = corpoDoHelperDeEscrita(
      MOCK_BOM.replace("Promise.resolve(resultado)", "Promise.resolve({ ...resultado, data: [] })"),
    );
    expect(falhasDoMockDeEscrita(corpo!)).toEqual(["a promessa nua já devolve `data`"]);
  });

  it("acusa o mock que não define `.select`", () => {
    const corpo = corpoDoHelperDeEscrita(
      [
        "function escrita(resultado: { error: { message: string } | null }) {",
        "  return Promise.resolve(resultado);",
        "}",
      ].join("\n"),
    );
    expect(falhasDoMockDeEscrita(corpo!)).toEqual(["não define `.select`"]);
  });

  it("acusa o mock que cita `.select` sem atribuí-lo", () => {
    // A forma sutil: o `.select` aparece no corpo — num comentário, ou numa
    // chamada — mas nada o instala na promessa, então o encadeamento do código
    // de produção estouraria. Sem esta regra, o recorte `slice(0, ondeSelect)`
    // ainda mediria alguma coisa e a guarda passaria.
    const corpo = corpoDoHelperDeEscrita(
      [
        "function escrita(resultado: { error: { message: string } | null }) {",
        "  // o cliente real responde ao .select com data",
        "  return Promise.resolve(resultado);",
        "}",
      ].join("\n"),
    );
    expect(falhasDoMockDeEscrita(corpo!)).toEqual(["cita `.select` mas não o define"]);
  });

  it("a declaração do helper é distinguida da menção a ele", () => {
    // A guarda acusando a si mesma foi o primeiro falso vermelho: o
    // `indexOf("function escrita(")` casava com a própria string de busca deste
    // arquivo. Menção indentada não é declaração.
    const mencao = '      const i = texto.indexOf("function escrita(");';
    expect(corpoDoHelperDeEscrita(mencao), "confundiu a menção com a declaração").toBeNull();
  });

  it("o detector não confunde menção em comentário com chamada", () => {
    // A contraprova, e o falso vermelho que ela evita: o `CaseTimeline` explica
    // num comentário por que usa `aplicar()`, e a primeira medição o acusou.
    const comComentario = [
      "// a escrita passa por `aplicar()`: uma recusa de RLS devolve 200",
      '/* exemplo: aplicar(supabase.from("x").update({}), { … }) */',
      'const ok = await aplicar(supabase.from("x").update({ a: 1 }).eq("id", i).select("id"), m);',
    ].join("\n");
    expect(
      escritasPassadasParaAplicar(comComentario),
      "contou a menção em comentário como chamada",
    ).toHaveLength(1);

    // E o outro lado: uma chamada de verdade sem `.select` tem de ser vista.
    const semSelect = 'await aplicar(supabase.from("x").delete().eq("id", i), { sucesso: "a", falha: "b" });';
    const achadas = escritasPassadasParaAplicar(semSelect);
    expect(achadas).toHaveLength(1);
    expect(/\.select\(/.test(achadas[0]), "não viu a falta do .select").toBe(false);
  });

  it("não confunde Set.delete com escrita no banco", () => {
    // O falso positivo que a janela larga revelou: `proximo.delete(key)` num
    // `Set`, no `CaseLaudoReader`, com um `logAudit` legítimo mais abaixo na
    // mesma função. Sem a âncora no `supabase.from(...)`, a guarda mandava
    // conferir linhas de uma estrutura de dados em memória.
    const MUTACAO = MUTACAO_DE_ESCRITA;
    const doSet = "const proximo = new Set(antes); proximo.delete(key); logAudit('x', 'y', 'z');";
    expect([...doSet.matchAll(MUTACAO)], "confundiu Set.delete com escrita").toHaveLength(0);

    const doBanco = 'await supabase.from("clinical_cases").delete().eq("id", i); toast.success("ok");';
    expect([...doBanco.matchAll(MUTACAO)], "não viu a escrita de verdade").toHaveLength(1);
  });

  it("o detector equilibra as chaves do objeto escrito", () => {
    // O erro que me deu 21 de 28 na primeira medição: cortar o argumento no
    // primeiro `{` esconde o `.select` que vem DEPOIS do objeto do update.
    const multilinha = [
      "await aplicar(",
      '  supabase.from("x").update({',
      "    campo: 1,",
      "    outro: { aninhado: true },",
      '  }).eq("id", i).select("id"),',
      '  { sucesso: "a", falha: "b" },',
      ");",
    ].join("\n");
    const [escrita] = escritasPassadasParaAplicar(multilinha);
    expect(escrita, "não chegou até o fim do encadeamento").toContain('.select("id")');
    expect(escrita, "invadiu o segundo argumento").not.toContain("sucesso");
  });
});
