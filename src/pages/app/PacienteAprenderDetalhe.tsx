import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Lightbulb } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { clinicalLibrary } from "@/data/clinicalLibrary";

const PacienteAprenderDetalhe = () => {
  const { slug } = useParams();
  const guideline = clinicalLibrary.find((g) => g.slug === slug);

  if (!guideline) return <Navigate to="/app/paciente/aprender" replace />;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        eyebrow={`${guideline.valve} • ${guideline.pathology}`}
        title={guideline.shortTitle}
        description={guideline.summary}
        breadcrumbs={[
          { label: "Início", to: "/app/paciente" },
          { label: "Aprender", to: "/app/paciente/aprender" },
          { label: guideline.shortTitle },
        ]}
        actions={
          <Button variant="outline" asChild>
            <Link to="/app/paciente/aprender"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
          </Button>
        }
      />

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-5 w-5 text-primary" /> Pontos-chave
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {guideline.keyPoints.map((p, i) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {guideline.sections.map((section, i) => (
        <Card key={i} className="shadow-sm-soft">
          <CardHeader>
            <CardTitle className="text-base">{section.heading}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground leading-relaxed">
            {section.body && <p className="whitespace-pre-wrap">{section.body}</p>}
            {section.bullets && (
              <ul className="space-y-1.5 pl-4 list-disc text-muted-foreground marker:text-primary">
                {section.bullets.map((b, j) => <li key={j}>{b}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}

      {guideline.references.length > 0 && (
        <Card className="bg-secondary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-primary" /> Referências
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {guideline.references.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PacienteAprenderDetalhe;
