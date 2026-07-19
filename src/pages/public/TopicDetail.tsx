import { useParams, Link, Navigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { ContentReviewBadge } from "@/components/ContentReviewBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { patientTopics, patientCategories } from "@/data/patientContent";
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, MapPin } from "lucide-react";

const TopicDetail = () => {
  const { slug } = useParams();
  const topic = patientTopics.find((t) => t.slug === slug);

  if (!topic) return <Navigate to="/aprender" replace />;

  const cat = patientCategories[topic.category];
  const idx = patientTopics.findIndex((t) => t.slug === slug);
  const prev = patientTopics[idx - 1];
  const next = patientTopics[idx + 1];

  return (
    <>
      <PageHeader
        eyebrow={cat.label}
        title={topic.title}
        description={topic.shortDescription}
        breadcrumbs={[
          { label: "Aprender", to: "/aprender" },
          { label: cat.label, to: "/aprender" },
          { label: topic.title },
        ]}
      />

      <article className="container-vp py-12">
        <div className="grid lg:grid-cols-[1fr_280px] gap-10">
          <div className="max-w-3xl">
            {topic.sections.map((sec, i) => (
              <div key={i} className="mb-8">
                <h2 className="font-display font-semibold text-xl text-foreground mb-3">
                  {sec.heading}
                </h2>
                <p className="text-base text-foreground/85 leading-relaxed">{sec.body}</p>
              </div>
            ))}

            {topic.alerts && topic.alerts.length > 0 && (
              <Card className="p-5 border-destructive/30 bg-destructive/5 mb-8">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-display font-semibold text-sm text-foreground mb-2">Sinais de atenção</h3>
                    <ul className="space-y-1.5">
                      {topic.alerts.map((a, i) => (
                        <li key={i} className="text-sm text-foreground/85 leading-relaxed">• {a}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            )}

            <MedicalDisclaimer className="mb-8" />

            <div className="flex justify-between gap-3 pt-6 border-t border-border">
              {prev ? (
                <Button asChild variant="ghost" size="sm">
                  <Link to={`/aprender/${prev.slug}`}>
                    <ArrowLeft className="h-4 w-4" /> {prev.title}
                  </Link>
                </Button>
              ) : <span />}
              {next && (
                <Button asChild variant="ghost" size="sm">
                  <Link to={`/aprender/${next.slug}`}>
                    {next.title} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <aside className="lg:sticky lg:top-20 self-start">
            <Card className="p-5 bg-secondary/40">
              <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-accent" /> Base científica
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                Conteúdo baseado em diretrizes 2025 ESC/EACTS, 2020 ACC/AHA e materiais educacionais de AHA e CDC.
              </p>
              <Link to="/referencias" className="text-xs font-medium text-accent hover:underline">
                Ver referências completas →
              </Link>
            </Card>

            <Card className="p-5 mt-4">
              <h3 className="font-display font-semibold text-sm text-foreground mb-3">Tópicos relacionados</h3>
              <div className="space-y-2">
                {patientTopics
                  .filter((t) => t.category === topic.category && t.slug !== topic.slug)
                  .slice(0, 4)
                  .map((t) => (
                    <Link
                      key={t.slug}
                      to={`/aprender/${t.slug}`}
                      className="block text-sm text-foreground/80 hover:text-primary"
                    >
                      → {t.title}
                    </Link>
                  ))}
              </div>
            </Card>
          </aside>
        </div>
      </article>
    </>
  );
};

export default TopicDetail;
