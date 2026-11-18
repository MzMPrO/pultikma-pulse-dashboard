import { CtaFooter } from "./CtaFooter";
import { DemoTeaser } from "./DemoTeaser";
import { Features } from "./Features";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { Navbar } from "./Navbar";
import { ScoreSection } from "./ScoreSection";
import { TrustStrip } from "./TrustStrip";

export function LandingPage() {
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
