import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Reseta o scroll para o topo a cada mudança de rota (pathname).
 * Preserva o scroll quando apenas o hash muda (âncoras internas) e
 * quando a navegação é POP (voltar/avançar do navegador).
 */
export const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Timeout garante execução após o novo conteúdo montar (Suspense/lazy).
    const id = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      // Alguns containers internos usam overflow-y-auto
      document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    });
    return () => window.cancelAnimationFrame(id);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
