import { motion } from "framer-motion";

import { TashkentMap } from "@/components/shared/TashkentMap";

const loop = { repeat: Infinity, repeatType: "mirror" as const, ease: "easeInOut" as const };

export function TwinPreview() {
  return (
    <div className="flex h-full items-end gap-1.5">
      {[40, 65, 50, 80, 70, 95, 85].map((h, i) => (
        <motion.div
          key={i}
          className="flex-1 rounded-t-md bg-brand-gradient opacity-80"
          animate={{ height: [`${h * 0.6}%`, `${h}%`] }}
          transition={{ ...loop, duration: 2 + i * 0.2 }}
        />
      ))}
    </div>
  );
}

export function SimulatorPreview() {
  const rows = [
    { id: "A", w: 55, best: false },
    { id: "B", w: 82, best: true },
    { id: "C", w: 68, best: false },
  ];
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={r.id} className="flex items-center gap-2 text-xs">
          <span className="w-4 font-semibold text-muted-foreground">{r.id}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.div
              className={r.best ? "h-full rounded-full bg-brand-gradient" : "h-full rounded-full bg-foreground/20"}
              initial={{ width: 0 }}
              whileInView={{ width: `${r.w}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: i * 0.15 }}
            />
          </div>
          {r.best && <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">best</span>}
        </div>
      ))}
    </div>
  );
}

export function VrPreview() {
  return (
    <div className="grid h-full place-items-center" style={{ perspective: 400 }}>
      <motion.div
        className="relative h-16 w-24 rounded-md border border-primary/40 bg-accent"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateX: [50, 55], rotateZ: [-30, -20] }}
        transition={{ ...loop, duration: 4 }}
      >
        <div className="absolute left-2 top-2 h-3 w-10 rounded-sm bg-primary/60" />
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute size-2 rounded-full bg-cyan-brand"
            animate={{ left: ["10%", "75%"], top: ["80%", "30%"] }}
            transition={{ duration: 3, repeat: Infinity, delay: i, ease: "linear" }}
          />
        ))}
      </motion.div>
    </div>
  );
}

export function FashionPreview() {
  const colors = ["bg-violet-brand/30", "bg-cyan-brand/40", "bg-warning/40", "bg-indigo-brand/30"];
  return (
    <div className="flex h-full items-end justify-center gap-3">
      {colors.map((c, i) => (
        <motion.div
          key={c}
          className={`w-8 rounded-t-full ${c}`}
          style={{ clipPath: "polygon(30% 0, 70% 0, 100% 100%, 0 100%)" }}
          animate={{ height: [48, 64] }}
          transition={{ ...loop, duration: 2.4, delay: i * 0.3 }}
        />
      ))}
    </div>
  );
}

export function AgentPreview() {
  const steps = ["Понял задачу", "Нашёл 3 локации", "14 конкурентов", "Скор 78/100"];
  return (
    <div className="space-y-1.5 font-mono text-[11px]">
      {steps.map((s, i) => (
        <motion.div
          key={s}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.35 }}
          className="flex items-center gap-2 text-muted-foreground"
        >
          <span className="size-1.5 rounded-full bg-success" />
          {s}
        </motion.div>
      ))}
    </div>
  );
}

export function MapPreview() {
  return (
    <div className="h-full overflow-hidden rounded-xl">
      <TashkentMap />
    </div>
  );
}
