interface Props {
  className?: string;
}

/** Ilustração vetorial própria: coração estilizado com válvula e traço de pulso. */
export function HeartValveIllustration({ className }: Props) {
  return (
    <svg
      viewBox="0 0 240 240"
      fill="none"
      className={className}
      role="img"
      aria-label="Ilustração de coração com válvula cardíaca"
    >
      <circle cx="120" cy="120" r="118" fill="hsl(var(--accent-soft))" />
      <path
        d="M120 176c-34-22-64-46-64-80a38 38 0 0 1 64-27 38 38 0 0 1 64 27c0 34-30 58-64 80Z"
        fill="hsl(var(--primary) / 0.08)"
        stroke="hsl(var(--primary))"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M76 118c8-10 20-10 28 0s20 10 28 0 20-10 28 0"
        stroke="hsl(var(--accent))"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M46 152h26l10-20 14 34 12-26 8 12h28"
        stroke="hsl(var(--accent))"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );
}
