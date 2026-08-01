import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, RefreshCw, DatabaseBackup } from "lucide-react";

type ClientError = {
  id: string;
  source: "client" | "edge_function";
  context: string;
  message: string;
  stack: string | null;
  created_at: string;
};

type JobRun = {
  job: string;
  finished_at: string | null;
  items_ok: number;
  items_failed: number;
  details: Record<string, number> | null;
};

export const clientErrorsKey = () => ["client-errors"] as const;
export const jobRunsKey = () => ["job-runs"] as const;

/**
 * As tarefas agendadas que precisam dar sinal de vida, e em quantos dias o
 * silêncio vira alarme. Ambas rodam toda segunda-feira, daí o limite de 8.
 *
 * Uma tarefa que nunca rodou aparece vermelha desde o primeiro dia: foi
 * exatamente esse estado — agendado, "ativo", nunca tendo produzido nada — que
 * passou despercebido no backup e no resumo semanal.
 */
const WATCHED_JOBS: {
  job: string;
  label: string;
  staleDays: number;
  describe: (r: JobRun) => string;
}[] = [
  {
    job: "weekly-export",
    label: "Backup semanal",
    staleDays: 8,
    describe: (r) => `${r.items_ok} tabelas, ${r.details?.["total_rows"] ?? 0} registros.`,
  },
  {
    job: "weekly-digest",
    label: "Resumo semanal do médico",
    staleDays: 8,
    describe: (r) => `${r.items_ok} médico(s) notificado(s).`,
  },
];

export default function AdminErrors() {
  const [openStack, setOpenStack] = useState<string | null>(null);

  // Duas noções distintas de "carregando": `isLoading` é a primeira carga (o
  // spinner no meio da lista) e `isFetching` cobre também as recargas manuais
  // (o spinner dentro do botão). Usar só uma delas quebraria um dos dois.
  const { data: errors = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: clientErrorsKey(),
    queryFn: async (): Promise<ClientError[]> => {
      const { data, error } = await supabase
        .from("client_errors")
        .select("id, source, context, message, stack, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as ClientError[]) ?? [];
    },
  });

  // refetch(), não invalidateQueries(): só o refetch devolve a promessa que
  // mantém o botão girando até a resposta chegar.
  const reload = () => refetch();

  // Uma tarefa agendada que para de rodar precisa gritar. Esta tela ficou
  // semanas mostrando "nenhum erro" enquanto o export nunca produzia arquivo.
  const { data: runs = [], isLoading: loadingRuns } = useQuery({
    queryKey: jobRunsKey(),
    queryFn: async (): Promise<JobRun[]> => {
      const { data, error } = await supabase
        .from("job_runs")
        .select("job, finished_at, items_ok, items_failed, details")
        .eq("ok", true)
        .order("finished_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as JobRun[]) ?? [];
    },
  });

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-7 w-7 text-primary" /> Admin — Erros em produção
          </h1>
          <p className="text-muted-foreground">Últimos 100 erros capturados no cliente e nas edge functions.</p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Atualizar
        </Button>
      </header>

      {!loadingRuns && (
        <div className="grid gap-3 sm:grid-cols-2">
          {WATCHED_JOBS.map((j) => {
            const last = runs.find((r) => r.job === j.job);
            const ageDays = last?.finished_at
              ? (Date.now() - new Date(last.finished_at).getTime()) / 86_400_000
              : null;
            const stale = ageDays === null || ageDays > j.staleDays;
            return (
              <Card
                key={j.job}
                className={stale ? "border-destructive bg-destructive/5" : "border-success/40 bg-success/5"}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <DatabaseBackup
                    className={`h-5 w-5 mt-0.5 shrink-0 ${stale ? "text-destructive" : "text-success"}`}
                  />
                  <div className="text-sm">
                    <p className="font-medium">{j.label}</p>
                    <p className="font-medium">
                      {ageDays === null
                        ? "Nunca executou com sucesso"
                        : `Última execução há ${Math.floor(ageDays)} dia(s)`}
                    </p>
                    <p className="text-muted-foreground">
                      {ageDays === null
                        ? "Agendada, mas sem nenhuma execução bem sucedida registrada. Verifique o agendamento antes de confiar nela."
                        : stale
                        ? "Deveria rodar toda segunda-feira. Passou do prazo — verifique o agendamento."
                        : j.describe(last!)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        {errors.map((err) => (
          <Card key={err.id}>
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={err.source === "edge_function" ? "destructive" : "secondary"}>
                      {err.source === "edge_function" ? "edge function" : "cliente"}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">{err.context}</span>
                  </div>
                  <div className="font-medium">{err.message}</div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(err.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
              {err.stack && (
                <div>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setOpenStack(openStack === err.id ? null : err.id)}
                  >
                    {openStack === err.id ? "Ocultar stack" : "Ver stack"}
                  </button>
                  {openStack === err.id && (
                    <pre className="mt-2 bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">{err.stack}</pre>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {!errors.length && !isLoading && <p className="text-muted-foreground text-sm">Nenhum erro registrado.</p>}
      </div>
    </div>
  );
}
