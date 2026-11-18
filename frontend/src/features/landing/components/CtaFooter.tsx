import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { FadeUp } from "@/shared/components/FadeUp";
import { Logo } from "@/shared/components/Logo";
import { Button } from "@/components/ui/button";
import { useT } from "@/shared/i18n";

export function CtaFooter() {
  const t = useT();
  return (
    <>
      <section className="bg-background px-6 py-24">
        <FadeUp className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-ink px-8 py-16 text-center text-ink-foreground sm:px-16">
          <div className="absolute inset-0 bg-ink-mesh" />
          <div className="absolute inset-0 bg-grid-ink" />
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">{t.cta.title}</h2>
            <p className="mx-auto mt-4 max-w-md text-ink-muted">{t.cta.text}</p>
            <Button asChild variant="hero" size="xl" className="mt-8">
              <Link to="/app">
                {t.cta.button} <ArrowRight />
              </Link>
            </Button>
          </div>
        </FadeUp>
      </section>
      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <Logo />
          <p className="text-center">{t.footer}</p>
          <p>© 2026 PulTikma AI · Ташкент</p>
        </div>
      </footer>
    </>
  );
}
