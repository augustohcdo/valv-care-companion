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

export const clientErrorsKey = () => ["client-errors"] as const;
export const lastBackupKey = () => ["last-backup"] as const;

/** Depois de quantos dias um backup semanal passa a ser motivo de alarme. */
const BACKUP_STALE_DAYS = 8;

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

  // Um backup que para de rodar precisa gritar. Esta tela ficou semanas
  // mostrando "nenhum erro" enquanto o export nunca produzia arquivo nenhum.
  const { data: lastBackup, isLoading: loadingBackup } = useQuery({
    queryKey: lastBackupKey(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backup_runs")
        .select("finished_at, ok, tables_ok, tables_failed, total_rows, error")
        .eq("ok", true)
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const backupAgeDays = lastBackup?.finished_at
    ? (Date.now() - new Date(lastBackup.finished_at).getTime()) / 86_400_000
    : null;
  const backupStale = backupAgeDays === null || backupAgeDays > BACKUP_STALE_DAYS;

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

      {!loadingBackup && (
        <Card className={backupStale ? "border-destructive bg-destructive/5" : "border-success/40 bg-success/5"}>
          <CardContent className="p-4 flex items-start gap-3">
            <DatabaseBackup className={`h-5 w-5 mt-0.5 shrink-0 ${backupStale ? "text-destructive" : "text-success"}`} />
            <div className="text-sm">
              <p className="font-medium">
                {backupAgeDays === null
                  ? "Nenhum backup registrado"
                  : backupStale
                  ? `Último backup há ${Math.floor(backupAgeDays)} dias`
                  : `Último backup há ${Math.floor(backupAgeDays)} dia(s)`}
              </p>
              <p className="text-muted-foreground">
                {backupAgeDays === null
                  ? "O export semanal nunca concluiu com sucesso. Verifique o agendamento antes de confiar em qualquer recuperação."
                  : backupStale
                  ? "O export semanal deveria rodar toda segunda-feira. Passou do prazo — verifique o agendamento."
                  : `${lastBackup?.tables_ok} tabelas, ${lastBackup?.total_rows} registros.`}
              </p>
            </div>
          </CardContent>
        </Card>
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
