<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules (PulTikma AI)

- Frontend-only demo: no backend, auth or real API calls; all "AI" output comes from the pure engine in `src/lib/engine.ts` (covered by `src/lib/engine.test.ts`) — keeps the demo deterministic and offline.
- Mock data lives in `src/data/*.ts`; app state lives in the Zustand store `src/store/useAppStore.ts` (persisted, `skipHydration`, rehydrated in `__root`) — avoids SSR hydration mismatches.
- UI strings go through `useT()` from `src/i18n` (ru primary, uz falls back to ru) — keeps the locale switch possible.
- Routing uses TanStack Router file routes (the brief's react-router is not supported); app pages live under `/app/*`.
- Reusable visuals (map, gauge, count-up, fade-up) live in `src/components/shared`; reuse them instead of duplicating.
