import { Bot, Gauge, Map, MapPinOff, Trophy } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { AgentPreview, MapPreview, SimulatorPreview, TwinPreview } from "./FeaturePreviews";
import { SectionHeading } from "./SectionHeading";
import { FadeUp } from "@/shared/components/FadeUp";
import { ScoreGauge } from "@/shared/components/ScoreGauge";
import { useT } from "@/shared/i18n";
import { cn } from "@/lib/utils";

interface Feature {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
  preview: ReactNode;
  span: string;
}

const FEATURES: Feature[] = [
  { icon: MapPinOff, title: "Закрывшиеся рядом", text: "Какие заведения закрылись в радиусе 500 м и почему — главный сигнал риска.", preview: <TwinPreview />, span: "lg:col-span-2" },
  { icon: Map, title: "Умная карта локаций", text: "Вузы, метро, базары и конкуренты в радиусе 500 м — на одной карте.", preview: <MapPreview />, span: "lg:col-span-2 lg:row-span-2" },
  { icon: Trophy, title: "Топ-3 лучших места рядом", text: "Три соседние точки с более высоким баллом — в один клик на карте.", preview: <SimulatorPreview />, span: "lg:col-span-2" },
  { icon: Bot, title: "AI Агент", text: "Задаёт уточняющие вопросы и показывает каждый шаг анализа.", preview: <AgentPreview />, span: "lg:col-span-2" },
  { icon: Gauge, title: "PulTikma Score", text: "Единый индекс 0–100 по пяти факторам.", preview: <div className="grid h-full place-items-center"><ScoreGauge value={78} size={110} stroke={9} label="Score" /></div>, span: "lg:col-span-2" },
];

export function Features() {
  const t = useT();
  return (
    <section id="features" className="scroll-mt-20 bg-secondary/50 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading eyebrow={t.features.eyebrow} title={t.features.title} />
        <div className="mt-14 grid auto-rows-[minmax(240px,auto)] gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {FEATURES.map((f, i) => (
            <FadeUp
              key={f.title}
              delay={i * 0.05}
              className={cn(
                "group flex flex-col rounded-2xl border bg-card p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift",
                f.span,
              )}
            >
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground transition-colors group-hover:bg-brand-gradient group-hover:text-primary-foreground">
                  <f.icon className="size-4.5" />
                </span>
                <h3 className="font-semibold tracking-tight">{f.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              <div className="mt-5 min-h-24 flex-1">{f.preview}</div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}
