import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, Loader2, RefreshCw, DatabaseBackup,
  Stethoscope, HeartPulse, FolderOpen, Eye,
} from "lucide-react";

type ClientError = {
  id: string;
  source: "client" | "edge_function";
  context: string;
  message: string;
  stack: string | null;
  created_at: string;
  last_seen_at: string;
  occurrences: number;
  metadata: Record<string, unknown> | null;
};

/** `filename:linha`, quando o navegador informou de onde o erro veio. */
function origemDoErro(meta: Record<string, unknown> | null): string | null {
  const arquivo = typeof meta?.["filename"] === "string" ? (meta["filename"] as string) : null;
  if (!arquivo) return null;
  const linha = typeof meta?.["lineno"] === "number" ? meta["lineno"] : null;
  return linha ? `${arquivo}:${linha}` : arquivo;
}

type JobRun = {
  job: string;
  finished_at: string | null;
  items_ok: number;
  items_failed: number;
  details: Record<string, number> | null;
};

export const clientErrorsKey = () => ["client-errors"] as const;
export const jobRunsKey = () => ["job-runs"] as const;
export const siteMetricsKey = () => ["site-metrics"] as const;

/**
 * Números do site. Vêm de um RPC porque contar no cliente exigiria trazer as
 * linhas de paciente para o navegador do admin só para descartá-las depois.
 *
 * `visitas_30d` é sessão de navegador, não pessoa: quem volta amanhã conta de
 * novo. O rótulo na tela precisa dizer isso — não medimos visitante único
 * porque escolhemos não identificar ninguém, e um número verdadeiro com o nome
 * errado engana mais do que a ausência dele.
 */
type SiteMetrics = {
  medicos: number; medicos_30d: number;
  pacientes: number; pacientes_30d: number;
  casos: number; casos_30d: number;
  contas_confirmadas: number; contas_pendentes: number;
  views_30d: number; visitas_30d: number;
  top_paths: { path: string; views: number }[];
};

type WatchedJob = { job: string; label: string; stale_after_days: number };

export const watchedJobsKey = () => ["watched-jobs"] as const;

/**
 * O que cada tarefa conta quando está saudável. Fica no código porque é função,
 * não dado — a lista em si (quem é vigiado e por quanto tempo) vive em
 * `watched_jobs`, no banco, para não existir em dois lugares: era assim que a
 * lista de tabelas do backup ficava para trás sem ninguém notar.
 */
const DESCRICAO: Record<string, (r: JobRun) => string> = {
  "weekly-export": (r) => `${r.items_ok} tabelas, ${r.details?.["total_rows"] ?? 0} registros.`,
  "weekly-digest": (r) => `${r.items_ok} médico(s) notificado(s).`,
  "job-watchdog": (r) =>
    r.items_failed > 0
      ? `${r.items_failed} tarefa(s) com problema.`
      : `${r.items_ok} tarefa(s) verificada(s), tudo em dia.`,
};

const descrever = (job: string, r: JobRun) =>
  DESCRICAO[job]?.(r) ?? `${r.items_ok} item(ns) processado(s).`;

