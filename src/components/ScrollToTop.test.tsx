import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ScrollToTop } from "./ScrollToTop";

/**
 * O reposicionamento a cada navegação, medido em vez de suposto.
 *
 * O caso que motivou este teste: o cabeçalho leva a `/medicos#solicitar` de
 * qualquer página, e a âncora **não funcionava**. O reset ao topo disparava na
 * troca de `pathname` e ignorava o hash, então o médico chegava no começo da
 * página e tinha que procurar o formulário — o contrário do que o link prometia.
 * Foi visto no navegador, não deduzido do código.
 *
 * É o tipo de coisa que volta a quebrar sem ninguém notar: continua havendo
 * navegação, continua havendo página, e só o destino final está errado.
 */

function montar(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <ScrollToTop />
    </MemoryRouter>,
  );
}

describe("ScrollToTop", () => {
  let scrollTo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    // jsdom não implementa nenhum dos dois.
    Element.prototype.scrollIntoView = vi.fn();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sem hash, volta ao topo", async () => {
    montar("/aprender");
    await waitFor(() => expect(scrollTo).toHaveBeenCalled());
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
  });

  it("com hash, rola até a seção — e não ao topo", async () => {
    const alvo = document.createElement("section");
    alvo.id = "solicitar";
    document.body.appendChild(alvo);

    montar("/medicos#solicitar");

    await waitFor(() => expect(alvo.scrollIntoView).toHaveBeenCalled());
    expect(scrollTo, "voltou ao topo mesmo com âncora").not.toHaveBeenCalled();
  });

  it("espera a seção aparecer: a página é lazy e monta depois", async () => {
    // Sem a espera, a âncora falharia sempre em produção e sempre passaria num
    // teste que criasse o elemento antes de montar.
    montar("/medicos#solicitar");

    const alvo = document.createElement("section");
    alvo.id = "solicitar";
    await new Promise((r) => setTimeout(r, 60));
    document.body.appendChild(alvo);

    await waitFor(() => expect(alvo.scrollIntoView).toHaveBeenCalled(), { timeout: 2000 });
  });

  it("âncora inexistente não deixa a pessoa parada no meio da página anterior", async () => {
    montar("/medicos#secao-que-nao-existe");
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 })), {
      timeout: 5000,
    });
  });
});
