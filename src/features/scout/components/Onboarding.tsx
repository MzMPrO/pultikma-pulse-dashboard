import { ChevronRight, Gauge, MapPin, MessageSquareText } from "lucide-react";
import { useRef, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const STEPS = [
  {
    icon: MessageSquareText,
    title: "Опишите бизнес",
    text: "Выберите тип заведения или напишите в чате, что хотите открыть.",
  },
  {
    icon: MapPin,
    title: "Выберите точку на карте",
    text: "Кликните там, где думаете открыться: смотрим район в радиусе 500 м.",
  },
  {
    icon: Gauge,
    title: "Получите PulTikma Score",
    text: "Оценка точки и топ-3 места рядом, где шансов больше.",
  },
];

/** Welcome overlay shown on the first visit and via the «?» button. Esc / outside click / «Начать» close it. */
export function Onboarding({
  open,
  onClose,
  onExample,
  inputRef,
}: {
  open: boolean;
  onClose: () => void;
  onExample: () => void;
  /** chat input: focused after «Начать» */
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const focusInput = useRef(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        data-testid="onboarding"
        className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-2xl gap-5 overflow-y-auto rounded-2xl border-ink-border bg-[#0b0f1a]/95 p-5 text-ink-foreground backdrop-blur-xl sm:p-7"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (focusInput.current) inputRef.current?.focus();
          focusInput.current = false;
        }}
      >
        <div className="space-y-1.5 pr-6">
          <DialogTitle className="text-xl font-bold sm:text-2xl">Как это работает</DialogTitle>
          <DialogDescription className="text-sm text-ink-muted">
            Три шага, чтобы понять, стоит ли открываться в выбранном месте Ташкента.
          </DialogDescription>
        </div>

        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="relative flex gap-3 rounded-2xl border border-ink-border bg-ink-foreground/5 p-4 sm:block sm:space-y-3"
            >
              <div className="relative grid size-12 shrink-0 place-items-center rounded-xl bg-brand-gradient text-primary-foreground">
                <s.icon className="size-6" />
                <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-[#0b0f1a] text-[11px] font-bold text-cyan-brand ring-1 ring-cyan-brand/60">
                  {i + 1}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold leading-snug">
                  {i + 1}. {s.title}
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{s.text}</p>
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight
                  className="absolute -right-3.5 top-1/2 z-10 hidden size-5 -translate-y-1/2 text-cyan-brand sm:block"
                  aria-hidden
                />
              )}
            </li>
          ))}
        </ol>

        <p className="rounded-xl border border-cyan-brand/30 bg-cyan-brand/10 px-4 py-2.5 text-[13px] leading-relaxed">
          <b className="text-cyan-brand">PulTikma Score</b> — оценка точки от 0 до 100: чем выше,
          тем больше шансов, что заведение приживётся.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            variant="hero"
            size="xl"
            className="sm:flex-1"
            onClick={() => {
              focusInput.current = true;
              onClose();
            }}
          >
            Начать
          </Button>
          <Button variant="glass" size="xl" className="sm:flex-1" onClick={onExample}>
            Посмотреть пример
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
