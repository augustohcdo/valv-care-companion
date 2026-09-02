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
 * O selo de mercado brasileiro, nos quatro estados.
 *
 * O catálogo foi auditado durante rodadas contra páginas americanas, o que
 * responde à pergunta errada para quem opera aqui: uma prótese pode ter saído de
 * linha nos EUA e continuar sendo implantada no Brasil, e o contrário também.
 *
 * O selo nasceu na rodada passada e **nunca foi renderizado em teste** — toda
 * fixture deste arquivo tem `mercado_br: null`, então o ramo que desenha o selo
 * nunca rodava. Um componente que nenhum teste exercita é um componente cujo
 * verde não significa nada.
 *
 * Os quatro estados, e por que o último importa tanto quanto os outros:
 *
 *   · confirmado COM registro   → mostra o número da ANVISA
 *   · confirmado SEM registro   → diz que se vende aqui e NÃO inventa número
 *   · não confirmado            → ressalva COM data, e a prótese CONTINUA na tela
 *   · nulo                      → selo nenhum, porque ninguém procurou ainda
 */
describe("selo de mercado brasileiro", () => {
  const comMercado = (over: Partial<ProteseDoCatalogo>) =>
    ({ data: [linha(over)], isLoading: false, error: null });

  it("confirmado com registro: mostra o número da ANVISA", () => {
    mockUseCatalogo.mockReturnValue(comMercado({
      manufacturer: "Labcor", model_name: "Dokimos Plus Aórtica",
      mercado_br: "confirmado", anvisa_registro: "10171250041",
      mercado_br_conferido_em: "2026-08-31",
    }));
    render(<CatalogoProteses />);
    expect(document.body.textContent ?? "").toContain("ANVISA 10171250041");
  });

  it("confirmado sem registro: diz que se vende aqui e não inventa número", () => {
    // A distinção que justifica os dois campos separados: distribuidor
    // brasileiro prova a venda sem publicar o registro. Fabricar um número para
    // preencher o selo seria a pior coisa possível num catálogo clínico.
    mockUseCatalogo.mockReturnValue(comMercado({
      manufacturer: "Medtronic", model_name: "Hancock II",
      mercado_br: "confirmado", anvisa_registro: null,
      mercado_br_conferido_em: "2026-08-31",
    }));
    render(<CatalogoProteses />);
    const texto = document.body.textContent ?? "";
    expect(texto).toContain("vendida no Brasil");
    expect(texto, "inventou um número de registro").not.toMatch(/ANVISA \d/);
  });

  it("não confirmado: ressalva com data, e a prótese CONTINUA na tela", () => {
    // A contraprova de que ressalva não é remoção. Tirar do catálogo uma prótese
    // que talvez esteja na prateleira do serviço é pior do que mantê-la com a
    // ressalva — decisão do usuário, e é o que este teste prende.
    mockUseCatalogo.mockReturnValue(comMercado({
      manufacturer: "Corcym", model_name: "Perceval Plus",
      mercado_br: "nao_confirmado", anvisa_registro: null,
      mercado_br_conferido_em: "2026-08-31",
    }));
    render(<CatalogoProteses />);
    const texto = document.body.textContent ?? "";
    expect(texto, "a família sumiu do catálogo por não ter sido confirmada").toContain("Perceval Plus");
    expect(texto).toMatch(/registro brasileiro não confirmado em 2026-08-31/);
  });

  it("nulo: nenhum selo, porque ninguém procurou ainda", () => {
    // O terceiro estado do projeto inteiro. Desenhar "não confirmado" aqui seria
    // afirmar uma busca que não houve.
    mockUseCatalogo.mockReturnValue(comMercado({
      mercado_br: null, anvisa_registro: null, mercado_br_conferido_em: null,
    }));
    render(<CatalogoProteses />);
    const texto = document.body.textContent ?? "";
    expect(texto, "afirmou busca que não aconteceu").not.toMatch(/não confirmado/i);
    expect(texto).not.toMatch(/vendida no Brasil/);
    expect(texto).not.toMatch(/ANVISA \d/);
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
