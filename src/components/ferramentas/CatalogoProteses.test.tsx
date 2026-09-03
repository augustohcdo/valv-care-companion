import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ProteseDoCatalogo } from "@/hooks/useCatalogoProteses";

/**
 * O catálogo não pode afirmar cobertura antes de saber qual é.
 *
 * Isto veio de uma foto da página, não de leitura de código: enquanto o
 * catálogo carregava, a tela exibia
 *
 *     "EOA de referência publicada em 0 de 0 tamanhos"
 *
 * — um número, com ar de fato apurado, calculado a partir de uma lista vazia.
 * Para o médico que abrisse a página numa conexão lenta, a leitura é "nenhuma
 * prótese tem EOA publicada", que é falso: são 29 de 246.
 *
 * É a mesma família do resto da sessão, e por isso vira teste permanente: uma
 * tela afirmando um estado que ela ainda não conhece.
 */

const mockUseCatalogo = vi.fn();
vi.mock("@/hooks/useCatalogoProteses", () => ({
  useCatalogoProteses: () => mockUseCatalogo(),
}));

// A seção de referência histórica faz a própria consulta, e sem este mock o
// arquivo inteiro deixa de carregar com "supabaseUrl is required" — uma suíte
// que some por erro de importação, não uma que reprova.
vi.mock("@/hooks/useReferenciaHistorica", () => ({
  useReferenciaHistorica: () => ({ data: [], isLoading: false, error: null }),
}));

const { CatalogoProteses } = await import("./CatalogoProteses");

const linha = (over: Partial<ProteseDoCatalogo> = {}): ProteseDoCatalogo => ({
  id: "1", manufacturer: "Edwards", model_name: "Perimount", type: "biologica_aortica",
  valve_position: "aortica", size: 21, effective_orifice_area: 1.3, eoa_reference_sd: 0.4,
  eoa_source_label: "EACVI 2016 — Tabela 7", eoa_source_url: "https://pubmed.ncbi.nlm.nih.gov/27143783/",
  mean_gradient_ref: 12.6, mean_gradient_ref_sd: 4.7,
  annulus_min_mm: null, annulus_max_mm: null, description: "Bioprótese aórtica.",
  reference_url: "https://exemplo.invalid/perimount", image_url: null, image_kind: null, display_order: 1,
  advisory: null, advisory_note: null, advisory_url: null, advisory_date: null,
  mercado_br: null, anvisa_registro: null, mercado_br_conferido_em: null, mercado_br_fonte: null,
  ...over,
});

