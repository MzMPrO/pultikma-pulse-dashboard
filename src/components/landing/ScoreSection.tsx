import { motion } from "framer-motion";

import { SectionHeading } from "./SectionHeading";
import { CountUp } from "@/components/shared/CountUp";
import { ScoreGauge } from "@/components/shared/ScoreGauge";
import { useT } from "@/i18n";

const BARS = [
  { label: "Поток клиентов", value: 88 },
  { label: "Конкуренция", value: 74 },
  { label: "Закрываемость района", value: 90 },
  { label: "Аренда", value: 70 },
  { label: "Видимость (1-я линия)", value: 86 },
];

export function ScoreSection() {
  const t = useT();
  return (
    <section className="relative overflow-hidden bg-ink py-24 text-ink-foreground sm:py-32">
      <div className="absolute inset-0 bg-ink-mesh opacity-70" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-2">
        <div>
          <SectionHeading eyebrow={t.score.eyebrow} title={t.score.title} text={t.score.text} tone="dark" className="text-left lg:mx-0" />
          <div className="mt-10 space-y-5">
            {BARS.map((b, i) => (
              <div key={b.label}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-ink-muted">{b.label}</span>
                  <span className="font-semibold tabular-nums"><CountUp to={b.value} /></span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-foreground/10">
                  <motion.div
                    className="h-full rounded-full bg-brand-gradient"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${b.value}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.3, delay: 0.2 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-center">
          <div className="glass-dark relative rounded-[2rem] p-10">
            <ScoreGauge value={84} size={280} stroke={18} tone="dark" />
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="size-2 rounded-full bg-success animate-soft-blink" />
              <span className="text-sm font-medium">Вердикт: Запускать</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
