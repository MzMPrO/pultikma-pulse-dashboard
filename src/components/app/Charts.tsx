import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MonthPoint } from "@/lib/forecast";

const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;

const tooltipStyle = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    fontSize: 12,
    boxShadow: "var(--shadow-card)",
  },
};

export function RevenueChart({ data, breakEven, height = 260 }: { data: MonthPoint[]; breakEven: number | null; height?: number }) {
  const be = breakEven && breakEven <= 12 ? data[breakEven - 1]?.month : undefined;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="g-rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-indigo)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--brand-indigo)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="g-exp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-cyan)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--brand-cyan)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" {...axis} />
        <YAxis {...axis} />
        <Tooltip {...tooltipStyle} formatter={(v: number, n: string) => [`${v} млн`, n === "revenue" ? "Выручка" : "Расходы"]} />
        {be && <ReferenceLine x={be} stroke="var(--success)" strokeDasharray="4 4" label={{ value: "Окупаемость", fill: "var(--success)", fontSize: 11, position: "insideTopRight" }} />}
        <Area type="monotone" dataKey="revenue" stroke="var(--brand-indigo)" strokeWidth={2.2} fill="url(#g-rev)" />
        <Area type="monotone" dataKey="expenses" stroke="var(--brand-cyan)" strokeWidth={2} fill="url(#g-exp)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CustomersChart({ data, height = 220 }: { data: { day: string; customers: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 0, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="g-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-violet)" />
            <stop offset="100%" stopColor="var(--brand-indigo)" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="day" {...axis} />
        <YAxis {...axis} />
        <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(v: number) => [v, "Клиентов"]} />
        <Bar dataKey="customers" fill="url(#g-bar)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CumulativeChart({ data, height = 220 }: { data: MonthPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="g-cum" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--success)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" {...axis} />
        <YAxis {...axis} />
        <ReferenceLine y={0} stroke="var(--muted-foreground)" />
        <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v} млн`, "Накопленная прибыль"]} />
        <Area type="monotone" dataKey="cumulative" stroke="var(--success)" strokeWidth={2.2} fill="url(#g-cum)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