describe("catálogo de próteses", () => {
  beforeEach(() => mockUseCatalogo.mockReset());

  it("carregando: não afirma cobertura nenhuma", () => {
    mockUseCatalogo.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(<CatalogoProteses />);
    expect(screen.getByText(/Carregando o catálogo/)).toBeTruthy();
    expect(
      screen.queryByText(/EOA de referência publicada/),
      "afirmou cobertura antes de conhecer o catálogo",
    ).toBeNull();
  });

  it("carregado: mostra a cobertura real, com os dois números", () => {
    mockUseCatalogo.mockReturnValue({
      data: [linha(), linha({ id: "2", size: 23, effective_orifice_area: null, eoa_source_url: null })],
      isLoading: false, error: null,
    });
    render(<CatalogoProteses />);
    const texto = document.body.textContent ?? "";
    expect(texto).toMatch(/EOA de referência publicada em/);
    expect(texto).toMatch(/1 de 2/);
  });

  it("erro: diz que falhou, e não mostra catálogo vazio como se fosse resposta", () => {
    // Catálogo vazio por falha é indistinguível de catálogo vazio por filtro se
    // a tela não separar os dois casos.
    mockUseCatalogo.mockReturnValue({ data: undefined, isLoading: false, error: new Error("falhou") });
    render(<CatalogoProteses />);
    expect(screen.getByText(/Não foi possível carregar o catálogo/)).toBeTruthy();
    expect(screen.queryByText(/EOA de referência publicada/)).toBeNull();
    expect(screen.queryByText(/Nenhum modelo com esses filtros/)).toBeNull();
  });

  it("modelo sem EOA e SEM busca registrada: diz que ninguém procurou ainda", () => {
    // Campo vazio tem dois sentidos opostos, e este é o primeiro. Confundi-lo
    // com "procuramos e não há" faria o médico concluir que a prótese é mal
    // documentada quando o catálogo é que está incompleto.
    mockUseCatalogo.mockReturnValue({
      data: [linha({
        manufacturer: "Fabricante", model_name: "Modelo Sem Busca",
        effective_orifice_area: null, eoa_reference_sd: null, eoa_source_url: null, eoa_source_label: null,
      })],
      isLoading: false, error: null,
    });
    render(<CatalogoProteses />);
    expect(screen.getByText(/ainda não pesquisado/)).toBeTruthy();
  });

  it("modelo sem EOA e COM busca registrada: diz que procurou e não há", () => {
    // A bioprótese de pericárdio bovino da Braile está no registro como
    // `sem_estudo`: o acompanhamento publicado não traz nenhum dado
    // hemodinâmico. (Esta família já se chamou "Biocor" aqui — nome que é da
    // linhagem St. Jude → Abbott e nunca foi produto da Braile.)
    mockUseCatalogo.mockReturnValue({
      data: [linha({
        manufacturer: "Braile", model_name: "Prótese de Pericárdio Bovino",
        effective_orifice_area: null, eoa_reference_sd: null, eoa_source_url: null, eoa_source_label: null,
      })],
      isLoading: false, error: null,
    });
    render(<CatalogoProteses />);
    const texto = document.body.textContent ?? "";
    expect(texto).toMatch(/não há estudo publicado com EOA por tamanho/);
    expect(texto, "não mostra a data da busca").toMatch(/busca de \d{4}-\d{2}-\d{2}/);
    expect(screen.getByText(/ver o estudo mais próximo/), "não aponta o estudo achado").toBeTruthy();
  });

  it("a nota sobre as fotos descreve a regra, e não o histórico de recusas", () => {
    // Nasceu de um defeito real: a nota listava por nome quatro fotos recusadas
    // por serem outro produto, e três delas — Sapien 3, Sapien 3 Ultra e Epic —
    // já tinham foto correta havia uma rodada. A tela contava um processo que
    // tinha deixado de ser verdade.
    //
    // Texto que narra o que aconteceu precisa de manutenção a cada rodada e não
    // recebe. Texto que descreve a regra vale enquanto a regra valer. A guarda
    // é essa: a nota não nomeia modelo nenhum.
    mockUseCatalogo.mockReturnValue({ data: [linha()], isLoading: false, error: null });
    render(<CatalogoProteses />);
    // A nota passou a viver num <details> recolhido — o resumo fica no
    // <summary> e o corpo dentro. Procuro o bloco inteiro, não um <p>.
    const nota = [...document.querySelectorAll("details, p")]
      .map((e) => e.textContent ?? "")
      .find((t) => t.includes("Sobre as imagens e os dados")) ?? "";
    expect(nota, "a nota sobre imagens sumiu da tela").not.toBe("");
    for (const modelo of ["Sapien", "Epic", "Magna", "Perimount", "Trifecta", "Avalus"]) {
      expect(nota, `a nota cita "${modelo}" — vira histórico e envelhece`).not.toContain(modelo);
    }
    expect(nota, "não diz que cada foto é conferida").toMatch(/conferida|aberta/i);
  });

  it("prótese retirada do mercado mostra o alerta no cartão, com a fonte", () => {
    mockUseCatalogo.mockReturnValue({
      data: [linha({
        manufacturer: "Abbott", model_name: "Trifecta GT",
        advisory: "retirada_do_mercado",
        advisory_note: "Retirada do mercado dos EUA por deterioração estrutural precoce.",
        advisory_url: "https://www.cardiovascular.abbott/exemplo.pdf",
        advisory_date: "2023-07-31",
      })],
      isLoading: false, error: null,
    });
    render(<CatalogoProteses />);
    const texto = document.body.textContent ?? "";
    expect(texto).toMatch(/Retirada do mercado — não indicar para novo implante/);
    expect(texto).toMatch(/deterioração estrutural precoce/);
    expect(texto, "alerta sem data é boato").toMatch(/comunicado de 2023-07-31/);
  });
});

