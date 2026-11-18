import { Link } from "@tanstack/react-router";
import { ArrowRight, Coffee, Pill, UtensilsCrossed } from "lucide-react";

import { SectionHeading } from "./SectionHeading";
import { FadeUp } from "@/shared/components/FadeUp";
import { useT } from "@/shared/i18n";

const DEMOS = [
  { key: "inha", label: "Кофейня у Inha", hint: "Университет + метро", icon: Coffee },
  { key: "chilanzar", label: "Фастфуд у метро Чиланзар", hint: "Огромный поток, но 4 закрытия", icon: UtensilsCrossed },
  { key: "novza", label: "Аптека у Новзы", hint: "Жилой район и поликлиника", icon: Pill },
] as const;

export function DemoTeaser() {
  const t = useT();
  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-6">
        <SectionHeading eyebrow={t.demo.eyebrow} title={t.demo.title} />
        <FadeUp delay={0.15}>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {DEMOS.map((d) => (
              <Link
                key={d.key}
                to="/app"
                search={{ scenario: d.key }}
                className="group flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground transition-colors group-hover:bg-brand-gradient group-hover:text-primary-foreground">
                  <d.icon className="size-5" />
                </span>
                <span className="font-semibold tracking-tight">{d.label}</span>
                <span className="text-sm text-muted-foreground">{d.hint}</span>
                <span className="mt-auto flex items-center gap-1 text-sm font-medium text-primary">
                  Запустить анализ <ArrowRight className="size-4" />
                </span>
              </Link>
            ))}
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
