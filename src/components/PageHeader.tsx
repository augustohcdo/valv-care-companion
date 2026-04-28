import { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}

export const PageHeader = ({ eyebrow, title, description, actions, children }: PageHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{eyebrow}</p>}
        <h1 className="font-serif text-3xl lg:text-4xl text-primary mt-1">{title}</h1>
        {description && <p className="text-muted-foreground mt-2 max-w-2xl">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
    </div>
  );
};
