import { motion } from "framer-motion";
import { Gavel, Lightbulb, Radar, Shuffle } from "lucide-react";

import { SectionHeading } from "./SectionHeading";
import { useT } from "@/i18n";

const icons = [Lightbulb, Radar, Shuffle, Gavel];

export function HowItWorks() {
  const t = useT();
  return (
    <section id="how" className="relative scroll-mt-20 bg-background py-24 sm:py-32">
      <div className="absolute inset-0 bg-grid-light" />
      <div className="relative mx-auto max-w-6xl px-6">
        <SectionHeading eyebrow={t.how.eyebrow} title={t.how.title} />
        <div className="relative mt-16 grid gap-5 md:grid-cols-4">
          {/* connector line */}
          <motion.div
            className="absolute left-[12%] right-[12%] top-9 hidden h-px origin-left bg-brand-gradient md:block"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          />
          {t.how.steps.map((step, i) => {
            const Icon = icons[i]!;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.15 }}
                className="relative flex flex-col items-center text-center"
              >
                <div className="relative grid size-[72px] place-items-center rounded-2xl border bg-card shadow-card">
                  <Icon className="size-7 text-primary" />
                  <span className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-brand-gradient text-[11px] font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-base font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 max-w-[220px] text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
