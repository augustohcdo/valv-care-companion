import { ShieldCheck, AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "reviewed" | "ai_generated_pending" | "pending" | "ai_generated";

interface Props {
  status: Status;
  reviewer?: string | null;
  reviewedAt?: string | null;
  compact?: boolean;
  className?: string;
}

/**
 * Selo de status de revisão de conteúdo clínico.
 * - reviewed: revisado por médico humano (verde)
 * - ai_generated_pending / ai_generated: gerado por IA, aguardando revisão (vermelho)
 * - pending: cadastrado, ainda não revisado (âmbar)
 */
export function ContentReviewBadge({ status, reviewer, reviewedAt, compact, className }: Props) {
  const map = {
    reviewed: {
      icon: ShieldCheck,
      label: "Revisado por médico",
      detail: reviewer ? `${reviewer}${reviewedAt ? ` · ${new Date(reviewedAt).toLocaleDateString("pt-BR")}` : ""}` : null,
      classes: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    ai_generated_pending: {
      icon: AlertTriangle,
      label: "Gerado por IA — aguardando revisão médica",
      detail: "Conteúdo preliminar. Não use como fonte primária para decisão clínica.",
      classes: "border-destructive/50 bg-destructive/10 text-destructive",
    },
    ai_generated: {
      icon: Sparkles,
      label: "Gerado por IA — aguardando revisão médica",
      detail: "Conteúdo preliminar. Verifique na fonte antes de citar.",
      classes: "border-destructive/50 bg-destructive/10 text-destructive",
    },
    pending: {
      icon: AlertTriangle,
      label: "Aguardando revisão",
      detail: null,
      classes: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
  } as const;

  const cfg = map[status] ?? map.pending;
  const Icon = cfg.icon;

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
          cfg.classes,
          className,
        )}
      >
        <Icon className="h-3 w-3" />
        {cfg.label}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
        cfg.classes,
        className,
      )}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold">{cfg.label}</p>
        {cfg.detail && <p className="opacity-90 mt-0.5">{cfg.detail}</p>}
      </div>
    </div>
  );
}
