import { createFileRoute } from "@tanstack/react-router";

import { ScoutPage } from "@/features/scout/components/ScoutPage";

export const Route = createFileRoute("/app/")({
  validateSearch: (s: Record<string, unknown>): { scenario?: string | undefined } => ({
    scenario: typeof s["scenario"] === "string" ? s["scenario"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Анализ локации — PulTikma AI" },
      { name: "description", content: "Выберите точку на карте Ташкента и получите PulTikma Score, конкурентов и лучшие места рядом." },
      { property: "og:title", content: "Анализ локации — PulTikma AI" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Scout,
});

function Scout() {
  const { scenario } = Route.useSearch();
  return <ScoutPage scenario={scenario} />;
}
