import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

export function Navbar() {
  const t = useT();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-3">
      <nav
        className={cn(
          "mx-auto flex h-14 max-w-6xl items-center justify-between rounded-2xl px-4 transition-all duration-300",
          scrolled ? "border border-ink-border bg-ink/80 shadow-lift backdrop-blur-xl" : "border border-transparent",
        )}
      >
        <Logo tone="light" />
        <div className="hidden items-center gap-7 text-sm text-ink-muted md:flex">
          <a href="#features" className="transition-colors hover:text-ink-foreground">{t.nav.features}</a>
          <a href="#how" className="transition-colors hover:text-ink-foreground">{t.nav.how}</a>
          <Link to="/app" className="transition-colors hover:text-ink-foreground">{t.nav.map}</Link>
        </div>
        <Button asChild variant="hero" size="sm" className="rounded-lg px-4">
          <Link to="/app">
            <span className="hidden sm:inline">{t.nav.cta}</span>
            <span className="sm:hidden">Тест</span>
            <ArrowRight />
          </Link>
        </Button>
      </nav>
    </header>
  );
}
