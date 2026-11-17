import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { DEMO_INPUT } from "@/data/demo";
import { simulate, type EngineInput, type EngineResult } from "@/lib/engine";

export interface Business {
  id: string;
  name: string;
  input: EngineInput;
  result: EngineResult;
  createdAt: string;
}

export type Locale = "ru" | "uz";

interface AppState {
  businesses: Business[];
  currentId: string;
  locale: Locale;
  /** Text handed from the landing demo input to the agent console. */
  pendingPrompt: string | null;
  setLocale: (l: Locale) => void;
  setPendingPrompt: (p: string | null) => void;
  upsertBusiness: (name: string, input: EngineInput, id?: string) => Business;
  selectBusiness: (id: string) => void;
  loadDemo: () => void;
}

const makeDemo = (): Business => ({
  id: "demo-coffee",
  name: "Кофейня у университета",
  input: DEMO_INPUT,
  result: simulate(DEMO_INPUT),
  createdAt: new Date("2026-01-01").toISOString(),
});

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      businesses: [makeDemo()],
      currentId: "demo-coffee",
      locale: "ru",
      pendingPrompt: null,
      setLocale: (locale) => set({ locale }),
      setPendingPrompt: (pendingPrompt) => set({ pendingPrompt }),
      upsertBusiness: (name, input, id) => {
        const business: Business = {
          id: id ?? crypto.randomUUID(),
          name,
          input,
          result: simulate(input),
          createdAt: new Date().toISOString(),
        };
        const rest = get().businesses.filter((b) => b.id !== business.id);
        set({ businesses: [business, ...rest], currentId: business.id });
        return business;
      },
      selectBusiness: (currentId) => set({ currentId }),
      loadDemo: () => {
        const demo = makeDemo();
        const rest = get().businesses.filter((b) => b.id !== demo.id);
        set({ businesses: [demo, ...rest], currentId: demo.id });
      },
    }),
    {
      name: "pultikma-store",
      storage: createJSONStorage(() => localStorage),
      // Rehydrated on the client after mount (see __root) so SSR markup matches.
      skipHydration: true,
      partialize: ({ businesses, currentId, locale }) => ({ businesses, currentId, locale }),
    },
  ),
);

export const useCurrentBusiness = () =>
  useAppStore((s) => s.businesses.find((b) => b.id === s.currentId) ?? s.businesses[0]);
