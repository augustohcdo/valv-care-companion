import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Phone, FileText, Loader2, User as UserIcon, Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDoctor } from "@/hooks/useDoctor";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PatientSymptomsViewer } from "@/components/PatientSymptomsViewer";
import { queuePatientPdf } from "@/lib/exporters";
import type { SecaoDoProntuario } from "@/lib/patientPdf";

export const doctorPatientDetailKey = (doctorId?: string, patientId?: string) =>
  ["doctor-patient-detail", doctorId, patientId] as const;

export default function MedicoPacienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);

  const { data: doctor, isLoading: loadingDoctor } = useDoctor();

  const { data, isLoading: loadingDetail, error: erroDetalhe } = useQuery({
    queryKey: doctorPatientDetailKey(doctor?.id, id),
    queryFn: async () => {
      // Este é o nome que vai no cabeçalho do PDF, ao lado do CRM. Falhar em
      // silêncio produzia um prontuário emitido por ninguém.
      const { data: docProf, error: erroDocProf } = await supabase
        .from("profiles").select("full_name").eq("user_id", user!.id).maybeSingle();
      if (erroDocProf) throw erroDocProf;

      // O vínculo faz parte do filtro: sem `linked_doctor_id`, um médico
      // enxergaria o prontuário de paciente de outro só trocando a URL.
      const { data: pat, error: erroPat } = await supabase
        .from("patients").select("*").is("deleted_at", null).eq("id", id!).eq("linked_doctor_id", doctor!.id).maybeSingle();
      // Lançar em vez de devolver `null`: os dois caminhos terminavam no mesmo
      // `return null`, e o efeito lá embaixo dizia "Paciente não encontrado ou
      // sem vínculo" — uma afirmação sobre o VÍNCULO tirada de uma falha de
      // rede. O médico concluía que perdeu o acesso ao paciente.
      if (erroPat) throw erroPat;
      if (!pat) return null;

      // Pelo RPC: ler `profiles` do paciente volta vazio pela policy
      // (`auth.uid() = user_id`), e o prontuário inteiro exibia "Paciente" no
      // lugar do nome — inclusive no título e no rastro de navegação.
      // E este é o nome do PACIENTE. Sem ele o PDF saía intitulado "Paciente" e
      // gravado como `valvepath-prontuario-paciente.pdf` — um prontuário sem
      // identificação, que é exatamente o documento que se atribui à pessoa
      // errada.
      const { data: meus, error: erroMeus } = await supabase.rpc("meus_pacientes");
      if (erroMeus) throw erroMeus;
      const meu = (meus ?? []).find((m) => m.patient_id === pat.id);
      const prof = meu ? { full_name: meu.full_name, phone: meu.phone, birth_date: meu.birth_date } : null;
      const { data: cs, error: erroCasos } = await supabase
        .from("clinical_cases").select("*").is("deleted_at", null).eq("patient_id", pat.id).eq("doctor_id", doctor!.id).neq("status", "draft" as any).order("created_at", { ascending: false });
      // Idem: sem isto, uma falha aqui virava "Casos clínicos (0)" na tela e,
      // pior, no PDF exportado.
      if (erroCasos) throw erroCasos;

      return { patient: pat, profile: prof, cases: cs ?? [], doctorProfile: docProf };
    },
    enabled: !!doctor?.id && !!id,
  });

  const patient = data?.patient ?? null;
  const profile = data?.profile ?? null;
  const cases = data?.cases ?? [];
  const doctorProfile = data?.doctorProfile ?? null;
  const loading = loadingDoctor || (!!doctor?.id && loadingDetail);

  // Redireciona quando o médico não existe, ou quando o paciente não existe /
  // não está vinculado a ele. Só depois que a busca termina, para não expulsar
  // ninguém enquanto os dados ainda estão a caminho.
  useEffect(() => {
    if (loading) return;
    if (!doctor) { navigate("/app/medico/pacientes"); return; }
    // "Não chegou" e "não existe" levavam à mesma frase e à mesma expulsão da
    // tela. São coisas diferentes: a primeira se resolve tentando de novo, a
    // segunda não. E dizer "sem vínculo" quando o vínculo existe é afirmar um
    // fato clínico-administrativo falso.
    if (erroDetalhe) {
      toast.error("Não foi possível carregar o prontuário", {
        description: "Isto não quer dizer que o paciente tenha deixado de estar vinculado. Tente novamente.",
      });
      return;
    }
    if (!patient) {
      toast.error("Paciente não encontrado ou sem vínculo");
      navigate("/app/medico/pacientes");
    }
  }, [loading, doctor, patient, erroDetalhe, navigate]);

  const handleExportPdf = async () => {
    if (!patient) return;
    setExporting(true);
    queuePatientPdf({
      label: `Prontuário — ${profile?.full_name || patient.id}`,
      data: async () => {
        const caseIds = cases.map((c) => c.id);
        const since = new Date(); since.setDate(since.getDate() - 30);
        const sinceISO = since.toISOString().slice(0, 10);

        // O `error` de cada leitura é OBSERVADO, não descartado. Antes, as
        // quatro caíam em `meds || []` e o PDF omitia a seção inteira: para
        // quem lesse o documento depois, "sem medicações" e "não deu para ler
        // as medicações" eram indistinguíveis. Uma falha de rede de dois
        // segundos virava um prontuário que sugere paciente sem anticoagulação.
        const [rExams, rSyms, rMeds, rLogs] = await Promise.all([
          caseIds.length
            ? supabase.from("case_exams").select("*").in("case_id", caseIds).is("deleted_at", null).order("exam_date", { ascending: true })
            : Promise.resolve({ data: [] as any[], error: null }),
          supabase.from("symptom_entries").select("*").eq("patient_id", patient.id).is("deleted_at", null)
            .gte("entry_date", sinceISO).order("entry_date", { ascending: false }),
          supabase.from("medications").select("*").eq("patient_id", patient.id).eq("active", true),
          supabase.from("medication_logs").select("*").eq("patient_id", patient.id).gte("log_date", sinceISO),
        ]);

        const naoCarregadas: SecaoDoProntuario[] = [];
        if (rExams.error) naoCarregadas.push("exames");
        if (rSyms.error) naoCarregadas.push("sintomas");
        if (rMeds.error) naoCarregadas.push("medicacoes");
        if (rLogs.error) naoCarregadas.push("aderencia");
        // `casos` não entra aqui: ele vem da consulta da própria tela, que já
        // trata o erro e nem chega a desenhar o botão de exportar sem ela.

        return {
          profile, patient,
          doctor: doctor && doctorProfile ? {
            full_name: doctorProfile.full_name,
            crm: doctor.crm, crm_uf: doctor.crm_uf, specialty: doctor.specialty,
          } : null,
          cases,
          exams: rExams.data || [],
          symptoms: rSyms.data || [],
          medications: rMeds.data || [],
          medLogs: rLogs.data || [],
          naoCarregadas,
        };
      },
    });
    // Libera o botão imediatamente — o feedback acontece no dock global
    setExporting(false);
    toast.message("Prontuário enfileirado", { description: "Acompanhe na barra de exportações." });
  };

  // Sem este ramo, a falha ficava girando o spinner para sempre — o usuário lê
  // "está carregando" sobre algo que já terminou e falhou.
  if (erroDetalhe) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center space-y-3">
        <p className="font-medium">Não foi possível carregar o prontuário.</p>
        <p className="text-sm text-muted-foreground">
          A ficha não chegou até aqui. Isso <strong>não</strong> significa que o paciente não exista
          ou que o vínculo tenha sido desfeito — significa que a consulta falhou.
        </p>
        <div className="flex gap-2 justify-center pt-1">
          <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
          <Button variant="outline" asChild><Link to="/app/medico/pacientes">Voltar</Link></Button>
        </div>
      </div>
    );
  }

  if (loading || !patient) {
    return <div className="grid place-items-center min-h-[40vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Paciente"
        title={profile?.full_name ?? "Paciente sem nome cadastrado"}
        description="Acompanhamento clínico, diário de sintomas, medicações e casos."
        breadcrumbs={[
          { label: "Início", to: "/app/medico" },
          { label: "Pacientes", to: "/app/medico/pacientes" },
          { label: profile?.full_name ?? "Paciente sem nome cadastrado" },
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
              {(profile?.full_name ?? "?").split(" ").slice(0, 2).map((n: string) => n[0]).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-serif text-xl text-primary">{profile?.full_name}</h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                {patient.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {patient.city}{patient.uf ? `/${patient.uf}` : ""}</span>}
                {profile?.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {profile.phone}</span>}
                {profile?.birth_date && <span className="inline-flex items-center gap-1"><UserIcon className="h-3 w-3" /> nasc. {new Date(profile.birth_date).toLocaleDateString("pt-BR")}</span>}
              </div>
              {!!patient.comorbidities?.length && (
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
