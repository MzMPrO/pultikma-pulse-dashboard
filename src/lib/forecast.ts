import type { EngineResult } from "@/lib/engine";

const MONTHS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

export interface MonthPoint {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  cumulative: number;
}

/** 12-month forecast with a ramp-up in the first months. */
export function monthlySeries(result: EngineResult, investment: number): MonthPoint[] {
  let cumulative = -investment;
  return MONTHS.map((month, i) => {
    const ramp = Math.min(1.08, 0.55 + i * 0.06);
    const revenue = Math.round(result.monthlyRevenue * ramp * 10) / 10;
    const expenses = result.monthlyExpenses;
    const profit = Math.round((revenue - expenses) * 10) / 10;
    cumulative = Math.round((cumulative + profit) * 10) / 10;
    return { month, revenue, expenses, profit, cumulative };
  });
}

const WEEK = [
  ["Пн", 0.86],
  ["Вт", 0.9],
  ["Ср", 0.95],
  ["Чт", 1],
  ["Пт", 1.12],
  ["Сб", 1.22],
  ["Вс", 0.95],
] as const;

export function weekdayCustomers(perDay: number) {
  return WEEK.map(([day, k]) => ({ day, customers: Math.round(perDay * k) }));
}
