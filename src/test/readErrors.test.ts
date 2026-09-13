// Este teste lê o disco; tsconfig.app.json restringe `types`, daí a referência.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { statSync } from "node:fs";
import {
  encontrarCegas, padraoDeDestino, arrayObservaTodosOsErros, itensDoArray,
} from "./detectorDeChamadasCegas";

/**
 * Guarda contra falha de LEITURA lida como conclusão.
 *
 * ## Por que um segundo arquivo, se já existe o `writeErrors.test.ts`
 *
 * Porque aquele varre `insert|update|upsert|delete` — só escrita. Nada cobria
 * leitura, e o vão era grande: **75 leituras** descartavam o `error` quando esta
 * varredura rodou pela primeira vez.
 *
 * A escrita cega mente sobre o passado ("salvei", quando não salvou). A leitura
 * cega é pior, porque mente sobre o **estado do paciente**. O cliente do
 * Supabase devolve `{ data: null, error }`; quem escreve `data ?? []` transforma
 * recusa de RLS e queda de rede em lista vazia — e a tela imprime a lista vazia
 * como fato:
 *
 *   · "Acessos ativos (0)" na tela de LGPD, com uma concessão vigente;
 *   · um PDF de prontuário sem a seção "Medicações ativas", lido depois, fora do
 *     aplicativo, como paciente sem anticoagulação;
 *   · "Nenhum compromisso futuro agendado" numa agenda que não carregou;
 *   · "Paciente não encontrado ou sem vínculo" — uma afirmação sobre o vínculo
 *     tirada de uma falha de rede.
 *
 * ## Duas exigências diferentes, de propósito
 *
 * Consertar as 75 de uma vez seria consertar mal. Então a guarda tem dois níveis:
 *
 *   1. **`SEM_TOLERANCIA`** — arquivos onde a falha vira conclusão clínica ou
 *      garantia de privacidade. Zero leituras cegas, sempre. Estes já foram
 *      corrigidos e não podem regredir.
 *   2. **A catraca** — no resto do projeto o número conhecido só pode cair.
 *      Uma leitura cega nova reprova; consertar as antigas nunca reprova.
 *
 * Catraca é confissão, não absolvição: o número abaixo é dívida declarada, com
 * a lista dos arquivos onde ela está.
 */

const RAIZ = "src";

/**
 * Arquivos onde ler errado muda conduta ou quebra promessa de privacidade.
 * Entrar nesta lista significa: nenhuma leitura cega, nem uma.
 */
const SEM_TOLERANCIA = [
  "src/pages/app/MedicoPacienteDetalhe.tsx",  // alimenta o PDF do prontuário
  "src/pages/app/PacienteIntegracoes.tsx",    // quem tem acesso aos meus dados
  "src/pages/app/HospitalPortal.tsx",         // o outro lado do mesmo consentimento

  // Promovidos em 06/09, depois de zerados. A razão de promover, e não deixar
  // sob o contador: o contador impede a dívida de CRESCER, mas quem topar com
  // ele tem uma saída — subir `DIVIDA_CONHECIDA` em um. Nestes arquivos essa
  // saída não pode existir, porque aqui a falha de leitura não deixa a tela
  // incompleta: deixa a tela AFIRMANDO o contrário do que existe.
  "src/components/PatientSymptomsViewer.tsx", // "sem sintomas" decide intervenção
  "src/pages/app/CasoDetalhe.tsx",            // o PDF do caso e quem pode comentar
  "src/lib/homeDoUsuario.ts",                 // para qual área a pessoa vai ao entrar
  "src/components/PrivacyPreferencesPanel.tsx", // o que o titular consentiu
  "src/components/CaseCollaborators.tsx",     // "médico não encontrado" quando existe
];

/**
 * Quantas leituras cegas o projeto ainda tem fora da lista acima.
 *
 * Só pode cair. Quando chegar a zero, esta constante sai e a exigência passa a
 * valer para o projeto inteiro.
 *
 * O número já nasceu corrigido uma vez: com o detector frouxo eram 56, com o
 * detector que amarra o `error` à variável são 60. Não é dívida nova — são
 * quatro que estavam escondidas atrás de um `error` que pertencia a outra coisa.
 *
 * Histórico da queda, para o número não virar folclore:
 *
 *   60 → 58  duas leituras de `PacienteAprender.tsx`, que transformavam falha
 *            de rede em "seu médico ainda não registrou nenhum caso";
 *   58 → 55  `MedicoAgenda` e `ListaCasos`;
 *   55 → 49  as sete de `MedicoRelatorios`, MAIS seis falsos positivos que o
 *            próprio detector criava: ele acusava
 *            `const [{ data, error }, { data, error }] = await Promise.all(…)`
 *            — código correto — porque a regra 1 exigia que o padrão começasse
 *            com `{`. Junto veio o falso NEGATIVO gêmeo, que era o grave: o
 *            mesmo padrão quebrado em várias linhas não casava com regex
 *            nenhuma e era absolvido como "resultado descartado de propósito".
 *   49 → 40  as telas do PACIENTE sobre ele mesmo. A pior era
 *            `PacientePerfil`: o formulário abria em branco com o botão Salvar
 *            ativo, e um clique gravava nome, telefone, data de nascimento e
 *            comorbidades VAZIOS por cima do cadastro real. Não era tela
 *            mostrando menos do que existe — era perda de dado. Junto,
 *            `PacienteHome` dizendo "Você ainda não vinculou um médico" a quem
 *            tem, e `PacienteJornada` mostrando "Nenhum caso clínico ainda"
 *            porque o `try/catch` que já existia nunca via falha (o cliente do
 *            Supabase não lança, devolve `{ data: null, error }`).
 */
