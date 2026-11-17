import { createFileRoute } from "@tanstack/react-router";

import { CtaFooter } from "@/components/landing/CtaFooter";
import { DemoTeaser } from "@/components/landing/DemoTeaser";
import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Navbar } from "@/components/landing/Navbar";
import { ScoreSection } from "@/components/landing/ScoreSection";
import { TrustStrip } from "@/components/landing/TrustStrip";

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
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <TrustStrip />
      <HowItWorks />
      <Features />
      <DemoTeaser />
      <ScoreSection />
      <CtaFooter />
    </main>
  );
}
