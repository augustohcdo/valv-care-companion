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

const { CatalogoProteses } = await import("./CatalogoProteses");

const linha = (over: Partial<ProteseDoCatalogo> = {}): ProteseDoCatalogo => ({
  id: "1", manufacturer: "Edwards", model_name: "Perimount", type: "biologica_aortica",
  valve_position: "aortica", size: 21, effective_orifice_area: 1.3, eoa_reference_sd: 0.4,
  eoa_source_label: "EACVI 2016 — Tabela 7", eoa_source_url: "https://pubmed.ncbi.nlm.nih.gov/27143783/",
  mean_gradient_ref: 12.6, mean_gradient_ref_sd: 4.7,
  annulus_min_mm: null, annulus_max_mm: null, description: "Bioprótese aórtica.",
  reference_url: "https://exemplo.invalid/perimount", image_url: null, display_order: 1,
  advisory: null, advisory_note: null, advisory_url: null, advisory_date: null,
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
