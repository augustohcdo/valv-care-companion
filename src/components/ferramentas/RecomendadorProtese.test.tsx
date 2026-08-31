import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { RecomendadorProtese } from "./RecomendadorProtese";
import type { ProteseDoCatalogo } from "@/hooks/useCatalogoProteses";
import { superficieCorporal } from "@/lib/bsa";

/**
 * Catálogo vazio não é resposta clínica.
 *
 * Isto veio de uma foto da tela, não de leitura de código. Com o catálogo fora
 * do ar, o recomendador exibia:
 *
 *     "0 tamanhos avaliados"
 *     "Nenhum tamanho com EOA publicada evita mismatch nesta superfície corporal"
 *
 * A segunda frase é uma **conclusão sobre o paciente** tirada de uma lista
 * vazia. Para quem lê, significa "não há prótese que sirva neste paciente" — e a
 * conduta que ela sugere logo abaixo é ampliação de raiz, prótese sem stent ou
 * transcateter.
 *
 * É a mesma família do "EOA de referência publicada em 0 de 0 tamanhos" que já
 * virou teste no catálogo. Aqui é pior: lá a tela errava um número, aqui erra
 * uma conduta.
 */

const BSA = superficieCorporal(170, 70)!;

const linha = (over: Partial<ProteseDoCatalogo> = {}): ProteseDoCatalogo => ({
  id: "1", manufacturer: "Edwards", model_name: "Perimount", type: "biologica_aortica",
  valve_position: "aortica", size: 21, effective_orifice_area: 0.9, eoa_reference_sd: 0.3,
  eoa_source_label: "ASE 2024", eoa_source_url: "https://pubmed.ncbi.nlm.nih.gov/38182282/",
  mean_gradient_ref: 12.6, mean_gradient_ref_sd: 4.7,
  annulus_min_mm: null, annulus_max_mm: null, description: null, reference_url: null,
  image_url: null, image_kind: null, display_order: 1,
  advisory: null, advisory_note: null, advisory_url: null, advisory_date: null,
  mercado_br: null, anvisa_registro: null, mercado_br_conferido_em: null, mercado_br_fonte: null,
  ...over,
});

const NEGA_CONDUTA = /Nenhum tamanho com EOA publicada evita mismatch/;

describe("recomendador de prótese, na tela", () => {
  it("catálogo carregando: não conclui nada sobre o paciente", () => {
    render(<RecomendadorProtese catalogo={[]} bsa={BSA} imc={24} posicao="aortica" carregando />);
    const texto = document.body.textContent ?? "";
    expect(texto).toMatch(/Carregando o catálogo/);
    expect(texto, "afirmou conduta a partir de catálogo que ainda não chegou").not.toMatch(NEGA_CONDUTA);
  });

  it("catálogo falhou: diz que não sabe, e diz que não saber é diferente de não haver", () => {
    render(<RecomendadorProtese catalogo={[]} bsa={BSA} imc={24} posicao="aortica" falhou />);
    const texto = document.body.textContent ?? "";
    expect(texto).toMatch(/Não foi possível carregar o catálogo/);
    expect(texto, "não separa 'não sei' de 'não há'").toMatch(/não quer dizer que nenhuma prótese sirva/i);
    expect(texto).not.toMatch(NEGA_CONDUTA);
  });

  it("catálogo vazio sem erro declarado: também não conclui", () => {
    // O terceiro caso, e o que de fato aconteceu: nem `isLoading` nem `error`,
    // só uma lista vazia chegando. Sem esta guarda a tela voltaria a concluir.
    render(<RecomendadorProtese catalogo={[]} bsa={BSA} imc={24} posicao="aortica" />);
    expect(document.body.textContent ?? "").not.toMatch(NEGA_CONDUTA);
  });

  it("catálogo cheio e nenhuma prótese servindo: AÍ SIM a conclusão é clínica", () => {
    // A contraprova. Se a guarda de cima fosse larga demais, ela engoliria o
    // achado clínico de verdade — que existe e é importante em superfície
    // corporal grande.
    render(
      <RecomendadorProtese
        catalogo={[linha(), linha({ id: "2", size: 23, effective_orifice_area: 1.0 })]}
        bsa={BSA} imc={24} posicao="aortica"
      />,
    );
    expect(document.body.textContent ?? "", "engoliu o achado clínico de verdade").toMatch(NEGA_CONDUTA);
  });
});

/**
 * Fabricante que some da tela é fabricante que o médico lê como "não tem opção".
 *
 * A montagem antiga filtrava `adequadas.length > 0` e, para o resto, exigia
 * `insuficientes.length > 0`. Quem tivesse todos os tamanhos sem EOA publicada
 * caía fora das duas listas e desaparecia — sem cartão, sem linha, sem nota.
 *
 * As duas coisas que somem são opostas: "nenhum tamanho serve neste paciente" é
 * achado clínico; "ninguém publicou medida deste fabricante" é lacuna de
 * literatura, e não diz nada sobre a prótese. Some as duas no mesmo silêncio e o
 * cirurgião conclui a primeira quando o caso é a segunda.
 */
describe("nenhum fabricante desaparece da tela", () => {
  const semDado = (over: Partial<ProteseDoCatalogo> = {}): ProteseDoCatalogo =>
    linha({ effective_orifice_area: null, eoa_source_url: null, eoa_source_label: null, ...over });

  it("fabricante sem NENHUMA EOA publicada aparece, e diz que a ausência é de dado", () => {
    render(
      <RecomendadorProtese
        catalogo={[
          linha({ id: "a", manufacturer: "ComDado", effective_orifice_area: 2.2 }),
          semDado({ id: "b", manufacturer: "SemDado" }),
          semDado({ id: "c", manufacturer: "SemDado", size: 23 }),
        ]}
        bsa={BSA} imc={24} posicao="aortica"
      />,
    );
    const texto = document.body.textContent ?? "";
    expect(texto, "o fabricante sem dado sumiu da tela").toContain("SemDado");
    expect(texto, "não separa 'não serve' de 'não há medida'")
      .toMatch(/não pôde entrar na conta|não diz nada sobre a prótese/i);
  });

  it("todo fabricante com linha na posição aparece — nenhum fica de fora", () => {
    // A contraprova da guarda acima: três fabricantes em três situações
    // diferentes, e os três têm de estar na tela.
    render(
      <RecomendadorProtese
        catalogo={[
          linha({ id: "1", manufacturer: "Serve", effective_orifice_area: 2.4 }),
          linha({ id: "2", manufacturer: "NaoServe", effective_orifice_area: 0.6 }),
          semDado({ id: "3", manufacturer: "SemMedida" }),
        ]}
        bsa={BSA} imc={24} posicao="aortica"
      />,
    );
    const texto = document.body.textContent ?? "";
    for (const f of ["Serve", "NaoServe", "SemMedida"]) {
      expect(texto, `${f} não aparece em lugar nenhum da tela`).toContain(f);
    }
  });

  it("transcateter não entra na lista de escolha", () => {
    // O corte de escopo, cobrado na tela e não só na biblioteca.
    render(
      <RecomendadorProtese
        catalogo={[
          linha({ id: "1", manufacturer: "Cirurgica", effective_orifice_area: 2.4 }),
          linha({ id: "2", manufacturer: "Transcateter", type: "tavi", effective_orifice_area: 2.4 }),
        ]}
        bsa={BSA} imc={24} posicao="aortica"
      />,
    );
    const texto = document.body.textContent ?? "";
    expect(texto).toContain("Cirurgica");
    expect(texto, "prótese transcateter apareceu numa tela de escolha cirúrgica")
      .not.toContain("Transcateter");
  });
});
