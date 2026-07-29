interface Props {
  className?: string;
}

/** Ilustração vetorial própria: trilha com marcos, representando a jornada acompanhada do paciente. */
export function JourneyIllustration({ className }: Props) {
  return (
    <svg
      viewBox="0 0 260 120"
      fill="none"
      className={className}
      role="img"
      aria-label="Ilustração de jornada de cuidado com etapas"
    >
      <path
        d="M12 100C60 100 60 30 108 30s48 60 96 60 44-70 44-70"
        stroke="hsl(var(--primary) / 0.35)"
        strokeWidth="4"
        strokeDasharray="2 10"
        strokeLinecap="round"
      />
      {[
        { x: 12, y: 100 },
        { x: 108, y: 30 },
        { x: 204, y: 90 },
        { x: 248, y: 20 },
      ].map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="9" fill="hsl(var(--accent-soft))" stroke="hsl(var(--accent))" strokeWidth="3" />
          <circle cx={p.x} cy={p.y} r="3" fill="hsl(var(--accent))" />
        </g>
      ))}
    </svg>
  );
}
