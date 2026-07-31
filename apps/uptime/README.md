# uptime

uptime is a Remix v3 (fetch-router + remix/ui) port of `apps/uptime`, reusing the
same Cloudflare D1 database, KV namespace, queue, Durable Object, and Analytics
Engine dataset. Full plan and decision log: `docs/adr/uptime/ADR-001-port-uptime-to-remix-v3.md`.

## Status

The port is code-complete for auth/teams, HTTP/DNS/TCP/cron-job monitoring,
alerts, maintenance windows, SSL monitoring, analytics aggregation, status pages,
team and access management, API v1, and the marketing site/docs/sitemap.

The current `wrangler.jsonc` is configured with the production `uptime.sergiodxa.com`
route, queue consumer, cron triggers, D1 database, KV namespace, Durable Object,
Workflow, and two Analytics Engine datasets: `uptime_monitor_results` for HTTP ping
results and `uptime_costs` for the per-team infrastructure cost the daily reporting
cron forwards to Polar. Neither dataset needs provisioning — the first write creates
it. Re-run verification before each deploy; the historical phase notes live in the ADR
linked above.

## Development

```sh
bun install
bun run --cwd apps/uptime db:local:migrate   # apply migrations to local D1
bun run --cwd apps/uptime dev
```

From the repo root: `bun run typecheck`, `bun run lint`, `bun test --isolate`, `bun run format:fix`.

## Deployment

Before deploying, run the full verification suite from the repo root: `bun typecheck`,
`bun lint`, `bun test --isolate`, `bun format`, `bun run --cwd apps/uptime build`,
and a Cloudflare dry run with `bunx wrangler deploy --dry-run` from this app.

```sh
bun run --cwd apps/uptime build
bun run --cwd apps/uptime cf:deploy
```

Read `docs/adr/uptime/AUTONOMOUS-SESSION-DECISIONS.md` before production work;
it records judgment calls and critical bugs found during the port.
