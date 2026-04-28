import {
  CheckCircle2,
  Loader2,
  AlertTriangle,
  RotateCw,
  X,
  Download,
} from "lucide-react";
import { useExportQueue } from "@/hooks/useExportQueue";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

/**
 * Dock flutuante (canto inferior direito) que mostra exportações ativas,
 * concluídas e com erro. Permite retry e dispensar.
 *
 * - Aparece automaticamente quando há jobs.
 * - Em mobile sobe acima do MobileBottomNav (bottom-20).
 */
export const ExportQueueDock = () => {
  const { jobs, retry, dismiss, clearFinished } = useExportQueue();

  if (jobs.length === 0) return null;

  const hasFinished = jobs.some(
    (j) => j.status === "success" || j.status === "error",
  );

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 bottom-20 lg:bottom-4 z-50 w-[min(92vw,360px)] animate-fade-in"
    >
      <div className="rounded-2xl border border-border bg-card/95 backdrop-blur shadow-lg-soft overflow-hidden">
        <header className="px-4 py-2.5 flex items-center justify-between border-b border-border bg-secondary/40">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium text-foreground">
              Exportações
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({jobs.length})
              </span>
            </p>
          </div>
          {hasFinished && (
            <button
              onClick={clearFinished}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpar concluídos
            </button>
          )}
        </header>

        <ul className="max-h-[60vh] overflow-y-auto divide-y divide-border">
          {jobs.map((job) => (
            <li key={job.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <StatusIcon status={job.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {job.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {statusLabel(job)}
                  </p>

                  {(job.status === "loading" || job.status === "running") && (
                    <Progress
                      value={job.progress ?? (job.status === "loading" ? 25 : 70)}
                      className="h-1 mt-2"
                    />
                  )}

                  {job.status === "error" && job.error && (
                    <p className="text-[11px] text-destructive mt-1.5 line-clamp-2">
                      {job.error}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 -mr-1">
                  {job.status === "error" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => retry(job.id)}
                      title="Tentar novamente"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {(job.status === "success" || job.status === "error") && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => dismiss(job.id)}
                      title="Dispensar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

function StatusIcon({ status }: { status: string }) {
  if (status === "success")
    return <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />;
  if (status === "error")
    return <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />;
  return (
    <Loader2 className="h-4 w-4 text-primary shrink-0 mt-0.5 animate-spin" />
  );
}

function statusLabel(job: { status: string; attempts: number }) {
  switch (job.status) {
    case "queued":
      return "Aguardando na fila…";
    case "loading":
      return "Carregando gerador…";
    case "running":
      return "Gerando arquivo…";
    case "success":
      return "Concluído";
    case "error":
      return job.attempts > 1
        ? `Falhou (tentativa ${job.attempts})`
        : "Falhou — toque para tentar novamente";
    default:
      return "";
  }
}
