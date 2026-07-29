import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";

interface Props {
  /** Valor exibido, ex. "20+", "100%", "3 min", "4". Só a parte numérica principal é animada. */
  value: string;
  className?: string;
}

/** Anima a contagem de 0 até o número embutido em `value` quando entra na viewport. */
export function AnimatedCounter({ value, className }: Props) {
  const match = value.match(/\d+/);
  const target = match ? Number(match[0]) : null;
  const prefix = target !== null ? value.slice(0, match!.index) : "";
  const suffix = target !== null ? value.slice((match!.index ?? 0) + match![0].length) : "";

  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { duration: 1200, bounce: 0 });

  useEffect(() => {
    if (inView && target !== null) motionValue.set(target);
  }, [inView, target, motionValue]);

  if (target === null) {
    return <span className={className}>{value}</span>;
  }

  return (
    <span className={className} ref={ref}>
      {prefix}
      <AnimatedNumber spring={spring} />
      {suffix}
    </span>
  );
}

function AnimatedNumber({ spring }: { spring: ReturnType<typeof useSpring> }) {
  const nodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    return spring.on("change", (v) => {
      if (nodeRef.current) nodeRef.current.textContent = Math.round(v).toString();
    });
  }, [spring]);

  return <span ref={nodeRef}>0</span>;
}
