import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Phone, FileText, Loader2, User as UserIcon, Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PatientSymptomsViewer } from "@/components/PatientSymptomsViewer";
import { queuePatientPdf } from "@/lib/exporters";

export default function MedicoPacienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [doctor, setDoctor] = useState<any>(null);
  const [doctorProfile, setDoctorProfile] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data: doc } = await supabase.from("doctors").select("*").eq("user_id", user.id).maybeSingle();
      if (!doc) { navigate("/app/medico/pacientes"); return; }
      const { data: docProf } = await supabase
        .from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();

      const { data: pat, error } = await supabase
        .from("patients").select("*").eq("id", id).eq("linked_doctor_id", doc.id).maybeSingle();
      if (error || !pat) {
        toast.error("Paciente não encontrado ou sem vínculo");
        navigate("/app/medico/pacientes");
        return;
      }
      const { data: prof } = await supabase
        .from("profiles").select("*").eq("user_id", pat.user_id).maybeSingle();
      const { data: cs } = await supabase
        .from("clinical_cases").select("*").eq("patient_id", pat.id).eq("doctor_id", doc.id).order("created_at", { ascending: false });

      setDoctor(doc);
      setDoctorProfile(docProf);
      setPatient(pat);
      setProfile(prof);
      setCases(cs || []);
      setLoading(false);
    })();
  }, [id, user, navigate]);

  const handleExportPdf = async () => {
    if (!patient) return;
    setExporting(true);
    queuePatientPdf({
      label: `Prontuário — ${profile?.full_name || patient.id}`,
      data: async () => {
        const caseIds = cases.map((c) => c.id);
        const since = new Date(); since.setDate(since.getDate() - 30);
        const sinceISO = since.toISOString().slice(0, 10);

        const [{ data: exams }, { data: syms }, { data: meds }, { data: logs }] = await Promise.all([
          caseIds.length
            ? supabase.from("case_exams").select("*").in("case_id", caseIds).order("exam_date", { ascending: true })
            : Promise.resolve({ data: [] as any[] }),
          supabase.from("symptom_entries").select("*").eq("patient_id", patient.id)
            .gte("entry_date", sinceISO).order("entry_date", { ascending: false }),
          supabase.from("medications").select("*").eq("patient_id", patient.id).eq("active", true),
          supabase.from("medication_logs").select("*").eq("patient_id", patient.id).gte("log_date", sinceISO),
        ]);

        return {
          profile, patient,
          doctor: doctor && doctorProfile ? {
            full_name: doctorProfile.full_name,
            crm: doctor.crm, crm_uf: doctor.crm_uf, specialty: doctor.specialty,
          } : null,
          cases,
          exams: exams || [],
          symptoms: syms || [],
          medications: meds || [],
          medLogs: logs || [],
        };
      },
    });
    // Libera o botão imediatamente — o feedback acontece no dock global
    setExporting(false);
    toast.message("Prontuário enfileirado", { description: "Acompanhe na barra de exportações." });
  };

  if (loading || !patient) {
    return <div className="grid place-items-center min-h-[40vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Paciente"
        title={profile?.full_name || "Paciente"}
        description="Acompanhamento clínico, diário de sintomas, medicações e casos."
        breadcrumbs={[
          { label: "Início", to: "/app/medico" },
          { label: "Pacientes", to: "/app/medico/pacientes" },
          { label: profile?.full_name || "Paciente" },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportPdf} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Exportar prontuário
            </Button>
            <Button variant="outline" asChild>
              <Link to="/app/medico/pacientes"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
            </Button>
          </div>
        }
      />

      {/* Identificação */}
      <Card className="shadow-sm-soft">
        <CardContent className="p-5">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="h-14 w-14 rounded-full bg-gradient-hero text-primary-foreground grid place-items-center font-semibold shrink-0 text-lg">
              {(profile?.full_name || "P").split(" ").slice(0, 2).map((n: string) => n[0]).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-serif text-xl text-primary">{profile?.full_name}</h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                {patient.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {patient.city}{patient.uf ? `/${patient.uf}` : ""}</span>}
                {profile?.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {profile.phone}</span>}
                {profile?.birth_date && <span className="inline-flex items-center gap-1"><UserIcon className="h-3 w-3" /> nasc. {new Date(profile.birth_date).toLocaleDateString("pt-BR")}</span>}
              </div>
              {patient.comorbidities?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {patient.comorbidities.map((c: string) => (
                    <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sintomas e medicações */}
      <PatientSymptomsViewer patientId={patient.id} />

      {/* Casos */}
      <Card className="shadow-sm-soft">
        <CardContent className="p-5">
          <h3 className="text-base font-semibold text-foreground mb-3 inline-flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Casos clínicos ({cases.length})
          </h3>
          {cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum caso registrado para este paciente.</p>
          ) : (
            <div className="space-y-2">
              {cases.map((c) => (
                <Link key={c.id} to={`/app/medico/casos/${c.id}`} className="block p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.patient_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.valve_type} — {c.valve_disease} • {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Badge variant="secondary">{c.severity}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
