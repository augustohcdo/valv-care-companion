import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface TopicCardProps {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
}

export const TopicCard = ({ to, icon: Icon, title, description, badge }: TopicCardProps) => {
  return (
    <Link to={to} className="group block">
      <Card className="h-full p-5 card-elevated border-border/70">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="h-10 w-10 rounded-lg bg-accent-soft text-accent flex items-center justify-center group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
            <Icon className="h-5 w-5" />
          </div>
          {badge && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded">
              {badge}
            </span>
          )}
        </div>
        <h3 className="font-display font-semibold text-base text-foreground mb-1.5 group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          {description}
        </p>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-accent group-hover:gap-2 transition-all">
          Saber mais <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </Card>
    </Link>
  );
};
