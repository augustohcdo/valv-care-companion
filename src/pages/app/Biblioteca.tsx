import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Search, ArrowRight, ShieldAlert } from "lucide-react";
import { clinicalLibrary, libraryByValve } from "@/data/clinicalLibrary";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Biblioteca() {
  const [q, setQ] = useState("");
  const [valveFilter, setValveFilter] = useState<string>("Todas");

  const valves = ["Todas", ...Object.keys(libraryByValve)];

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return clinicalLibrary.filter((g) => {
      const matchesValve = valveFilter === "Todas" || g.valve === valveFilter;
      if (!query) return matchesValve;
      const haystack = [
        g.title,
        g.shortTitle,
        g.pathology,
        g.summary,
        ...g.keyPoints,
        ...g.sections.flatMap((s) => [s.heading, s.body ?? "", ...(s.bullets ?? [])]),
      ]
        .join(" ")
        .toLowerCase();
      return matchesValve && haystack.includes(query);
    });
  }, [q, valveFilter]);

  const highlight = (text: string) => {
    const query = q.trim();
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return parts.map((p, i) =>
      p.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-warning/30 text-foreground rounded px-0.5">{p}</mark>
      ) : (
        <span key={i}>{p}</span>
      ),
    );
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <p className="text-sm text-muted-foreground">Apoio clínico</p>
        <h1 className="font-serif text-3xl lg:text-4xl text-primary mt-1 flex items-center gap-3">
          <BookOpen className="h-7 w-7" /> Biblioteca clínica
        </h1>
        <p className="text-muted-foreground mt-1 max-w-3xl">
          Resumos clínicos por valvopatia, baseados em recomendações gerais das principais diretrizes
          (SBC 2020, ESC/EACTS 2021, ACC/AHA 2020). Material educativo — não substitui julgamento
          clínico individual nem consulta às diretrizes na íntegra.
        </p>
      </div>

      <div className="flex gap-3 items-start rounded-xl border border-warning/30 bg-warning/5 p-4">
        <ShieldAlert className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Os textos são <strong className="text-foreground">resumos didáticos</strong>. Decisões
          terapêuticas devem considerar o caso individual, comorbidades e contexto local.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por valvopatia, lesão ou termo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {valves.map((v) => (
            <button
              key={v}
              onClick={() => setValveFilter(v)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                valveFilter === v
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-secondary"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((g) => {
          // Encontra trecho relevante quando a busca não está no resumo
          const query = q.trim().toLowerCase();
          let snippet: string | null = null;
          if (query && !g.summary.toLowerCase().includes(query)) {
            const matchPoint = g.keyPoints.find((k) => k.toLowerCase().includes(query));
            if (matchPoint) snippet = matchPoint;
            else {
              for (const s of g.sections) {
                const inBody = s.body?.toLowerCase().includes(query);
                const inBullet = s.bullets?.find((b) => b.toLowerCase().includes(query));
                if (inBody) { snippet = `${s.heading}: ${s.body}`; break; }
                if (inBullet) { snippet = `${s.heading}: ${inBullet}`; break; }
              }
            }
          }
          return (
            <Card key={g.slug} className="shadow-sm-soft hover:shadow-md-soft transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary">{g.valve}</Badge>
                  <Badge variant="outline">{g.pathology}</Badge>
                </div>
                <h3 className="font-serif text-xl text-primary mb-2">{highlight(g.shortTitle)}</h3>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{highlight(g.summary)}</p>
                {snippet && (
                  <p className="text-xs text-foreground bg-secondary/50 border-l-2 border-primary px-3 py-2 rounded mb-3 line-clamp-2">
                    {highlight(snippet)}
                  </p>
                )}
                <ul className="text-xs text-muted-foreground space-y-1 mb-4">
                  {g.keyPoints.slice(0, 2).map((k) => (
                    <li key={k} className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>{highlight(k)}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/app/medico/biblioteca/${g.slug}`}>
                    Ler resumo <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-8">
            Nenhum resultado encontrado.
          </p>
        )}
      </div>
    </div>
  );
}
