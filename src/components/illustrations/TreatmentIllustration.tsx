interface Props {
  className?: string;
}

/** Ilustração vetorial própria: válvula reparada com marca de confirmação, representando tratamento. */
export function TreatmentIllustration({ className }: Props) {
  return (
    <svg
      viewBox="0 0 240 240"
      fill="none"
      className={className}
      role="img"
      aria-label="Ilustração de tratamento e reparo valvar"
    >
      <circle cx="120" cy="120" r="118" fill="hsl(var(--accent-soft))" />
      <path
        d="M120 172c-30-19-56-40-56-70a33 33 0 0 1 56-24 33 33 0 0 1 56 24c0 30-26 51-56 70Z"
        fill="hsl(var(--primary) / 0.08)"
        stroke="hsl(var(--primary))"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="164" cy="70" r="26" fill="hsl(var(--success) / 0.15)" stroke="hsl(var(--success))" strokeWidth="4" />
      <path
        d="M153 70l8 8 16-16"
        stroke="hsl(var(--success))"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
