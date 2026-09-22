import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Stub window.scrollTo for jsdom (not implemented)
window.scrollTo = (() => {}) as any;

// jsdom não implementa ResizeObserver, e o ResponsiveContainer do recharts o
// usa no mount — sem este stub, qualquer tela com gráfico visível estoura.
// Largura/altura ficam em 0, então a série não é desenhada: o gráfico em si
// não é testável aqui, só o resto da tela em volta dele.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!("ResizeObserver" in window)) {
  (window as any).ResizeObserver = ResizeObserverStub;
  (globalThis as any).ResizeObserver = ResizeObserverStub;
}

/**
 * `IntersectionObserver`, pelo mesmo motivo do de cima e com uma consequência
 * pior: sem ele, o render **estoura**.
 *
 * O `whileInView` do framer-motion o instancia no mount, e as páginas públicas
 * que animam por rolagem — `Aprender` e `Medicos` — não chegavam a renderizar
 * em teste nenhum. Quer dizer: elas estavam fora de toda varredura desta base,
 * e não por decisão: por uma peça que o jsdom não traz. Ausência de teste que
 * ninguém escolheu é a pior espécie, porque não aparece em lista de exceção.
 *
 * O stub nunca dispara o callback, então o elemento fica no estado inicial da
 * animação — mas ELE ESTÁ no DOM, e é isso que permite medir a tela. O que não
 * se testa por aqui é a animação em si.
 */
class IntersectionObserverStub {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): unknown[] { return []; }
}
if (!("IntersectionObserver" in window)) {
  (window as any).IntersectionObserver = IntersectionObserverStub;
  (globalThis as any).IntersectionObserver = IntersectionObserverStub;
}
