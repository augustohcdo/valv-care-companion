import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Inbox, ChevronRight, Check, X, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  valveTypeLabels, valveDiseaseLabels, severityLabels, severityColors, caseStatusLabels,
} from "@/lib/clinicalLabels";

export default function MedicoColaboracoes() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data: doc } = await supabase
      .from("doctors").select("id").eq("user_id", user.id).maybeSingle();
    if (!doc) { setLoading(false); return; }

    const { data: collabs } = await supabase
      .from("case_collaborators")
      .select("*")
      .eq("doctor_id", doc.id)
      .order("created_at", { ascending: false });

    const caseIds = [...new Set((collabs || []).map((c) => c.case_id))];
    const { data: cases } = caseIds.length
      ? await supabase.from("clinical_cases").select("*").in("id", caseIds).neq("status", "draft" as any)
      : { data: [] as any[] };

    // Médico responsável de cada caso
    const docIds = [...new Set((cases || []).map((c: any) => c.doctor_id))];
    const { data: owners } = docIds.length
      ? await supabase.from("doctors").select("id, user_id, crm, crm_uf").in("id", docIds)
      : { data: [] as any[] };
    const userIds = (owners || []).map((d: any) => d.user_id);
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
      : { data: [] as any[] };

    const enriched = (collabs || []).map((c) => {
      const cs = cases?.find((x: any) => x.id === c.case_id);
      const owner = cs ? owners?.find((o: any) => o.id === cs.doctor_id) : null;
      const ownerProfile = owner ? profs?.find((p: any) => p.user_id === owner.user_id) : null;
      return { ...c, caso: cs, owner: owner ? { ...owner, full_name: ownerProfile?.full_name } : null };
    });

    setItems(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const respond = async (id: string, status: "aceito" | "recusado") => {
    const { error } = await supabase
      .from("case_collaborators")
      .update({ status: status as any, responded_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error("Erro", { description: error.message });
    else toast.success(status === "aceito" ? "Convite aceito" : "Convite recusado");
    load();
  };

  const pending = items.filter((i) => i.status === "pendente");
  const active = items.filter((i) => i.status === "aceito");
  const past = items.filter((i) => !["pendente", "aceito"].includes(i.status));

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Colaboração"
        title="Casos compartilhados comigo"
        description="Convites e casos clínicos onde você atua como segunda opinião ou membro do Heart Team."
        breadcrumbs={[{ label: "Início", to: "/app/medico" }, { label: "Colaborações" }]}
      />

      {loading ? (
        <div className="grid place-items-center min-h-[30vh]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card className="shadow-sm-soft">
          <CardContent className="p-10 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="font-serif text-xl text-primary mb-2">Nenhum convite ainda</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Quando outro médico te convidar para discutir um caso, ele aparecerá aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <Section title="Convites pendentes" icon={Inbox} highlight>
              {pending.map((c) => (
                <CollabCard key={c.id} item={c} onAccept={() => respond(c.id, "aceito")} onReject={() => respond(c.id, "recusado")} />
              ))}
            </Section>
          )}
          {active.length > 0 && (
            <Section title="Casos ativos" icon={Users}>
              {active.map((c) => <CollabCard key={c.id} item={c} />)}
            </Section>
          )}
          {past.length > 0 && (
            <Section title="Histórico" icon={Inbox} dim>
              {past.map((c) => <CollabCard key={c.id} item={c} />)}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children, highlight, dim }: any) {
  return (
    <div>
      <h3 className={`text-sm font-semibold uppercase tracking-wide mb-3 inline-flex items-center gap-2 ${
        highlight ? "text-warning" : dim ? "text-muted-foreground" : "text-foreground"
      }`}>
        <Icon className="h-4 w-4" /> {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function CollabCard({ item, onAccept, onReject }: { item: any; onAccept?: () => void; onReject?: () => void }) {
  const c = item.caso;
  if (!c) return null;
  return (
    <Card className="shadow-sm-soft">
      <CardContent className="p-4">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h4 className="font-serif text-lg text-primary">
              {c.patient_name}
            </h4>
            <p className="text-sm text-muted-foreground">
              {valveTypeLabels[c.valve_type]} — {valveDiseaseLabels[c.valve_disease]}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Convite de Dr(a). {item.owner?.full_name} (CRM {item.owner?.crm}/{item.owner?.crm_uf})
            </p>
            {item.message && (
              <p className="text-xs text-muted-foreground italic mt-2 p-2 bg-secondary/40 rounded border-l-2 border-primary/40">
                "{item.message}"
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="outline" className={severityColors[c.severity]}>{severityLabels[c.severity]}</Badge>
              <Badge variant="secondary">{caseStatusLabels[c.status]}</Badge>
              <Badge variant="outline" className="text-[10px]">
                {item.access_level === "comentar" ? "Pode comentar" : "Somente leitura"}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            {onAccept && onReject ? (
              <>
                <Button size="sm" onClick={onAccept}>
                  <Check className="h-4 w-4" /> Aceitar
                </Button>
                <Button size="sm" variant="ghost" onClick={onReject}>
                  <X className="h-4 w-4" /> Recusar
                </Button>
              </>
            ) : item.status === "aceito" ? (
              <Button size="sm" variant="outline" asChild>
                <Link to={`/app/medico/casos/${c.id}`}>
                  Abrir caso <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