// 60 → 58 → 55 → 49 → 40 → 29 → 18 → 2.
//
// ## As duas que sobraram são FALSOS POSITIVOS, e ficam
//
// `AdminUsuarios.tsx:88` e `:102` passam a chamada como argumento para o helper
// `executar`, que faz `const { error } = await chamada` e mostra o erro em
// toast. O erro É observado — uma função adiante. O detector não atravessa
// fronteira de função, e não vai atravessar: tentar isso por texto é como o
// detector já errou dos dois lados uma vez.
//
// Poderia zerar o número abrindo uma exceção nominal para esses dois. Não abri:
// lista de exceção envelhece, e um zero comprado com isenção mente mais do que
// um dois explicado. Fica 2, e fica escrito por quê.
//
// ## As três rodadas que trouxeram de 40 até aqui zeraram estes arquivos
// arquivos, todos escolhidos por consequência e não por facilidade:
//
//   · `MedicoHome.tsx` (4) — a primeira tela depois de entrar. O `?? 0` fazia
//     ela dizer "0 pacientes, 0 casos, 0 em acompanhamento" a quem tem;
//   · `MedicoPacientes.tsx` (3) — "Nenhum paciente vinculado", com o convite a
//     divulgar o CRM, a um médico cujos vínculos não puderam ser lidos;
//   · `MedicoColaboracoes.tsx` (4) — "Nenhum convite ainda" a quem foi
//     convidado: o colega parece não ter chamado, ou ter retirado o convite.
//
// E antes delas:
//
//   · `CasoDetalhe.tsx` (7) — a pior era o `handleExport`. Quatro leituras num
//     `Promise.all` sem observar erro, e o `|| []` logo abaixo transformava
//     falha em seção vazia: o PDF do caso saía COM CARA DE COMPLETO. Um caso
//     sem eventos e um caso cujos eventos não puderam ser lidos viravam o mesmo
//     documento — e PDF é impresso, anexado, mandado ao colega. Agora não
//     exporta: documento clínico incompleto é pior que documento nenhum.
//   · `homeDoUsuario.ts` (4) — as quatro decidem PARA ONDE a pessoa vai depois
//     de "Entrar". `profiles` falhando mandava MÉDICO PARA A ÁREA DO PACIENTE,
//     onde ele não vê nenhum caso seu e conclui que perdeu o cadastro.
//
// E uma lição sobre a própria varredura: a primeira versão do conserto do
// `homeDoUsuario` pôs um comentário de quinze linhas entre a leitura e a
// checagem. A varredura olha oito linhas depois do statement, então continuou
// contando como cega — com o conserto já escrito logo abaixo. Explicação antes
// do código, checagem colada nele.
// ## O que este número NÃO garante
//
// Descoberto invertendo esta rodada: apaguei o `if (erroPaciente) throw` de uma
// leitura já corrigida e a guarda continuou verde. O detector cobra que o
// `error` seja DESESTRUTURADO junto da chamada — observado —, não que alguém
// faça algo com ele. Tirar a ação e deixar a observação passa.
//
// Não é frouxidão a corrigir aqui: separar "leu o erro e tratou" de "leu o erro
// e engoliu" exige entender o fluxo depois da leitura, e um detector que tenta
// isso por texto erra dos dois lados — que é o defeito que estes testes já
// tiveram uma vez. O que dá para fazer é dizer a verdade sobre o alcance: este
// número mede quantas leituras ignoram o erro POR COMPLETO. É o piso, não o
// teto, e a inversão de cada conserto tem de tirar a desestruturação inteira
// para valer alguma coisa.
const DIVIDA_CONHECIDA = 2;

/**
 * A varredura em si mora em `detectorDeChamadasCegas.ts`, compartilhada com a
 * guarda das edge functions. Duas cópias divergem — esta base já pagou por isso.
 *
 * Em `src` o cliente é sempre `supabase`, importado de um módulo só, então o
 * nome é fixo. Nas functions ele se chama `admin` na maioria dos arquivos, e lá
 * a descoberta é pelo `createClient`.
 */
const cegas = encontrarCegas({ raiz: RAIZ, nomesDoCliente: () => ["supabase"] });

const foraDaLista = cegas.filter((c) => !SEM_TOLERANCIA.includes(c.split(":")[0]));
const naLista = cegas.filter((c) => SEM_TOLERANCIA.includes(c.split(":")[0]));

