import { Heart } from "lucide-react";
import { Link } from "react-router-dom";

interface LogoProps {
  variant?: "default" | "light";
  showText?: boolean;
}

export const Logo = ({ variant = "default", showText = true }: LogoProps) => {
  const textColor = variant === "light" ? "text-primary-foreground" : "text-foreground";
  const iconBg = variant === "light" ? "bg-accent" : "bg-gradient-hero";
  const iconColor = variant === "light" ? "text-accent-foreground" : "text-primary-foreground";

  return (
    <Link to="/" className="flex items-center gap-2.5 group" aria-label="ValvePath — Início">
      <div className={`${iconBg} ${iconColor} h-9 w-9 rounded-lg flex items-center justify-center shadow-md-soft group-hover:shadow-glow transition-all`}>
        <Heart className="h-5 w-5" strokeWidth={2.5} fill="currentColor" />
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`font-display font-bold text-lg ${textColor}`}>
            ValvePath
          </span>
          <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Heart Valve Care
          </span>
        </div>
      )}
    </Link>
  );
};
