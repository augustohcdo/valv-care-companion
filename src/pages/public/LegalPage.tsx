import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export interface LegalSection {
  heading: string;
  body?: string | string[];
  subsections?: { heading: string; body: string | string[] }[];
}

export interface LegalDoc {
  title: string;
  eyebrow: string;
  description: string;
  effectiveDate: string;       // ex: "01 de maio de 2026"
  version: string;             // ex: "1.0"
  sections: LegalSection[];
  contact?: { dpoEmail?: string; supportEmail?: string };
}

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const renderBody = (body?: string | string[]) => {
  if (!body) return null;
  if (Array.isArray(body)) {
    return (
      <ul className="space-y-2 mt-2">
        {body.map((b, j) => (
          <li key={j} className="text-base text-foreground/85 leading-relaxed">• {b}</li>
        ))}
      </ul>
    );
  }
  return (
    <p className="text-base text-foreground/85 leading-relaxed mt-2 whitespace-pre-line">
      {body}
    </p>
  );
};

export const LegalPage = ({ doc }: { doc: LegalDoc }) => {
  return (
    <>
      <PageHeader eyebrow={doc.eyebrow} title={doc.title} description={doc.description} />

      <article className="container-vp py-10 max-w-3xl">
        <div className="flex flex-wrap items-center gap-3 mb-6 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/60 border border-border/60">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Vigência: <strong className="text-foreground/80">{doc.effectiveDate}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-secondary/60 border border-border/60">
            Versão {doc.version}
          </span>
        </div>

        {/* Índice */}
        <Card className="p-4 mb-8 bg-secondary/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Índice</p>
          <ol className="space-y-1 text-sm">
            {doc.sections.map((s, i) => (
              <li key={i}>
                <a href={`#${slug(s.heading)}`} className="text-primary hover:underline">
                  {i + 1}. {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </Card>

        {doc.sections.map((s, i) => (
          <section key={i} id={slug(s.heading)} className="mb-8 scroll-mt-24">
            <h2 className="font-display font-semibold text-xl text-foreground mb-1">
              {i + 1}. {s.heading}
            </h2>
            {renderBody(s.body)}
            {s.subsections?.map((ss, j) => (
              <div key={j} className="mt-4 pl-4 border-l-2 border-border/60">
                <h3 className="font-display font-semibold text-base text-foreground">
                  {i + 1}.{j + 1} {ss.heading}
                </h3>
                {renderBody(ss.body)}
              </div>
            ))}
          </section>
        ))}

        {(doc.contact?.dpoEmail || doc.contact?.supportEmail) && (
          <Card className="p-5 bg-primary/5 border-primary/20">
            <p className="text-sm text-foreground/90">
              <strong>Contato:</strong>
            </p>
            <ul className="text-sm text-foreground/80 mt-1 space-y-1">
              {doc.contact?.dpoEmail && (
                <li>
                  Encarregado de Dados (DPO):{" "}
                  <a href={`mailto:${doc.contact.dpoEmail}`} className="text-primary underline">
                    {doc.contact.dpoEmail}
                  </a>
                </li>
              )}
              {doc.contact?.supportEmail && (
                <li>
                  Suporte:{" "}
                  <a href={`mailto:${doc.contact.supportEmail}`} className="text-primary underline">
                    {doc.contact.supportEmail}
                  </a>
                </li>
              )}
            </ul>
          </Card>
        )}

        <p className="text-xs text-muted-foreground mt-8">
          Este documento está em constante evolução. Alterações materiais serão comunicadas com
          antecedência mínima de 30 dias e exigirão novo aceite quando aplicável (Art. 8º, §6º, LGPD).
        </p>
      </article>
    </>
  );
};

export default LegalPage;
