import { createFileRoute, redirect } from "@tanstack/react-router";

// Old /app/wizard, /app/agent, /app/map, /app/fashion → the single /app screen.
export const Route = createFileRoute("/app/$")({
  beforeLoad: () => {
    throw redirect({ to: "/app" });
  },
});
