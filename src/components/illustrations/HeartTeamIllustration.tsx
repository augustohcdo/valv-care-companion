interface Props {
  className?: string;
}

/** Ilustração vetorial própria: médico e paciente conectados por uma linha de cuidado. */
export function HeartTeamIllustration({ className }: Props) {
  return (
    <svg
      viewBox="0 0 240 200"
      fill="none"
      className={className}
      role="img"
      aria-label="Ilustração de médico e paciente conectados"
    >
      <rect x="2" y="2" width="236" height="196" rx="24" fill="hsl(var(--accent-soft))" />

      {/* Figura médico */}
      <circle cx="66" cy="70" r="22" fill="hsl(var(--primary) / 0.12)" stroke="hsl(var(--primary))" strokeWidth="4" />
      <path
        d="M30 158c4-30 20-46 36-46s32 16 36 46"
        stroke="hsl(var(--primary))"
        strokeWidth="4"
        strokeLinecap="round"
        fill="hsl(var(--primary) / 0.06)"
      />

      {/* Figura paciente */}
      <circle cx="174" cy="70" r="22" fill="hsl(var(--accent) / 0.14)" stroke="hsl(var(--accent))" strokeWidth="4" />
      <path
        d="M138 158c4-30 20-46 36-46s32 16 36 46"
        stroke="hsl(var(--accent))"
        strokeWidth="4"
        strokeLinecap="round"
        fill="hsl(var(--accent) / 0.06)"
      />

      {/* Linha de cuidado conectando, com pulso central */}
      <path
        d="M96 120h20l8-16 10 28 8-20 6 8h16"
        stroke="hsl(var(--primary))"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
