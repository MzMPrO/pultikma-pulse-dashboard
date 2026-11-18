import { SCENARIOS, type ScenarioKey } from "@/lib/api";

const CARDS = [
  { emoji: "☕", label: "Кофейня" },
  { emoji: "🍔", label: "Фастфуд" },
  { emoji: "🍽", label: "Кафе" },
  { emoji: "💊", label: "Аптека" },
];

/** Chat empty state: big category cards + one-click ready examples. */
export function EmptyState({
  disabled,
  onCategory,
  onScenario,
}: {
  disabled?: boolean;
  onCategory: (label: string) => void;
  onScenario: (key: ScenarioKey) => void;
}) {
  return (
    <div className="space-y-3 pt-1" data-testid="chat-empty">
      <div>
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
          Что хотите открыть?
        </div>
        <div className="grid grid-cols-2 gap-2">
          {CARDS.map((c) => (
            <button
              key={c.label}
              type="button"
              disabled={disabled}
              onClick={() => onCategory(c.label)}
              className="flex items-center gap-2.5 rounded-xl border border-ink-border bg-ink-foreground/5 px-3 py-2 text-left text-sm font-medium lg:py-3 transition-all hover:-translate-y-0.5 hover:border-cyan-brand/60 hover:bg-cyan-brand/10 disabled:opacity-50"
            >
              <span className="text-2xl leading-none" aria-hidden>
                {c.emoji}
              </span>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
          Готовые примеры
        </div>
        <div className="flex flex-col gap-1.5">
          {(Object.keys(SCENARIOS) as ScenarioKey[]).map((k) => (
            <button
              key={k}
              type="button"
              disabled={disabled}
              onClick={() => onScenario(k)}
              className="flex items-center justify-between rounded-xl border border-cyan-brand/30 bg-cyan-brand/10 px-3 py-2 text-left text-[13px] text-cyan-brand transition-colors hover:bg-cyan-brand/20 disabled:opacity-50"
            >
              {SCENARIOS[k].label}
              <span aria-hidden>→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