function MetricCard({
  icon, label, value, hint,
}: { icon: React.ReactNode; label: string; value: number; hint: string }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <p className="text-2xl font-bold">{value.toLocaleString("pt-BR")}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminErrors() {
  const [openStack, setOpenStack] = useState<string | null>(null);

  // Duas noções distintas de "carregando": `isLoading` é a primeira carga (o
  // spinner no meio da lista) e `isFetching` cobre também as recargas manuais
  // (o spinner dentro do botão). Usar só uma delas quebraria um dos dois.
  const { data: errors = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: clientErrorsKey(),
    queryFn: async (): Promise<ClientError[]> => {
      // Por última ocorrência, não por criação: um erro antigo que voltou a
      // acontecer agora importa mais que um erro novo que aconteceu uma vez.
      const { data, error } = await supabase
        .from("client_errors")
        .select("id, source, context, message, stack, created_at, last_seen_at, occurrences, metadata")
        .order("last_seen_at", { ascending: false })
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

  const { data: metrics } = useQuery({
    queryKey: siteMetricsKey(),
    queryFn: async (): Promise<SiteMetrics> => {
      const { data, error } = await supabase.rpc("admin_site_metrics");
      if (error) throw error;
      return data as unknown as SiteMetrics;
    },
  });

  const { data: watched = [], isLoading: loadingWatched } = useQuery({
    queryKey: watchedJobsKey(),
    queryFn: async (): Promise<WatchedJob[]> => {
      const { data, error } = await supabase
        .from("watched_jobs")
        .select("job, label, stale_after_days")
        .eq("enabled", true)
        .order("job");
      if (error) throw error;
      return (data as WatchedJob[]) ?? [];
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

      {metrics && (
        <section className="space-y-3">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={<Stethoscope className="h-5 w-5 text-primary" />}
              label="Médicos cadastrados"
              value={metrics.medicos}
              hint={`+${metrics.medicos_30d} nos últimos 30 dias`}
            />
            <MetricCard
              icon={<HeartPulse className="h-5 w-5 text-primary" />}
              label="Pacientes cadastrados"
              value={metrics.pacientes}
              hint={`+${metrics.pacientes_30d} nos últimos 30 dias`}
            />
            <MetricCard
              icon={<FolderOpen className="h-5 w-5 text-primary" />}
              label="Casos clínicos"
              value={metrics.casos}
              hint={`+${metrics.casos_30d} nos últimos 30 dias`}
            />
            <MetricCard
              icon={<Eye className="h-5 w-5 text-primary" />}
              label="Telas abertas (30 dias)"
              value={metrics.views_30d}
              hint={`${metrics.visitas_30d} sessão(ões) de navegador`}
            />
          </div>

          <Card>
            <CardContent className="p-4 text-sm space-y-3">
              <p className="text-muted-foreground">
                <strong className="text-foreground">{metrics.contas_confirmadas}</strong> conta(s) com
                e-mail confirmado
                {metrics.contas_pendentes > 0 && (
                  <> · <strong className="text-foreground">{metrics.contas_pendentes}</strong> aguardando confirmação</>
                )}
              </p>
              {/* Dizer o que o número é evita que ele seja lido como "pessoas". */}
              <p className="text-xs text-muted-foreground">
                A audiência é contada sem cookie, sem IP e sem identificador — por isso são telas
                abertas e sessões de navegador, não visitantes únicos. Quem volta outro dia conta
                como uma nova sessão.
              </p>
              {metrics.top_paths.length > 0 && (
                <div className="space-y-1">
                  <p className="font-medium">Páginas mais abertas (30 dias)</p>
                  <ul className="space-y-0.5">
                    {metrics.top_paths.map((p) => (
                      <li key={p.path} className="flex justify-between gap-4 font-mono text-xs">
                        <span className="truncate text-muted-foreground">{p.path}</span>
                        <span>{p.views}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {!loadingRuns && !loadingWatched && (
        <div className="grid gap-3 sm:grid-cols-2">
          {watched.map((j) => {
            const last = runs.find((r) => r.job === j.job);
            const ageDays = last?.finished_at
              ? (Date.now() - new Date(last.finished_at).getTime()) / 86_400_000
              : null;
            const stale = ageDays === null || ageDays > j.stale_after_days;
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
                        ? `Sem execução bem sucedida há mais de ${j.stale_after_days} dias — verifique o agendamento.`
                        : descrever(j.job, last!)}
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
                    {err.occurrences > 1 && (
                      <Badge variant="outline" className="text-xs">×{err.occurrences}</Badge>
                    )}
                  </div>
                  <div className="font-medium">{err.message}</div>
                  {origemDoErro(err.metadata) && (
                    <div className="font-mono text-xs text-muted-foreground break-all">
                      {origemDoErro(err.metadata)}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap text-right">
                  {new Date(err.last_seen_at).toLocaleString("pt-BR")}
                  {err.occurrences > 1 && (
                    <div className="text-[11px]">
                      1ª vez: {new Date(err.created_at).toLocaleString("pt-BR")}
                    </div>
                  )}
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
