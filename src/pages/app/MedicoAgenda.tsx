import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, isSameDay, startOfMonth, endOfMonth, addMonths, subMonths, isToday, isAfter, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, MapPin, Clock, FileText, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { appointmentTypeLabels, appointmentStatusLabels, appointmentStatusColors } from "@/lib/clinicalLabels";
import { cn } from "@/lib/utils";

interface Appt {
  id: string;
  case_id: string;
  scheduled_at: string;
  duration_minutes: number;
  appointment_type: string;
  status: string;
  location: string | null;
  notes: string | null;
  clinical_cases?: { id: string; patient_name: string };
}

export default function MedicoAgenda() {
  const { user } = useAuth();
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<Date>(new Date());
  const [selected, setSelected] = useState<Date>(new Date());

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: doc } = await supabase.from("doctors").select("id").eq("user_id", user.id).maybeSingle();
      if (!doc) { setLoading(false); return; }
      const { data: cases } = await supabase.from("clinical_cases").select("id").is("deleted_at", null).eq("doctor_id", doc.id).neq("status", "draft" as any);
      const ids = (cases ?? []).map((c) => c.id);
      if (ids.length === 0) { setAppts([]); setLoading(false); return; }
      const { data } = await supabase
        .from("appointments")
        .select("id, case_id, scheduled_at, duration_minutes, appointment_type, status, location, notes, clinical_cases(id, patient_name)")
        .in("case_id", ids)
        .order("scheduled_at", { ascending: true });
      setAppts((data as any) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const firstDayWeekday = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDayWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));

  const apptsByDay = useMemo(() => {
    const map: Record<string, Appt[]> = {};
    appts.forEach((a) => {
      const key = format(new Date(a.scheduled_at), "yyyy-MM-dd");
      (map[key] ||= []).push(a);
    });
    return map;
  }, [appts]);

  const selectedAppts = apptsByDay[format(selected, "yyyy-MM-dd")] ?? [];
  const now = startOfDay(new Date());
  const upcoming = appts.filter((a) => isAfter(new Date(a.scheduled_at), now) && a.status === "agendado").slice(0, 5);
  const past = appts.filter((a) => isBefore(new Date(a.scheduled_at), now)).slice(-5).reverse();

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <p className="text-sm text-muted-foreground">Área médica</p>
        <h1 className="font-serif text-3xl lg:text-4xl text-primary mt-1 flex items-center gap-3">
          <CalendarIcon className="h-7 w-7" /> Agenda consolidada
        </h1>
        <p className="text-muted-foreground mt-1 max-w-3xl">
          Todos os retornos e compromissos dos seus casos clínicos em uma única visão.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendário */}
        <Card className="lg:col-span-2 shadow-sm-soft">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base capitalize">
              {format(cursor, "MMMM yyyy", { locale: ptBR })}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setCursor(subMonths(cursor, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setCursor(new Date()); setSelected(new Date()); }}>
                Hoje
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
              {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                <div key={i} className="py-1 font-medium">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, idx) => {
                if (!day) return <div key={idx} className="aspect-square" />;
                const key = format(day, "yyyy-MM-dd");
                const dayAppts = apptsByDay[key] ?? [];
                const isSel = isSameDay(day, selected);
                return (
                  <button
                    key={idx}
                    onClick={() => setSelected(day)}
                    className={cn(
                      "aspect-square rounded-lg border text-sm flex flex-col items-center justify-center gap-0.5 transition-colors relative",
                      isSel
                        ? "bg-primary text-primary-foreground border-primary"
                        : isToday(day)
                        ? "border-primary/50 bg-primary/5 text-foreground"
                        : "border-border bg-card hover:bg-secondary text-foreground",
                    )}
                  >
                    <span className="font-medium">{day.getDate()}</span>
                    {dayAppts.length > 0 && (
                      <div className="flex gap-0.5">
                        {dayAppts.slice(0, 3).map((_, i) => (
                          <span
                            key={i}
                            className={cn(
                              "h-1 w-1 rounded-full",
                              isSel ? "bg-primary-foreground" : "bg-primary",
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 pt-6 border-t border-border">
              <h3 className="font-serif text-lg text-primary mb-3 capitalize">
                {format(selected, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </h3>
              {selectedAppts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nenhum compromisso neste dia.</p>
              ) : (
                <div className="space-y-2">
                  {selectedAppts.map((a) => (
                    <ApptRow key={a.id} appt={a} />
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lateral: próximos + recentes */}
        <div className="space-y-6">
          <Card className="shadow-sm-soft">
            <CardHeader>
              <CardTitle className="text-base">Próximos compromissos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum compromisso futuro agendado.</p>
              ) : (
                upcoming.map((a) => <ApptRow key={a.id} appt={a} compact />)
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm-soft">
            <CardHeader>
              <CardTitle className="text-base">Recentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {past.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem histórico recente.</p>
              ) : (
                past.map((a) => <ApptRow key={a.id} appt={a} compact />)
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ApptRow({ appt, compact }: { appt: Appt; compact?: boolean }) {
  const dt = new Date(appt.scheduled_at);
  const patient = appt.clinical_cases?.patient_name ?? "Paciente";
  return (
    <Link
      to={`/app/medico/casos/${appt.case_id}`}
      className="block rounded-lg border border-border bg-card p-3 hover:bg-secondary/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-foreground truncate">{patient}</p>
          <p className="text-xs text-muted-foreground">
            {appointmentTypeLabels[appt.appointment_type]}
          </p>
        </div>
        <Badge variant="outline" className={cn("text-[10px] shrink-0", appointmentStatusColors[appt.status])}>
          {appointmentStatusLabels[appt.status]}
        </Badge>
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {format(dt, "dd/MM HH:mm")} · {appt.duration_minutes}min
        </span>
        {appt.location && !compact && (
          <span className="flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3" /> {appt.location}
          </span>
        )}
      </div>
      {appt.notes && !compact && (
        <p className="text-xs text-muted-foreground mt-1.5 flex items-start gap-1">
          <FileText className="h-3 w-3 mt-0.5 shrink-0" /> {appt.notes}
        </p>
      )}
    </Link>
  );
}
