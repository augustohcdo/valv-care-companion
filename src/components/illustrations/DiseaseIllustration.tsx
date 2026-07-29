interface Props {
  className?: string;
}

/** Ilustração vetorial própria: válvula com passagem estreitada, representando doença valvar. */
export function DiseaseIllustration({ className }: Props) {
  return (
    <svg
      viewBox="0 0 240 240"
      fill="none"
      className={className}
      role="img"
      aria-label="Ilustração de válvula cardíaca estreitada"
    >
      <circle cx="120" cy="120" r="118" fill="hsl(var(--accent-soft))" />
      <path
        d="M60 90h50l10 30-10 30H60"
        stroke="hsl(var(--primary))"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="hsl(var(--primary) / 0.06)"
      />
      <path
        d="M180 90h-50l-10 30 10 30h50"
        stroke="hsl(var(--primary))"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="hsl(var(--primary) / 0.06)"
      />
      <circle cx="120" cy="120" r="7" fill="hsl(var(--warning))" />
      <path
        d="M120 66v18M120 156v18"
        stroke="hsl(var(--warning))"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
