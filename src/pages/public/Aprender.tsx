import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { TopicCard } from "@/components/TopicCard";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { patientTopics, patientCategories } from "@/data/patientContent";
import {
  Search,
  Heart,
  Activity,
  Stethoscope,
  Wrench,
  Compass,
  AlertTriangle,
  BookOpen,
  HelpCircle,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const categoryIcons: Record<string, any> = {
  fundamentos: Heart,
  doencas: Activity,
  exames: Stethoscope,
  tratamentos: Wrench,
  jornada: Compass,
  aprofundamento: GraduationCap,
};

const Aprender = () => {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return patientTopics;
    const q = query.toLowerCase();
    return patientTopics.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.shortDescription.toLowerCase().includes(q) ||
        t.tags?.some((tag) => tag.toLowerCase().includes(q)) ||
        t.sections.some((s) => s.body.toLowerCase().includes(q))
    );
  }, [query]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof patientTopics> = {};
    filtered.forEach((t) => {
      if (!map[t.category]) map[t.category] = [];
      map[t.category].push(t);
    });
    return map;
  }, [filtered]);

  return (
    <>
      <PageHeader
        eyebrow="Portal do paciente"
        title="Entenda sua saúde valvar"
        description="Conteúdo confiável e em linguagem clara sobre as válvulas do coração, doenças, exames, tratamentos e a jornada hospitalar. Sem cadastro."
      />

      <section className="container-vp -mt-6 mb-10">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite sua dúvida sobre válvulas, sintomas, exames ou tratamentos"
            className="h-14 pl-12 pr-4 text-base shadow-md-soft border-border/80"
          />
        </div>
      </section>

      <section className="container-vp pb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { to: "/aprender/o-que-sao-valvulas", icon: Heart, title: "Quero entender minha doença" },
            { to: "/aprender/ecocardiograma", icon: Stethoscope, title: "Vou fazer um exame" },
            { to: "/aprender/cirurgia-valvar", icon: Wrench, title: "Vou passar por procedimento" },
            { to: "/aprender/recuperacao", icon: Compass, title: "Cuidados depois do tratamento" },
          ].map((q, i) => (
            <Link key={i} to={q.to}>
              <Card className="p-5 card-elevated h-full">
                <q.icon className="h-6 w-6 text-accent mb-3" />
                <p className="font-display font-semibold text-sm text-foreground leading-snug">{q.title}</p>
              </Card>
            </Link>
          ))}
        </div>

        {Object.entries(grouped).length === 0 && (
          <div className="text-center py-16">
            <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum tópico encontrado para "{query}".</p>
          </div>
        )}

        {Object.entries(grouped).map(([catKey, topics]) => {
          const cat = patientCategories[catKey as keyof typeof patientCategories];
          const Icon = categoryIcons[catKey] ?? BookOpen;
          if (!cat) return null;
          return (
            <div key={catKey} className="mb-14">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display font-semibold text-2xl text-foreground">{cat.label}</h2>
                  <p className="text-sm text-muted-foreground">{cat.description}</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {topics.map((t) => (
                  <TopicCard
                    key={t.slug}
                    to={`/aprender/${t.slug}`}
                    icon={Icon}
                    title={t.title}
                    description={t.shortDescription}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <div className="grid md:grid-cols-3 gap-4 mt-16">
          <Link to="/aprender/sinais-de-alerta">
            <Card className="p-5 card-elevated border-destructive/20 bg-destructive/5">
              <AlertTriangle className="h-6 w-6 text-destructive mb-2" />
              <h3 className="font-display font-semibold text-foreground">Sinais de alerta</h3>
              <p className="text-sm text-muted-foreground mt-1">Quando procurar atendimento imediato.</p>
            </Card>
          </Link>
          <Link to="/aprender/glossario">
            <Card className="p-5 card-elevated">
              <BookOpen className="h-6 w-6 text-accent mb-2" />
              <h3 className="font-display font-semibold text-foreground">Glossário</h3>
              <p className="text-sm text-muted-foreground mt-1">Termos médicos explicados em palavras simples.</p>
            </Card>
          </Link>
          <Link to="/aprender/faq">
            <Card className="p-5 card-elevated">
              <HelpCircle className="h-6 w-6 text-accent mb-2" />
              <h3 className="font-display font-semibold text-foreground">Perguntas frequentes</h3>
              <p className="text-sm text-muted-foreground mt-1">Dúvidas comuns sobre doenças valvares.</p>
            </Card>
          </Link>
        </div>

        <div className="mt-14 max-w-3xl mx-auto">
          <MedicalDisclaimer />
        </div>
      </section>
    </>
  );
};

export default Aprender;
