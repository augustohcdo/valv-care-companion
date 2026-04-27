import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { glossary } from "@/data/patientContent";
import { Search } from "lucide-react";

const Glossario = () => {
  const [q, setQ] = useState("");

  const grouped = useMemo(() => {
    const filtered = glossary.filter(
      (g) => !q || g.term.toLowerCase().includes(q.toLowerCase()) || g.definition.toLowerCase().includes(q.toLowerCase())
    );
    const map: Record<string, typeof glossary> = {};
    filtered.forEach((e) => {
      const letter = e.term[0].toUpperCase();
      if (!map[letter]) map[letter] = [];
      map[letter].push(e);
    });
    return map;
  }, [q]);

  return (
    <>
      <PageHeader
        eyebrow="Para pacientes"
        title="Glossário"
        description="Termos médicos da área de doenças valvares cardíacas, explicados em linguagem simples."
        breadcrumbs={[{ label: "Aprender", to: "/aprender" }, { label: "Glossário" }]}
      />
      <section className="container-vp py-10">
        <div className="relative max-w-xl mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar termo..." className="pl-11 h-12" />
        </div>

        {Object.keys(grouped).sort().map((letter) => (
          <div key={letter} className="mb-8">
            <h2 className="font-display font-bold text-3xl text-accent mb-4">{letter}</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {grouped[letter].map((e) => (
                <Card key={e.term} className="p-4">
                  <h3 className="font-display font-semibold text-base text-foreground mb-1">{e.term}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{e.definition}</p>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
};

export default Glossario;
