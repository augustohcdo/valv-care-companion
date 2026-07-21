import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Pill, Plus, Loader2, Edit2, Trash2, Check, X, Clock, CalendarOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const emptyForm = {
  name: "",
  dose: "",
  frequency: "",
  times: ["08:00"] as string[],
  start_date: format(new Date(), "yyyy-MM-dd"),
  end_date: "",
  active: true,
  notes: "",
};

export default function PacienteMedicacoes() {
  const { user } = useAuth();
  const [patient, setPatient] = useState<any>(null);
  const [meds, setMeds] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);

  const today = format(new Date(), "yyyy-MM-dd");

  const load = async () => {
    if (!user) return;
    const { data: pat } = await supabase.from("patients").select("id").is("deleted_at", null).eq("user_id", user.id).maybeSingle();
    if (!pat) { setLoading(false); return; }
    setPatient(pat);
    const [{ data: m }, { data: l }] = await Promise.all([
      supabase.from("medications").select("*").eq("patient_id", pat.id).order("active", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("medication_logs").select("*").eq("patient_id", pat.id).eq("log_date", today),
    ]);
    setMeds(m || []);
    setLogs(l || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const reset = () => { setForm(emptyForm); setEditingId(null); };

  const startEdit = (m: any) => {
    setEditingId(m.id);
    setForm({
      name: m.name,
      dose: m.dose || "",
      frequency: m.frequency || "",
      times: m.times?.length ? m.times : ["08:00"],
      start_date: m.start_date,
      end_date: m.end_date || "",
      active: m.active,
      notes: m.notes || "",
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!patient) return;
    if (!form.name.trim()) { toast.error("Informe o nome do medicamento"); return; }
    setSaving(true);
    const payload: any = {
      patient_id: patient.id,
      name: form.name.trim(),
      dose: form.dose.trim() || null,
      frequency: form.frequency.trim() || null,
      times: form.times.filter((t: string) => t),
      start_date: form.start_date,
      end_date: form.end_date || null,
      active: form.active,
      notes: form.notes.trim() || null,
    };
    const { error } = editingId
      ? await supabase.from("medications").update(payload).eq("id", editingId)
      : await supabase.from("medications").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    toast.success(editingId ? "Atualizado" : "Medicação adicionada");
    reset();
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta medicação? O histórico de adesão será mantido.")) return;
    await supabase.from("medications").update({ active: false, end_date: today }).eq("id", id);
    toast.success("Medicação suspensa");
    load();
  };

  const logTake = async (med: any, time: string, status: "tomado" | "pulado") => {
    if (!patient) return;
    const existing = logs.find((l) => l.medication_id === med.id && l.scheduled_time === time);
    if (existing) {
      await supabase.from("medication_logs").update({ status, taken_at: status === "tomado" ? new Date().toISOString() : null }).eq("id", existing.id);
    } else {
      await supabase.from("medication_logs").insert({
        medication_id: med.id,
        patient_id: patient.id,
        log_date: today,
        scheduled_time: time,
        status,
        taken_at: status === "tomado" ? new Date().toISOString() : null,
      });
    }
    load();
  };

  const addTime = () => setForm({ ...form, times: [...form.times, "12:00"] });
  const updateTime = (i: number, v: string) => {
    const next = [...form.times]; next[i] = v; setForm({ ...form, times: next });
  };
  const removeTime = (i: number) => setForm({ ...form, times: form.times.filter((_: any, idx: number) => idx !== i) });

  const activeMeds = meds.filter((m) => m.active);

  if (loading) {
    return <div className="grid place-items-center min-h-[40vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Meu acompanhamento"
        title="Medicações e lembretes"
        description="Gerencie suas medicações e marque o que já tomou hoje."
        breadcrumbs={[{ label: "Início", to: "/app/paciente" }, { label: "Medicações" }]}
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4" /> Nova medicação</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar medicação" : "Adicionar medicação"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Nome do medicamento</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex: Losartana" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Dose</Label>
                    <Input value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} placeholder="50 mg" />
                  </div>
                  <div>
                    <Label className="text-xs">Frequência</Label>
                    <Input value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="1x ao dia" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Horários</Label>
                  <div className="space-y-1.5">
                    {form.times.map((t: string, i: number) => (
                      <div key={i} className="flex gap-2">
                        <Input type="time" value={t} onChange={(e) => updateTime(i, e.target.value)} />
                        {form.times.length > 1 && (
                          <Button size="icon" variant="ghost" onClick={() => removeTime(i)}><X className="h-4 w-4" /></Button>
                        )}
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={addTime} className="w-full">
                      <Plus className="h-3 w-3" /> Adicionar horário
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Início</Label>
                    <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Fim (opcional)</Label>
                    <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg border border-border bg-secondary/30">
                  <Label className="text-sm cursor-pointer">Ativa</Label>
                  <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                </div>
                <div>
                  <Label className="text-xs">Observações</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="ex: tomar com alimento" />
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
        }
      />

      {!patient ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Complete seu perfil para gerenciar medicações.
        </CardContent></Card>
      ) : activeMeds.length === 0 ? (
        <Card className="shadow-sm-soft">
          <CardContent className="p-10 text-center">
            <Pill className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="font-serif text-xl text-primary mb-2">Nenhuma medicação ativa</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Adicione suas medicações para receber lembretes e acompanhar a adesão.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="shadow-sm-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-primary" /> Checklist de hoje
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeMeds.flatMap((m) =>
                (m.times || []).map((t: string) => {
                  const log = logs.find((l) => l.medication_id === m.id && l.scheduled_time === t);
                  const taken = log?.status === "tomado";
                  const skipped = log?.status === "pulado";
                  return (
                    <div key={`${m.id}-${t}`} className={`flex items-center gap-3 p-3 rounded-lg border ${
                      taken ? "border-success/30 bg-success/5" : skipped ? "border-muted bg-muted/30" : "border-border bg-card"
                    }`}>
                      <div className="text-center shrink-0 w-14">
                        <Clock className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
                        <p className="text-sm font-bold">{t}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{m.name}</p>
                        {m.dose && <p className="text-xs text-muted-foreground">{m.dose} {m.frequency && `• ${m.frequency}`}</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={taken ? "default" : "outline"}
                          className={taken ? "bg-success text-success-foreground hover:bg-success/90" : ""}
                          onClick={() => logTake(m, t, "tomado")}
                        >
                          <Check className="h-3.5 w-3.5" /> {taken ? "Tomado" : "Tomar"}
                        </Button>
                        {!taken && (
                          <Button size="sm" variant="ghost" onClick={() => logTake(m, t, "pulado")}>
                            <CalendarOff className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Pill className="h-5 w-5 text-primary" /> Minhas medicações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {meds.map((m) => (
                <div key={m.id} className={`p-3 rounded-lg border ${m.active ? "border-border bg-card" : "border-border bg-secondary/30 opacity-70"}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{m.name}</p>
                        {!m.active && <Badge variant="secondary" className="text-[10px]">Suspensa</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {[m.dose, m.frequency].filter(Boolean).join(" • ")}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {(m.times || []).map((t: string) => (
                          <Badge key={t} variant="outline" className="text-[10px]">
                            <Clock className="h-2.5 w-2.5 mr-1" /> {t}
                          </Badge>
                        ))}
                      </div>
                      {m.notes && <p className="text-xs text-muted-foreground italic mt-1">"{m.notes}"</p>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(m)}><Edit2 className="h-3.5 w-3.5" /></Button>
                      {m.active && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
