import { Clock, MapPinned, Wallet } from "lucide-react";

import { useT } from "@/shared/i18n";

const icons = [Clock, Wallet, MapPinned];

export function TrustStrip() {
  const t = useT();
  return (
    <div className="border-y border-ink-border bg-ink">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-5 text-sm text-ink-muted">
        {t.trust.map((item, i) => {
          const Icon = icons[i]!;
          return (
            <span key={item} className="flex items-center gap-2">
              <Icon className="size-4 text-cyan-brand" />
              {item}
            </span>
          );
        })}
      </div>
    </div>
  );
}
