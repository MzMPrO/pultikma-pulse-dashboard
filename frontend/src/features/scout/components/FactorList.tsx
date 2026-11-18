import { InfoHint } from "./Hint";
import { FACTOR_INFO, FACTOR_ORDER, describeFactor, scoreBand, scoreColor } from "@/features/scout/lib/guidance";
import type { AnalyzeResponse } from "@/lib/api";

/** Score scale «0–49 риск · 50–70 можно доработать · 71+ хорошо» with a marker at the current score. */
export function ScoreScale({ score }: { score: number }) {
  const pos = Math.max(0, Math.min(100, score));
  const band = scoreBand(score);
  const on = (b: typeof band) => (b === band ? "font-semibold text-ink-foreground" : "");
  return (
    <div className="w-full space-y-1.5" data-testid="score-scale">
      <div
        className="relative h-2.5 rounded-full"
        style={{
          background:
            "linear-gradient(90deg,#ef4444 0%,#ef4444 49%,#eab308 50%,#eab308 70%,#22c55e 71%,#22c55e 100%)",
        }}
      >
        <span
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg"
          style={{
            left: `${pos}%`,
            background: scoreColor(score),
            transition: "left 1.4s cubic-bezier(0.22,1,0.36,1)",
          }}
          aria-label={`Ваш балл: ${score}`}
        />
      </div>
      <div className="flex justify-between gap-1 text-[10px] leading-tight text-ink-muted">
        <span className={on("risk")}>0–49 риск</span>
        <span className={on("maybe")}>50–70 можно доработать</span>
        <span className={on("good")}>71+ хорошо</span>
      </div>
    </div>
  );
}

/** The 5 scoring factors: value bar + one-line plain explanation + ⓘ tooltip. */
export function FactorList({ result }: { result: AnalyzeResponse }) {
  return (
    <section data-testid="factor-list">
      <h3 className="mb-2 text-sm font-semibold">Из чего сложился балл</h3>
      <ul className="space-y-2.5">
        {FACTOR_ORDER.map((k) => {
          const v = Math.round(result.factors[k] * 100);
          const color = scoreColor(v);
          return (
            <li
              key={k}
              className="rounded-xl border border-ink-border bg-ink-foreground/5 px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-1.5 font-medium">
                  {FACTOR_INFO[k].label}
                  <InfoHint
                    text={FACTOR_INFO[k].tip}
                    label={`Что значит «${FACTOR_INFO[k].label}»`}
                  />
                </span>
                <span className="tabular-nums font-semibold" style={{ color }}>
                  {v}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-foreground/10">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${v}%`, background: color }}
                />
              </div>
              <p className="mt-1.5 text-xs leading-snug text-ink-muted">
                {describeFactor(k, result)}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
