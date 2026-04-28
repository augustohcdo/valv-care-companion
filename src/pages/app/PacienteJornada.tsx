import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileHeart, Stethoscope } from "lucide-react";
import {
  valveTypeLabels, valveDiseaseLabels, severityLabels, severityColors, caseStatusLabels,
} from "@/lib/clinicalLabels";
import { CaseDocuments } from "@/components/CaseDocuments";
import { CaseTimeline } from "@/components/CaseTimeline";
import { CaseAppointments } from "@/components/CaseAppointments";

export default function PacienteJornada() {
  const { user } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [openCase, setOpenCase] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: pat } = await supabase.from("patients").select("id").eq("user_id", user.id).maybeSingle();
      if (!pat) { setLoading(false); return; }

      const { data: cs } = await supabase
        .from("clinical_cases").select("*").eq("patient_id", pat.id)
        .order("created_at", { ascending: false });

      const docIds = [...new Set((cs || []).map((c) => c.doctor_id))];
      const { data: docs } = docIds.length
        ? await supabase.from("doctors").select("id, user_id, crm, crm_uf, specialty").in("id", docIds)
        : { data: [] as any[] };

      const userIds = (docs || []).map((d: any) => d.user_id);
      const { data: profs } = userIds.length
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
        : { data: [] as any[] };

      const map: Record<string, any> = {};
      (docs || []).forEach((d: any) => {
        const p = profs?.find((x: any) => x.user_id === d.user_id);
        map[d.id] = { ...d, full_name: p?.full_name };
      });

      setCases(cs || []);
      setDoctors(map);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="Minha jornada"
        title="Minha jornada clínica"
        description="Casos clínicos registrados pelo seu médico. Você pode acompanhar e anexar exames adicionais."
        breadcrumbs={[{ label: "Início", to: "/app/paciente" }, { label: "Jornada" }]}
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : cases.length === 0 ? (
        <Card className="shadow-sm-soft">
          <CardContent className="p-10 text-center">
            <FileHeart className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="font-serif text-xl text-primary mb-2">Nenhum caso clínico ainda</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Quando seu médico registrar uma avaliação valvar, ela aparecerá aqui.
              Você pode anexar exames próprios para discutir na próxima consulta.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {cases.map((c) => {
            const doc = doctors[c.doctor_id];
            const isOpen = openCase === c.id;
            return (
              <Card key={c.id} className="shadow-sm-soft">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-serif text-lg text-primary">
                          {valveTypeLabels[c.valve_type]} — {valveDiseaseLabels[c.valve_disease]}
                        </h3>
                      </div>
                      {doc && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Stethoscope className="h-3 w-3" /> Dr(a). {doc.full_name} — CRM {doc.crm}/{doc.crm_uf}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Registrado em {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={severityColors[c.severity]}>{severityLabels[c.severity]}</Badge>
                      <Badge variant="secondary">{caseStatusLabels[c.status]}</Badge>
                    </div>
                  </div>

                  {c.proposed_management && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs uppercase text-muted-foreground mb-1">Conduta proposta</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{c.proposed_management}</p>
                    </div>
                  )}

                  <button
                    onClick={() => setOpenCase(isOpen ? null : c.id)}
                    className="text-sm text-primary hover:underline mt-4 font-medium"
                  >
                    {isOpen ? "Ocultar detalhes" : "Ver evolução, agenda e documentos"}
                  </button>

                  {isOpen && (
                    <div className="mt-4 space-y-4">
                      <CaseTimeline caseId={c.id} readOnly />
                      <CaseAppointments caseId={c.id} readOnly />
                      <CaseDocuments caseId={c.id} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
