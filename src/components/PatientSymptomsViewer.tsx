import { useEffect, useState, useMemo } from "react";
import { format, subDays, startOfDay, parseISO } from "date-fns";
import { Activity, AlertTriangle, Pill, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface Props {
  patientId: string;
}

const intensityFields = [
  { key: "dyspnea", label: "Dispneia", color: "hsl(var(--primary))" },
  { key: "fatigue", label: "Fadiga", color: "hsl(var(--accent))" },
  { key: "chest_pain", label: "Dor torácica", color: "hsl(var(--destructive))" },
  { key: "palpitations", label: "Palpitações", color: "hsl(var(--warning))" },
];

export const PatientSymptomsViewer = ({ patientId }: Props) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [meds, setMeds] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  /** `null` = leu. Texto = não leu, e a tela não pode afirmar nada. */
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const since = format(subDays(new Date(), 60), "yyyy-MM-dd");
      // As três descartavam o erro, e esta é a leitura cega mais perigosa que
      // sobrou no projeto. Falhando, a tela mostrava ao médico:
      //
      //   · "Registros (60d): 0" e "Sintomas relevantes (14d): 0";
      //   · "Paciente ainda não registrou sintomas no diário.";
      //   · e — o pior — o card "Alertas recentes" NÃO ERA DESENHADO. Um
      //     paciente com dispneia ≥ 7, dor torácica ≥ 7 ou síncope nos últimos
      //     14 dias aparecia como tela limpa.
      //
      // Em valvopatia, sintomático × assintomático é a variável que decide
      // intervenção. Uma tela que transforma falha de rede em "assintomático"
      // não está mostrando menos: está afirmando o contrário do que existe, no
      // ponto exato onde a conduta muda.
      const [rSintomas, rMeds, rLogs] = await Promise.all([
        supabase.from("symptom_entries").select("*").eq("patient_id", patientId).is("deleted_at", null).gte("entry_date", since).order("entry_date", { ascending: false }),
        supabase.from("medications").select("*").eq("patient_id", patientId).eq("active", true).order("name"),
        supabase.from("medication_logs").select("status, log_date").eq("patient_id", patientId).gte("log_date", format(subDays(new Date(), 30), "yyyy-MM-dd")),
      ]);
      const falhou = rSintomas.error || rMeds.error || rLogs.error;
      if (falhou) {
        setErro(falhou.message);
        setLoading(false);
        return;
      }
      setEntries(rSintomas.data || []);
      setMeds(rMeds.data || []);
      setLogs(rLogs.data || []);
      setLoading(false);
    })();
  }, [patientId]);

  const chartData = useMemo(() => {
    const days: any[] = [];
    const today = startOfDay(new Date());
    for (let i = 29; i >= 0; i--) {
      const d = subDays(today, i);
      const iso = format(d, "yyyy-MM-dd");
      const found = entries.find((e) => e.entry_date === iso);
      days.push({
        date: format(d, "dd/MM"),
        dyspnea: found?.dyspnea ?? null,
        fatigue: found?.fatigue ?? null,
        chest_pain: found?.chest_pain ?? null,
        palpitations: found?.palpitations ?? null,
      });
    }
    return days;
  }, [entries]);

  const adherence = useMemo(() => {
    if (logs.length === 0) return null;
    const taken = logs.filter((l) => l.status === "tomado").length;
    return Math.round((taken / logs.length) * 100);
  }, [logs]);

  const recentSevere = entries.slice(0, 14).filter(
    (e) => e.dyspnea >= 7 || e.chest_pain >= 7 || e.syncope || (e.orthopnea && e.dyspnea >= 5)
  );

  if (loading) {
    return <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  // No lugar do painel inteiro, e não ao lado dele: os três números e o gráfico
  // seriam lidos como o quadro do paciente. Zerado, esse quadro diz
  // "assintomático" — e é justamente o que não se sabe.
  if (erro) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-7 w-7 text-destructive mx-auto mb-3" />
          <p className="font-medium text-foreground">
            Não foi possível carregar o diário de sintomas deste paciente.
          </p>
          <p className="text-sm text-foreground/85 max-w-md mx-auto leading-relaxed mt-2">
            <strong>Isto não quer dizer que ele esteja sem sintomas.</strong> É uma falha
            de leitura: pode haver registros, alertas e medicações que a tela não
            conseguiu buscar. Não conclua ausência de sintomas a partir desta tela —
            recarregue, e se continuar, pergunte ao paciente.
          </p>
          <p className="text-xs text-muted-foreground font-mono mt-3">{erro}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <Card className="shadow-sm-soft"><CardContent className="p-3">
          <p className="text-[11px] text-muted-foreground uppercase">Registros (60d)</p>
          <p className="text-xl font-serif text-primary">{entries.length}</p>
        </CardContent></Card>
        <Card className="shadow-sm-soft"><CardContent className="p-3">
          <p className="text-[11px] text-muted-foreground uppercase">Sintomas relevantes (14d)</p>
          <p className="text-xl font-serif text-foreground inline-flex items-center gap-1">
            {recentSevere.length}
            {recentSevere.length > 0 && <AlertTriangle className="h-4 w-4 text-destructive" />}
          </p>
        </CardContent></Card>
        <Card className="shadow-sm-soft"><CardContent className="p-3">
          <p className="text-[11px] text-muted-foreground uppercase">Adesão med. (30d)</p>
          <p className="text-xl font-serif text-primary">{adherence !== null ? `${adherence}%` : "—"}</p>
        </CardContent></Card>
      </div>

      <Card className="shadow-sm-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" /> Evolução de sintomas (30 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Paciente ainda não registrou sintomas no diário.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis domain={[0, 10]} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {intensityFields.map((f) => (
                  <Line key={f.key} type="monotone" dataKey={f.key} stroke={f.color} strokeWidth={2} dot={{ r: 2 }} connectNulls name={f.label} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {recentSevere.length > 0 && (
        <Card className="shadow-sm-soft border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-4 w-4" /> Alertas recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentSevere.slice(0, 5).map((e) => (
              <div key={e.id} className="text-sm p-2 rounded border border-destructive/20 bg-destructive/5">
                <p className="font-medium">{format(parseISO(e.entry_date), "dd/MM/yyyy")}</p>
                <p className="text-xs text-muted-foreground">
                  Dispneia {e.dyspnea}/10, Dor {e.chest_pain}/10
                  {e.syncope && " • síncope"}
                  {e.orthopnea && " • ortopneia"}
                </p>
                {e.notes && <p className="text-xs italic mt-0.5">"{e.notes}"</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {meds.length > 0 && (
        <Card className="shadow-sm-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Pill className="h-4 w-4 text-primary" /> Medicações ativas ({meds.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {meds.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 text-sm p-2 rounded border border-border bg-secondary/30">
                <div>
                  <p className="font-medium text-foreground">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{[m.dose, m.frequency].filter(Boolean).join(" • ")}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(m.times || []).map((t: string) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
