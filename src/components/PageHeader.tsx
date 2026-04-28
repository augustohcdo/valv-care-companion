import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface Crumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  breadcrumbs?: Crumb[];
}

export const PageHeader = ({ eyebrow, title, description, actions, children, breadcrumbs }: PageHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-2 flex-wrap">
            {breadcrumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {c.to ? (
                  <Link to={c.to} className="hover:text-primary">{c.label}</Link>
                ) : (
                  <span className="text-foreground">{c.label}</span>
                )}
                {i < breadcrumbs.length - 1 && <ChevronRight className="h-3 w-3" />}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{eyebrow}</p>}
        <h1 className="font-serif text-3xl lg:text-4xl text-primary mt-1">{title}</h1>
        {description && <p className="text-muted-foreground mt-2 max-w-2xl">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
    </div>
  );
};
