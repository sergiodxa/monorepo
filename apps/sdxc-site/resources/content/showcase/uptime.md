---
title: uptime
headline: Running five kinds of monitor, alerts, status pages and per-team billing from one Cloudflare Worker
summary: Monitoring for HTTP, DNS, TCP, cron jobs and scripted browser flows, with alerts, status pages, an API and MCP, on one Cloudflare Worker.
cover: monitors
shots:
  - id: monitors
    page: "https://uptime.sergiodxa.com/features/monitors"
    alt: The uptime HTTP monitoring page, with the headline beside a drawn monitor screen.
  - id: monitor
    page: "https://uptime.sergiodxa.com/features/monitors"
    highlight: "[aria-label^='An HTTP monitor in Uptime']"
    alt: A drawn HTTP monitor screen with its uptime percentage, p99 response time, a 90-day uptime bar and a day of response times from two regions.
  - id: dashboard
    page: "https://uptime.sergiodxa.com/features/monitors"
    highlight: "[aria-label^='The Uptime dashboard']"
    alt: A drawn dashboard with team uptime and the HTTP monitor count over a table of monitors, each with a latency trend and status.
  - id: api
    page: "https://uptime.sergiodxa.com/features/api"
    highlight: "[data-slot='code-stage']"
    alt: A code panel with tabs for create-monitor.sh and mcp.json, showing a curl call that creates a monitor through the API.
  - id: flow-spec
    page: "https://uptime.sergiodxa.com/browser-flows"
    highlight: "[data-slot='code-stage']"
    alt: A browser-flow spec that opens a login page, fills email and password, clicks Sign in and expects the dashboard.
  - id: flow-monitor
    page: "https://uptime.sergiodxa.com/browser-flows"
    highlight: "[data-slot='product-frame']"
    alt: A drawn flow monitor screen for signing in and loading the dashboard, with its schedule, pass rate, duration and steps.
  - id: alerts
    page: "https://uptime.sergiodxa.com/features/alerts"
    highlight: "[data-slot='product-frame']"
    alt: A drawn alerts screen with PagerDuty, Slack and email channels and the history of one outage and its recovery.
  - id: phone
    page: "https://uptime.sergiodxa.com/docs"
    viewport: phone
    alt: The uptime help docs hub on a phone, with a search box and the places to start.
---

