import { useAppStore } from "@/store/useAppStore";

import { ru } from "./ru";
import { uz } from "./uz";

const dictionaries = { ru, uz };

export function useT() {
  const locale = useAppStore((s) => s.locale);
  return dictionaries[locale];
}
