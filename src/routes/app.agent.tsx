import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/shared/ComingSoon";
import { useAppStore } from "@/store/useAppStore";

export const Route = createFileRoute("/app/agent")({
  head: () => ({
    meta: [
      { title: "AI Агент — PulTikma AI" },
      { name: "description", content: "Автономный AI-агент исследует рынок, карту и конкурентов для вашей идеи." },
      { property: "og:title", content: "AI Агент — PulTikma AI" },
      { property: "og:description", content: "Автономный AI-агент исследует рынок, карту и конкурентов для вашей идеи." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgentPage,
});

function AgentPage() {
  const prompt = useAppStore((s) => s.pendingPrompt);
  return (
    <ComingSoon
      title="AI Агент"
      text={prompt ? `Задача получена: «${prompt}». Консоль агента появится на следующем этапе.` : "Консоль автономного агента появится на следующем этапе."}
    />
  );
}
