import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileHeart, Stethoscope, AlertTriangle } from "lucide-react";
import {
  valveTypeLabels, valveDiseaseLabels, severityLabels, severityColors, caseStatusLabels,
} from "@/lib/clinicalLabels";
import { CaseDocuments } from "@/components/CaseDocuments";
import { CaseTimeline } from "@/components/CaseTimeline";
import { CaseAppointments } from "@/components/CaseAppointments";
import { CaseChat } from "@/components/CaseChat";
import { CaseExams } from "@/components/CaseExams";
import { EmptyState } from "@/components/EmptyState";

export default function PacienteJornada() {
  const { user } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  // O toast some em segundos; a tela fica. Sem este estado, o paciente que
  // perdeu o toast continua lendo "Nenhum caso clínico ainda" como se fosse
  // fato sobre a saúde dele.
  const [falhou, setFalhou] = useState(false);
  const [openCase, setOpenCase] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        // O `try` desta função já existia, mas o cliente do Supabase NÃO
        // lança: devolve `{ data: null, error }`. O `catch` de baixo nunca
        // via falha nenhuma, e a jornada aparecia vazia — "Nenhum caso
        // clínico ainda" — para um paciente que tem casos registrados pelo
        // médico. Com o `throw`, o toast que já estava escrito passa a sair.
        const { data: pat, error: erroPaciente } = await supabase.from("patients").select("id").is("deleted_at", null).eq("user_id", user.id).maybeSingle();
        if (erroPaciente) throw erroPaciente;
        if (!pat) return;

        const { data: cs, error: erroCasos } = await supabase
          .from("clinical_cases").select("*").is("deleted_at", null).eq("patient_id", pat.id)
          .neq("status", "draft" as any)
          .order("created_at", { ascending: false });
        if (erroCasos) throw erroCasos;

        const docIds = [...new Set((cs || []).map((c) => c.doctor_id))];
        const { data: docs, error: erroMedicos } = docIds.length
          ? await supabase.from("doctors").select("id, user_id, crm, crm_uf, specialty").in("id", docIds)
          : { data: [] as any[], error: null };
        if (erroMedicos) throw erroMedicos;

        // Pelo RPC: `profiles` de outra pessoa volta vazio pela policy, e a
        // jornada mostrava os médicos do próprio paciente sem nome.
        // Esta pode falhar sozinha sem derrubar a tela: ela traz só o NOME do
        // médico, e `full_name` já sabe ser nulo. Perder o nome não é perder
        // a jornada.
        const { data: meus } = await supabase.rpc("meus_medicos");
        const nomePorMedico = new Map<string, string | null>(
          (meus ?? []).map((m) => [m.doctor_id, m.full_name]),
        );

        const map: Record<string, any> = {};
        (docs || []).forEach((d: any) => {
          map[d.id] = { ...d, full_name: nomePorMedico.get(d.id) ?? null };
        });

        setCases(cs || []);
        setDoctors(map);
      } catch (e) {
        setFalhou(true);
        toast.error("Erro ao carregar jornada clínica", { description: (e as Error).message });
      } finally {
        setLoading(false);
      }
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
      ) : falhou ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="py-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/85 leading-relaxed">
              <strong className="text-foreground">Não foi possível carregar sua jornada agora.</strong>{" "}
              Isto é uma falha de conexão — <strong>não significa que não haja casos
              registrados</strong>. Nada foi apagado. Recarregue a página; se continuar,
              avise o suporte ou seu médico.
            </p>
          </CardContent>
        </Card>
      ) : cases.length === 0 ? (
        <EmptyState
          icon={FileHeart}
          title="Nenhum caso clínico ainda"
          description="Quando seu médico registrar uma avaliação valvar, ela aparecerá aqui. Você pode anexar exames próprios para discutir na próxima consulta."
        />
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
                          <Stethoscope className="h-3 w-3" /> {doc.full_name ? `Dr(a). ${doc.full_name}` : "Médico responsável"} — CRM {doc.crm}/{doc.crm_uf}
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
                      <CaseExams caseId={c.id} readOnly />
                      <CaseTimeline caseId={c.id} readOnly />
                      <CaseAppointments caseId={c.id} readOnly />
                      <CaseDocuments caseId={c.id} />
                      <CaseChat caseId={c.id} viewerRole="paciente" />
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
