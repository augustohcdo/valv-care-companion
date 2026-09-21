/// <reference types="node" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

/**
 * NENHUMA tela de `/app/` afirma ausência enquanto ainda está lendo.
 *
 * ## O terceiro estado
 *
 * Este repositório já tem duas varreduras sobre o que as telas dizem quando a
 * leitura **falha**: `telasReconhecemFalha.test.tsx` (ninguém cala) e
 * `telasComLeituraFalhando.test.tsx` (quem fala, fala direito). As duas nasceram
 * do mesmo princípio: "não consegui ler" é diferente de "não tem nada".
 *
 * Falta o terceiro estado, e ele é o mais frequente dos três — acontece em toda
 * abertura de tela, não só quando algo dá errado: **ainda não sei**.
 *
 * Com as consultas pendentes, 4 telas de 38 afirmavam ausência:
 *
 *   · `PacienteHome` — "Nenhum médico vinculado" no selo mais visível da tela,
 *     e "Você ainda não vinculou um médico" com o convite para vincular. Dito
 *     a quem já tem médico, é a tela pedindo que ele conserte o que não está
 *     quebrado;
 *   · `MedicoAgenda` — "Nenhum compromisso neste dia" a quem está planejando o
 *     dia. E a prova do padrão está no mesmo arquivo: o cartão "Próximos
 *     compromissos", logo abaixo, já tratava os TRÊS estados com a mesma
 *     variável `loading`. Um painel tinha três, o outro tinha dois;
 *   · `PacienteIntegracoes` — "Acessos ativos (0)", "Dados recebidos (0)" e
 *     "Nenhum acesso ativo", sobre quem pode ver o prontuário do paciente;
 *   · `PrivacyPreferencesPanel` (em `Privacidade`) — "Todas as 0 ações
 *     registradas em sua conta" e "Nenhum registro ainda", sobre a trilha de
 *     auditoria da LGPD, que é o documento que prova o que aconteceu na conta.
 *
 * Nas quatro, o ramo de ERRO já tinha sido consertado, com o motivo escrito no
 * código. O ramo de carregamento ficou. É a mesma forma do caminho do Chromium:
 * a lição aprendida, escrita, aplicada a um ramo do `if`, e ausente no vizinho.
 *
 * ## Por que a regra NÃO é "proibir a frase categórica"
 *
 * Porque a explicação contém a palavra. `telasReconhecemFalha.test.tsx` já
 * registrou essa tentativa e por que ela foi descartada: "Não conclua que
 * NENHUM hospital tem acesso" e "NENHUM número é exibido de propósito" são
 * exatamente as telas que fazem a coisa certa. Guarda que pune quem escreveu
 * melhor é guarda que alguém desliga.
 *
 * Então esta guarda **fixa a medição**: com tudo pendente, o conjunto de telas
 * que contêm frase categórica é exatamente o conjunto declarado abaixo, com
 * motivo escrito para cada uma. Tela nova que passar a afirmar entra sozinha no
 * vermelho, e quem a puser aqui precisa saber escrever por quê — motivo que não
 * se consegue escrever é esquecimento disfarçado de decisão.
 */

const h = vi.hoisted(() => ({ pendentes: 0 }));

/**
 * O cliente com TODA leitura pendente para sempre.
 *
 * Não é "erro": é a promessa que não volta, que é o estado real de uma tela
 * recém-aberta num 3G ruim — o celular do paciente na rua, ou o do médico no
 * corredor. É aí que a frase categórica é lida.
 *
 * O mock mora dentro do `factory` do `vi.mock` de propósito. A primeira versão
 * desta sonda o declarava fora, e o içamento fazia a fábrica pegar a variável
 * ainda não inicializada; o mock não aplicava, a consulta caía no caminho de
 * ERRO e a medição acusou **11 telas**, das quais 6 eram falso positivo.
 * Medição que não isola não mede — e eu quase acreditei nela.
 */
vi.mock("@/integrations/supabase/client", () => {
  const pendente = () => { h.pendentes++; return new Promise(() => {}); };
  const consulta = (): any => {
    const alvo: any = {};
    for (const m of [
      "select", "eq", "is", "neq", "in", "gte", "lte", "lt", "gt", "order", "limit",
      "filter", "or", "range", "match", "not", "contains", "overlaps", "textSearch",
      "ilike", "like", "returns", "abortSignal",
    ]) alvo[m] = () => alvo;
    alvo.maybeSingle = pendente;
    alvo.single = pendente;
    alvo.then = () => { h.pendentes++; return new Promise(() => {}); };
    return alvo;
  };
  return {
    supabase: {
      from: () => consulta(),
      rpc: pendente,
      channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
      removeChannel: vi.fn(),
      auth: { getUser: pendente, getSession: pendente },
      functions: { invoke: pendente },
      storage: { from: () => ({ list: pendente, download: pendente, createSignedUrl: pendente }) },
    },
  };
});

vi.mock("react-router-dom", async () => {
  const real = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...real, useParams: () => ({ id: "id-de-teste", slug: "slug-de-teste" }) };
});
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1" },
    profile: { full_name: "Ana Souza", account_type: "medico" },
    loading: false,
  }),
}));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => ({ isAdmin: true, loading: false }) }));
vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

