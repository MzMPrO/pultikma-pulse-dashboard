import type { Dictionary } from "./ru";
import { ru } from "./ru";

/** Uzbek dictionary — prepared; falls back to Russian until translated. */
export const uz: Dictionary = {
  ...ru,
  tagline: "Pul tikishdan oldin biznesingizni tekshiring",
  nav: { ...ru.nav, cta: "Biznesni sinab ko'rish" },
};
