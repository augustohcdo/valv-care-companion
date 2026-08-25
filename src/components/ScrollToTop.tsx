import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Coloca a página na posição certa a cada navegação.
 *
 * Regra antiga: topo a cada troca de `pathname`. O comentário dizia preservar
 * âncoras internas, e preservava — mas só quando **apenas** o hash mudava. Numa
 * navegação que troca as duas coisas (`/medicos#solicitar`, vinda do cabeçalho
 * de qualquer página), o reset ao topo vencia e a âncora não levava a lugar
 * nenhum: o médico caía no começo da página e tinha que procurar o formulário
 * de novo — o problema que o link existia para resolver.
 *
 * Com hash, então, o alvo é o elemento. Ele pode ainda não existir no primeiro
 * quadro, porque a página é `lazy` e entra por Suspense; por isso a busca
 * insiste por um tempo curto antes de desistir e cair no comportamento antigo.
 * O deslocamento do cabeçalho fixo vem do `scroll-mt-*` da própria seção.
 */
export const ScrollToTop = () => {
  const { pathname, hash } = useLocation();
  const anterior = useRef<string | null>(null);

  useEffect(() => {
    const mudouDePagina = anterior.current !== pathname;
    anterior.current = pathname;

    let cancelado = false;
    let quadro = 0;

    const aoTopo = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      // Alguns containers internos usam overflow-y-auto
      document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    };

    if (!hash) {
      // Sem hash: só reposiciona quando de fato trocou de página. Limpar o
      // hash na mesma página não é motivo para jogar a pessoa para o topo.
      if (!mudouDePagina) return;
      quadro = window.requestAnimationFrame(aoTopo);
      return () => window.cancelAnimationFrame(quadro);
    }

    const alvo = decodeURIComponent(hash.slice(1));
    const inicio = performance.now();

    const procurar = () => {
      if (cancelado) return;
      const el = document.getElementById(alvo);
      if (el) {
        el.scrollIntoView({ behavior: "auto", block: "start" });
        return;
      }
      // Até 3s: tempo de a página lazy baixar e montar numa conexão ruim.
      if (performance.now() - inicio < 3000) {
        quadro = window.requestAnimationFrame(procurar);
      } else if (mudouDePagina) {
        // Âncora inexistente não pode deixar a pessoa no meio da página
        // anterior; volta a ser o comportamento de sempre.
        aoTopo();
      }
    };

    quadro = window.requestAnimationFrame(procurar);
    return () => {
      cancelado = true;
      window.cancelAnimationFrame(quadro);
    };
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
