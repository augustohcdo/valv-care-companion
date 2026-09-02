import { useParams, Link, Navigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ScrollReveal";
import { categoryIllustrations } from "@/components/illustrations/categoryIllustrations";
import { patientTopics, patientCategories } from "@/data/patientContent";
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen } from "lucide-react";

const TopicDetail = () => {
  const { slug } = useParams();
  const topic = patientTopics.find((t) => t.slug === slug);

  if (!topic) return <Navigate to="/aprender" replace />;

  const cat = patientCategories[topic.category];
  const Illustration = categoryIllustrations[topic.category];
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
        {/* `min-w-0` nos dois filhos: item de grid nasce com `min-width: auto`,
            que o proíbe de encolher abaixo do conteúdo mínimo. Aqui isso dava
            487px numa tela de 390 — e, como `html, body` tinha
            `overflow-x: hidden`, o excedente não virava rolagem, virava texto
            cortado no meio da palavra. */}
        <div className="grid lg:grid-cols-[1fr_280px] gap-10">
          <div className="min-w-0 max-w-3xl">
            {Illustration && (
              <ScrollReveal>
                <Card className="p-6 mb-8 card-elevated bg-accent-soft/60 flex items-center justify-center">
                  <Illustration className="w-full max-w-[220px] h-auto" />
                </Card>
              </ScrollReveal>
            )}

            {topic.sections.map((sec, i) => (
              <ScrollReveal key={i} delay={Math.min(i * 0.06, 0.3)} className="mb-8">
                <h2 className="font-display font-semibold text-xl text-foreground mb-3">
                  {sec.heading}
                </h2>
                <p className="text-base text-foreground/85 leading-relaxed">{sec.body}</p>
              </ScrollReveal>
            ))}

            {topic.alerts && topic.alerts.length > 0 && (
              <ScrollReveal>
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
              </ScrollReveal>
            )}

            <MedicalDisclaimer className="mb-8" />

            {/* O `Button` base tem `whitespace-nowrap` (certo para botão comum),
                mas aqui o texto é o título do tópico vizinho — sem tamanho
                previsível. "Febre reumática e doença valvar" sozinho já bastava
                para estourar a largura, porque item de flex também nasce com
                `min-width: auto` e se recusa a encolher abaixo do texto que não
                pode quebrar. `min-w-0` libera o encolhimento; `truncate` no
                título evita cortar no meio de uma letra. */}
            <div className="flex justify-between gap-3 pt-6 border-t border-border">
              {prev ? (
                <Button asChild variant="ghost" size="sm" className="min-w-0 max-w-[46%]">
                  <Link to={`/aprender/${prev.slug}`}>
                    <ArrowLeft className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate">{prev.title}</span>
                  </Link>
                </Button>
              ) : <span />}
              {next && (
                <Button asChild variant="ghost" size="sm" className="min-w-0 max-w-[46%]">
                  <Link to={`/aprender/${next.slug}`}>
                    <span className="min-w-0 truncate">{next.title}</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <aside className="min-w-0 lg:sticky lg:top-20 self-start">
            <Card className="p-5 bg-secondary/40">
              <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-accent" /> Base científica
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                Conteúdo baseado nas diretrizes 2025 ESC/EACTS (Eur Heart J. 2025;46(44):4635–4736),
                2020 ACC/AHA, Diretriz Brasileira de Valvopatias (SBC 2024) e materiais educacionais
                de AHA e CDC.
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