/**
 * O selo de mercado NÃO pode voltar.
 *
 * Havia aqui quatro testes provando que ele aparecia: número da ANVISA, "vendida
 * no Brasil", e a ressalva "registro brasileiro não confirmado em <data>". Eles
 * guardavam um defeito.
 *
 * `nao_confirmado` significava, no meu processo, "não achei página brasileira
 * que citasse este produto". A tela mostrava isso ao cardiologista como **dúvida
 * sobre o produto** — em dezenove famílias, entre elas Abbott Epic, St. Jude
 * Regent, Corcym Perceval e as Medtronic, que se implantam no Brasil toda
 * semana. Ausência de evidência apresentada como evidência de ausência, e
 * publicada.
 *
 * E não era corrigível procurando melhor: a base da ANVISA está atrás de desafio
 * do Cloudflare, e catálogo de distribuidor prova presença mas nunca prova
 * ausência. Método que só consegue confirmar não pode produzir "não vendida".
 *
 * Apagar os quatro testes deixaria o selo voltar sem ninguém perceber. Então
 * eles viram este: com o dado PREENCHIDO na fixture, nada disso pode alcançar a
 * tela.
 */
describe("mercado brasileiro não aparece no catálogo", () => {
  const comDadoDeMercado = () =>
    mockUseCatalogo.mockReturnValue({
      data: [
        linha({
          manufacturer: "Edwards", model_name: "Inspiris Resilia",
          mercado_br: "confirmado", anvisa_registro: "80219050171",
          mercado_br_conferido_em: "2026-08-31",
          mercado_br_fonte: "https://intermedicalbr.com/cirurgia-cardiaca/",
        }),
        linha({
          manufacturer: "Corcym", model_name: "Perceval Plus",
          mercado_br: "nao_confirmado", anvisa_registro: null,
          mercado_br_conferido_em: "2026-08-31", mercado_br_fonte: null,
        }),
      ],
      isLoading: false,
      error: null,
    });

  it("com o dado preenchido no banco, nada de mercado alcança a tela", () => {
    comDadoDeMercado();
    render(<CatalogoProteses />);
    const texto = document.body.textContent ?? "";
    // `/ANVISA/` sozinho seria largo demais: o rodapé cita, com razão, que a
    // varredura de alertas NÃO cobre o banco da ANVISA. O que não pode voltar é
    // o NÚMERO ao lado da sigla, que era o selo.
    expect(texto, "voltou a mostrar número de registro").not.toMatch(/ANVISA\s*\d/i);
    expect(texto, "voltou a afirmar venda no Brasil").not.toMatch(/vendida no Brasil/i);
    expect(texto, "voltou a lançar dúvida sobre o produto").not.toMatch(/não confirmado/i);
    expect(texto, "vazou o número solto").not.toMatch(/80219050171/);
  });

  it("as próteses continuam todas na tela — nada foi filtrado por mercado", () => {
    // A contraprova do teste acima: se o catálogo viesse vazio, as asserções de
    // ausência passariam por acidente.
    comDadoDeMercado();
    render(<CatalogoProteses />);
    const texto = document.body.textContent ?? "";
    expect(texto).toContain("Inspiris Resilia");
    expect(texto).toContain("Perceval Plus");
  });
});

describe("cobertura da varredura de alerta", () => {
  it("a conta fecha: varridas + faltam = famílias do catálogo", () => {
    // A invariante que estava quebrada. O numerador vinha de FAMILIAS_VARRIDAS,
    // que é a soma das listas declaradas e continua contando família que já saiu
    // do catálogo. O denominador vinha do catálogo carregado. Resultado possível
    // na tela: "40 de 45" logo acima de "10 famílias ainda não passaram" —
    // 40 + 10 ≠ 45, e o médico lê o número maior.
    //
    // Aqui o catálogo tem três famílias, e NENHUMA delas está nas listas da
    // varredura. Então o numerador honesto é 0, não 40.
    mockUseCatalogo.mockReturnValue({
      data: [
        linha({ manufacturer: "Fabricante Fictício", model_name: "Modelo A" }),
        linha({ manufacturer: "Fabricante Fictício", model_name: "Modelo B" }),
        linha({ manufacturer: "Fabricante Fictício", model_name: "Modelo C" }),
      ],
      isLoading: false,
      error: null,
    });
    render(<CatalogoProteses />);
    const texto = document.body.textContent ?? "";

    const conta = texto.match(/(\d+) de (\d+)\s*famílias do catálogo/);
    expect(conta, "não achei a frase de cobertura na tela").not.toBeNull();
    const varridas = Number(conta![1]);
    const total = Number(conta![2]);
    const faltam = Number((texto.match(/(\d+) família\(s\) do catálogo ainda não/) ?? [0, "0"])[1]);

    expect(total, "o denominador não veio do catálogo carregado").toBe(3);
    expect(varridas, "contou como varrida família que não está no catálogo").toBe(0);
    expect(varridas + faltam, `${varridas} + ${faltam} ≠ ${total}`).toBe(total);
  });
});
