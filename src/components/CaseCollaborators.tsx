import { useEffect, useState } from "react";
import { Users, Plus, Loader2, Check, X, Trash2, ShieldCheck, Eye, MessageSquare } from "lucide-react";
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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  caseId: string;
  isOwner: boolean;
}

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  aceito: "Aceito",
  recusado: "Recusou",
  removido: "Removido",
};
const statusColors: Record<string, string> = {
  pendente: "bg-warning/10 text-warning border-warning/30",
  aceito: "bg-success/10 text-success border-success/30",
  recusado: "bg-destructive/10 text-destructive border-destructive/30",
  removido: "bg-muted text-muted-foreground border-border",
};

export const CaseCollaborators = ({ caseId, isOwner }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [crm, setCrm] = useState("");
  const [crmUf, setCrmUf] = useState("SP");
  const [accessLevel, setAccessLevel] = useState<"leitura" | "comentar">("comentar");
  const [message, setMessage] = useState("");

  const load = async () => {
    const { data: collabs } = await supabase
      .from("case_collaborators")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });

    const docIds = [...new Set((collabs || []).map((c) => c.doctor_id))];
    const { data: docs } = docIds.length
      ? await supabase.from("doctors").select("id, user_id, crm, crm_uf, specialty").in("id", docIds)
      : { data: [] as any[] };
    const userIds = (docs || []).map((d: any) => d.user_id);
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
      : { data: [] as any[] };

    const enriched = (collabs || []).map((c) => {
      const d = docs?.find((x: any) => x.id === c.doctor_id);
      const p = d ? profs?.find((x: any) => x.user_id === d.user_id) : null;
      return { ...c, doctor: d ? { ...d, full_name: p?.full_name } : null };
    });
    setItems(enriched);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`collab-${caseId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "case_collaborators", filter: `case_id=eq.${caseId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [caseId]);

  const invite = async () => {
    if (!user) return;
    if (!crm.trim()) {
      toast.error("Informe o CRM");
      return;
    }
    setSaving(true);
    // Buscar médico pelo CRM
    const { data: doc } = await supabase
      .from("doctors")
      .select("id, user_id")
      .eq("crm", crm.trim())
      .eq("crm_uf", crmUf)
      .maybeSingle();

    if (!doc) {
      setSaving(false);
      toast.error("Médico não encontrado", { description: "Verifique o CRM e a UF." });
      return;
    }
    if (doc.user_id === user.id) {
      setSaving(false);
      toast.error("Você não pode convidar a si mesmo");
      return;
    }

    const { error } = await supabase.from("case_collaborators").insert({
      case_id: caseId,
      doctor_id: doc.id,
      invited_by: user.id,
      access_level: accessLevel,
      message: message.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao convidar", {
        description: error.code === "23505" ? "Este médico já foi convidado." : error.message,
      });
      return;
    }
    toast.success("Convite enviado");
    setCrm(""); setMessage(""); setAccessLevel("comentar");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este colaborador do caso?")) return;
    await supabase.from("case_collaborators").delete().eq("id", id);
    toast.success("Colaborador removido");
    load();
  };

  const respond = async (id: string, status: "aceito" | "recusado") => {
    const { error } = await supabase
      .from("case_collaborators")
      .update({ status: status as any, responded_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error("Erro", { description: error.message });
    else toast.success(status === "aceito" ? "Convite aceito" : "Convite recusado");
    load();
  };

  const accepted = items.filter((i) => i.status === "aceito");
  const myInvite = items.find((i) => i.status === "pendente" && i.doctor?.user_id === user?.id);

  return (
    <Card className="shadow-sm-soft">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" /> Colaboradores
          {accepted.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-1">{accepted.length}</Badge>
          )}
        </CardTitle>
        {isOwner && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" /> Convidar</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar médico para discutir o caso</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs">CRM</Label>
                    <Input value={crm} onChange={(e) => setCrm(e.target.value)} placeholder="123456" />
                  </div>
                  <div>
                    <Label className="text-xs">UF</Label>
                    <Input maxLength={2} value={crmUf} onChange={(e) => setCrmUf(e.target.value.toUpperCase())} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Nível de acesso</Label>
                  <Select value={accessLevel} onValueChange={(v: any) => setAccessLevel(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leitura">Somente leitura</SelectItem>
                      <SelectItem value="comentar">Pode comentar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Mensagem (opcional)</Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    placeholder="ex: Gostaria da sua opinião sobre a indicação cirúrgica."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={invite} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar convite"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Nenhum colaborador {isOwner ? "ainda. Convide um colega para uma segunda opinião." : "."}
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((c) => (
              <li key={c.id} className="p-3 rounded-lg border border-border bg-card">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">
                        Dr(a). {c.doctor?.full_name || "—"}
                      </p>
                      <Badge variant="outline" className={`text-[10px] ${statusColors[c.status]}`}>
                        {statusLabels[c.status]}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {c.access_level === "comentar" ? (
                          <><MessageSquare className="h-2.5 w-2.5 mr-1" /> Comenta</>
                        ) : (
                          <><Eye className="h-2.5 w-2.5 mr-1" /> Leitura</>
                        )}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      CRM {c.doctor?.crm}/{c.doctor?.crm_uf} {c.doctor?.specialty && `• ${c.doctor.specialty}`}
                    </p>
                    {c.message && (
                      <p className="text-xs text-muted-foreground mt-1.5 italic">"{c.message}"</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {myInvite?.id === c.id && (
                      <>
                        <Button size="sm" className="h-7" onClick={() => respond(c.id, "aceito")}>
                          <Check className="h-3.5 w-3.5" /> Aceitar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => respond(c.id, "recusado")}>
                          <X className="h-3.5 w-3.5" /> Recusar
                        </Button>
                      </>
                    )}
                    {isOwner && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {isOwner && accepted.length > 0 && (
          <p className="text-[11px] text-muted-foreground italic mt-3 inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Colaboradores aceitos têm acesso aos dados clínicos do caso para fins de discussão.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
