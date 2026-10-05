# uptime

uptime is a Remix v3 (fetch-router + remix/component) port of `apps/uptime`, reusing the
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
cron forwards to the billing platform. Neither dataset needs provisioning — the first write creates
it. Re-run verification before each deploy; the historical phase notes live in the ADR
linked above.

## Public try-it form

The landing page and `/try` let an anonymous visitor check one URL, and `/try/lead` turns that
check into a free week of hourly checks. Both forms carry signed honeypot fields, verified before
anything else runs: a filled trap gets an ordinary `200` page from `/try` and the started-watch
receipt from `/try/lead`, while nothing is checked, recorded or sent, and a missing or forged token renders the form again with what was typed, asking to send
it again. The honeypot's key derives from `COOKIE_SESSION_SECRET`, so it needs no secret of its
own. Past the honeypot, `POST /try` runs `app/services/trial-guard.ts`: a per-address rate limit, a
public-target check, the Turnstile challenge and a daily budget of free probes. The target check
is `@sdxc/outbound`'s `checkUrl` (ports 80 and 443 only) and `resolveHost`, so a refusal's logged
`detail` is that package's error code, and its README states the DNS rebinding limit the check carries.

## Development

```sh
bun install
bun run --cwd apps/uptime db:local:migrate   # apply migrations to local D1
bun run --cwd apps/uptime dev
```

From the repo root: `bun check` (format, lint and type check in one pass) and `bun run test`.

## Deployment

Before deploying, run the full verification suite from the repo root: `bun typecheck`,
`bun lint`, `bun run test`, `bun format`, `bun run --cwd apps/uptime build`,
and a Cloudflare dry run with `bunx wrangler deploy --dry-run` from this app.

```sh
bun run --cwd apps/uptime build
bun run --cwd apps/uptime cf:deploy
```

Read `docs/adr/uptime/AUTONOMOUS-SESSION-DECISIONS.md` before production work;
it records judgment calls and critical bugs found during the port.
