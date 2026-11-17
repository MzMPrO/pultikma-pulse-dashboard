import { motion } from "framer-motion";
import { MapPin, TrendingUp } from "lucide-react";

import { ScoreGauge } from "@/components/shared/ScoreGauge";
import { TashkentMap } from "@/components/shared/TashkentMap";

function Float({ children, className, delay = 0, y = 10 }: { children: React.ReactNode; className?: string; delay?: number; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: [0, -y, 0] }}
      transition={{
        opacity: { duration: 0.8, delay },
        y: { duration: 6 + delay * 2, repeat: Infinity, ease: "easeInOut", delay },
      }}
    >
      {children}
    </motion.div>
  );
}

const revenue = [12, 18, 16, 24, 22, 30, 34, 31, 40, 44, 42, 52];

function MiniRevenue() {
  const max = Math.max(...revenue);
  const pts = revenue.map((v, i) => `${(i / (revenue.length - 1)) * 200},${70 - (v / max) * 60}`).join(" ");
  return (
    <svg viewBox="0 0 200 74" className="h-16 w-full">
      <defs>
        <linearGradient id="rev-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--brand-cyan)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--brand-cyan)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,74 ${pts} 200,74`} fill="url(#rev-fill)" />
      <motion.polyline
        points={pts}
        fill="none"
        stroke="var(--brand-cyan)"
        strokeWidth="2"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, delay: 0.6 }}
      />
    </svg>
  );
}

function TwinCube() {
  const face = "absolute inset-0 rounded-md border border-ink-foreground/20";
  const s = 88;
  return (
    <div className="grid place-items-center" style={{ perspective: 600 }}>
      <div className="relative animate-cube" style={{ width: s, height: s, transformStyle: "preserve-3d" }}>
        <div className={`${face} bg-indigo-brand/30`} style={{ transform: `translateZ(${s / 2}px)` }}>
          {/* storefront */}
          <div className="absolute inset-x-3 bottom-0 h-1/2 rounded-t-sm border border-cyan-brand/60 bg-cyan-brand/20" />
          <div className="absolute inset-x-2 top-3 h-2 rounded-sm bg-brand-gradient" />
        </div>
        <div className={`${face} bg-violet-brand/25`} style={{ transform: `rotateY(180deg) translateZ(${s / 2}px)` }} />
        <div className={`${face} bg-violet-brand/30`} style={{ transform: `rotateY(90deg) translateZ(${s / 2}px)` }}>
          <div className="absolute left-3 top-5 size-5 rounded-sm bg-cyan-brand/40" />
          <div className="absolute right-3 top-5 size-5 rounded-sm bg-cyan-brand/40" />
        </div>
        <div className={`${face} bg-indigo-brand/25`} style={{ transform: `rotateY(-90deg) translateZ(${s / 2}px)` }} />
        <div className={`${face} bg-ink-foreground/10`} style={{ transform: `rotateX(90deg) translateZ(${s / 2}px)` }} />
        <div className={`${face} bg-ink/80`} style={{ transform: `rotateX(-90deg) translateZ(${s / 2}px)` }} />
      </div>
    </div>
  );
}

export function HeroVisual() {
  return (
    <div className="relative mx-auto h-[460px] w-full max-w-[540px] sm:h-[520px]">
      {/* glow */}
      <div className="absolute left-1/2 top-1/2 size-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-brand/30 blur-3xl" />

      <Float className="absolute left-0 top-6 w-[62%] sm:w-[58%]" delay={0.1}>
        <div className="glass-dark overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between px-4 pt-3 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5"><MapPin className="size-3.5 text-cyan-brand" /> Мирзо-Улугбек</span>
            <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-medium text-success">Location 82</span>
          </div>
          <div className="mt-2 h-40 sm:h-44">
            <TashkentMap />
          </div>
        </div>
      </Float>

      <Float className="absolute right-0 top-0 w-[40%]" delay={0.5} y={14}>
        <div className="glass-dark flex flex-col items-center rounded-2xl px-3 py-4">
          <ScoreGauge value={78} size={124} stroke={10} label="Success" tone="dark" />
          <span className="-mt-2 text-xs text-ink-muted">Вероятность успеха</span>
        </div>
      </Float>

      <Float className="absolute bottom-10 left-[6%] w-[52%]" delay={0.9} y={8}>
        <div className="glass-dark rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Выручка / мес</span>
            <span className="flex items-center gap-1 text-success"><TrendingUp className="size-3" /> +18%</span>
          </div>
          <div className="mt-1 text-xl font-semibold text-ink-foreground">45 млн сум</div>
          <MiniRevenue />
        </div>
      </Float>

      <Float className="absolute bottom-0 right-[2%] w-[38%]" delay={0.3} y={12}>
        <div className="glass-dark rounded-2xl px-4 pb-4 pt-6">
          <TwinCube />
          <div className="mt-6 text-center text-xs text-ink-muted">
            <span className="font-medium text-ink-foreground">Digital Twin</span> · кофейня
          </div>
        </div>
      </Float>
    </div>
  );
}
