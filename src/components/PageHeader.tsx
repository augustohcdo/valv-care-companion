import { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: { label: string; to?: string }[];
  actions?: ReactNode;
}

export const PageHeader = ({ eyebrow, title, description, breadcrumbs, actions }: PageHeaderProps) => {
  return (
    <section className="bg-gradient-subtle border-b border-border">
      <div className="container-vp py-10 sm:py-14">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-primary">Início</Link>
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <ChevronRight className="h-3 w-3" />
                {b.to ? (
                  <Link to={b.to} className="hover:text-primary">{b.label}</Link>
                ) : (
                  <span className="text-foreground font-medium">{b.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="max-w-3xl">
            {eyebrow && (
              <span className="inline-block text-xs font-semibold uppercase tracking-wider text-accent mb-3">
                {eyebrow}
              </span>
            )}
            <h1 className="font-display font-semibold text-3xl sm:text-4xl lg:text-5xl text-foreground tracking-tight">
              {title}
            </h1>
            {description && (
              <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      </div>
    </section>
  );
};
