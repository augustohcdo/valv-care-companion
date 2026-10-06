import { Skeleton } from "@/components/ui/skeleton";

interface PageSkeletonProps {
  variant?: "dashboard" | "list" | "detail" | "form";
}

/**
 * Skeleton padrão para uso em Suspense fallback ou enquanto dados carregam.
 * Mantém layout estável e evita CLS ao trocar de rota.
 *
 * ## `data-carregando="rota"`, e por que um atributo e não uma classe
 *
 * O verificador de rotas (`scripts/rotas-renderizam.mjs`) precisa esperar o
 * conteúdo da rota chegar antes de medir a tela — senão ele mede ESTE
 * esqueleto e relata "renderizou". Ele esperava `.animate-pulse`, que é a
 * animação do `<Skeleton>`, e isso quebrou de um jeito instrutivo:
 *
 * `animate-pulse` também é ENFEITE. Medido: quatro ocorrências fora do
 * `<Skeleton>`, e três delas em `PacienteHome` e `MedicoHome` — um blob
 * desfocado de `animationDuration: 6s` e dois pontinhos. São exatamente as duas
 * telas que a prova de sessão do workflow abre, então a espera nunca terminava
 * e a varredura saía 2 com "ficou 15s no spinner" sobre telas que renderizam.
 *
 * Classe de animação não distingue "estou carregando" de "sou decorativo".
 * Este atributo distingue: ele existe só aqui, e o verificador espera por ele.
 */
export const PageSkeleton = ({ variant = "dashboard" }: PageSkeletonProps) => {
  if (variant === "list") {
    return (
      <div data-carregando="rota" className="space-y-4 max-w-6xl animate-fade-in">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-72" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div data-carregando="rota" className="space-y-6 max-w-6xl animate-fade-in">
        <Skeleton className="h-8 w-2/3" />
        <div className="grid sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div data-carregando="rota" className="space-y-6 max-w-3xl animate-fade-in">
        <Skeleton className="h-9 w-1/2" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-carregando="rota" className="space-y-6 max-w-6xl animate-fade-in">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
};
