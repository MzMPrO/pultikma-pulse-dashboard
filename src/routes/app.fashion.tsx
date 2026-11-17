import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/shared/ComingSoon";

export const Route = createFileRoute("/app/fashion")({
  head: () => ({
    meta: [
      { title: "Fashion Lab — PulTikma AI" },
      { name: "description", content: "Виртуальный шоурум и узбекские fashion-тренды для вашего бренда." },
      { property: "og:title", content: "Fashion Lab — PulTikma AI" },
      { property: "og:description", content: "Виртуальный шоурум и узбекские fashion-тренды для вашего бренда." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ComingSoon title="Fashion Lab" text="Виртуальный шоурум, симуляция покупателей и тренды Узбекистана — скоро здесь." />
  ),
});
