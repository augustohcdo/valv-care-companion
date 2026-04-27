import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";

interface LegalDoc {
  title: string;
  eyebrow: string;
  description: string;
  sections: { heading: string; body: string | string[] }[];
}

export const LegalPage = ({ doc }: { doc: LegalDoc }) => {
  return (
    <>
      <PageHeader eyebrow={doc.eyebrow} title={doc.title} description={doc.description} />
      <article className="container-vp py-12 max-w-3xl">
        {doc.sections.map((s, i) => (
          <div key={i} className="mb-8">
            <h2 className="font-display font-semibold text-xl text-foreground mb-3">{s.heading}</h2>
            {Array.isArray(s.body) ? (
              <ul className="space-y-2">
                {s.body.map((b, j) => (
                  <li key={j} className="text-base text-foreground/85 leading-relaxed">• {b}</li>
                ))}
              </ul>
            ) : (
              <p className="text-base text-foreground/85 leading-relaxed">{s.body}</p>
            )}
          </div>
        ))}

        <Card className="p-5 bg-secondary/40 mt-8">
          <p className="text-xs text-muted-foreground">
            Esta é uma versão preliminar para demonstração. Recomenda-se revisão jurídica completa antes da utilização em produção.
          </p>
        </Card>
      </article>
    </>
  );
};

export default LegalPage;
