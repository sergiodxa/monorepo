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
own. Past the honeypot, `POST /try` runs `app/services/trial/guard.ts`: a per-address rate limit, a
public-target check, the Turnstile challenge and a daily budget of free probes. The target check
is `@sdxc/outbound`'s `checkUrl` (ports 80 and 443 only) and `resolveHost`, so a refusal's logged
`detail` is that package's error code, and its README states the DNS rebinding limit the check carries.

## Data layer

Every table is read and written through an `@sdxc/data-model` model in `app/models/`, bound per
request and per job as `ctx.models`. Services that read data take those bound models from their
caller, and the two queries that join several tables into one report shape live beside them
as `app/models/reports.ts` and `app/models/team-digests.ts`.

## Layout

The app follows the repo's one-home-per-kind layout: `bootstrap/` holds only the Worker,
browser and command-line entry points, re-exporting the `GeoFetchDO` class from `app/services/geo-fetch.ts`; the router, logger, job
dispatcher and queue, database, billing, flags, mailer, assets and SEO instances are built in
`app/initializers/`; app logic is in `app/services/` (crowded features grouped by folder: `alerts/`, `api/`,
`dns/`, `reports/`, `trial/`), test helpers in `app/test/`,
translations in `resources/locales/`, and static configuration (pricing, origin, security.txt,
security headers policy) in `config/`.

## Start

```sh
bun install
cp .env.example .dev.vars   # in a fresh clone
sdxc run typegen            # writes worker-configuration.d.ts from wrangler.jsonc
sdxc run db migrate         # applies database/migrations to the local D1 copy
bun dev
```

Run `sdxc run typegen` again whenever you change a binding in `wrangler.jsonc` or a secret in
`.dev.vars`.

## Everyday commands

```sh
sdxc make controller <name>        # a page or endpoint, mapped in app/initializers/router.tsx
sdxc make migration <name>         # then: sdxc run db migrate
sdxc make model <name>             # then: ctx.models.<name>
sdxc make job <name>               # declared in app/jobs/index.ts, mapped in the dispatcher
sdxc make command <group/name>     # then: sdxc run <group> <name>

sdxc run about                     # the app's name, its @sdxc/cli and remix versions
sdxc run db console                # SQL prompt over the local database
sdxc run emails preview <name>     # print an email from its preview(); /_emails in bun dev
```

From the repo root: `bun check` (format, lint and type check in one pass) and `bun run test`.

## Deployment

Before deploying, run the full verification suite from the repo root: `bun typecheck`,
`bun lint`, `bun run test`, `bun format`, `bun run --cwd apps/uptime build`,
and a Cloudflare dry run with `sdxc run deploy --dry-run` from this app.

```sh
sdxc deploy   # from apps/uptime: build, apply pending migrations, then wrangler deploy
```

Read `docs/adr/uptime/AUTONOMOUS-SESSION-DECISIONS.md` before production work;
it records judgment calls and critical bugs found during the port.
