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
