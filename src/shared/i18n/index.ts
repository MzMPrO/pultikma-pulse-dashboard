import { useLocaleStore } from "@/shared/i18n/useLocaleStore";

import { ru } from "./ru";
import { uz } from "./uz";

const dictionaries = { ru, uz };

export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  return dictionaries[locale];
}