describe("leituras que viram conclusão", () => {
  it("nos arquivos onde ler errado muda conduta, nenhuma leitura ignora o erro", () => {
    expect(
      naLista,
      `\n${naLista.join("\n")}\n\n` +
        "Nestes arquivos a falha de leitura chega ao médico ou ao paciente como\n" +
        "afirmação: 'sem medicação', 'nenhum acesso ativo', 'sem vínculo'. Observe\n" +
        "o `error` e diga na tela que não foi possível ler — nunca deixe a lista\n" +
        "vazia falar pela falha.",
    ).toEqual([]);
  });

  it("a dívida do resto do projeto não cresce", () => {
    expect(
      foraDaLista.length,
      `\nLeituras cegas fora da lista sem tolerância: ${foraDaLista.length} (conhecidas: ${DIVIDA_CONHECIDA})\n\n` +
        foraDaLista.join("\n") +
        "\n\nSe o número SUBIU, uma leitura nova está descartando o erro.\n" +
        "Se CAIU, obrigado — baixe a constante DIVIDA_CONHECIDA para o novo valor.",
    ).toBeLessThanOrEqual(DIVIDA_CONHECIDA);
  });

  it("a lista sem tolerância aponta para arquivos que existem", () => {
    // Sem isto, renomear um arquivo esvaziaria a exigência em silêncio — a
    // lista continuaria "passando" por não encontrar nada.
    for (const caminho of SEM_TOLERANCIA) {
      expect(() => statSync(caminho), `SEM_TOLERANCIA aponta para ${caminho}`).not.toThrow();
    }
  });

  it("a varredura enxerga uma leitura cega de verdade", () => {
    // A contraprova da própria guarda. Um detector que não acha nada passaria
    // com o projeto inteiro corrigido e com o projeto inteiro quebrado.
    // Aqui se cobra que o mecanismo ainda encontra o padrão que ele procura.
    expect(
      cegas.length,
      "a varredura não achou NENHUMA leitura cega — provavelmente o detector quebrou",
    ).toBeGreaterThan(0);
  });
});

/**
 * O detector, conferido nas duas direções.
 *
 * Estes testes existem porque o detector errou dos DOIS lados de uma vez, e os
 * dois erros são invisíveis olhando só o total: o falso positivo enche a dívida
 * de código correto (e convida a desligar a guarda), e o falso negativo abaixa
 * a dívida sem ninguém ter consertado nada — que é a mentira que esta sessão
 * inteira persegue.
 *
 * Um teste do TOTAL não pega nenhum dos dois. Estes pegam.
 */
describe("as duas peças do detector", () => {
  it("acha o padrão de destino mesmo quebrado em várias linhas", () => {
    // Este era o falso negativo: nenhuma linha sozinha casava, e a varredura
    // concluía "resultado descartado de propósito" — absolvendo uma leitura
    // cega de verdade.
    const texto = "const [\n  { data: p },\n  { data: q },\n] = await Promise.all([";
    expect(padraoDeDestino(texto)).toBe("[\n  { data: p },\n  { data: q },\n]");
  });

  it("pega a última declaração, não a primeira", () => {
    // A chamada pertence à declaração mais próxima acima dela.
    const texto = "const { data: outro, error: e } = await x;\nconst { data } = await supabase";
    expect(padraoDeDestino(texto)).toBe("{ data }");
  });

  it("não confunde `const x;` com atribuição", () => {
    expect(padraoDeDestino("const nada;\nfoo()")).toBeNull();
    expect(padraoDeDestino("nada aqui")).toBeNull();
  });

  it("só absolve o array quando TODOS os itens observam o erro", () => {
    // A regra frouxa — "algum item confere" — não muda o total de hoje, porque
    // não existe esse padrão misto no projeto agora. Um teste do total passaria
    // com ela, e a primeira leitura cega escrita nesse formato entraria
    // absolvida. Por isso a regra é cobrada aqui, direto.
    expect(arrayObservaTodosOsErros("[{ data: a, error: e }, { data: b, error: f }]")).toBe(true);
    expect(
      arrayObservaTodosOsErros("[{ data: a, error: e }, { data: b }]"),
      "um item cego ao lado de um correto foi absolvido",
    ).toBe(false);
    expect(arrayObservaTodosOsErros("[{ data: a }, { data: b }]")).toBe(false);
    // Array de nomes simples não é este caso — cai na regra do `<nome>.error`.
    expect(arrayObservaTodosOsErros("[um, dois]")).toBe(false);
  });

  it("separa os itens do array sem se perder no aninhamento", () => {
    // A vírgula de dentro de `{ data: a, error: e }` não é separador de item.
    expect(itensDoArray("[{ data: a, error: e }, { data: b, error: f }]")).toEqual([
      "{ data: a, error: e }",
      "{ data: b, error: f }",
    ]);
    expect(itensDoArray("[um, dois]")).toEqual(["um", "dois"]);
  });
});
