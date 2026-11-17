import { useNavigate } from "@tanstack/react-router";
import { ArrowUp, Bot } from "lucide-react";
import { useState } from "react";

import { SectionHeading } from "./SectionHeading";
import { FadeUp } from "@/components/shared/FadeUp";
import { useT } from "@/i18n";
import { useAppStore } from "@/store/useAppStore";

export function DemoTeaser() {
  const t = useT();
  const navigate = useNavigate();
  const setPendingPrompt = useAppStore((s) => s.setPendingPrompt);
  const [text, setText] = useState(t.demo.placeholder);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = text.trim() || t.demo.placeholder;
    setPendingPrompt(prompt);
    navigate({ to: "/app/agent" });
  };

  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeading eyebrow={t.demo.eyebrow} title={t.demo.title} />
        <FadeUp delay={0.15}>
          <form
            onSubmit={submit}
            className="relative mt-10 rounded-3xl bg-brand-gradient p-px shadow-glow"
          >
            <div className="flex items-center gap-3 rounded-[calc(1.5rem-1px)] bg-card p-2.5 pl-4">
              <Bot className="size-5 shrink-0 text-primary" />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t.demo.placeholder}
                aria-label={t.demo.placeholder}
                className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                className="flex shrink-0 items-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-sm font-medium text-ink-foreground transition-colors hover:bg-ink-2"
              >
                <span className="hidden sm:inline">{t.demo.button}</span>
                <ArrowUp className="size-4" />
              </button>
            </div>
          </form>
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
            {["Салон красоты в Чиланзаре, 80 млн", "Fashion-бренд, 150 млн сум", "Магазин у метро, 120 млн"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setText(s)}
                className="rounded-full border bg-card px-3 py-1.5 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
