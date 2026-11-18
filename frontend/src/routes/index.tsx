import { createFileRoute } from "@tanstack/react-router";

import { LandingPage } from "@/features/landing/components/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PulTikma AI — Проверь бизнес до вложений" },
      {
        name: "description",
        content:
          "AI-симулятор бизнеса для Узбекистана: цифровой двойник, анализ локации на карте и сценарии развития за 2 минуты.",
      },
      { property: "og:title", content: "PulTikma AI — Проверь бизнес до вложений" },
      {
        property: "og:description",
        content: "Цифровой двойник бизнеса, умная карта Ташкента и PulTikma Score — до того, как вы вложите деньги.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <LandingPage />;
}
