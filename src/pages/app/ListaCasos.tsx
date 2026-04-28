import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  valveTypeLabels,
  valveDiseaseLabels,
  severityLabels,
  severityColors,
  caseStatusLabels,
} from "@/lib/clinicalLabels";

export default function ListaCasos() {
  const { user } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("clinical_cases")
        .select("*")
        .order("created_at", { ascending: false });
      setCases(data || []);
      setLoading(false);
    })();
  }, [user]);

  const filtered = cases.filter((c) =>
    !q.trim() || c.patient_name?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="max-w-6xl">
      <PageHeader
        eyebrow="Casos clínicos"
        title="Meus casos"
        description="Avaliações valvares registradas. Clique em um caso para ver detalhes e anexar exames."
        breadcrumbs={[{ label: "Início", to: "/app/medico" }, { label: "Casos" }]}
        actions={
          <Button asChild>
            <Link to="/app/medico/casos/novo"><Plus className="h-4 w-4" /> Novo caso</Link>
          </Button>
        }
      />

      <div className="relative max-w-md mb-5">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome do paciente..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Carregando casos...</p>
      ) : filtered.length === 0 ? (
        <Card className="shadow-sm-soft">
          <CardContent className="p-10 text-center">
            <div className="h-14 w-14 rounded-xl bg-secondary mx-auto mb-4 grid place-items-center">
              <FileText className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-serif text-xl text-primary mb-2">Nenhum caso registrado</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
              Comece registrando seu primeiro caso clínico em 3 passos rápidos.
            </p>
            <Button asChild>
              <Link to="/app/medico/casos/novo"><Plus className="h-4 w-4" /> Criar primeiro caso</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <Link key={c.id} to={`/app/medico/casos/${c.id}`}>
              <Card className="shadow-sm-soft hover:shadow-md-soft transition-shadow">
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-serif text-lg text-primary truncate">{c.patient_name}</h3>
                      {c.patient_age && <span className="text-xs text-muted-foreground">{c.patient_age} anos</span>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {valveTypeLabels[c.valve_type]} — {valveDiseaseLabels[c.valve_disease]}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Registrado em {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Badge className={severityColors[c.severity]} variant="outline">
                      {severityLabels[c.severity]}
                    </Badge>
                    <Badge variant="secondary">{caseStatusLabels[c.status]}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
