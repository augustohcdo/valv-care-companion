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
    <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 sm:p-12 text-center animate-fade-in">
      <div className={`mx-auto mb-4 h-14 w-14 rounded-full grid place-items-center ${ring}`}>
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="font-serif text-xl text-primary">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          {description}
        </p>
      )}
      {(action || secondary) && (
        <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
          {action &&
            (action.to ? (
              <Button asChild>
                <Link to={action.to}>{action.label}</Link>
              </Button>
            ) : (
              <Button onClick={action.onClick}>{action.label}</Button>
            ))}
          {secondary}
        </div>
      )}
    </div>
  );
};
