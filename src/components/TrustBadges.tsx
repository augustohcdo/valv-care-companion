import { ShieldCheck, Lock, FileCheck2, KeyRound } from "lucide-react";

const items = [
  { icon: ShieldCheck, label: "LGPD", desc: "Conformidade Lei 13.709" },
  { icon: Lock, label: "Criptografia", desc: "TLS + at-rest" },
  { icon: KeyRound, label: "Senhas verificadas", desc: "Checagem HIBP ativa" },
  { icon: FileCheck2, label: "Auditoria", desc: "Trilha imutável" },
];

interface Props {
  variant?: "row" | "grid";
  className?: string;
}

export const TrustBadges = ({ variant = "row", className = "" }: Props) => {
  if (variant === "grid") {
    return (
      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${className}`}>
        {items.map((it) => (
          <div
            key={it.label}
            className="rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm p-3 flex items-start gap-2.5"
          >
            <it.icon className="h-4 w-4 text-success shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground leading-tight">{it.label}</p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{it.desc}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground ${className}`}>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <it.icon className="h-3.5 w-3.5 text-success" />
          <span className="font-medium text-foreground/80">{it.label}</span>
          <span className="hidden sm:inline">· {it.desc}</span>
        </span>
      ))}
    </div>
  );
};
