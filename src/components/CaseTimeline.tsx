import { useEffect, useState } from "react";
import {
  Plus,
  Loader2,
  Stethoscope,
  Activity,
  Scissors,
  BedDouble,
  LogOut,
  TrendingUp,
  AlertTriangle,
  Pill,
  StickyNote,
  Trash2,
  History,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { eventTypeLabels, eventTypeColors } from "@/lib/clinicalLabels";

const eventIcons: Record<string, any> = {
  consulta: Stethoscope,
  exame: Activity,
  cirurgia: Scissors,
  internacao: BedDouble,
  alta: LogOut,
  mudanca_nyha: TrendingUp,
  mudanca_severidade: AlertTriangle,
  observacao: StickyNote,
  medicacao: Pill,
};

interface Props {
  caseId: string;
  readOnly?: boolean;
}

export const CaseTimeline = ({ caseId, readOnly = false }: Props) => {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [eventType, setEventType] = useState("observacao");
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("case_events")
      .select("*")
      .eq("case_id", caseId)
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false });
    setEvents(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [caseId]);

  const reset = () => {
    setEventType("observacao");
    setEventDate(new Date().toISOString().slice(0, 10));
    setTitle("");
    setDescription("");
  };

  const submit = async () => {
    if (!user) return;
    if (!title.trim()) {
      toast.error("Informe o título do evento");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("case_events").insert({
      case_id: caseId,
      created_by: user.id,
      event_type: eventType as any,
      event_date: eventDate,
      title: title.trim(),
      description: description.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao registrar", { description: error.message });
      return;
    }
    toast.success("Evento registrado");
    reset();
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este evento?")) return;
    await supabase.from("case_events").delete().eq("id", id);
    toast.success("Evento removido");
    load();
  };

  return (
    <Card className="shadow-sm-soft">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5 text-primary" /> Timeline evolutiva
          <Badge variant="secondary" className="text-[10px] ml-1">{events.length}</Badge>
        </CardTitle>
        {!readOnly && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" /> Novo evento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar evento clínico</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select value={eventType} onValueChange={setEventType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(eventTypeLabels).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Data</Label>
                    <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Título do evento</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="ex: Eco de controle - área 0,8 cm²"
                  />
                </div>
                <div>
                  <Label className="text-xs">Descrição (opcional)</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Detalhes, achados, condutas..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={submit} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Nenhum evento registrado ainda.
          </div>
        ) : (
          <ol className="relative border-l-2 border-border ml-3 space-y-5">
            {events.map((e) => {
              const Icon = eventIcons[e.event_type] || StickyNote;
              return (
                <li key={e.id} className="ml-6 group">
                  <span className="absolute -left-[13px] h-6 w-6 rounded-full bg-card border-2 border-primary grid place-items-center">
                    <Icon className="h-3 w-3 text-primary" />
                  </span>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] ${eventTypeColors[e.event_type]}`}>
                          {eventTypeLabels[e.event_type]}
                        </Badge>
                        <time className="text-xs text-muted-foreground">
                          {new Date(e.event_date + "T00:00:00").toLocaleDateString("pt-BR")}
                        </time>
                      </div>
                      <p className="text-sm font-medium text-foreground mt-1">{e.title}</p>
                      {e.description && (
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                          {e.description}
                        </p>
                      )}
                    </div>
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                        onClick={() => remove(e.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
};
