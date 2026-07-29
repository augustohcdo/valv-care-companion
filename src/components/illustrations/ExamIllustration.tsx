interface Props {
  className?: string;
}

/** Ilustração vetorial própria: estetoscópio com onda de exame, representando diagnóstico. */
export function ExamIllustration({ className }: Props) {
  return (
    <svg
      viewBox="0 0 240 240"
      fill="none"
      className={className}
      role="img"
      aria-label="Ilustração de estetoscópio com onda de exame"
    >
      <circle cx="120" cy="120" r="118" fill="hsl(var(--accent-soft))" />
      <path
        d="M78 56v46a30 30 0 0 0 60 0V56"
        stroke="hsl(var(--primary))"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M138 102a30 30 0 1 0 30 30"
        stroke="hsl(var(--primary))"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="168" cy="132" r="10" fill="hsl(var(--primary) / 0.1)" stroke="hsl(var(--primary))" strokeWidth="4" />
      <path
        d="M48 170h22l8-16 12 30 10-22 6 8h20"
        stroke="hsl(var(--accent))"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
