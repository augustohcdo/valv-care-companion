import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Contador de audiência sem rastrear ninguém.
 *
 * Manda ao servidor apenas o caminho da rota — sem cookie, sem identificador,
 * sem nada que ligue duas visualizações à mesma pessoa. O servidor ainda
 * normaliza o caminho (`/casos/<uuid>` vira `/casos/:id`) antes de contar, de
 * modo que nem o que a pessoa abriu especificamente é guardado.
 *
 * A única marca local é um booleano em `sessionStorage`, que diz "esta aba já
 * foi contada como uma visita". Ele morre quando a aba fecha, não sai do
 * navegador e não contém identificador — é o que permite separar "telas
 * abertas" de "sessões iniciadas" sem saber quem é quem.
 *
 * Consequência que o painel precisa respeitar: isto NÃO conta visitantes
 * únicos. Quem volta amanhã conta como duas visitas. Um número verdadeiro
 * respondendo a pergunta errada seria pior que não ter número.
 */
const CHAVE_SESSAO = "vp:visita";

export default function PageViewTracker() {
  const { pathname } = useLocation();
  // Em desenvolvimento o StrictMode monta duas vezes; sem isto a primeira tela
  // contaria dobrado só na máquina de quem programa.
  const ultimo = useRef<string | null>(null);

  useEffect(() => {
    if (ultimo.current === pathname) return;
    ultimo.current = pathname;

    let novaVisita = false;
    try {
      if (!sessionStorage.getItem(CHAVE_SESSAO)) {
        sessionStorage.setItem(CHAVE_SESSAO, "1");
        novaVisita = true;
      }
    } catch {
      // Navegador com armazenamento bloqueado: conta a visualização e não a
      // visita. Melhor um número a menos que uma tela quebrada.
    }

    // Sem await e sem tratar erro na tela: se a contagem falhar, quem está
    // navegando não tem nada com isso.
    void supabase
      .rpc("record_page_view", { _path: pathname, _new_visit: novaVisita })
      .then(({ error }) => {
        if (error) console.debug("contagem de página não registrada", error.message);
      });
  }, [pathname]);

  return null;
}
