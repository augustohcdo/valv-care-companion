import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import BibliotecaDetalhe from "./BibliotecaDetalhe";
import { tutoriaisDoTopico, SEM_TUTORIAL } from "@/data/mmcts";

/**
 * A seção de técnica cirúrgica, e o silêncio deliberado dela.
 *
 * Os tutoriais do MMCTS entram por tópico. Duas coisas precisam ficar presas:
 *
 * 1. o link tem de **abrir o tutorial certo** — o id manda, e o endereço é
 *    montado dele, para a tela nunca abrir uma página diferente da que o
 *    `conferir-mmcts.mjs` conferiu;
 * 2. onde não há tutorial, a seção **some inteira**. O motivo de não haver está
 *    registrado em `SEM_TUTORIAL` e é informação para quem mantém o catálogo,
 *    não para quem lê sobre anticoagulação. Seção vazia com explicação é o
 *    ruído que acabou de sair do catálogo de próteses a pedido do usuário.
 */

const abrir = (slug: string) =>
  render(
    <MemoryRouter initialEntries={[`/app/medico/biblioteca/${slug}`]}>
      <Routes>
        <Route path="/app/medico/biblioteca/:slug" element={<BibliotecaDetalhe />} />
      </Routes>
    </MemoryRouter>,
  );

describe("técnica cirúrgica na biblioteca", () => {
  it("tópico COM tutorial: mostra o título e aponta para o id certo", () => {
    const esperados = tutoriaisDoTopico("insuficiencia-mitral");
    expect(esperados.length, "a fixture do teste ficou vazia").toBeGreaterThan(0);

    const { container } = abrir("insuficiencia-mitral");
    const texto = container.textContent ?? "";
    expect(texto).toMatch(/Técnica cirúrgica em vídeo/i);

    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    for (const t of esperados) {
      expect(texto, `não mostra o título do tutorial ${t.id}`).toContain(t.titulo);
      expect(hrefs, `não linka o tutorial ${t.id}`).toContain(`https://mmcts.org/tutorial/${t.id}`);
    }
  });

  it("tópico SEM tutorial: a seção não aparece, nem o motivo", () => {
    const slug = Object.keys(SEM_TUTORIAL)[0];
    expect(tutoriaisDoTopico(slug).length, "este tópico deveria estar sem tutorial").toBe(0);

    const { container } = abrir(slug);
    const texto = container.textContent ?? "";
    expect(texto, "desenhou a seção de técnica sem ter tutorial").not.toMatch(/Técnica cirúrgica em vídeo/i);
    expect(texto, "vazou para a tela o motivo, que é nota interna").not.toContain(SEM_TUTORIAL[slug]);
  });

  it("os links abrem fora, sem levar a sessão junto", () => {
    // `target="_blank"` sem `rel="noopener"` dá à página aberta acesso a
    // `window.opener`. Num aplicativo com sessão de médico, isso não é detalhe.
    const { container } = abrir("estenose-aortica");
    const externos = [...container.querySelectorAll('a[href^="https://mmcts.org"]')];
    expect(externos.length).toBeGreaterThan(0);
    for (const a of externos) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel") ?? "", a.getAttribute("href") ?? "").toContain("noopener");
    }
  });
});
