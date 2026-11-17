import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

import { HeroVisual } from "./HeroVisual";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

const ease = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  const t = useT();
  return (
    <section className="relative overflow-hidden bg-ink text-ink-foreground">
      <div className="absolute inset-[-10%] bg-ink-mesh animate-mesh" />
      <div className="absolute inset-0 bg-grid-ink" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-ink" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-32 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-40">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="glass-dark inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-ink-muted"
          >
            <Sparkles className="size-3.5 text-cyan-brand" />
            {t.hero.eyebrow}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease }}
            className="mt-6 text-5xl font-semibold tracking-[-0.04em] sm:text-6xl lg:text-7xl"
          >
            <span className="text-hero-gradient">PulTikma AI</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease }}
            className="mt-5 text-2xl font-medium leading-tight tracking-tight text-ink-foreground sm:text-3xl"
          >
            {t.tagline}
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease }}
            className="mt-5 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg"
          >
            {t.hero.description}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease }}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <Button asChild variant="hero" size="xl">
              <Link to="/app/wizard">
                {t.hero.primary} <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="glass" size="xl">
              <a href="#how">{t.hero.secondary}</a>
            </Button>
          </motion.div>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}
