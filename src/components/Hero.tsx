import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface TrustItem {
  icon: ReactNode;
  label: string;
}

interface Props {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  trustItems?: TrustItem[];
  /** Ilustração/imagem posicionada à direita em telas largas. */
  media?: ReactNode;
  backgroundImage?: string;
}

/** Hero reutilizável — título, subtítulo, CTAs e mídia, sobre o gradiente de marca. */
export function Hero({ eyebrow, title, subtitle, actions, trustItems, media, backgroundImage }: Props) {
  return (
    <section className="relative overflow-hidden bg-gradient-hero text-primary-foreground">
      {backgroundImage && (
        <>
          <div className="absolute inset-0 opacity-30">
            <img src={backgroundImage} alt="" className="w-full h-full object-cover object-right" width={1600} height={1200} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/85 to-transparent" />
        </>
      )}

      <div className="container-vp relative py-20 sm:py-28 lg:py-32">
        <div className={media ? "grid lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center" : ""}>
          <motion.div
            className="max-w-3xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            {eyebrow && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/20 border border-accent/30 text-xs font-medium text-accent backdrop-blur-sm mb-6">
                {eyebrow}
              </span>
            )}
            <h1 className="font-display font-semibold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-6 text-lg sm:text-xl text-primary-foreground/85 leading-relaxed max-w-2xl">
                {subtitle}
              </p>
            )}
            {actions && <div className="mt-9 flex flex-col sm:flex-row flex-wrap gap-3">{actions}</div>}
            {trustItems && trustItems.length > 0 && (
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-primary-foreground/75">
                {trustItems.map((t, i) => (
                  <span key={i} className="flex items-center gap-2">
                    {t.icon} {t.label}
                  </span>
                ))}
              </div>
            )}
          </motion.div>

          {media && (
            <motion.div
              className="hidden lg:block"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              {media}
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
