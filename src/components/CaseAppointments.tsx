import { useEffect, useState } from "react";
import {
  CalendarDays,
  Plus,
  Loader2,
  MapPin,
  Clock,
  Trash2,
  Edit2,
  Calendar as CalIcon,
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
import {
  appointmentTypeLabels,
  appointmentStatusLabels,
  appointmentStatusColors,
} from "@/lib/clinicalLabels";

interface Props {
  caseId: string;
  readOnly?: boolean;
}

const toLocalInput = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export const CaseAppointments = ({ caseId, readOnly = false }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [type, setType] = useState("consulta_retorno");
  const [scheduledAt, setScheduledAt] = useState(() => toLocalInput(new Date(Date.now() + 7 * 86400000)));
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("case_id", caseId)
      .order("scheduled_at", { ascending: true });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [caseId]);

  const reset = () => {
    setType("consulta_retorno");
    setScheduledAt(toLocalInput(new Date(Date.now() + 7 * 86400000)));
    setDuration(30);
    setLocation("");
    setNotes("");
    setEditingId(null);
  };

  const startEdit = (a: any) => {
    setEditingId(a.id);
    setType(a.appointment_type);
    setScheduledAt(toLocalInput(new Date(a.scheduled_at)));
    setDuration(a.duration_minutes);
    setLocation(a.location || "");
    setNotes(a.notes || "");
    setOpen(true);
  };

  const submit = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      case_id: caseId,
      created_by: user.id,
      appointment_type: type as any,
      scheduled_at: new Date(scheduledAt).toISOString(),
      duration_minutes: duration,
      location: location.trim() || null,
      notes: notes.trim() || null,
    };
    const { error } = editingId
      ? await supabase.from("appointments").update(payload).eq("id", editingId)
      : await supabase.from("appointments").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    toast.success(editingId ? "Compromisso atualizado" : "Compromisso agendado");
    reset();
    setOpen(false);
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("appointments").update({ status: status as any }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este compromisso?")) return;
    await supabase.from("appointments").delete().eq("id", id);
    toast.success("Compromisso removido");
    load();
  };

  const upcoming = items.filter((a) => a.status === "agendado" && new Date(a.scheduled_at) >= new Date());
  const past = items.filter((a) => !upcoming.includes(a));

  return (
    <Card className="shadow-sm-soft">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarDays className="h-5 w-5 text-primary" /> Agenda de retornos
          {upcoming.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-1">
              {upcoming.length} próximo{upcoming.length > 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
        {!readOnly && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" /> Agendar</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar compromisso" : "Novo compromisso"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(appointmentTypeLabels).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Duração (min)</Label>
                    <Input
                      type="number"
                      min={15}
                      step={15}
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Data e hora</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Local (opcional)</Label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="ex: Hospital São Lucas - Sala 305"
                  />
                </div>
                <div>
                  <Label className="text-xs">Observações</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={submit} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <CalIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Nenhum compromisso agendado.
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Próximos</p>
                <ul className="space-y-2">
                  {upcoming.map((a) => (
                    <AppointmentItem
                      key={a.id}
                      appointment={a}
                      readOnly={readOnly}
                      onEdit={() => startEdit(a)}
                      onStatus={(s) => updateStatus(a.id, s)}
                      onDelete={() => remove(a.id)}
                    />
                  ))}
                </ul>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 mt-4">Histórico</p>
                <ul className="space-y-2">
                  {past.map((a) => (
                    <AppointmentItem
                      key={a.id}
                      appointment={a}
                      readOnly={readOnly}
                      past
                      onEdit={() => startEdit(a)}
                      onStatus={(s) => updateStatus(a.id, s)}
                      onDelete={() => remove(a.id)}
                    />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

function AppointmentItem({
  appointment: a,
  readOnly,
  past,
  onEdit,
  onStatus,
  onDelete,
}: {
  appointment: any;
  readOnly: boolean;
  past?: boolean;
  onEdit: () => void;
  onStatus: (s: string) => void;
  onDelete: () => void;
}) {
  const date = new Date(a.scheduled_at);
  return (
    <li className={`p-3 rounded-lg border ${past ? "border-border bg-secondary/30" : "border-primary/30 bg-primary/5"}`}>
      <div className="flex items-start gap-3">
        <div className="text-center shrink-0 w-12">
          <p className="text-[10px] uppercase text-muted-foreground">
            {date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
          </p>
          <p className="text-xl font-bold text-foreground leading-tight">{date.getDate()}</p>
          <p className="text-[10px] text-muted-foreground">{date.getFullYear()}</p>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground">
              {appointmentTypeLabels[a.appointment_type]}
            </p>
            <Badge variant="outline" className={`text-[10px] ${appointmentStatusColors[a.status]}`}>
              {appointmentStatusLabels[a.status]}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} • {a.duration_minutes}min
            </span>
            {a.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {a.location}
              </span>
            )}
          </div>
          {a.notes && <p className="text-xs text-muted-foreground mt-1.5">{a.notes}</p>}
        </div>
      </div>

      {!readOnly && (
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/60">
          {a.status === "agendado" && (
            <>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onStatus("realizado")}>
                Marcar realizado
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onStatus("cancelado")}>
                Cancelar
              </Button>
            </>
          )}
          <div className="flex-1" />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </li>
  );
}
