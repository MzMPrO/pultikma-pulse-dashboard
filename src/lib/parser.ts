import { DISTRICTS_INFO } from "@/data/market";
import type { BusinessType } from "@/lib/engine";

export interface ParsedIdea {
  type?: BusinessType;
  investment?: number;
  district?: string;
  anchor?: "university" | "metro" | "mall";
  customers?: number;
}

const TYPE_PATTERNS: [BusinessType, RegExp][] = [
  ["cafe", /коф|кафе|ресторан|кофейн|чайхан|пекарн/i],
  ["beauty", /салон|красот|барбер|маникюр|спа/i],
  ["fashion", /fashion|одежд|бренд|мод[аеы]|платья|modest/i],
  ["shop", /магазин|минимаркет|лавк|супермаркет/i],
  ["production", /производ|цех|фабрик|завод/i],
  ["service", /сервис|услуг|it\b|приложени|доставк|студи/i],
];

/** Mock NLU: extracts business type, budget, district and anchors from one sentence. */
export function parseIdea(text: string): ParsedIdea {
  const out: ParsedIdea = {};
  for (const [type, re] of TYPE_PATTERNS) {
    if (re.test(text)) {
      out.type = type;
      break;
    }
  }
  const money = text.match(/(\d+(?:[.,]\d+)?)\s*(млрд|млн|mln|million)/i);
  if (money?.[1]) {
    const n = parseFloat(money[1].replace(",", "."));
    out.investment = Math.round(/млрд/i.test(money[2] ?? "") ? n * 1000 : n);
  }
  const district = DISTRICTS_INFO.find((d) => text.toLowerCase().includes(d.name.toLowerCase().slice(0, 6)));
  if (district) out.district = district.name;
  if (/универ|вуз|студен|институт/i.test(text)) out.anchor = "university";
  else if (/метро/i.test(text)) out.anchor = "metro";
  else if (/\bтц\b|торгов|молл|mall/i.test(text)) out.anchor = "mall";
  const customers = text.match(/(\d+)\s*(клиент|покупател|гост)/i);
  if (customers?.[1]) out.customers = parseInt(customers[1], 10);
  return out;
}
