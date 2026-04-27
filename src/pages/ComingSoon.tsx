import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Construction, ArrowLeft } from "lucide-react";

interface ComingSoonProps {
  title: string;
  eyebrow?: string;
  description?: string;
  features?: string[];
}

const ComingSoon = ({ title, eyebrow = "Em breve", description, features }: ComingSoonProps) => {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <section className="container-vp py-16 max-w-2xl">
        <Card className="p-8 card-elevated text-center">
          <div className="h-14 w-14 rounded-xl bg-accent-soft text-accent flex items-center justify-center mx-auto mb-5">
            <Construction className="h-7 w-7" />
          </div>
          <h2 className="font-display font-semibold text-2xl text-foreground mb-2">
            Esta área será liberada na próxima fase
          </h2>
          <p className="text-muted-foreground mb-6">
            Entrega faseada para garantir profundidade e segurança. Esta seção entra na Fase 2 do ValvePath 2.0.
          </p>
          {features && (
            <ul className="text-left bg-secondary/40 rounded-lg p-5 mb-6 space-y-2">
              {features.map((f, i) => (
                <li key={i} className="text-sm text-foreground/85">• {f}</li>
              ))}
            </ul>
          )}
          <Button asChild variant="hero">
            <Link to="/"><ArrowLeft className="h-4 w-4" /> Voltar ao início</Link>
          </Button>
        </Card>
      </section>
    </>
  );
};

export default ComingSoon;
