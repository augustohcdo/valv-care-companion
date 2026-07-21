import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ChevronRight, HeartPulse, Sparkles, Lightbulb, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clinicalLibrary } from "@/data/clinicalLibrary";
import {
  caseToGuidelineSlug,
  valveTypeLabels,
  valveDiseaseLabels,
} from "@/lib/clinicalLabels";

const PacienteAprender = () => {
  const { user } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: pat } = await supabase
        .from("patients")
        .select("id")
        .is("deleted_at", null)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!pat) {
        setLoading(false);
        return;
      }
      const { data: cs } = await supabase
        .from("clinical_cases")
        .select("id, valve_type, valve_disease")
        .is("deleted_at", null)
        .eq("patient_id", pat.id)
        .neq("status", "draft" as any);
      setCases(cs || []);
      setLoading(false);
    })();
  }, [user]);

  // valvopatias únicas do paciente
  const personalSlugs = new Set<string>();
  cases.forEach((c) => {
    const s = caseToGuidelineSlug(c.valve_type, c.valve_disease);
    if (s) personalSlugs.add(s);
  });

  const personal = clinicalLibrary.filter((g) => personalSlugs.has(g.slug));
  const others = clinicalLibrary.filter((g) => !personalSlugs.has(g.slug));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Conteúdo educacional"
        title="Aprender sobre minhas valvopatias"
        description="Conteúdo organizado especialmente para você, com base nos casos clínicos registrados pelo seu médico. Linguagem cuidadosa, sem substituir a consulta médica."
      />

      {!loading && personal.length > 0 && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent shadow-sm-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-primary" /> Personalizado para você
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Conteúdos relacionados à sua condição. Selecionados a partir dos casos
              registrados na plataforma.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {personal.map((g) => (
                <Link
                  key={g.slug}
                  to={`/app/paciente/aprender/${g.slug}`}
                  className="group p-4 rounded-lg bg-card border border-border hover:border-primary hover:shadow-md transition-all"
                >
                  <Badge variant="secondary" className="text-[10px] mb-2">{g.valve}</Badge>
                  <h3 className="font-serif text-base text-primary leading-snug">{g.shortTitle}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{g.summary}</p>
                  <span className="text-xs text-primary font-medium inline-flex items-center gap-1 mt-2 group-hover:gap-2 transition-all">
                    Ler conteúdo <ChevronRight className="h-3 w-3" />
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && cases.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <HeartPulse className="h-10 w-10 mx-auto mb-2 opacity-40" />
            Quando seu médico registrar um caso clínico, conteúdos personalizados
            aparecerão aqui automaticamente.
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5 text-primary" /> Biblioteca completa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {others.map((g) => (
              <Link
                key={g.slug}
                to={`/app/paciente/aprender/${g.slug}`}
                className="group p-4 rounded-lg border border-border hover:border-primary/60 hover:bg-secondary/40 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{g.valve}</Badge>
                  <Badge variant="outline" className="text-[10px]">{g.pathology}</Badge>
                </div>
                <h3 className="font-serif text-base text-primary mt-2 leading-snug">{g.shortTitle}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{g.summary}</p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-secondary/40 border-border">
        <CardContent className="py-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Importante:</strong> Este conteúdo é educativo
            e baseado em diretrizes nacionais e internacionais. Não substitui a avaliação do seu
            cardiologista. Em caso de sintomas novos, dor torácica, falta de ar súbita ou síncope,
            procure imediatamente um pronto-atendimento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PacienteAprender;
