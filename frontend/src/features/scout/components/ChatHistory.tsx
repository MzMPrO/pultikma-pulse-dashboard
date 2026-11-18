import { Loader2, Trash2, X } from "lucide-react";

import { scoreColor } from "./ResultsPanel";
import type { ChatSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
};

/** «История» drawer: slides over the chat panel body, lists past chats (newest first). */
export function ChatHistory({
  chats,
  currentId,
  loading,
  onClose,
  onOpen,
  onDelete,
}: {
  chats: ChatSummary[] | null;
  currentId: string;
  loading: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      data-testid="chat-history"
      className="absolute inset-x-0 bottom-0 top-[53px] z-20 flex flex-col bg-[#0b0f1a]/95 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between border-b border-ink-border px-4 py-2.5">
        <span className="text-sm font-semibold">История чатов</span>
        <button
          onClick={onClose}
          aria-label="Закрыть историю"
          className="grid size-7 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-ink-foreground/10 hover:text-ink-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {loading && chats === null && (
          <div className="grid place-items-center py-8 text-ink-muted">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
        {chats !== null && chats.length === 0 && (
          <p className="px-2 py-8 text-center text-xs text-ink-muted">Пока нет сохранённых чатов. Начните анализ — он появится здесь.</p>
        )}
        {chats?.map((c) => (
          <div
            key={c.session_id}
            className={cn(
              "group flex items-center gap-2 rounded-xl border p-2 transition-colors",
              c.session_id === currentId
                ? "border-cyan-brand/50 bg-cyan-brand/10"
                : "border-ink-border bg-ink-foreground/5 hover:border-cyan-brand/40",
            )}
          >
            <button onClick={() => onOpen(c.session_id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold tabular-nums"
                style={
                  c.last_score == null
                    ? undefined
                    : { background: `${scoreColor(c.last_score)}22`, color: scoreColor(c.last_score), border: `1px solid ${scoreColor(c.last_score)}66` }
                }
                data-testid="chat-score"
              >
                {c.last_score == null ? <span className="text-ink-muted">—</span> : c.last_score}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm">{c.title || "Новый чат"}</span>
                <span className="block text-[11px] text-ink-muted">{fmtDate(c.updated_at)}</span>
              </span>
            </button>
            <button
              onClick={() => onDelete(c.session_id)}
              aria-label={`Удалить чат «${c.title}»`}
              className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-muted opacity-60 transition hover:bg-red-500/15 hover:text-red-400 group-hover:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
