import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, BookOpen } from "lucide-react";
import { clinicalLibrary } from "@/data/clinicalLibrary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function BibliotecaDetalhe() {
  const { slug } = useParams();
  const guideline = clinicalLibrary.find((g) => g.slug === slug);

  if (!guideline) return <Navigate to="/app/medico/biblioteca" replace />;

  return (
    <div className="max-w-4xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/app/medico/biblioteca" className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar à biblioteca
        </Link>
      </Button>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary">{guideline.valve}</Badge>
          <Badge variant="outline">{guideline.pathology}</Badge>
        </div>
        <h1 className="font-serif text-3xl lg:text-4xl text-primary flex items-center gap-3">
          <BookOpen className="h-7 w-7" /> {guideline.title}
        </h1>
        <p className="text-muted-foreground mt-3 text-lg leading-relaxed">{guideline.summary}</p>
      </div>

      <Card className="shadow-sm-soft border-primary/20">
        <CardContent className="p-6">
          <h2 className="font-serif text-xl text-primary mb-4">Pontos-chave</h2>
          <ul className="space-y-2">
            {guideline.keyPoints.map((k) => (
              <li key={k} className="flex gap-3 text-sm">
                <span className="h-5 w-5 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold shrink-0 mt-0.5">
                  ✓
                </span>
                <span className="text-foreground">{k}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {guideline.sections.map((s) => (
          <Card key={s.heading} className="shadow-sm-soft">
            <CardContent className="p-6">
              <h2 className="font-serif text-xl text-primary mb-3">{s.heading}</h2>
              {s.body && <p className="text-sm text-muted-foreground leading-relaxed mb-3">{s.body}</p>}
              {s.bullets && (
                <ul className="space-y-1.5">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex gap-2 text-sm text-foreground">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-secondary/40 border-border">
        <CardContent className="p-6">
          <h3 className="font-serif text-base text-primary mb-2">Referências</h3>
          <ul className="text-xs text-muted-foreground space-y-1">
            {guideline.references.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
            Conteúdo educativo — sempre consulte as diretrizes originais e o contexto clínico individual.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
