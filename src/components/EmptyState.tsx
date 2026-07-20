import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    to?: string;
    onClick?: () => void;
  };
  secondary?: ReactNode;
  tone?: "default" | "accent";
}

/**
 * Estado vazio padronizado: mensagem amigável + 1 CTA principal.
 * Usar em listas/coleções vazias para evitar telas em branco.
 */
export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  secondary,
  tone = "default",
}: EmptyStateProps) => {
  const ring =
    tone === "accent"
      ? "bg-accent/10 text-accent"
      : "bg-primary/10 text-primary";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-border/60 bg-gradient-to-b from-card to-secondary/30 p-10 sm:p-16 text-center animate-fade-in">
      <div className="absolute inset-x-0 -top-24 h-48 bg-accent/5 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className={`mx-auto mb-5 h-20 w-20 rounded-2xl grid place-items-center ${ring} shadow-sm ring-1 ring-border/40`}>
          <Icon className="h-10 w-10" strokeWidth={1.5} />
        </div>
        <h3 className="font-serif text-2xl sm:text-3xl text-primary">{title}</h3>
        {description && (
          <p className="text-sm sm:text-base text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
            {description}
          </p>
        )}
        {(action || secondary) && (
          <div className="mt-7 flex items-center justify-center gap-3 flex-wrap">
            {action &&
              (action.to ? (
                <Button asChild size="lg" className="rounded-xl shadow-sm">
                  <Link to={action.to}>{action.label}</Link>
                </Button>
              ) : (
                <Button size="lg" className="rounded-xl shadow-sm" onClick={action.onClick}>
                  {action.label}
                </Button>
              ))}
            {secondary}
          </div>
        )}
      </div>
    </div>
  );
};
