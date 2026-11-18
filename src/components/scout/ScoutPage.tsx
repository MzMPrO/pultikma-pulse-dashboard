import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Loader2, Send } from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";

import type { FlyTarget, FocusTarget } from "./LeafletMap";
import { ResultsPanel } from "./ResultsPanel";
import { Logo } from "@/components/shared/Logo";
import {
  SCENARIOS,
  analyze,
  chat,
  type AnalyzeResponse,
  type ScenarioKey,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const LeafletMap = lazy(() => import("./LeafletMap"));

const STEPS = [
  "Определяю район",
  "Считаю конкурентов в радиусе 500 м",
  "Ищу закрывшиеся заведения",
  "Оцениваю пешеходный поток",
  "Проверяю аренду и видимость",
  "Подбираю альтернативы рядом",
];

type Msg =
  | { id: number; role: "agent" | "user"; kind: "text"; text: string }
  | { id: number; role: "agent"; kind: "steps"; done: number };

const GREETING = "Ассалому алайкум! Какой бизнес хотите открыть? Выберите точку на карте 📍";
const FIRST_CHIPS = ["Кофейня", "Фастфуд", "Кафе", "Аптека"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const newSession = () => `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function ScoutPage({ scenario }: { scenario?: string | undefined }) {
  const [mounted, setMounted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ id: 1, role: "agent", kind: "text", text: GREETING }]);
  const [chips, setChips] = useState<string[]>(FIRST_CHIPS);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [visible, setVisible] = useState(0);
  const [showAlts, setShowAlts] = useState(false);
  const [selectedAlt, setSelectedAlt] = useState<number | null>(null);
  const [fly, setFly] = useState<FlyTarget | null>(null);
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [compareNonce, setCompareNonce] = useState(0);

  const session = useRef(newSession());
  const idRef = useRef(10);
  const runRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, chips]);

  const nextId = () => ++idRef.current;
  const addMsg = useCallback((role: "agent" | "user", text: string) => {
    setMessages((m) => [...m, { id: ++idRef.current, role, kind: "text", text }]);
  }, []);
  const flyTo = useCallback((lat: number, lng: number, zoom = 16) => {
    setFly({ lat, lng, zoom, nonce: Date.now() });
  }, []);

  /** Radar animation → markers one by one → results. */
  const runAnalysis = useCallback(
    async (a: AnalyzeResponse) => {
      const run = ++runRef.current;
      const live = () => runRef.current === run;
      const p = { lat: a.location.lat, lng: a.location.lng };
      setPoint(p);
      setResult(null);
      setVisible(0);
      setShowAlts(false);
      setSelectedAlt(null);
      setAnalyzing(true);
      flyTo(p.lat, p.lng, 15);

      const stepsId = nextId();
      setMessages((m) => [...m, { id: stepsId, role: "agent", kind: "steps", done: 0 }]);
      await sleep(1100); // let the camera fly in
      const total = a.competitors.length + a.closed.length + a.traffic_generators.length;
      let shown = 0;
      for (let s = 0; s < STEPS.length; s++) {
        if (!live()) return;
        setMessages((m) => m.map((x) => (x.id === stepsId && x.kind === "steps" ? { ...x, done: s } : x)));
        // reveal this step's share of markers one-by-one
        const target = Math.round(((s + 1) / STEPS.length) * total);
        const n = Math.max(0, target - shown);
        const slice = 650 / Math.max(n, 1);
        for (let i = 0; i < n; i++) {
          await sleep(slice);
          if (!live()) return;
          shown++;
          setVisible(shown);
        }
        if (n === 0) await sleep(450);
      }
      if (!live()) return;
      setMessages((m) => m.map((x) => (x.id === stepsId && x.kind === "steps" ? { ...x, done: STEPS.length } : x)));
      setVisible(total);
      setAnalyzing(false);
      setResult(a);
      setShowAlts(true);
      addMsg("agent", `Готово: ${a.score}/100 — ${a.verdict_text}. ${a.explanation}`);
      setChips(["Другая точка", "Сравнить с лучшей альтернативой"]);
    },
    [addMsg, flyTo],
  );

  const send = useCallback(
    async (text: string, coords?: { lat: number; lng: number }, silentUser = false) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setChips([]);
      if (!silentUser) addMsg("user", text);
      setTyping(true);
      try {
        const [res] = await Promise.all([
          chat({ session_id: session.current, message: text, lat: coords?.lat, lng: coords?.lng }),
          sleep(600),
        ]);
        setTyping(false);
        addMsg("agent", res.reply);
        setChips(res.quick_replies ?? []);
        if (res.analysis) await runAnalysis(res.analysis);
      } finally {
        setTyping(false);
        busyRef.current = false;
        setBusy(false);
      }
    },
    [addMsg, runAnalysis],
  );

  const onPick = useCallback(
    (lat: number, lng: number) => {
      if (busyRef.current) return;
      setPoint({ lat, lng });
      setResult(null);
      setShowAlts(false);
      setVisible(0);
      void send(`Анализируй точку ${lat.toFixed(4)}, ${lng.toFixed(4)}`, { lat, lng });
    },
    [send],
  );

  const runScenario = useCallback(
    async (key: ScenarioKey) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      const sc = SCENARIOS[key];
      setChips([]);
      addMsg("user", sc.label);
      setPoint({ lat: sc.lat, lng: sc.lng });
      setTyping(true);
      try {
        const [a] = await Promise.all([analyze({ lat: sc.lat, lng: sc.lng, category: sc.category }), sleep(500)]);
        setTyping(false);
        addMsg("agent", "Принято, запускаю анализ района в радиусе 500 м.");
        await runAnalysis(a);
      } finally {
        setTyping(false);
        busyRef.current = false;
        setBusy(false);
      }
    },
    [addMsg, runAnalysis],
  );

  // auto-run ?scenario=
  const autoRan = useRef<string | null>(null);
  useEffect(() => {
    if (!mapReady || !scenario || !(scenario in SCENARIOS)) return;
    if (autoRan.current === scenario) return;
    autoRan.current = scenario;
    void runScenario(scenario as ScenarioKey);
  }, [mapReady, scenario, runScenario]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = input.trim();
    if (!t || busy) return;
    setInput("");
    void send(t, point ?? undefined);
  };

  const handleAltClick = (rank: number) => {
    setSelectedAlt(rank);
    const a = result?.alternatives.find((x) => x.rank === rank);
    if (a) flyTo(a.lat, a.lng, 16);
  };

  /** Fly to a marker and open its tooltip (id = "x<closedId>"). */
  const focusMarker = useCallback((id: string, lat: number, lng: number) => {
    setFocus({ id, lat, lng, nonce: Date.now() });
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0b0f1a] text-ink-foreground">
      <div className="scout-map scout-noprint absolute inset-0 isolate z-0">
        {mounted && (
          <Suspense fallback={<div className="grid h-full place-items-center text-ink-muted"><Loader2 className="size-6 animate-spin" /></div>}>
            <LeafletMap
              point={point}
              analyzing={analyzing}
              result={result}
              visible={visible}
              showAlternatives={showAlts}
              selectedAlt={selectedAlt}
              fly={fly}
              focus={focus}
              onPick={onPick}
              onAltClick={handleAltClick}
              onReady={() => setMapReady(true)}
            />
          </Suspense>
        )}
      </div>

      {/* Chat panel */}
      <aside data-map-panel="chat" className="scout-noprint glass-dark absolute inset-x-2 bottom-2 z-10 flex h-[40vh] flex-col overflow-hidden rounded-2xl bg-[#0b0f1a]/80 lg:inset-x-auto lg:bottom-4 lg:left-4 lg:top-4 lg:h-auto lg:w-[360px]">
        <div className="flex items-center justify-between border-b border-ink-border px-4 py-3">
          <Logo tone="light" />
          <Link to="/" className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink-foreground">
            <ArrowLeft className="size-3.5" /> Главная
          </Link>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto p-4">
          {messages.map((m) =>
            m.kind === "steps" ? (
              <div key={m.id} className="max-w-[92%] space-y-1.5 rounded-2xl rounded-bl-sm border border-ink-border bg-ink-foreground/5 p-3 text-xs">
                {STEPS.map((s, i) => {
                  const done = m.done > i;
                  const active = m.done === i;
                  return (
                    <div key={s} className={cn("flex items-center gap-2", done ? "text-ink-foreground" : active ? "text-cyan-brand" : "text-ink-muted/60")}>
                      {done ? (
                        <Check className="size-3.5 text-green-400" />
                      ) : active ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <span className="size-3.5 rounded-full border border-ink-border" />
                      )}
                      {s}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                key={m.id}
                className={cn(
                  "max-w-[90%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "ml-auto rounded-br-sm bg-brand-gradient text-primary-foreground"
                    : "rounded-bl-sm border border-ink-border bg-ink-foreground/5",
                )}
              >
                {m.text}
              </div>
            ),
          )}
          {typing && (
            <div className="scout-typing w-fit rounded-2xl rounded-bl-sm border border-ink-border bg-ink-foreground/5 px-3 py-3 text-ink-muted" aria-label="Агент печатает">
              <span />
              <span />
              <span />
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-ink-border p-3">
          {chips.length > 0 && !busy && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    if (c === "Другая точка") addMsg("agent", "Кликните по другой точке на карте 📍");
                    else if (/^Сравнить/.test(c)) setCompareNonce((n) => n + 1);
                    else void send(c, point ?? undefined);
                  }}
                  className="rounded-full border border-ink-border bg-ink-foreground/5 px-3 py-1 text-xs transition-colors hover:border-cyan-brand/60 hover:text-cyan-brand"
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          {messages.length <= 2 && !busy && (
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SCENARIOS) as ScenarioKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => void runScenario(k)}
                  className="rounded-full border border-cyan-brand/30 bg-cyan-brand/10 px-3 py-1 text-xs text-cyan-brand transition-colors hover:bg-cyan-brand/20"
                >
                  {SCENARIOS[k].label}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={submit} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Напишите ответ…"
              disabled={busy}
              className="min-w-0 flex-1 rounded-xl border border-ink-border bg-ink-foreground/5 px-3 py-2 text-sm outline-none placeholder:text-ink-muted focus:border-cyan-brand/60"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="grid size-9 place-items-center rounded-xl bg-brand-gradient text-primary-foreground disabled:opacity-40"
              aria-label="Отправить"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </aside>

      {/* Results panel */}
      {result && (
        <aside data-map-panel="results" className="scout-print glass-dark absolute inset-x-2 top-2 z-10 max-h-[36vh] overflow-y-auto rounded-2xl bg-[#0b0f1a]/85 lg:inset-x-auto lg:bottom-4 lg:right-4 lg:top-4 lg:max-h-none lg:w-[380px]">
          <ResultsPanel
            result={result}
            selectedAlt={selectedAlt}
            compareNonce={compareNonce}
            onFly={(lat, lng) => flyTo(lat, lng, 17)}
            onFocusMarker={focusMarker}
            onSelectAlt={setSelectedAlt}
          />
        </aside>
      )}
    </div>
  );
}
