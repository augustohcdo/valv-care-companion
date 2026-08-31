import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { ProteseForaDeLinha } from "@/hooks/useReferenciaHistorica";

/**
 * A seção que recebe a Perimount — e que nunca tinha sido renderizada em teste.
 *
 * Este componente é o centro do que o usuário pediu: as próteses que saíram do
 * mercado deixam o catálogo mas **os dados continuam**, porque é contra a
 * Perimount que as próteses atuais são comparadas nos estudos e porque quem já a
 * tem implantada precisa da EOA de referência para ler o eco de seguimento.
 *
 * Até agora ela aparecia em teste uma única vez, assim:
 *
 *     vi.mock("@/hooks/useReferenciaHistorica", () => ({
 *       useReferenciaHistorica: () => ({ data: [], isLoading: false, error: null }),
 *     }));
 *
 * — mockada vazia, para o arquivo do catálogo carregar. Nunca com dado. Se ela
 * estivesse toda errada, os 776 testes passavam do mesmo jeito, que é a
 * definição de verde que não prova nada.
 *
 * O que se cobra aqui é a promessa escrita no cabeçalho do próprio componente:
 * **isto não é uma oferta**. Se um dia ela ganhar foto, faixa de anel ou "a
 * partir de X mm", vira cartão de catálogo disfarçado — e aí a prótese que saiu
 * do mercado volta a parecer escolha disponível.
 */

const mockUseHistorica = vi.fn();
vi.mock("@/hooks/useReferenciaHistorica", () => ({
  useReferenciaHistorica: () => mockUseHistorica(),
}));

const { ReferenciaHistorica } = await import("./ReferenciaHistorica");

const linha = (over: Partial<ProteseForaDeLinha> = {}): ProteseForaDeLinha => ({
  manufacturer: "Edwards",
  model_name: "Perimount",
  valve_position: "aortica",
  size: 21,
  effective_orifice_area: 1.3,
  eoa_reference_sd: 0.3,
  eoa_source_label: "ASE 2024 — Tabela A4",
  eoa_source_url: "https://pubmed.ncbi.nlm.nih.gov/38182282/",
  mean_gradient_ref: 13.8,
  mean_gradient_ref_sd: 4.0,
  discontinued_at: "2026-08-30",
  discontinued_note:
    "A página de aórticas cirúrgicas da Edwards lista hoje só a Magna Ease na família PERIMOUNT.",
  discontinued_source_url:
    "https://www.edwards.com/healthcare-professionals/products-services/surgical-heart/aortic",
  ...over,
});

const pronto = (data: ProteseForaDeLinha[]) => ({ data, isLoading: false, error: null });

beforeEach(() => {
  mockUseHistorica.mockReset();
  document.body.innerHTML = "";
});

describe("referência histórica", () => {
  it("mostra a EOA e o gradiente por tamanho de quem saiu de linha", () => {
    mockUseHistorica.mockReturnValue(
      pronto([linha(), linha({ size: 23, effective_orifice_area: 1.6, mean_gradient_ref: 11.5 })]),
    );
    render(<ReferenciaHistorica />);
    const texto = document.body.textContent ?? "";
    expect(texto).toContain("Edwards Perimount");
    expect(texto, "não mostra o tamanho").toMatch(/21\s*mm/);
    expect(texto, "não mostra a EOA de referência").toMatch(/1,30/);
    expect(texto, "não mostra o gradiente").toMatch(/13,80/);
  });

  it("NÃO é oferta: sem foto, sem faixa de anel, sem 'a partir de'", () => {
    // A contraprova do desenho inteiro. Se qualquer uma destas aparecer, a seção
    // virou cartão de catálogo e a prótese fora do mercado volta a parecer
    // escolha disponível — que é exatamente o que o usuário mandou tirar.
    mockUseHistorica.mockReturnValue(pronto([linha()]));
    const { container } = render(<ReferenciaHistorica />);
    const texto = document.body.textContent ?? "";
    expect(container.querySelector("img"), "desenhou imagem de produto").toBeNull();
    expect(texto, "ofereceu um piso de tamanho, como o recomendador").not.toMatch(/a partir de/i);
    expect(texto, "mostrou faixa de anel, que é informação de escolha").not.toMatch(/anel \d+/);
  });

  it("diz quando saiu de linha, por quê, e com que fonte", () => {
    mockUseHistorica.mockReturnValue(pronto([linha()]));
    const { container } = render(<ReferenciaHistorica />);
    const texto = document.body.textContent ?? "";
    expect(texto, "não diz a data da retirada").toContain("2026-08-30");
    expect(texto, "não diz o motivo").toMatch(/Magna Ease na família PERIMOUNT/);
    const links = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(links, "não aponta a página do fabricante").toContain(
      "https://www.edwards.com/healthcare-professionals/products-services/surgical-heart/aortic",
    );
  });

  it("deixa claro que não está à venda, e por que os dados ficam", () => {
    mockUseHistorica.mockReturnValue(pronto([linha()]));
    render(<ReferenciaHistorica />);
    const texto = document.body.textContent ?? "";
    expect(texto).toMatch(/não estão à venda/i);
    // As duas razões clínicas, que são o que justifica não apagar.
    expect(texto, "não explica o seguimento de quem já tem implantada").toMatch(/seguimento/i);
    expect(texto, "não explica a comparação dos estudos").toMatch(/comparadas nos estudos/i);
  });

  it("carregando não vira silêncio", () => {
    mockUseHistorica.mockReturnValue({ data: [], isLoading: true, error: null });
    render(<ReferenciaHistorica />);
    expect(document.body.textContent ?? "").toMatch(/Carregando a referência histórica/i);
  });

  it("falha não vira 'não há prótese fora de linha'", () => {
    // O mesmo defeito do recomendador com catálogo vazio: silêncio lido como
    // conclusão. Aqui a leitura errada seria "nenhuma prótese saiu de linha".
    mockUseHistorica.mockReturnValue({ data: [], isLoading: false, error: new Error("falhou") });
    render(<ReferenciaHistorica />);
    const texto = document.body.textContent ?? "";
    expect(texto).toMatch(/Não foi possível carregar/i);
    expect(texto, "não separa 'não chegou' de 'não há'").toMatch(
      /não quer dizer que não haja prótese fora de linha/i,
    );
  });

  it("lista vazia não desenha seção fantasma", () => {
    mockUseHistorica.mockReturnValue(pronto([]));
    const { container } = render(<ReferenciaHistorica />);
    expect(container.textContent, "desenhou cabeçalho sem conteúdo").toBe("");
  });

  it("separa aórtica de mitral do mesmo modelo", () => {
    // A Perimount saiu nas duas posições, e são linhas de tabela diferentes na
    // fonte. Juntá-las num bloco só misturaria EOA de posições distintas.
    mockUseHistorica.mockReturnValue(
      pronto([
        linha(),
        linha({ valve_position: "mitral", size: 27, effective_orifice_area: 1.88 }),
      ]),
    );
    render(<ReferenciaHistorica />);
    const texto = document.body.textContent ?? "";
    expect(texto).toMatch(/aórtica/);
    expect(texto).toMatch(/mitral/);
    expect(texto).toMatch(/1,88/);
  });
});
