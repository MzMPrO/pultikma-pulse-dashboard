import { animate, useInView, useMotionValue } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export function CountUp({
  to,
  duration = 1.4,
  decimals = 0,
  className,
}: {
  to: number;
  duration?: number;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, to, { duration, ease: [0.16, 1, 0.3, 1] });
    const unsub = mv.on("change", (v) => setValue(v));
    return () => {
      controls.stop();
      unsub();
    };
  }, [inView, to, duration, mv]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString("ru-RU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  );
}
