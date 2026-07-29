interface Props {
  className?: string;
}

/** Ilustração vetorial própria: escudo com coração, representando proteção de dados de saúde. */
export function ShieldSecurityIllustration({ className }: Props) {
  return (
    <svg
      viewBox="0 0 200 220"
      fill="none"
      className={className}
      role="img"
      aria-label="Ilustração de escudo protegendo dados de saúde"
    >
      <path
        d="M100 10 172 34v58c0 58-32 96-72 118-40-22-72-60-72-118V34Z"
        fill="hsl(var(--success) / 0.1)"
        stroke="hsl(var(--success))"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M100 138c-18-11-34-24-34-42a20 20 0 0 1 34-14 20 20 0 0 1 34 14c0 18-16 31-34 42Z"
        fill="hsl(var(--success) / 0.18)"
        stroke="hsl(var(--success))"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
