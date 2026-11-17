import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/shared/ComingSoon";

export const Route = createFileRoute("/app/wizard")({
  head: () => ({
    meta: [
      { title: "Мастер бизнеса — PulTikma AI" },
      { name: "description", content: "Опишите бизнес-идею за 6 шагов и получите AI-прогноз." },
      { property: "og:title", content: "Мастер бизнеса — PulTikma AI" },
      { property: "og:description", content: "Опишите бизнес-идею за 6 шагов и получите AI-прогноз." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ComingSoon title="Мастер создания бизнеса" text="Шесть шагов: тип бизнеса, локация, инвестиции, расходы, клиенты и цели. Скоро здесь." />
  ),
});