uptime checks URLs, DNS records, TCP ports, cron job heartbeats and scripted browser flows on a schedule, alerts a team when something changes, and publishes status pages for its customers. It runs in production at [uptime.sergiodxa.com](https://uptime.sergiodxa.com) as one Cloudflare Worker with D1, KV, R2, a queue with a dead-letter queue, a Durable Object and two Analytics Engine datasets. Accounts sign in through the author's own OpenID Connect provider, and plans bill through Polar.

It is the widest reader of the `@sdxc/*` collection: scheduled jobs, rate limits, billing, mail, feature flags, translations, an OpenAPI-described API, an MCP server, a marketing site and customer docs all live in one app. That breadth is the reason to read it. Each package does one job and the app shows how the jobs meet: who owns a scheduled check, how a probe proves where it came from, how a request's cost lands on the team that caused it.

The screenshots below come from the public site. The signed-in app sits behind sign-in, so its screens appear here as the product frames the marketing pages draw.

## The brief

A monitoring service has an odd shape for a Worker. Most of its work happens on a schedule, with no request to answer, and it has to run the same check at the same cadence whether a team has one monitor or a thousand. A check must never run twice for one slot, and never be skipped because a delivery came late. Probes have to come from more than one region and be identifiable by the sites they hit. Alerts must arrive once per incident and stop repeating. Status pages are public and get read hardest exactly when something is down. And every check costs money, so a usage-based plan has to know what each team actually used.

uptime takes all of that on, on a platform with no long-running process. Cron triggers and a queue replace a scheduler, a Durable Object pinned to a location hint runs checks from a chosen region, Analytics Engine stores raw results and costs, and D1 holds monitors, teams, alerts and the daily roll-ups. The app follows the repository's layout, so the router, job dispatcher, mailer, billing, flags and SEO instances each live in `app/initializers/`, and business logic sits in `app/services/` grouped by feature.

## A schedule that cannot double-book

Every monitor type carries a `next_due_at` column. A cron trigger delivers a sweep job through [@sdxc/jobs](/api/jobs), and the sweep claims the monitors whose check is owed with one atomic statement that advances each row by whole intervals, so two overlapping deliveries can never claim the same monitor, and a late one catches up without stacking checks.

```ts
let claimed = await db.exec(
	`UPDATE ${getTableName(table)}
	    SET next_due_at = next_due_at
	          + (interval_seconds * 1000)
	          * (((? - next_due_at) / (interval_seconds * 1000)) + 1),
	        updated_at = ?
	  WHERE next_due_at IS NOT NULL
	    AND next_due_at <= ?
	RETURNING ${columns.join(", ")}`,
	[scheduledAt, Date.now(), scheduledAt],
);
```

Claimed monitors fan out as messages on the `ping` queue, and a failed message goes to `ping-dlq`, which the same Worker consumes. The dispatcher maps every job handler as a loader, so an isolate serving web pages imports none of them; a handler module loads only once a message has matched its job.

HTTP checks run through `GeoFetchDO`, a Durable Object pinned to a region. It proxies the outbound `fetch`, reports what happened in an RFC 9209 `Proxy-Status` field and its timings in `Server-Timing`. Each probe is signed with Web Bot Auth through [@sdxc/http-signatures](/api/http-signatures), using an Ed25519 key, and `/.well-known/http-message-signatures-directory` publishes the public half, so a monitored site can verify a request really came from uptime and allowlist it.

Each monitor's own screen shows what those probes found: its uptime, its p99 response time over a window, a 90-day uptime bar, and a day of response times from each region it runs in. The marketing pages draw these screens with [ProductFrame](/api/ui/product-frame), as illustrations of the signed-in app.

![A drawn HTTP monitor screen](/showcase/uptime/monitor.webp "A monitor's screen: uptime, p99, a 90-day bar and response times per region.")

Across monitors, the team sees a dashboard: an uptime figure, counts per monitor type and a list with latency, a trend [Sparkline](/api/ui/sparkline) and a status [Badge](/api/ui/badge).

![A drawn dashboard in a window frame](/showcase/uptime/dashboard.webp "The dashboard a team signs in to: team uptime over a table of monitors with their trends.")

## Monitors for what breaks past the status code

Some failures only show once a page has run its JavaScript. A browser-flow monitor is a customer's executable spec in the [@sdxc/spec](/api/spec) language: open the login page, fill the email and password, click Sign in, and expect the dashboard within five seconds. `app/services/flow-check.ts` decides which capabilities a spec may use (among them `http`, `url`, `jwt`, `html` and, when Browser Run is bound, `browser`) and which hosts it may reach, limited to domains the team has verified. A run's browser trace is stored in R2 so a failure can be replayed.

![A browser-flow spec](/showcase/uptime/flow-spec.webp "A flow monitor is a short spec: the steps a person takes, then what must be true.")

Flow runs bill on their own meter, $2.50 per 1,000 runs, with the fastest schedule every fifteen minutes and an hourly default. The browser-flows page draws the monitor screen a team sees: the flow's name, schedule, pass rate, average duration and each step.

![A drawn flow monitor screen](/showcase/uptime/flow-monitor.webp "Each flow reports a pass rate and duration, broken down by step.")

DNS monitors go further than resolution. A team imports its records from a zone file through [@sdxc/zone-file](/api/zone-file), and the monitor watches each record for drift. Domain registration expiry is read over RDAP through [@sdxc/rdap](/api/rdap), and certificates are found through Certificate Transparency logs, since a Worker's `fetch()` exposes no TLS details. Cron job monitors work the other way round: the job pings uptime, and a missed heartbeat is the alert.

## Alerts that arrive once, and a team that can find them

Alerts go to email, Slack, Discord, PagerDuty or a webhook, scoped by monitor type, and a repeat policy bounds how often an open incident re-notifies. Maintenance windows silence alerts for the monitors they cover. Every transition is kept in an alert history, and teams also get daily and weekly digests by mail through [@sdxc/mail](/api/mail).

![A drawn alerts screen](/showcase/uptime/alerts.webp "One outage, its alerts across channels, and the recovery, as the alerts screen shows them.")

The signed-in app is built on the `@sdxc/ui` app kit: an [AppShell](/api/ui/app-shell) whose sidebar shows a red count beside each monitor type that needs attention, a [CommandPalette](/api/ui/command-palette) on ⌘K that jumps to any section or creates any kind of monitor, `g`-then-letter shortcuts listed by [KeyboardHelp](/api/ui/keyboard-help), [FilterBar](/api/ui/filter-bar) lists, and a 90-day [StatusStrip](/api/ui/status-strip) that moves day by day with the arrow keys. A refused form answers 422 with the page again and everything the user typed.

## A price the server prints, and a cost per team

The home page's pricing is a form beside a bill the server prints from `config/pricing.ts`, the same pricing the subscription uses. A visitor lists their monitors and how often each checks; the [UsageEstimate](/api/ui/usage-estimate) shows the $5 subscription with its 100,000 included pings, the extra pings in whole blocks of 10,000 at $1, and the month's total, counting a month as 28 days so the estimate is the least anyone would pay. Add and Remove are form buttons, so it works without JavaScript; with it, the bill re-prices as the visitor types. Either way the address carries the estimate, so `?m=1&m=1&m=1` reproduces the same bill for anyone it is sent to.

Behind the price is a cost ledger. `app/services/cost.ts` counts the platform operations each request, job or cron delivery causes (D1 rows, KV reads, queue writes, Durable Object time), splits them across the teams that caused them, prices them against a rate card and writes them to the `uptime_costs` Analytics Engine dataset. `bootstrap/worker.ts` wraps the fetch and scheduled handlers in that ledger, and a daily job reports each team's cost through [@sdxc/billing](/api/billing).

## Built to be driven by other programs

The REST API under `/api/v1` is described with [@sdxc/openapi](/api/openapi), pages with cursors through [@sdxc/pagination](/api/pagination) and answers errors as problem details through [@sdxc/problem](/api/problem). The same operations are MCP tools through [@sdxc/mcp](/api/mcp), mounted behind API-key auth and an `mcp` scope. The API page shows both side by side: a curl call that creates a monitor, and the `mcp.json` an agent needs.

![A code panel with the API and MCP setup](/showcase/uptime/api.webp "The same monitor, created by curl or by an agent over MCP.")

The public try-it form lets an anonymous visitor check one URL. It checks a signed [@sdxc/honeypot](/api/honeypot) first, then a per-address rate limit, an [@sdxc/outbound](/api/outbound) check that the target is public and on port 80 or 443, a Turnstile challenge through [@sdxc/captcha](/api/captcha) and a daily budget. A paid accountless lane, `POST /api/v1/guest/probe`, settles through [@sdxc/x402](/api/x402). The customer docs are built on the same docs kit as sdxc.dev, with a hub, search and per-page feedback, and read cleanly on a phone.

![The help docs hub on a phone](/showcase/uptime/phone.webp "The customer docs open on search and the places to start, on a phone as on a desktop.")

## Where to start reading

- [`bootstrap/worker.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/uptime/bootstrap/worker.ts) — the fetch, scheduled and queue handlers, each wrapped in the cost ledger.
- [`app/services/scheduling.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/uptime/app/services/scheduling.ts) — the `next_due_at` claim every sweep shares.
- [`app/services/geo-fetch.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/uptime/app/services/geo-fetch.ts) — the regional probe and the fields it reports.
- [`app/services/flow-check.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/uptime/app/services/flow-check.ts) — a customer's spec run with only the capabilities its team is allowed.
- [`app/services/cost.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/uptime/app/services/cost.ts) — the per-team cost ledger.
