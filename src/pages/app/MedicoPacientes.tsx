import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Users, FileText, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function MedicoPacientes() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: doc } = await supabase.from("doctors").select("id").eq("user_id", user.id).maybeSingle();
      if (!doc) { setLoading(false); return; }

      const [{ data: patients }, { data: cases }] = await Promise.all([
        supabase.from("patients").select("id, user_id, sex, city, uf, comorbidities, linked_at").is("deleted_at", null).eq("linked_doctor_id", doc.id),
        supabase.from("clinical_cases").select("id, patient_id").is("deleted_at", null).eq("doctor_id", doc.id).neq("status", "draft" as any),
      ]);

      const userIds = (patients || []).map((p) => p.user_id);
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, full_name, phone").in("user_id", userIds)
        : { data: [] as any[] };

      const enriched = (patients || []).map((p) => {
        const prof = profiles?.find((x: any) => x.user_id === p.user_id);
        const caseCount = (cases || []).filter((c) => c.patient_id === p.id).length;
        return { ...p, full_name: prof?.full_name || "Paciente", phone: prof?.phone, caseCount };
      });
      setItems(enriched);
      setLoading(false);
    })();
  }, [user]);

  const filtered = items.filter((p) => !q.trim() || p.full_name?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="max-w-6xl">
      <PageHeader
        eyebrow="Pacientes"
        title="Meus pacientes"
        description="Pacientes que vincularam você como médico responsável usando seu CRM."
        breadcrumbs={[{ label: "Início", to: "/app/medico" }, { label: "Pacientes" }]}
      />

      <div className="relative max-w-md mb-5">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nome..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card className="shadow-sm-soft">
          <CardContent className="p-10 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="font-serif text-xl text-primary mb-2">Nenhum paciente vinculado</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Quando um paciente cadastrar seu CRM, ele aparecerá aqui automaticamente.
              Compartilhe seu CRM/UF com pacientes que precisam acompanhamento valvar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Card key={p.id} className="shadow-sm-soft hover:shadow-md-soft transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-full bg-gradient-hero text-primary-foreground grid place-items-center font-semibold shrink-0">
                    {p.full_name.split(" ").slice(0, 2).map((n: string) => n[0]).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-serif text-base text-primary truncate">{p.full_name}</h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      {p.city && <><MapPin className="h-3 w-3" /> {p.city}{p.uf ? `/${p.uf}` : ""}</>}
                    </div>
                  </div>
                </div>

                {p.comorbidities?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {p.comorbidities.slice(0, 3).map((c: string) => (
                      <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" /> {p.caseCount} {p.caseCount === 1 ? "caso" : "casos"}
                  </span>
                  <Link to={`/app/medico/pacientes/${p.id}`} className="text-xs text-primary hover:underline">Ver detalhes →</Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
