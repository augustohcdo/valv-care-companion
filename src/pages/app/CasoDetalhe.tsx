import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2, Loader2, Save, Activity } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  valveTypeLabels, valveDiseaseLabels, severityLabels, severityColors,
  caseStatusLabels, nyhaLabels,
} from "@/lib/clinicalLabels";
import { CaseDocuments } from "@/components/CaseDocuments";
import { CaseTimeline } from "@/components/CaseTimeline";
import { CaseAppointments } from "@/components/CaseAppointments";

export default function CasoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [caso, setCaso] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data, error } = await supabase
        .from("clinical_cases").select("*").eq("id", id).maybeSingle();
      if (error || !data) {
        toast.error("Caso não encontrado");
        navigate("/app/medico/casos");
        return;
      }
      setCaso(data);
      setStatus(data.status);
      setNotes(data.clinical_notes || "");
      setLoading(false);
    })();
  }, [id, user, navigate]);

  const saveChanges = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("clinical_cases")
      .update({ status: status as any, clinical_notes: notes })
      .eq("id", id!);
    setSaving(false);
    if (error) toast.error("Erro ao salvar", { description: error.message });
    else toast.success("Caso atualizado");
  };

  const deleteCase = async () => {
    const { error } = await supabase.from("clinical_cases").delete().eq("id", id!);
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success("Caso removido");
      navigate("/app/medico/casos");
    }
  };

  if (loading || !caso) {
    return <div className="grid place-items-center min-h-[40vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Caso clínico"
        title={caso.patient_name}
        description={`${valveTypeLabels[caso.valve_type]} — ${valveDiseaseLabels[caso.valve_disease]}`}
        breadcrumbs={[
          { label: "Início", to: "/app/medico" },
          { label: "Casos", to: "/app/medico/casos" },
          { label: caso.patient_name },
        ]}
        actions={
          <>
            <Button variant="outline" asChild><Link to="/app/medico/casos"><ArrowLeft className="h-4 w-4" /> Voltar</Link></Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover caso?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. O caso e todos os documentos anexados serão excluídos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteCase} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      >
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="outline" className={severityColors[caso.severity]}>{severityLabels[caso.severity]}</Badge>
          <Badge variant="secondary">{caseStatusLabels[caso.status]}</Badge>
          {caso.nyha && <Badge variant="outline">NYHA {caso.nyha}</Badge>}
          {caso.patient_age && <Badge variant="outline">{caso.patient_age} anos</Badge>}
        </div>
      </PageHeader>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Achados */}
          <Card className="shadow-sm-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" /> Achados clínicos e ecocardiográficos
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <Info label="Classe NYHA" value={caso.nyha ? nyhaLabels[caso.nyha] : "—"} />
              <Info label="FE" value={caso.ejection_fraction ? `${caso.ejection_fraction}%` : "—"} />
              <Info label="Gradiente médio" value={caso.mean_gradient ? `${caso.mean_gradient} mmHg` : "—"} />
              <Info label="Gradiente máximo" value={caso.peak_gradient ? `${caso.peak_gradient} mmHg` : "—"} />
              <Info label="Área valvar" value={caso.valve_area ? `${caso.valve_area} cm²` : "—"} />
              <Info label="Regurgitação" value={caso.regurgitation_grade || "—"} />

              {caso.symptoms?.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Sintomas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {caso.symptoms.map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)}
                  </div>
                </div>
              )}
              {caso.comorbidities?.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Comorbidades</p>
                  <div className="flex flex-wrap gap-1.5">
                    {caso.comorbidities.map((s: string) => <Badge key={s} variant="outline">{s}</Badge>)}
                  </div>
                </div>
              )}
              {caso.proposed_management && (
                <div className="sm:col-span-2 pt-2 border-t border-border">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Conduta proposta</p>
                  <p className="text-foreground whitespace-pre-wrap">{caso.proposed_management}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline evolutiva */}
          <CaseTimeline caseId={caso.id} />

          {/* Agenda */}
          <CaseAppointments caseId={caso.id} />

          {/* Documentos */}
          <CaseDocuments caseId={caso.id} />
        </div>

        {/* Coluna lateral */}
        <div className="space-y-6">
          <Card className="shadow-sm-soft">
            <CardHeader><CardTitle className="text-base">Status & evolução</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Status do caso</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(caseStatusLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notas clínicas</Label>
                <Textarea
                  value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="mt-1.5 min-h-[140px]"
                  placeholder="Adicione evolução, decisões compartilhadas..."
                />
              </div>
              <Button onClick={saveChanges} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar alterações
              </Button>
            </CardContent>
          </Card>

          <div className="text-xs text-muted-foreground bg-secondary/40 border border-border rounded-lg p-3">
            ValvePath é apoio à decisão. Não substitui julgamento clínico nem realiza diagnóstico automático.
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-foreground font-medium">{value || "—"}</p>
    </div>
  );
}