/** Afirmação categórica de ausência — ampla de propósito. */
const CATEGORICA =
  /nenhum[ao]?\b|n[ãa]o h[áa]\b|sem registros?\b|ainda n[ãa]o (tem|h[áa]|possui)/i;

/**
 * As telas em que a palavra aparece na EXPLICAÇÃO, e não numa contagem.
 *
 * Cada uma com o motivo, e o motivo precisa dizer por que a frase não é uma
 * afirmação sobre dado que ninguém leu.
 */
const EXPLICAM_SEM_AFIRMAR: Record<string, string> = {
  AdminDPO:
    "'nenhuma exclusão é executada automaticamente por esta tela' descreve a REGRA do " +
    "processo de LGPD, não uma contagem; a lista em si diz 'Carregando solicitações…'. " +
    "O CUSTO desta isenção, escrito para quem vier depois: enquanto ela existir, esta " +
    "tela fica fora da varredura — uma contagem falsa que aparecesse aqui passaria batida. " +
    "Quem reescrever a frase de processo sem a palavra tira a entrada e devolve a cobertura.",
};

/**
 * Isenção custa cobertura, e por isso a lista tem uma só.
 *
 * `PacienteIntegracoes` esteve aqui por um parágrafo que EU escrevi no conserto
 * ("nenhum número é exibido de propósito"). A inversão mostrou o preço: com a
 * tela isenta, desfazer o conserto dela não reprovava nada — a guarda ficava
 * cega justamente onde o defeito tinha acabado de existir. O texto foi
 * reescrito sem a palavra e a tela voltou para dentro da varredura.
 *
 * A regra que fica: antes de acrescentar uma entrada aqui, tente reescrever a
 * frase. Isenção é a última saída, não a primeira.
 */

const todos = import.meta.glob("../pages/app/*.tsx");
const modulos = Object.fromEntries(
  Object.entries(todos).filter(([c]) => !/\.test\.tsx$/.test(c)),
);
const TELAS = Object.keys(modulos).map((c) => ({
  caminho: c,
  nome: c.replace("../pages/app/", "").replace(".tsx", ""),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => vi.clearAllMocks());

/** Monta a tela com tudo pendente e devolve o texto que ela mostra. */
async function textoEnquantoCarrega(caminho: string, nome: string) {
  const mod = (await modulos[caminho]()) as Record<string, unknown>;
  const Tela = (mod.default ?? mod[nome]) as React.ComponentType | undefined;
  if (!Tela) throw new Error(`${nome} não tem componente exportado`);
  const { container, unmount } = render(<Tela />, { wrapper });
  // Tempo para os efeitos dispararem. Não há corrida com a resposta: ela nunca
  // chega, então o estado medido é estável, e não uma janela de sorte.
  await new Promise((r) => setTimeout(r, 80));
  const texto = (container.textContent ?? "").replace(/\s+/g, " ").trim();
  unmount();
  return texto;
}

describe("nenhuma tela afirma ausência enquanto ainda está lendo", () => {
  // Uma tela por bloco, e não as 38 num `it` só: este repositório já perdeu uma
  // medição para contaminação entre telas dentro do mesmo teste.
  for (const { caminho, nome } of TELAS) {
    const declarada = EXPLICAM_SEM_AFIRMAR[nome];

    it(`${nome}`, async () => {
      const texto = await textoEnquantoCarrega(caminho, nome);
      const achado = CATEGORICA.exec(texto);

      if (declarada) {
        // A exceção também é cobrada: se a frase sumiu, a isenção virou peso
        // morto e some junto — senão a lista cresce e nunca encolhe.
        expect(
          achado,
          `${nome} está declarada em EXPLICAM_SEM_AFIRMAR, mas não contém mais frase\n` +
            "categórica. Tire a entrada: exceção que não isenta nada ensina a\n" +
            "acrescentar exceção sem olhar.",
        ).not.toBeNull();
        return;
      }

      const trecho = achado
        ? `…${texto.slice(Math.max(0, achado.index - 80), achado.index + 120)}…`
        : "";
      expect(
        achado,
        `\n${nome} afirma ausência com a leitura ainda em voo:\n\n  ${trecho}\n\n` +
          "Enquanto a consulta não volta, `data` é vazio — e vazio não é zero, é\n" +
          "ainda-não-sei. Três estados: carregando, falhou, e não tem. O ramo de\n" +
          "erro desta base já foi consertado tela a tela; este é o vizinho dele.\n\n" +
          "Se a palavra estiver numa EXPLICAÇÃO e não numa contagem, declare a tela\n" +
          "em EXPLICAM_SEM_AFIRMAR com o motivo.",
      ).toBeNull();
    }, 30_000);
  }

  it("a varredura mediu alguma coisa", async () => {
    /**
     * O piso da própria varredura. Se o mock parar de aplicar — foi o que
     * aconteceu na primeira versão desta medição —, as telas resolvem por outro
     * caminho, ninguém fica pendente, e os 38 blocos acima passam sobre nada.
     */
    expect(TELAS.length, "não achou telas em `pages/app/`").toBeGreaterThanOrEqual(35);
    expect(
      h.pendentes,
      "nenhuma consulta ficou pendente — o mock não está sendo aplicado, e os\n" +
        "blocos acima passaram sobre telas que nunca entraram em carregamento",
    ).toBeGreaterThanOrEqual(30);
  });
});
