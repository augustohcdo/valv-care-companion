/// <reference types="node" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

/**
 * TODA tela de `/app/` reconhece, na tela, que a leitura falhou.
 *
 * ## Por que esta varredura existe, e por que ela é de diretório
 *
 * `telasComLeituraFalhando.test.tsx` cobre oito telas, escolhidas a dedo: as
 * que já tinham o defeito quando alguém foi olhar. É uma LISTA, e lista cobre o
 * que já se sabe.
 *
 * Renderizando as 38 telas de `/app/` com o cliente do Supabase falhando em
 * tudo, o número apareceu: **13 reconheciam a falha, 25 calavam**. Entre as que
 * calavam, afirmações categóricas sobre leitura que não aconteceu:
 *
 *   · "Complete seu perfil para gerenciar medicações." — com o perfil completo;
 *   · "Nenhuma solicitação registrada" — na fila da LGPD;
 *   · "Nenhum erro registrado." — no painel de erros de produção;
 *   · "A consulta à literatura está desligada para todos os médicos.";
 *   · "Nenhum compromisso neste dia." — na agenda do médico.
 *
 * A lista não teria achado nenhuma delas. Por isso aqui a exigência é plana:
 * toda tela, sem lista, com exceções que precisam de motivo escrito.
 *
 * ## O que ela cobra, e o que não cobra
 *
 * Cobra o PISO: com tudo falhando, a tela precisa dizer que falhou. Não cobra
 * que ela diga a coisa certa — isso é o teto, e continua em
 * `telasComLeituraFalhando.test.tsx`, que cobra a segunda metade da mensagem
 * ("isto NÃO significa que não haja X"), que é a que faz o trabalho.
 *
 * As duas juntas: aqui, ninguém cala; lá, quem fala, fala direito.
 */

const ERRO = { message: "network error", code: "PGRST000", details: null, hint: null };

/** Encadeamento do cliente real: qualquer método devolve a si mesmo até o fim. */
function consultaQueFalha(): any {
  const alvo: any = {};
  const metodos = [
    "select", "eq", "is", "neq", "in", "gte", "lte", "lt", "gt", "order",
    "limit", "filter", "or", "range", "match", "not", "contains", "overlaps", "textSearch",
  ];
  for (const m of metodos) alvo[m] = () => alvo;
  alvo.maybeSingle = () => Promise.resolve({ data: null, error: ERRO });
  alvo.single = () => Promise.resolve({ data: null, error: ERRO });
  alvo.then = (resolve: any) => resolve({ data: null, count: null, error: ERRO });
  return alvo;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => consultaQueFalha(),
    rpc: () => Promise.resolve({ data: null, error: ERRO }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    functions: { invoke: () => Promise.resolve({ data: null, error: ERRO }) },
    storage: {
      from: () => ({
        list: () => Promise.resolve({ data: null, error: ERRO }),
        download: () => Promise.resolve({ data: null, error: ERRO }),
        createSignedUrl: () => Promise.resolve({ data: null, error: ERRO }),
      }),
    },
  },
}));

// `useParams` mockado em vez de montar rotas: as telas de detalhe pedem `id` ou
// `slug`, e uma rota só não serve as duas. Sem isto, `BibliotecaDetalhe`
// redirecionava e a varredura media o redirecionamento, não a tela.
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

import { toast } from "sonner";

/**
 * Como se reconhece que uma tela reconheceu.
 *
 * Deliberadamente amplo: o objetivo é achar quem NÃO diz nada. Uma tela que
 * avisa com outras palavras passa, e está certo — a regra é sobre o silêncio,
 * não sobre o texto.
 */
const RECONHECE =
  /não foi poss[ií]vel|n[ãa]o consegu|erro ao|falhou|falha ao|tentar novamente|indispon[ií]vel|problema ao|n[ãa]o carregou/i;

