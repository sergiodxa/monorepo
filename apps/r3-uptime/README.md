# r3-uptime

r3-uptime is a Remix v3 (fetch-router + remix/ui) port of `apps/uptime`, reusing the
same Cloudflare D1 database, KV namespace, queue, Durable Object, and Analytics
Engine dataset. Full plan and decision log: `docs/adr/r3-uptime/ADR-001-port-uptime-to-remix-v3.md`.

## Status

All ten phases are code-complete: auth/teams, HTTP/DNS/TCP/cron-job monitoring,
alerts, maintenance windows, SSL monitoring, analytics aggregation, status pages,
team & access management, API v1, and the marketing site/docs/sitemap. Full test
suite (795 tests), typecheck, lint, format, build, and `wrangler deploy --dry-run`
are green as of this writing — see the ADR's "Current Progress" section for the
per-phase detail and any open live-verification items.

**Not yet done: the actual cutover.** This app has not been deployed to receive
real traffic, and the OLD APP (`apps/uptime`) is still the one running in
production. See "Cutover" below before taking that step.

## Development

```sh
bun install
bun run --cwd apps/r3-uptime db:local:migrate   # apply migrations to local D1
bun run --cwd apps/r3-uptime dev
```

From the repo root: `bun run typecheck`, `bun run lint`, `bun test`, `bun run format:fix`.

## Cutover

This is the runbook for whoever actually cuts traffic over — none of these steps
have been run yet. Follow the ADR's "Phase 10: Verification and cutover" section
for full context; this is the condensed checklist.

1. **Deploy side-by-side.** `bun run --cwd apps/r3-uptime build && bun run --cwd apps/r3-uptime cf:deploy`. This app still has no queue consumer or custom domain bound (deliberately — see the ADR's Decision §11), so this deploy is safe to run without affecting production traffic. Browse the resulting `workers.dev` URL and compare every page against the live OLD APP.
2. **Cut over, in this exact order** (each step is reversible by reversing it):
   1. Deploy the OLD APP with its crons and queue consumer removed.
   2. Add `queues.consumers` and crons to this app's `wrangler.jsonc`, then deploy.
   3. Move the `uptime.sergiodxa.com` route to this app.
   4. Verify checks resume and the queue backlog drains.
3. **Soak for a week** with the OLD APP dormant but not deleted. Rollback = reverse the three steps above.
4. **After the soak**, delete the OLD APP worker and archive `apps/uptime` in a follow-up decision. Only then mark ADR-001 **Implemented**.

**Before starting step 1**, re-run the full verification suite (typecheck/lint/test/build/`wrangler deploy --dry-run`) to confirm nothing regressed since this README was last updated, and read `docs/adr/r3-uptime/AUTONOMOUS-SESSION-DECISIONS.md` for context on judgment calls made without the app's owner present — in particular the two critical bugs found and fixed during test-writing (form validation, monitor scheduling), which are worth independently confirming before trusting this app with real traffic.
