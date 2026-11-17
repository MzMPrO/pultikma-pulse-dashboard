import { Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles } from "lucide-react";

import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";

export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-ink text-ink-foreground">
      <div className="absolute inset-0 bg-ink-mesh" />
      <div className="absolute inset-0 bg-grid-ink" />
      <div className="relative px-6 py-5">
        <Logo tone="light" />
      </div>
      <div className="relative flex flex-1 items-center justify-center px-6">
        <div className="glass-dark max-w-md rounded-3xl p-10 text-center">
          <Sparkles className="mx-auto size-8 text-cyan-brand" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">{text}</p>
          <Button asChild variant="glass" className="mt-6">
            <Link to="/"><ArrowLeft /> На главную</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