/**
 * ## O TETO — e por que ele não fecha por varredura plana
 *
 * Esta varredura cobra o piso: ninguém cala. A pergunta seguinte é se quem fala
 * fala direito — se a mensagem traz a SEGUNDA metade, "isto não significa que
 * não haja X", que é a que impede a conclusão errada.
 *
 * Tentei três formulações, e registro as três para ninguém (eu inclusive)
 * refazer o caminho:
 *
 * 1. **Exigir a frase de negação por regex.** Reprovou seis telas que fazem a
 *    coisa certa com outras palavras: "não a ausência de vínculos", "Não
 *    conclua que nenhum hospital tem acesso", "o formulário não é exibido de
 *    propósito: salvar apagaria seus dados". Negar uma conclusão é semântica;
 *    lista de frases não captura.
 *
 * 2. **Proibir a frase categórica junto do aviso.** Parecia o lado fechado do
 *    problema — "nenhum(a)", "não há", um zero. Reprovou quatro telas boas: a
 *    própria negação contém a palavra ("Não conclua que NENHUM hospital tem
 *    acesso"), e a explicação também ("NENHUM número é exibido nesta situação
 *    de propósito"). A palavra aparece nos dois lados da mesma ideia.
 *
 * 3. **Medir antes de virar regra.** A sonda disse 32 de 32 e estava
 *    contaminada: todas as telas rodavam dentro de um teste só e o `toast`
 *    acumulava entre elas — uma passava com a negação que a outra tinha
 *    emitido. Medição que não isola não mede.
 *
 * As duas primeiras puniam quem escreveu melhor, e guarda que pune quem fez
 * certo é guarda que alguém desliga. Então o teto NÃO é cobrado aqui: ele fica
 * em `telasComLeituraFalhando.test.tsx`, tela a tela, onde a asserção pode ser
 * sobre o sentido e não sobre o vocabulário. É uma lista, e assumida como tal.
 *
 * O que a tentativa rendeu, e por isso ela valeu: dois defeitos reais que
 * nenhuma das duas regras teria sobrevivido para achar —
 *
 *   · `PacienteHome` mostrava o selo "Nenhum médico vinculado" no ponto mais
 *     visível da tela enquanto a faixa de falha aparecia embaixo. A tela já
 *     tinha `falhouLeitura`; o selo é que ficava de fora dela;
 *   · `PrivacyPreferencesPanel` protegia o cartão dos controles e deixava o
 *     cartão da TRILHA DE AUDITORIA por fora, dizendo ao titular "Últimas 0
 *     ações registradas" e "Nenhum registro ainda" — sobre o documento que
 *     prova o que aconteceu na conta dele.
 */

/**
 * Telas que não leem nada, e por isso não têm o que reconhecer.
 *
 * Cada uma com o motivo escrito — a mesma regra das outras varreduras deste
 * repositório: motivo que não se consegue escrever é esquecimento disfarçado de
 * decisão. Se uma delas passar a ler do banco, a isenção cai junto, e o teste
 * abaixo cobra isso nos dois sentidos.
 */
const EXCECOES: Record<string, string> = {
  Biblioteca: "conteúdo estático de `src/data/clinicalLibrary.ts`; não lê banco",
  BibliotecaDetalhe: "idem — o detalhe vem do mesmo módulo estático",
  TecnicaCirurgica: "lista de links do MMCTS, conferida em build; não lê banco",
  MedicoFerramentas: "menu para as três calculadoras; não lê banco",
  AdminHome: "menu da administração; os números vêm de telas próprias",
  PacienteAprenderDetalhe: "conteúdo educativo de `src/data/patientContent.ts`",
};

const modulos = import.meta.glob("../pages/app/*.tsx");

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => vi.clearAllMocks());

/**
 * Monta a tela com tudo falhando e devolve como perguntar o estado dela.
 *
 * O `reconheceu()` é uma FUNÇÃO, e não um valor, de propósito: a primeira versão
 * lia o texto uma vez depois de 40 ms fixos, e o `MedicoRelatorios` — que
 * reconhece a falha perfeitamente — aparecia como mudo porque ainda estava no
 * spinner. Prazo cravado num teste que renderiza 38 telas é intermitência
 * esperando a máquina certa; quem lê o vermelho não tem como saber se a tela
 * está errada ou se o computador estava ocupado.
 *
 * Avisar por `toast` conta como avisar: `CasoDetalhe` e `NovoCaso` reportam
 * assim, e reprová-los seria punir quem fez certo no formato certo.
 */
