import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Locale = "ru" | "uz";

interface LocaleState {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "ru",
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "pultikma-store",
      version: 2,
      migrate: () => ({ locale: "ru" as Locale }),
      storage: createJSONStorage(() => localStorage),
      // Rehydrated on the client after mount (see __root) so SSR markup matches.
      skipHydration: true,
      partialize: ({ locale }) => ({ locale }),
    },
  ),
);