async function montarComTudoFalhando(carregar: () => Promise<unknown>, nome: string) {
  const mod = (await carregar()) as Record<string, unknown>;
  const Tela = (mod.default ?? mod[nome]) as React.ComponentType | undefined;
  if (!Tela) throw new Error(`${nome} não tem componente exportado`);
  const { container, unmount } = render(<Tela />, { wrapper });
  const texto = () => (container.textContent ?? "").replace(/\s+/g, " ").trim();
  // O texto do `toast` entra na conta: a negação pode estar na `description`
  // dele, e é onde o `CasoDetalhe` e o `NovoCaso` a colocam.
  const reconheceu = () => RECONHECE.test(texto()) || vi.mocked(toast.error).mock.calls.length > 0;
  return { texto, reconheceu, unmount };
}

const telas = Object.entries(modulos)
  .map(([caminho, carregar]) => [caminho.split("/").pop()!.replace(".tsx", ""), carregar] as const)
  .filter(([nome]) => !nome.endsWith(".test"))
  .sort(([a], [b]) => a.localeCompare(b));

describe("toda tela de /app reconhece a falha de leitura", () => {
  it("a varredura acha as telas", () => {
    // Sem isto, mudar a pasta deixaria zero iterações e o arquivo inteiro
    // passaria por não ter olhado nada.
    expect(telas.length, "nenhuma tela encontrada em src/pages/app").toBeGreaterThan(20);
  });

  for (const [nome, carregar] of telas) {
    const motivo = EXCECOES[nome];
    it(`${nome}${motivo ? " (isenta)" : ""}`, async () => {
      const { texto, reconheceu, unmount } = await montarComTudoFalhando(
        carregar as () => Promise<unknown>,
        nome,
      );
      try {
        if (motivo) {
          // Isenção que não isenta nada é lixo acumulando: se a tela passou a
          // avisar, a linha em EXCECOES tem de sair. Aqui o prazo fixo é
          // correto — está-se provando uma AUSÊNCIA de aviso, e ausência só se
          // afirma depois de ter esperado.
          await new Promise((r) => setTimeout(r, 300));
          expect(
            reconheceu(),
            `${nome} está em EXCECOES ("${motivo}") mas AVISA da falha — tire a isenção`,
          ).toBe(false);
          return;
        }
        await waitFor(
          () => {
            expect(
              reconheceu(),
              `${nome} não diz nada com TODAS as leituras falhando — nem na tela, nem por toast.\n\n` +
                `O que ela mostra: ${texto().slice(0, 300)}\n\n` +
                "Com a leitura falhada, estado vazio é afirmação falsa: a tela diz que\n" +
                "não há o que não foi lido. Observe o `error` e diga que não foi possível\n" +
                "carregar — e, junto, que isso NÃO significa ausência.\n\n" +
                "Se a tela realmente não lê nada, ponha em EXCECOES com o motivo escrito.",
            ).toBe(true);
          },
          { timeout: 4000 },
        );

      } finally {
        unmount();
      }
    }, 20_000);
  }

  it("a varredura ainda enxerga uma tela que cala", async () => {
    // Contraprova. Com todas passando, o laço acima ficaria verde tanto com as
    // telas corretas quanto com o `RECONHECE` quebrado.
    function TelaQueCala() {
      return <div>Nenhum registro encontrado.</div>;
    }
    const { container } = render(<TelaQueCala />, { wrapper });
    expect(RECONHECE.test(container.textContent ?? "")).toBe(false);

    function TelaQueAvisa() {
      return <div>Não foi possível carregar seus registros agora.</div>;
    }
    const segunda = render(<TelaQueAvisa />, { wrapper });
    expect(RECONHECE.test(segunda.container.textContent ?? "")).toBe(true);
  });
});
