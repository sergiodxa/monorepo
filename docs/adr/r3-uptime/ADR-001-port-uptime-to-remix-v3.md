# ADR-001: Port apps/uptime to Remix v3 (apps/r3-uptime)

## Status

**Proposed** - 2026-07-06

## How To Use This Document

This ADR is the implementation spec for porting the uptime app to Remix v3. It was written after a full exploration of both apps so that an implementation session can start coding without re-deriving anything.

Instructions for the implementer:

1. Read this whole document once before writing any code.
2. Work phase by phase, in order, following the Implementation Plan section. Do not skip phases. Do not start a phase before the previous one's "Definition of done" passes.
3. Tick the checkboxes in the Current Progress section as you complete work, and commit the updated ADR together with the code.
4. Terminology used everywhere below:
   - **OLD APP** = `apps/uptime` (React Router v8, deployed as the Cloudflare Worker named `ping` at uptime.sergiodxa.com). This app keeps running in production until Phase 10.
   - **NEW APP** = `apps/r3-uptime` (Remix v3 scaffold, Cloudflare Worker named `r3-uptime`). All new code goes here.
5. **Never import from the OLD APP.** The NEW APP must not contain `import ... from "~/apps/uptime/..."` or any path reaching into `apps/uptime`. When the OLD APP has logic you need, copy the file into the NEW APP and adapt it (see the Ground Rules below for what to adapt).
6. When this document says "port `<file>`", it means: open that file in the OLD APP, copy its logic into the stated NEW APP location, then apply the standard adaptations listed in Decision §0.
7. If a file referenced here does not exist or looks different from what is described, do not guess: open the OLD APP source and re-verify. The repository is actively worked on by other sessions.
8. The behavior specs in `apps/r3-uptime/docs/*.md` (11 files) are the acceptance criteria. When you finish a feature, re-read its spec file and confirm every rule, default, and limit listed there is implemented.

## Background

The uptime monitoring product is a production SaaS. The OLD APP is built on React Router v8, React 19, Drizzle ORM, Tailwind CSS v4, and Zod. The monorepo is standardizing new server-rendered apps on Remix v3 (`remix` npm package, 3.0.0-beta.x): `remix/fetch-router` for HTTP routing, `remix/ui` JSX with `css()` mixins for server-rendered views, `remix/data-table` for persistence, and `remix/data-schema` for validation. Client-side JavaScript is limited to small hydrated islands (`clientEntry`).

The NEW APP exists as a minimal scaffold with a working build, worker entry, middleware stack, and SSR renderer — but zero feature code. This ADR specifies how to port **every feature** of the OLD APP into the NEW APP, reusing the same Cloudflare resources (same D1 database, KV namespace, queue, Durable Object binding, Workflow, Analytics Engine dataset, cron schedules, and secrets) so the NEW APP becomes a drop-in replacement and the OLD APP can be retired.

## Context

### Current State: the OLD APP (apps/uptime)

| Aspect        | Current implementation                                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework     | React Router v8 (`react-router` 8.0.1, fs-routes), React 19                                                                                                                                                   |
| Worker entry  | `apps/uptime/app/entry.worker.ts` — `fetch` + `scheduled` + `queue` handlers; re-exports the `Ping` workflow class and the `GeoFetchDO` Durable Object class                                                  |
| Styling       | Tailwind CSS v4 + `@pkg/ui` React components (`Card`, `Dialog`, `Confirm`, `Menu`, `Popover`, `Table`, `Tabs`, `Toaster`…), dark mode via `dark:` variants                                                    |
| ORM           | Drizzle (`apps/uptime/db/schema.ts`, 1031 lines; SQL migrations in `apps/uptime/db/migrations/`, applied with `wrangler d1 migrations apply`)                                                                 |
| Validation    | Zod v4 (+ `@pkg/validate`)                                                                                                                                                                                    |
| Auth          | OAuth2/OIDC against `auth.sergiodxa.com` via `remix-auth-oauth2` (`apps/uptime/app/modules/auth.ts`); KV-backed sessions (`apps/uptime/app/session.ts`); SSO logout with `id_token_hint`                      |
| Billing       | Polar (`@polar-sh/sdk` used directly in `apps/uptime/app/models/customer.ts`); an active subscription is required for monitor pings; usage ingestion happens in the Ping workflow; there is a checkout route  |
| Email         | Resend HTTP API (`RESEND_API_TOKEN`); the invite email is a React component (`apps/uptime/app/components/emails/team-invite.tsx`)                                                                             |
| i18n          | i18next + react-i18next, 6 locales (`apps/uptime/app/locales/{en,es,de,ja,fr,it}.ts`, ~3,400 lines each), locale API route `/api/locales/:lng/:ns`, per-user `preferredLanguage` stored in `user_preferences` |
| Client extras | sonner toasts (fired from `clientAction`s), nprogress, spin-delay, recharts (one sparkline), fuse.js search, `@epic-web/client-hints` (timezone)                                                              |
| Tests         | 5 test files (content checks, SSL logic, date helpers)                                                                                                                                                        |

### Cloudflare Resources and Bindings

Source of truth: `apps/uptime/wrangler.jsonc`. The NEW APP must use the **same binding names and the same resource IDs** so it operates on the same production data:

| Binding        | Type             | Value                                                                                                |
| -------------- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| `DB`           | D1               | database_name `ping`, database_id `b51fff7c-c4dd-412d-8b56-57da405b780e`                             |
| `KV`           | KV namespace     | id `ea5b4a1bb7804692992b013e1627a8ad` (holds sessions under `session:` keys + analytics query cache) |
| `QUEUE`        | Queue producer   | queue name `ping` (the worker is also the sole consumer of this queue)                               |
| `GEO_FETCH`    | Durable Object   | class `GeoFetchDO` (stateless fetch proxy pinned to a location hint; measures response time)         |
| `PING`         | Workflow         | workflow name `ping-workflow`, class `Ping`                                                          |
| `PING_RESULTS` | Analytics Engine | dataset `uptime_monitor_results`                                                                     |
| routes         | Custom domain    | `uptime.sergiodxa.com` (stays on the OLD APP until Phase 10)                                         |

Cron triggers (all seven must be configured on the NEW APP, and the `scheduled` handler must branch on `controller.cron` exactly like the OLD APP does):

| Cron           | What the scheduled handler does                                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `* * * * *`    | Runs `Monitor.pingLater(db, scheduledDate)` directly (finds monitors due for a check and enqueues one `{ type: "ping", monitorId, ownerId }` message per monitor), and enqueues `{ type: "checkCronJobs" }` |
| `*/5 * * * *`  | Enqueues `{ type: "checkTcp" }`                                                                                                                                                                             |
| `*/10 * * * *` | Enqueues `{ type: "enqueuePendingDomains" }` (team-domain verification)                                                                                                                                     |
| `0 * * * *`    | Enqueues `{ type: "checkDns" }`                                                                                                                                                                             |
| `0 0 * * *`    | Enqueues `{ type: "clean" }` and `{ type: "cleanCronJobPings" }` (365-day retention)                                                                                                                        |
| `0 1 * * *`    | Enqueues `{ type: "aggregateDailyStats" }`                                                                                                                                                                  |
| `0 6 * * *`    | Enqueues `{ type: "checkSsl" }`                                                                                                                                                                             |

Secrets / vars (names from `apps/uptime/.dev.vars` and `env.*` usage in the OLD APP; all are needed by the NEW APP too):

| Name                                                  | Used for                                                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------- |
| `CLIENT_ID`, `CLIENT_SECRET`                          | OAuth client credentials for auth.sergiodxa.com                             |
| `POLAR_ACCESS_TOKEN`                                  | Polar billing API                                                           |
| `RESEND_API_TOKEN`                                    | Sending email (alerts, invites)                                             |
| `COOKIE_SESSION_SECRET`                               | Signing the session cookie (already bound in the NEW APP via secrets store) |
| `UPTIME_CRON_API_KEY`                                 | Self-monitoring: background jobs ping the app's own cron-job monitor        |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ANALYTICS_TOKEN` | Querying the Analytics Engine SQL API                                       |

### Background Pipeline (must be preserved exactly)

The monitoring engine is a chain of five mechanisms. Keep the message shapes and semantics byte-identical, because at cutover the NEW APP starts consuming the same production queue and must understand messages the OLD APP enqueued.

1. **Scheduled handler** (`apps/uptime/app/entry.worker.ts`, `scheduled`): branches on `controller.cron` per the table above. Everything except `Monitor.pingLater` is a single `env.QUEUE.send({ type: "..." })` call wrapped in `waitUntil`.
2. **Queue consumer** (same file, `queue` handler): for each message, validates `message.body` against a discriminated union on `type` (10 message types), then lazily imports and runs the matching job class from `apps/uptime/app/jobs/`. Invalid messages are logged and acked (not retried).
3. **PingJob** (`apps/uptime/app/jobs/ping.ts`): validates `{ monitorId, ownerId }`, checks `Customer.hasActiveSubscription(ownerId)` (Polar) and silently skips when there is no active subscription, then calls `Monitor.ping(db, monitorId)` which creates a `PING` workflow instance.
4. **Ping workflow** (`apps/uptime/app/workflows/ping.ts`, class `Ping`): loads the monitor, fetches the target URL through the `GEO_FETCH` Durable Object (pinned to the monitor's `locationHint`, measures response time), classifies the result (up / degraded / down based on expected status + `degradedAfterMs`), evaluates enabled content checks, writes the result to Analytics Engine (`PING_RESULTS`), dispatches alerts (email / webhook / Slack / Discord) respecting cooldowns and active maintenance windows, and ingests usage into Polar. Retry config: 3 retries, exponential backoff, 1s initial delay.
5. **Analytics reads** (`apps/uptime/app/services/analytics.server.ts`): SQL POSTed to `https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql` with bearer `CLOUDFLARE_ANALYTICS_TOKEN`; there is a KV-cached variant. Daily rollups are computed by `AggregateDailyStatsJob` into the `monitor_daily_stats` D1 table.

The other jobs (all in `apps/uptime/app/jobs/`): `check-tcp.ts`, `check-dns.ts`, `check-ssl.ts`, `check-cron-jobs.ts`, `clean.ts`, `clean-cron-job-pings.ts`, `enqueue-pending-domains.ts`, `verify-domain-ownership.ts`, `aggregate-daily-stats.ts`. All extend `Job` from `@pkg/jobs`.

**Cutover constraints** (why Phase 10 is shaped the way it is):

- A Cloudflare queue can have only ONE consumer worker. The consumer stays on the OLD APP until cutover.
- The custom domain can point at only one worker. It moves at cutover.
- `GeoFetchDO` stores no persistent state, so the NEW APP getting a fresh DO namespace loses nothing.
- Workflows are per-worker; in-flight `ping-workflow` instances on the OLD APP finish there.
- D1, KV, and the Analytics Engine dataset are account-level; both workers can bind them simultaneously during development.

### Database Schema (frozen — do not change it)

The NEW APP reuses the live production D1 database, so this port makes **zero schema changes**. The schema source of truth is `apps/uptime/db/schema.ts` (Drizzle definitions; the actual column names are snake_case). Tables:

| Area            | Tables                                                                                                                                                                                                                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Teams/access    | `teams` (owner via `owner_id`), `memberships` (role: `member` \| `admin`), `invites`, `team_domains` (DNS-verified auto-join), `user_preferences` (`preferred_language`), `api_keys` (SHA-256 `key_hash`, `key_prefix`, JSON `scopes` array)                                                                                                                             |
| HTTP monitoring | `monitors` (method, expected_status, interval_seconds, degraded_after_ms, timeout_seconds, location_hint, ssl_monitoring_enabled + ssl_expiry_warning_days + ssl_expires_at + ssl_issuer + ssl_last_checked_at + ssl_status, enabled_at), `monitor_results`, `monitor_content_checks` (type: `contains` \| `not_contains` \| `regex`, value, case_sensitive, is_enabled) |
| DNS             | `dns_monitors` (record_type: A \| AAAA \| CNAME \| MX \| TXT \| NS, expected_value, interval_seconds default 3600, last_checked_at/last_status/last_value), `dns_monitor_results`                                                                                                                                                                                        |
| TCP             | `tcp_monitors` (host, port, timeout_ms default 5000, interval_seconds default 60, last_status: up \| down \| timeout), `tcp_monitor_results`                                                                                                                                                                                                                             |
| SSL             | `ssl_monitors` (optional `http_monitor_id` link, hostname, port default 443, expiry_warning_days default 30, status: unknown \| valid \| expiring \| expired \| error)                                                                                                                                                                                                   |
| Cron jobs       | `cron_job_monitors` (cron_expression, timezone default UTC, grace_period_seconds default 300, status: healthy \| late \| missed \| new, alert_on_late, last_ping_at, next_expected_at), `cron_job_pings` (was_on_time, source_ip, user_agent)                                                                                                                            |
| Alerts          | `alerts` (JSON `config` = strategy email \| webhook \| slack \| discord + per-strategy payload, cooldown_minutes default 0, notify_on_recovery default true, optional `monitor_id` scope), `alert_events` (event_type: down \| up \| degraded, status: sent \| skipped_cooldown \| failed, monitor_type, monitor_name, JSON `snapshot`, sent_at)                         |
| Status pages    | `status_pages` (slug unique, title, description, logo_url, custom_domain, is_public default true, show_overall_status default true) + five join tables: `status_page_monitors`, `status_page_dns_monitors`, `status_page_tcp_monitors`, `status_page_cron_jobs`, `status_page_ssl_monitors` (each with display_name + order)                                             |
| Maintenance     | `maintenance_windows` (optional `monitor_id` — NULL means all monitors, starts_at, ends_at, ended_early_at, suppress_alerts default true, show_on_status_page default true, is_recurring + recurring_pattern)                                                                                                                                                            |
| Analytics       | `monitor_daily_stats` (monitor_id + monitor_type + date string YYYY-MM-DD, total/successful/failed checks, avg/max/p95 response time, status: up \| degraded \| down)                                                                                                                                                                                                    |

### URL Surface (parity required)

The OLD APP builds its URL space from four fs-routes directories (`apps/uptime/app/routes.ts`): files in `routes/` mount at `/`, files in `routes/app/` mount under **`/app`**, files in `routes/api/` under **`/api`**, and files in `routes/actions/` under **`/actions`**. The NEW APP must serve the exact same URLs.

Public pages (all GET):

- `/` (landing), `/privacy`, `/terms`
- `/features/{alerts,analytics,api,content-monitoring,cron-jobs,dns,integrations,maintenance,monitors,ssl,status-pages,teams}` (12 pages)
- `/for/{agencies,devops,enterprises,indie-hackers,solo-devs,startups}` (6 pages)
- `/use-cases/{api-monitoring,cron-jobs,ecommerce,healthcheck,microservices,saas,website-monitoring}` (7 pages)
- `/vs/{better-uptime,checkly,cronitor,datadog,healthchecks,ohdear,pingdom,site24x7,statuscake,uptimerobot}` (10 pages)
- `/status/:slug` (public status page), `/invite/:inviteId` (accept invite), `/docs` + `/docs/*` (markdown docs), `/sitemap.xml`, `/healthcheck`, `/healthcheck/analytics-engine`
- `/auth` (GET = OAuth callback, POST = start OAuth flow), `/logout`

Signed-in app pages (all GET, under `/app`; `:team` is the team id/slug used in the OLD APP):

| URL                                                                                                                           | Purpose                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `/app`                                                                                                                        | Redirect to the user's team                                                                  |
| `/app/:team`                                                                                                                  | Redirect (member → dashboard, owner → profile)                                               |
| `/app/:team/dashboard`                                                                                                        | Dashboard: tab per monitor kind (HTTP/DNS/TCP/Cron), stat cards, consumption, monitor tables |
| `/app/:team/http`                                                                                                             | HTTP monitors list                                                                           |
| `/app/:team/monitors/new`                                                                                                     | Create HTTP monitor form                                                                     |
| `/app/:team/monitors/:monitorId`                                                                                              | HTTP monitor detail (results, content checks, SSL, alert events, manual ping)                |
| `/app/:team/monitors/:monitorId/edit`                                                                                         | Edit HTTP monitor form                                                                       |
| `/app/:team/dns`, `/app/:team/dns/new`, `/app/:team/dns/:dnsMonitorId`, `/app/:team/dns/:dnsMonitorId/edit`                   | DNS monitors                                                                                 |
| `/app/:team/tcp`, `/app/:team/tcp/new`, `/app/:team/tcp/:tcpMonitorId`, `/app/:team/tcp/:tcpMonitorId/edit`                   | TCP monitors                                                                                 |
| `/app/:team/cron-jobs`, `/app/:team/cron-jobs/new`, `/app/:team/cron-jobs/:cronJobId`, `/app/:team/cron-jobs/:cronJobId/edit` | Cron job monitors                                                                            |
| `/app/:team/maintenance`, `/app/:team/maintenance/new`                                                                        | Maintenance windows                                                                          |
| `/app/:team/status-pages`, `/app/:team/status-pages/new`, `/app/:team/status-pages/:statusPageId/edit`                        | Status pages                                                                                 |
| `/app/:team/alerts`, `/app/:team/alerts/new`                                                                                  | Alerts                                                                                       |
| `/app/:team/alert-history`                                                                                                    | Alert event history                                                                          |
| `/app/:team/api-keys`, `/app/:team/api-keys/new`                                                                              | API keys                                                                                     |
| `/app/:team/domains/new`                                                                                                      | Add team domain                                                                              |
| `/app/:team/settings`, `/app/:team/settings/invite`                                                                           | Team settings, invite member                                                                 |
| `/app/:team/account`, `/app/:team/account/create-team`                                                                        | Account settings, create team                                                                |
| `/app/:team/checkout`                                                                                                         | Polar checkout                                                                               |

Form-submission endpoints (under `/actions`; method is POST unless marked DELETE — DELETE arrives as a POST form with `_method=DELETE` and the method-override middleware rewrites it):

- `/actions/:team/create-monitor`, `/actions/:team/update-monitor`, `/actions/:team/delete-monitor` (DELETE)
- `/actions/:team/create-dns-monitor`, `update-dns-monitor`, `delete-dns-monitor` (DELETE), `check-dns-monitor`
- `/actions/:team/create-tcp-monitor`, `update-tcp-monitor`, `delete-tcp-monitor` (DELETE)
- `/actions/:team/create-cron-job`, `update-cron-job`, `delete-cron-job` (DELETE)
- `/actions/:team/create-maintenance`, `end-maintenance`, `delete-maintenance` (DELETE)
- `/actions/:team/create-alert`, `remove-alert` (DELETE)
- `/actions/:team/create-api-key`, `delete-api-key` (DELETE)
- `/actions/:team/create-content-check`, `delete-content-check` (DELETE)
- `/actions/:team/create-status-page`, `update-status-page`, `delete-status-page` (DELETE)
- `/actions/:team/add-domain`, `remove-domain` (DELETE), `retry-domain-verification`
- `/actions/:team/play-monitor`, `update-ssl`, `set-dashboard-tab`
- `/actions/:team/create-invite`, `revoke-invite` (DELETE), `remove-member` (DELETE), `change-role`
- `/actions/:team/update-team`, `delete-team` (DELETE)
- `/actions/create-team`, `/actions/leave-team`, `/actions/update-language`

API v1 (under `/api`; bearer API-key auth with scopes, except the cron ping which is public):

- `/api/v1/monitors` (list/create), `/api/v1/monitors/stats`, `/api/v1/monitors/:monitorId` (read/update/delete), `/api/v1/monitors/:monitorId/{results,stats,alert-events,content-checks}`, `/api/v1/monitors/:monitorId/content-checks/:contentCheckId`
- `/api/v1/dns-monitors`, `/api/v1/dns-monitors/:dnsMonitorId`, `/api/v1/dns-monitors/:dnsMonitorId/results`
- `/api/v1/tcp-monitors`, `/api/v1/tcp-monitors/:tcpMonitorId`, `/api/v1/tcp-monitors/:tcpMonitorId/results`
- `/api/v1/cron-jobs`, `/api/v1/cron-jobs/:cronJobId`, and `POST /api/v1/cron-jobs/:cronJobId/ping` (**public**, rate-limited — this is the URL users' cron jobs call)
- `/api/v1/alerts`, `/api/v1/alerts/:alertId`, `/api/v1/alerts/:alertId/events`
- `/api/v1/maintenance`, `/api/v1/maintenance/:maintenanceId`, `/api/v1/maintenance/:maintenanceId/end`
- `/api/v1/status-pages`, `/api/v1/status-pages/:statusPageId`, `/api/v1/status-pages/:statusPageId/monitors`
- `/api/v1/invites`, `/api/v1/invites/:inviteId`, `/api/v1/memberships`, `/api/v1/team`, `/api/v1/team-domains`, `/api/v1/api-keys`, `/api/v1/api-keys/:apiKeyId`
- `/api/v1/status`, `/api/v1/backfill-daily-stats`
- `/api/locales/:lng/:ns` exists in the OLD APP for client-side i18next; the NEW APP drops it (see Decision §9)

Before porting each endpoint, open its OLD APP route file (`apps/uptime/app/routes/api/v1.<name>.ts`) and copy the exact supported methods, JSON request/response shapes, and scope checks.

### Current State: the NEW APP scaffold (apps/r3-uptime)

Already working — build on these, do not recreate them:

| File                                                                                                               | What it is                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/r3-uptime/vite.config.ts`                                                                                    | Vite + `@cloudflare/vite-plugin`; client entry is `bootstrap/browser.ts`, output pinned to `assets/clientEntry.js`                                                                                                                                                |
| `apps/r3-uptime/bootstrap/worker.ts`                                                                               | Worker `fetch` handler: builds the data-table `Database` from `env.DB` and forwards to the router                                                                                                                                                                 |
| `apps/r3-uptime/bootstrap/app.tsx`                                                                                 | Composition root: `createRouter` with middleware `[asyncContext(), formData(), methodOverride(), database(...), renderWith(createHtmlRenderer)]`, plus an SSR frame resolver that routes frame fetches back through the router with cookies and follows redirects |
| `apps/r3-uptime/bootstrap/browser.ts`                                                                              | Client boot: `run()` from `remix/ui` with a `loadModule` that resolves module URLs through `import.meta.glob` over `resources/**` and `routes/**` (excluding `*.server.*`)                                                                                        |
| `apps/r3-uptime/routes/web.ts`                                                                                     | Route map — currently `route({})`, to be filled in                                                                                                                                                                                                                |
| `apps/r3-uptime/app/http/controllers/default-handler.tsx`                                                          | 404 fallback showing the controller/view/view-model composition style                                                                                                                                                                                             |
| `apps/r3-uptime/app/http/middleware/database.ts`                                                                   | Middleware style reference: `ctx.set(Database, db)`                                                                                                                                                                                                               |
| `apps/r3-uptime/app/http/view-models/not-found.ts`                                                                 | View-model style reference: class with static factory, namespace for types                                                                                                                                                                                        |
| `apps/r3-uptime/resources/layouts/document.tsx`                                                                    | HTML document shell (charset, viewport, title, client entry script with dev/prod path switch)                                                                                                                                                                     |
| `apps/r3-uptime/infrastructure/session/kv-session-storage-adapter.ts` + `apps/r3-uptime/app/contracts/kv-store.ts` | KV-backed `SessionStorage` for `remix/session` + its storage contract, with a bun test                                                                                                                                                                            |
| `apps/r3-uptime/AGENTS.md`                                                                                         | App-specific rules (read it)                                                                                                                                                                                                                                      |
| `apps/r3-uptime/docs/*.md`                                                                                         | The 11 feature behavior specs (acceptance criteria)                                                                                                                                                                                                               |

Known-broken (verified with `bunx tsc --noEmit` on 2026-07-06) — fixed in Phase 0:

| Problem                                                                                                                                                               | Fix                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `Cannot find namespace 'Cloudflare'`, `ExportedHandler`, `D1Database`, `KVNamespace` unresolved                                                                       | Fill `wrangler.jsonc` with real bindings, then run `bun cf:typegen` to generate `worker-configuration.d.ts`    |
| `apps/r3-uptime/infrastructure/database/d1-data-table-adapter.ts` no longer compiles (missing `executeScript`, renamed `DataMigration*` types — the remix beta moved) | Delete the whole `infrastructure/database/` directory and use `@pkg/data-table-d1` instead                     |
| `apps/r3-uptime/resources/components/timer.tsx` uses a removed `remix/ui/button` export                                                                               | Delete this demo file and remove its usage from `default-handler.tsx`                                          |
| `default-handler.tsx` passes `key=` to remix/ui components, which fails typecheck                                                                                     | Remove the `key` props from remix/ui **components** (keys on plain HTML elements like `<li key=...>` are fine) |
| `wrangler.jsonc` has placeholder values (`<database-name>`, empty kv/queues/DO/workflows/crons)                                                                       | Fill with the production values from the bindings table above                                                  |

## Decision

Port the OLD APP feature-for-feature into the NEW APP on Remix v3, reusing the same Cloudflare resources, database, and URLs. The sections below define exactly how. Code examples use the repo's real import paths and conventions — copy their shapes.

### 0. Ground Rules (apply to every file you write)

These restate the monorepo rules (root `AGENTS.md`) and app rules (`apps/r3-uptime/AGENTS.md`) that matter most for this port. When in doubt, those two files win.

1. **Standard adaptations when porting a file from the OLD APP**:
   - Replace Drizzle queries with `remix/data-table` queries.
   - Replace Zod schemas with `remix/data-schema` schemas (validated through `@pkg/validate`).
   - Replace `react-router` imports (`redirect`, `data`, `href`) with fetch-router equivalents (`ctx.redirect(...)` or a plain `new Response(null, { status: 302, headers: { Location: ... } })`, and `routes.<name>.href()` for URLs).
   - Replace React JSX with `remix/ui` JSX (different component model — see §4).
   - Delete comments that name another app or package as the source of a pattern. Describe the code on its own terms.
   - Keep the module-level JSDoc header (see rule 4) but rewrite it to describe the new module.
2. **Error handling**: use `@pkg/result` (`success`/`failure`/`isFailure`) instead of throwing, matching how the OLD APP services already do it.
3. **Logging**: use `@pkg/logger`. Never `console.log`. Inside HTTP handlers use the request-scoped logger from context; inside jobs/workflows use `BatchedLogger` like the OLD APP does.
4. **Every file** starts with the module JSDoc header (what/why in ~3 lines, then the exact tags):

   ```
   /**
    * <what the module is, what it does, and why it exists — ~3 lines>
    *
    * @author [Sergio Xalambrí](https://sergiodxa.com)
    * @copyright Sergio Xalambrí 2026
    */
   ```

   Every exported symbol gets a JSDoc comment. So do controller/middleware callbacks.

5. **TypeScript style**: `const` only at module level; `let` inside functions. `interface` when possible, `type` only when necessary (unions, and clientEntry props — see §4.5). `namespace` for types only. Never `as any`. Never a non-null assertion when a checked alternative exists.
6. **Environment**: `import { env } from "cloudflare:workers"`. Never `process.env`.
7. **Commands**: always Bun (`bun`, `bunx`). Run tests from the repo root. Run `bun format:fix` at the repo root before every commit. Commit directly on `main` with Conventional Commits.
8. **DB-facing field names are snake_case** (`author_id`, `created_at`) — this matches the frozen production schema.
9. **D1 has no real transactions.** Any multi-step write (example: create a status page, then insert its monitor rows) must be written as independent steps with compensation on failure (delete what you created), or as a single statement / upsert. Never assume rollback.
10. **Per-tenant caches must be keyed by team** so one team's data can never appear for another.
11. **Prefer what Remix v3 ships before writing anything custom**: `remix/session-middleware`, `remix/cop-middleware`, `remix/auth` + `remix/auth-middleware`, `remix/form-data-middleware`, `remix/method-override-middleware`, `remix/render-middleware`, `createAction`/`createController`, `remix/data-schema`. Check `docs/vendor/@remix-run/<package>/README.md` for any package before hand-rolling.

### 1. Where Files Go (directory layout of the NEW APP)

| Kind of code                | Location in NEW APP                                  | OLD APP source to port from                                                                |
| --------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Route map (browser)         | `routes/web.ts`                                      | `apps/uptime/app/routes.ts` + the `routes/` + `routes/app/` + `routes/actions/` file names |
| Route map (API)             | `routes/api.ts` (new file)                           | `apps/uptime/app/routes/api/` file names                                                   |
| Controllers (HTTP handlers) | `app/http/controllers/<feature>/…`                   | `apps/uptime/app/routes/**/route.tsx` loaders/actions                                      |
| Middleware                  | `app/http/middleware/*.ts`                           | `apps/uptime/app/middleware/*.ts`                                                          |
| View models                 | `app/http/view-models/*.ts`                          | data-shaping currently inline in OLD APP loaders                                           |
| Models / repositories       | `app/data/*.ts`                                      | `apps/uptime/app/models/*.ts`                                                              |
| Domain services             | `app/services/*.ts`                                  | `apps/uptime/app/services/*.ts`                                                            |
| Jobs                        | `app/jobs/*.ts`                                      | `apps/uptime/app/jobs/*.ts`                                                                |
| Workflow                    | `app/workflows/ping.ts`                              | `apps/uptime/app/workflows/ping.ts`                                                        |
| Durable Object              | `app/do/geo-fetch.ts`                                | `apps/uptime/app/do/geo-fetch.ts`                                                          |
| Views (pages)               | `resources/views/<feature>/*.tsx`                    | OLD APP route components                                                                   |
| Layouts                     | `resources/layouts/*.tsx`                            | `apps/uptime/app/root.tsx` + layout components                                             |
| Shared UI components        | `resources/components/*.tsx`                         | `apps/uptime/app/components/*.tsx` + `@pkg/ui` pieces used                                 |
| Shared style mixins         | `resources/styles.ts` (new file)                     | translation of Tailwind utility classes                                                    |
| Locale files                | `app/locales/{en,es,de,ja,fr,it}.ts`                 | `apps/uptime/app/locales/*.ts` (copy)                                                      |
| DB schema                   | `database/schema.ts`                                 | `apps/uptime/db/schema.ts`                                                                 |
| DB migrations               | `database/migrations/*.sql`                          | `apps/uptime/db/migrations/*.sql` (copy unchanged)                                         |
| Service container           | `app/lib/container.ts` (new file)                    | n/a (new; see §2)                                                                          |
| Session storage             | `@pkg/session-storage-kv` after extraction (Phase 0) | `apps/r3-uptime/infrastructure/session/`                                                   |

A working example of this architecture at scale is `apps/auth-saas` (route registration in `bootstrap/app.ts`, container in `app/lib/container.ts`, controllers in `app/http/controllers/`). Open it when unsure how pieces fit together — but copy shapes, not code, and never reference it in comments.

### 2. Composition Root, Services, and Middleware

`bootstrap/app.tsx` keeps its current structure and gains middleware; `bootstrap/worker.ts` gains `scheduled` and `queue` handlers and re-exports `Ping` and `GeoFetchDO`.

Middleware order in `createRouter({ middleware: [...] })` (order matters — later middleware can read what earlier middleware set):

1. `asyncContext()` — already present; enables `getContext()`.
2. Request logger — provides `ctx.logger` (a `RequestLogger` from `@pkg/logger`).
3. `formData()` — already present; parses form bodies.
4. `methodOverride()` — already present; turns `_method=DELETE` posts into DELETE requests.
5. `session(cookie, sessionStorage)` from `remix/session-middleware` — cookie signed with `COOKIE_SESSION_SECRET`, storage = the KV adapter over `env.KV` with prefix `session:`.
6. `auth({ schemes: [...] })` from `remix/auth-middleware` — a session scheme that reads the auth record (user id, name, email, avatar, idToken) and resolves the current user.
7. `cop()` from `remix/cop-middleware` — cross-origin protection for browser form posts. Configure `insecureBypassPatterns` for `/api/` (bearer-token authenticated, called server-to-server) — the cron ping endpoint lives under `/api`, so this also exempts it.
8. `database(options.database)` — already present.
9. `renderWith(createHtmlRenderer)` — already present.

Type the middleware array as `Middleware[]` (non-tuple). For every value a middleware exposes as a context property, add a global augmentation:

```ts
declare module "remix/fetch-router" {
	interface RequestContext {
		logger: RequestLogger;
		formData: FormData;
	}
}
```

**Application services** (things that exist independent of a request) go in `@pkg/service-container` (ADR-008), registered in a new `app/lib/container.ts`: the data-table `Database`, `PolarClient` (from `@pkg/polar`), the Resend email client, and the Analytics Engine client. `bootstrap/worker.ts` wraps every entry point in a container scope:

```ts
async fetch(request: Request, env: Cloudflare.Env) {
	return await container.scope(() => router.fetch(request));
},
async scheduled(controller: ScheduledController) {
	await container.scope(async () => { /* branch on controller.cron */ });
},
```

**Request-scoped values** (session, current user, current team, request logger) never go in the container — they live in request context via middleware.

### 3. Routing and Controllers

#### 3.1 Route map

Define every URL from the "URL Surface" section in `routes/web.ts` (pages + form actions) and `routes/api.ts` (API v1), using explicit patterns:

```ts
import { form, route } from "remix/fetch-router/routes";

export default route({
	home: { method: "GET", pattern: "/" },
	auth: {
		callback: { method: "GET", pattern: "/auth" },
		start: { method: "POST", pattern: "/auth" },
	},
	logout: { method: "POST", pattern: "/logout" },
	app: {
		index: { method: "GET", pattern: "/app" },
		team: {
			index: { method: "GET", pattern: "/app/:team" },
			dashboard: { method: "GET", pattern: "/app/:team/dashboard" },
			httpMonitors: { method: "GET", pattern: "/app/:team/http" },
			monitorNew: { method: "GET", pattern: "/app/:team/monitors/new" },
			monitorShow: { method: "GET", pattern: "/app/:team/monitors/:monitorId" },
			// ... every page URL from the table above
		},
	},
	actions: {
		createMonitor: { method: "POST", pattern: "/actions/:team/create-monitor" },
		deleteMonitor: { method: "DELETE", pattern: "/actions/:team/delete-monitor" },
		// ... every action URL from the list above
	},
});
```

Generate URLs only with `routes.<name>.href({ team: ... })`. Never build URL strings by hand.

#### 3.2 Registering controllers — the one big trap

`router.map()` accepts actions ONLY for the direct (leaf) routes of the map you pass it. Passing a nested group inside `actions` **throws at runtime**.

```ts
// WRONG — throws "Cannot map nested route map key"
router.map(routes, {
	actions: {
		home: homeHandler,
		app: { dashboard: dashboardHandler }, // nested key — crash
	},
});

// RIGHT — one router.map call per route group, middleware repeated per call
router.map(routes, { actions: { home: homeHandler } });
router.map(routes.app.team, {
	middleware: [requireUser(), requireTeam()],
	actions: { dashboard: dashboardHandler /* , ...other leaves of this group */ },
});
router.map(routes.actions, {
	middleware: [requireUser(), requireTeam()],
	actions: { createMonitor: createMonitorHandler /* ... */ },
});
```

Middleware does NOT cascade from one `router.map` call to another. Every group that needs auth must list its middleware chain again.

#### 3.3 Controller shape

One file per action (or one file per small group), under `app/http/controllers/<feature>/`. Shape (this matches the repo's working convention):

```tsx
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Monitor from "~/app/data/monitor";
import MonitorsIndexView from "~/resources/views/monitors/index";
import routes from "~/routes/web";

/** GET /app/:team/http — lists the team's HTTP monitors. */
export default createAction(
	routes.app.team.httpMonitors,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let team = ctx.team; // provided by requireTeam middleware
		let monitors = await Monitor.listByTeam(db, team.id);
		return ctx.render(<MonitorsIndexView monitors={monitors} team={team} />);
	}),
);
```

Form actions follow the POST → validate → mutate → flash → redirect pattern (no JSON responses to the browser):

```tsx
/** POST /actions/:team/create-tcp-monitor — creates a TCP monitor then redirects to the list. */
export default createAction(
	routes.actions.createTcpMonitor,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let result = await validate(ctx.formData, CreateTcpMonitorSchema);
		if (isFailure(result)) {
			ctx.session.flash("toast", { intent: "error", message: result.error.message });
			return ctx.redirect(routes.app.team.tcpNew.href({ team: ctx.team.slug }));
		}
		await TcpMonitor.create(db, ctx.team.id, result.data);
		ctx.session.flash("toast", { intent: "success", message: "TCP monitor created" });
		return ctx.redirect(routes.app.team.tcpMonitors.href({ team: ctx.team.slug }));
	}),
);
```

(Adapt the exact flash/redirect helpers to what the middleware provides; the pattern — validate, mutate, flash, redirect — is the requirement.)

#### 3.4 Route params

Inside a controller registered with its route, `ctx.params` is typed. When a handler goes through `getContext()` (which erases the per-route type), the accepted idiom in this repo is the non-null assertion: `let team = ctx.params.team!;` (see the assessment in the repo root `TODO.md`). Do not build a helper for this without checking whether one already exists in `@pkg/http` (a `requireParams` helper was added and then removed around 2026-07-06).

#### 3.5 Authorization middleware to build (in `app/http/middleware/`)

| Middleware                                                | Behavior (port from the OLD APP's loaders and `apps/uptime/app/middleware/session.ts`)                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requireUser()`                                           | Session must contain a signed-in user; otherwise redirect to the login flow, storing the requested URL in the `returnTo` cookie                                                                                                                                                                                                                                |
| `requireTeam()`                                           | Resolve `ctx.params.team` to a team the current user is a member of; expose `ctx.team` and `ctx.membership`; 404 when not a member (do not leak team existence)                                                                                                                                                                                                |
| `requireRole("admin")`                                    | Allow only admins and the team owner; 403 otherwise. Used by: invites, member management, API keys, team settings, domains, team delete                                                                                                                                                                                                                        |
| `requireApiKey(scope)`                                    | For API v1: read `Authorization: Bearer <key>`, hash with SHA-256, look up `api_keys.key_hash`, reject expired keys, check the required scope, expose `ctx.apiTeam`, update `last_used_at`. Missing/invalid key → 401; valid key without the scope → 403. Response bodies use the OLD APP's JSON envelope (see `apiSuccess`/`apiError` helpers in the OLD APP) |
| Rate limiter for `POST /api/v1/cron-jobs/:cronJobId/ping` | Port the OLD APP behavior (KV counter keyed by monitor)                                                                                                                                                                                                                                                                                                        |

### 4. Views and UI

#### 4.1 Rendering model

All pages are server-rendered `remix/ui` JSX returned via `ctx.render(...)`. remix/ui components are NOT React components. The component shape is:

```tsx
// WRONG (React style — crashes at runtime under remix/ui)
function Badge(props: { label: string }) {
	return <span>{props.label}</span>;
}

// RIGHT — a function taking a Handle, returning a render function that reads handle.props
import type { Handle } from "remix/ui";

function Badge(handle: Handle<{ label: string }>) {
	return () => <span>{handle.props.label}</span>;
}
```

Do not pass `key=` to remix/ui components (their prop type rejects it and typecheck fails). Keys on plain HTML elements inside `.map()` are fine: `<li key={monitor.id}>`.

#### 4.2 Styling

No Tailwind in the NEW APP. Styles are `css()` mixins from `remix/ui` in the `mix` prop. Create a shared `resources/styles.ts` module exporting named mixins for repeated patterns (buttons, cards, badges, tables, form fields), and translate the OLD APP's Tailwind classes to CSS. Dark mode: the OLD APP uses `dark:` variants — check `apps/uptime/app/root.tsx` and its `styles.css` for whether dark mode is class-based or media-query based, and mirror that with `@media (prefers-color-scheme: dark)` blocks (or an equivalent class hook) so pages look the same in both modes. Example translation:

```tsx
// OLD APP: <p className="text-xs text-neutral-500 dark:text-neutral-400">
// NEW APP:
import { css } from "remix/ui";

export const mutedSmall = css({
	fontSize: "0.75rem",
	lineHeight: "1rem",
	color: "#737373", // neutral-500
	"@media (prefers-color-scheme: dark)": {
		color: "#a3a3a3", // neutral-400
	},
});

// usage: <p mix={[mutedSmall]}>…</p>
```

Keep the same visual design as the OLD APP: same layout, spacing, colors, typography. When translating a component, open the OLD APP component side by side and translate class-by-class.

#### 4.3 Native HTML instead of JavaScript UI (mandatory)

| UI element in OLD APP                                     | How to build it in the NEW APP                                                                                                                                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirm/delete dialogs (`@pkg/ui` `Dialog`/`Confirm`)     | Native `<dialog>` opened declaratively with command invokers — no JS. See example below                                                                                                                        |
| Dropdown menus, team picker, user menu (`Menu`/`Popover`) | Popover API: element with `popover` attribute + `<button popovertarget="id">` (or `command="toggle-popover"`); style with CSS                                                                                  |
| Dashboard tabs (HTTP/DNS/TCP/Cron)                        | Plain links that set a search param (e.g. `?tab=dns`); the server renders the selected tab; keep persisting the last tab via the existing `set-dashboard-tab` action; style the active link via `aria-current` |
| Disclosure sections                                       | `<details>`/`<summary>`                                                                                                                                                                                        |
| Toasts (sonner)                                           | Server-side: actions `session.flash()` a message, the layout renders it as a fixed-position element with a CSS auto-dismiss animation                                                                          |
| Loading states (spin-delay, nprogress)                    | Drop; navigations are normal MPA navigations                                                                                                                                                                   |

Delete-confirmation dialog pattern (use everywhere a destructive action needs confirming):

```tsx
<button commandfor={`confirm-delete-${monitor.id}`} command="show-modal" mix={[s.dangerButton]}>
	Delete
</button>

<dialog id={`confirm-delete-${monitor.id}`} mix={[s.dialog]}>
	<h2>Delete monitor?</h2>
	<p>This permanently deletes "{monitor.name}" and its history.</p>
	<form method="post" action={routes.actions.deleteMonitor.href({ team: team.slug })}>
		<input type="hidden" name="_method" value="DELETE" />
		<input type="hidden" name="monitorId" value={monitor.id} />
		<button commandfor={`confirm-delete-${monitor.id}`} command="close" type="button">
			Cancel
		</button>
		<button type="submit" mix={[s.dangerButton]}>Delete</button>
	</form>
</dialog>
```

This works with zero JavaScript: the invoker button opens the modal, Cancel closes it, and the submit posts a normal form that method-override turns into a DELETE.

#### 4.4 Charts and visualizations (no chart library)

- The only recharts usage in the OLD APP is one sparkline in `apps/uptime/app/routes/app/$team.dashboard/components/http-monitor-table-row.tsx`. Replace it with a server-rendered inline `<svg viewBox="..."><polyline points={computedPoints} /></svg>` computed from the same response-time data.
- The 365-day heatmap (`apps/uptime/app/components/heatmap.tsx`, `heatmap-composable.tsx`) is already a hand-built grid of colored cells — port it as server-rendered JSX with `css()`; per-day details go in the cell's `title` attribute.

#### 4.5 Client-side islands (the ONLY places that ship JS)

Use `clientEntry` from `remix/ui`. The first argument is the module's source path + export name; the client resolves it through the glob map in `bootstrap/browser.ts`, so the URL is the literal source path:

```tsx
import type { Handle } from "remix/ui";
import { clientEntry, css, on } from "remix/ui";

// Props MUST be declared as a `type` (not interface) to satisfy SerializableProps.
type CopyButtonProps = { value: string; label: string };

export const CopyButton = clientEntry(
	"/resources/components/copy-button.tsx#CopyButton",
	function CopyButton(handle: Handle<CopyButtonProps>) {
		let copied = false;

		return () => (
			<button
				mix={[
					css({ cursor: "pointer" }),
					on("click", async () => {
						await navigator.clipboard.writeText(handle.props.value);
						copied = true;
						handle.update();
					}),
				]}
			>
				{copied ? "Copied!" : handle.props.label}
			</button>
		);
	},
);
```

Approved islands — do not add more without a reason the platform truly cannot cover:

1. `CopyButton` — cron ping URL, API key one-time reveal, integration snippets.
2. `LocalTime` — receives a UTC ISO string prop, renders it in the visitor's timezone (replaces `@epic-web/client-hints`). Server renders `<time datetime>` with UTC text as fallback.
3. Optional toast dismissal (close button) if CSS-only auto-dismiss is not enough.
4. Optional dashboard/status auto-refresh: wrap the refreshable region in a named `<Frame>` and add a small island calling `handle.frames.get(name)?.reload()` on an interval. Only if the OLD APP has equivalent auto-refresh behavior.

Event handlers go in `mix={[on("click", fn)]}`. In async handlers, use the provided `AbortSignal` (`on("input", async (event, signal) => ...)`) and check `signal.aborted` after awaits.

### 5. Auth

1. Provider: `createOIDCAuthProvider()` from `remix/auth` configured for `https://auth.sergiodxa.com` with `CLIENT_ID`/`CLIENT_SECRET`, scopes `openid profile email` (the authorize endpoint is `/authorize` and token endpoint `/oauth/token` — pass explicit `metadata` if discovery is unavailable).
2. `POST /auth` calls `startExternalAuth(...)`; `GET /auth` calls `finishExternalAuth(...)` then runs the ported verify logic from `apps/uptime/app/modules/auth.ts`:
   - Verify the ID token fully: JWKS signature, `iss`, `aud`, `exp`, `nonce` (port `apps/uptime/app/entities/id-token.ts`). Never trust unverified claims.
   - Provision the Polar customer: find by external id → find by email → create; assign external id if missing.
   - Resolve teams in this order: existing memberships → `Team.joinByDomain` (verified `team_domains` matching the email domain) → `Team.createTeam`.
   - Write the session record `{ id, name, email, avatar, idToken }` and redirect to the `returnTo` cookie value or `/app`.
3. Sessions: `remix/session-middleware` + the KV session adapter (`session:` prefix, same `KV` namespace, cookie signed with `COOKIE_SESSION_SECRET`). Compare the stored record format with the OLD APP's `apps/uptime/app/vendor/create-worker-kv-session-storage.ts`; if the formats differ, existing users are logged out once at cutover — acceptable, but state it in the cutover checklist.
4. Logout (`/logout`): clear the session, then redirect to `https://auth.sergiodxa.com/oidc/logout?id_token_hint=<stored idToken>&post_logout_redirect_uri=https://uptime.sergiodxa.com`, with a `Clear-Site-Data: "*"` header — port `logout()` from `apps/uptime/app/modules/auth.ts`.

### 6. Validation

All external input (form data, query params, JSON bodies, queue messages, webhook payloads) is validated with `remix/data-schema` through `@pkg/validate`. Patterns:

- Forms: `f.object({ name: f.field(s.string().pipe(checks.minLength(1))), ... })` from `remix/data-schema/form-data`, parsed from `ctx.formData`.
- Query params: `f.object` over `url.searchParams` with `coerce.*` for numbers/booleans.
- Queue messages: `variant("type", { ping: object({ type: literal("ping"), monitorId: string(), ownerId: string() }), ... })` — one variant per message type listed in Context.
- Alert `config` JSON: `variant("strategy", { email: ..., webhook: ..., slack: ..., discord: ... })`.
- Cross-field rules with `.refine()`: maintenance `endsAt` after `startsAt`; content-check `regex` values must compile (`new RegExp(value)` inside a try/catch at creation time — invalid patterns are rejected with a validation error, per `apps/r3-uptime/docs/content-checks.md`).

### 7. Background Jobs, Workflow, Durable Object

These are mostly framework-agnostic already. Port each file 1:1 into the NEW APP applying only the standard adaptations (§0.1):

| OLD APP file                                                                                                                                                                                                 | NEW APP file                 | Notes                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `app/entry.worker.ts` (`scheduled` + `queue` parts)                                                                                                                                                          | `bootstrap/worker.ts`        | Keep lazy `await import(...)` per job so the worker stays small; keep `waitUntil`                              |
| `app/jobs/ping.ts`                                                                                                                                                                                           | `app/jobs/ping.ts`           | Subscription gate stays                                                                                        |
| `app/jobs/check-tcp.ts`, `check-dns.ts`, `check-ssl.ts`, `check-cron-jobs.ts`, `clean.ts`, `clean-cron-job-pings.ts`, `enqueue-pending-domains.ts`, `verify-domain-ownership.ts`, `aggregate-daily-stats.ts` | same names under `app/jobs/` | All extend `Job` from `@pkg/jobs`; each takes `uptime` (the `UPTIME_CRON_API_KEY`) where the OLD APP passes it |
| `app/workflows/ping.ts`                                                                                                                                                                                      | `app/workflows/ping.ts`      | Keep class name `Ping`, params `{ monitorId }`, step structure, and retry config identical                     |
| `app/do/geo-fetch.ts`                                                                                                                                                                                        | `app/do/geo-fetch.ts`        | Keep class name `GeoFetchDO`                                                                                   |
| `app/models/monitor.ts` (`pingLater`, `ping`)                                                                                                                                                                | `app/data/monitor.ts`        | `pingLater` runs inside `scheduled` every minute — keep it a single cheap query                                |
| `app/services/*` (all 9 files)                                                                                                                                                                               | `app/services/*`             | check-content and check-ssl have tests — port the tests too                                                    |

Absolute requirements: queue message `type` strings and payload fields unchanged; Analytics Engine data point shape unchanged (`monitorId`, `teamId`, `monitorType`, `status`, `responseTimeMs`); alert-event snapshot JSON shape unchanged; cooldown and maintenance-suppression semantics unchanged.

### 8. Billing, Email, Analytics

- **Billing**: use `@pkg/polar` `PolarClient` (constructor takes `{ accessToken: env.POLAR_ACCESS_TOKEN }`; register in the container) instead of the raw `@polar-sh/sdk` calls in `apps/uptime/app/models/customer.ts`. Port `Customer` (find/create/assignExternalId/hasActiveSubscription) onto it, plus the checkout route and the usage ingestion call in the workflow.
- **Email**: keep Resend via its HTTP API. Re-create the invite email as remix/ui JSX rendered to a string with `renderToString` from `remix/ui/server` (visual parity with `apps/uptime/app/components/emails/team-invite.tsx`).
- **Analytics**: port `apps/uptime/app/services/analytics.server.ts` as an app-local service class registered in the container: `queryAnalytics(sql)` (SQL API + error parsing), the KV-cached variant with its cache keys/TTLs, `writePingResult(...)` via the `PING_RESULTS` binding, and the latest-status read. Keep the SQL-injection guard behavior the OLD APP has.

### 9. i18n

Keep all six languages and all existing translation keys.

1. Copy the six locale files into `app/locales/` unchanged.
2. Do NOT bring react-i18next, remix-i18next, or the browser language detector.
3. Build a small server-side translator: middleware resolves the request language (order: signed-in user's `user_preferences.preferred_language` → language cookie → `Accept-Language` header → `en`) and puts a `t(key, params)` function in request context. Implementation may be i18next core (already a dependency of the OLD APP) or a typed lookup over the locale objects — pick in Phase 1 and note the choice here.
   - **Decision (Phase 1): typed lookup, not i18next core.** `app/services/translator.ts` does a dot-path lookup into the imported locale object plus a `{{param}}` regex-replace — matching the OLD APP's existing key/interpolation syntax exactly (verified against `app/locales/en.ts`) without adding an i18next runtime this server-only app doesn't otherwise need. `app/http/middleware/i18n.ts` resolves the language in the documented order and sets `ctx.t`/`ctx.language`. View-level adoption of `t()` is incremental: Phase 1's placeholder views (home, dashboard shell, auth error) use plain English copy since they have no ported strings yet; each later phase's views call `t()` against the matching keys as they're built.
4. Views call `t()` during server render. Client islands never translate — they receive already-translated strings as props.
5. Port the `update-language` action (`/actions/update-language`) writing `user_preferences`.
6. Drop the `/api/locales/:lng/:ns` route — nothing loads translations client-side anymore.

### 10. Package Reuse and Extraction

Use these existing workspace packages (do not re-implement what they do):

| Package                                                                                                        | Use for                                                                        |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `@pkg/data-table-d1`                                                                                           | The D1 `DatabaseAdapter` (replaces the scaffold's broken local copy)           |
| `@pkg/service-container`                                                                                       | Application services (ADR-008)                                                 |
| `@pkg/jobs`                                                                                                    | Base `Job` class for queue jobs (OLD APP already uses it)                      |
| `@pkg/logger`                                                                                                  | `BatchedLogger` / `RequestLogger` (OLD APP already uses it)                    |
| `@pkg/result`                                                                                                  | `success`/`failure` result handling (mandated)                                 |
| `@pkg/validate`                                                                                                | Validation entry point over `remix/data-schema`                                |
| `@pkg/polar`                                                                                                   | Polar billing client                                                           |
| `@pkg/http`                                                                                                    | Content-type constants and response helpers (check current exports before use) |
| `@pkg/sitemap`                                                                                                 | `/sitemap.xml`                                                                 |
| `@pkg/markdown-server`                                                                                         | Rendering `/docs` markdown without React                                       |
| `@pkg/location`, `@pkg/hostname`, `@pkg/get-client-ip`, `@pkg/uuid`/`@pkg/typeid`, `@pkg/arrays`, `@pkg/cache` | Where the OLD APP uses them or equivalents                                     |

Do NOT use in the NEW APP (React- or Drizzle-coupled, or replaced): `@pkg/ui`, `@pkg/hooks`, `@pkg/cn`, `@pkg/db-helpers`, `remix-auth-oauth2`, `remix-utils`, `zod`, `drizzle-orm`, `recharts`, `sonner`, `nprogress`, `react-i18next`, `@epic-web/client-hints`, `fuse.js`.

**Extract one new package in Phase 0**: `@pkg/session-storage-kv` — move `apps/r3-uptime/infrastructure/session/kv-session-storage-adapter.ts`, its `KVStore` contract, and its test into `packages/session-storage-kv`. Reason: Remix ships cookie/fs/memory/redis/memcache session stores but none for Cloudflare Workers KV, and every Workers-based Remix v3 app needs one. Keep it app-agnostic (no `apps/*` imports or references), document it per `docs/guides/package-documentation.md`, and extend the root `tsconfig.json`.

Everything else that is app-specific (alert senders, analytics client, DNS/TCP/SSL checkers) stays inside the NEW APP.

### 11. Wrangler Config

Final shape of `apps/r3-uptime/wrangler.jsonc` (name and main stay as they are):

1. Keep `name: "r3-uptime"`, `main: "./bootstrap/worker.ts"`, current compatibility date and `nodejs_compat`.
2. Add `triggers.crons` — the seven crons from Context.
3. Add the `DB` D1 binding with `database_name: "ping"`, `database_id: "b51fff7c-c4dd-412d-8b56-57da405b780e"`, `migrations_dir: "./database/migrations"`.
4. Add the `KV` binding with id `ea5b4a1bb7804692992b013e1627a8ad`.
5. Add `queues.producers: [{ binding: "QUEUE", queue: "ping" }]`. Do NOT add `queues.consumers` until Phase 10 (only one worker may consume the queue, and the OLD APP is consuming it). Local dev queues are simulated per-worker by `wrangler dev`, so local development still works with a consumer entry added temporarily in dev or by invoking jobs directly in tests.
6. Add `durable_objects.bindings: [{ name: "GEO_FETCH", class_name: "GeoFetchDO" }]` and `migrations: [{ tag: "add-geo-fetch-do", new_classes: ["GeoFetchDO"] }]` (this worker starts its own DO migration history; the OLD APP's rename history does not apply here).
7. Add `workflows: [{ name: "ping-workflow", binding: "PING", class_name: "Ping" }]`.
8. Add `analytics_engine_datasets: [{ binding: "PING_RESULTS", dataset: "uptime_monitor_results" }]`.
9. Keep the existing `COOKIE_SESSION_SECRET` secrets-store binding; put the other six secrets in `.dev.vars` locally and `bunx wrangler secret put` for production.
10. Do NOT add the `uptime.sergiodxa.com` route until Phase 10.
11. After every wrangler.jsonc change: `bun cf:typegen`, then `bunx wrangler deploy --dry-run` to validate.

### 12. Testing

- Test runner: `bun:test` only, run from the repo root (`bun test apps/r3-uptime/...`). Test files must pass `bun typecheck`.
- Database-backed tests: run models/repositories against the in-memory `remix/data-table-sqlite` adapter (`bun:sqlite`), which mirrors the D1 adapter's SQLite semantics. Do not mock the query layer.
- Outbound HTTP (Polar, Resend, Slack/Discord/webhook deliveries, Analytics Engine SQL API, DNS-over-HTTPS): mock with MSW `setupServer` from `msw/node`. Never stub `globalThis.fetch` directly and never add injectable fetch parameters.
- Cloudflare bindings in tests: `mock.module("cloudflare:workers", ...)` to supply `env`.
- Router-level tests: call `router.fetch(new Request(url, ...))` and assert on responses — cover: unauthenticated redirect, non-member 404, member vs admin permissions, API key 401/403 by scope, and one happy-path CRUD per monitor type.
- Port the OLD APP's existing tests: `check-content.test.ts`, `check-ssl.test.ts`, `get-day-label.test.ts`, `days-of-year.test.ts`, `group-dates-per-week.test.ts`.

## Consequences

### Positive

- **Single stack**: the app joins the other Remix v3 apps (shared packages, shared patterns, shared fixes).
- **Far less client JavaScript**: React, recharts, sonner, nprogress, and client i18next disappear; pages are server-rendered HTML with a handful of tiny islands.
- **Zero data migration**: same D1/KV/Analytics dataset/queue; history, sessions, and in-flight queue messages survive cutover.
- **Platform-native UI**: dialogs and menus work before (and without) JavaScript and inherit correct keyboard/focus behavior.
- **Cleanup**: deletes the scaffold's broken local D1 adapter, extracts a reusable KV session store, consolidates Polar usage on `@pkg/polar`.

### Negative

- **Big surface**: ~186 routes, ~40 marketing pages, 30+ tables, 10 jobs, a workflow, a DO, and ~20k lines of locale data. This is multi-week work even though most business logic ports verbatim.
- **Manual Tailwind → css() translation**: every component's classes must be re-expressed; visual regressions are likely without side-by-side comparison against the live app.
- **Leaner replacements**: hand-rolled sparkline/heatmap/toasts replace battle-tested libraries; edge cases (focus trapping in complex flows, chart rendering quirks) need manual attention.
- **Possible one-time logout**: if the session record format differs from the OLD APP's KV format, all users re-login at cutover.
- **Beta dependency**: remix 3.0.0-beta.x still changes APIs between betas (the scaffold's adapter already rotted once). Pin the version; on upgrades re-check `docs/vendor/@remix-run/*`.

### Neutral

- The OLD APP keeps running until Phase 10; both workers can bind the same D1/KV safely because only the OLD APP consumes the queue and receives crons until cutover.
- API v1 contracts are unchanged, so existing integrations and the `UPTIME_CRON_API_KEY` self-monitoring loop continue working.
- `apps/r3-uptime/docs/*.md` stay authoritative; update them only if behavior intentionally changes.

## Implementation Plan

Rules for every phase: work only inside `apps/r3-uptime`, `packages/session-storage-kv` (Phase 0), and this ADR file. Definition of done for EVERY phase (in addition to the phase-specific items): `bun typecheck`, `bun lint`, and `bun test` pass from the repo root; `bun format:fix` has been run; work is committed to `main` with Conventional Commits; the Current Progress checklist below is updated.

### Phase 0: Foundation repair

**Priority:** High. **Effort:** ~half day.

1. Fill `wrangler.jsonc` per Decision §11 (no queue consumer, no custom domain).
2. Delete `infrastructure/database/` and `resources/components/timer.tsx`; remove the `Counter` import and the `key` props from `default-handler.tsx`; switch `bootstrap/worker.ts` to `createD1Adapter` (or the actual export) from `@pkg/data-table-d1` (add it to `package.json` dependencies as `workspace:*`).
3. `bun cf:typegen`; then get `bunx tsc --noEmit` clean inside `apps/r3-uptime`.
4. Copy `apps/uptime/db/migrations/` → `apps/r3-uptime/database/migrations/`; write the full `database/schema.ts` (every table from Context, snake_case); run `bun db:local:migrate` and verify all migrations apply locally.
5. Extract `@pkg/session-storage-kv` (Decision §10) and point the app at it.
6. Verify: `bunx wrangler deploy --dry-run` succeeds.

### Phase 1: App skeleton — auth, teams, layout

**Priority:** High. **Effort:** 2–3 days.

1. Add middleware per Decision §2 (logger, session, auth, cop) with context augmentations; create `app/lib/container.ts` and register Database + PolarClient + Resend + Analytics clients.
2. Implement `/auth` (start + callback with the full verify logic), `/logout`, and the `returnTo` cookie.
3. Implement `requireUser` / `requireTeam` / `requireRole`.
4. Make the i18n decision (§9), implement the language middleware, copy locale files.
5. Build layouts: document (exists), app shell (header with logo + team picker + user menu as popovers, sidebar), flash-toast rendering; create `resources/styles.ts`.
6. Implement `/app` and `/app/:team` redirects and `/healthcheck`.
7. Verify manually: log in through auth.sergiodxa.com locally, see an empty dashboard shell, log out.

### Phase 2: HTTP monitors end-to-end

**Priority:** High. **Effort:** 3–4 days.

1. `app/data/monitor.ts` + monitor queries; pages: list, new, detail, edit; actions: create/update/delete, play-monitor, update-ssl; content checks create/delete with regex validation.
2. Background pipeline: `scheduled` + `queue` handlers in `bootstrap/worker.ts`, `PingJob`, `Ping` workflow, `GeoFetchDO`, analytics writes, `clean` job.
3. Dashboard v1: stat cards, HTTP tab, monitor table with server-rendered sparklines, `set-dashboard-tab`.
4. Native `<dialog>` delete confirmations (§4.3 pattern).
5. Verify: create a monitor locally, trigger a check (invoke the job directly or via a temporary local consumer), see the result on dashboard + detail.

### Phase 3: DNS, TCP, and cron-job monitors

**Priority:** High. **Effort:** 3–4 days.

1. For each type: model in `app/data/`, list/new/detail/edit pages, create/update/delete actions, check job, results history view, dashboard tab.
2. DNS: manual check action (`check-dns-monitor`), change-detection semantics per `docs/dns-monitors.md`.
3. Cron jobs: public ping endpoint with rate limiting, ping history, next-expected calculation with `cron-parser`, integration snippets with `CopyButton`, `cleanCronJobPings`.

### Phase 4: Alerts and maintenance windows

**Priority:** High. **Effort:** 2–3 days.

1. Alert CRUD with the four strategy config forms; delivery services (email via Resend, webhook with HMAC signature, Slack, Discord); cooldown + recovery semantics; alert-history page.
2. Maintenance CRUD + end-early; suppression respected by the workflow and all check jobs; recurrence per `docs/maintenance-windows.md`.

### Phase 5: SSL monitoring and analytics aggregation

**Priority:** Medium. **Effort:** 2 days.

1. `checkSsl` job + SSL badges/counters on dashboard and monitor detail.
2. `AggregateDailyStatsJob`, `monitor_daily_stats` reads, the 365-day heatmap, slowest-endpoint summaries, `/healthcheck/analytics-engine`.

### Phase 6: Status pages

**Priority:** Medium. **Effort:** 2 days.

CRUD + monitor curation/ordering across the five join tables; public `/status/:slug` (overall banner, per-service status + history, maintenance display, empty state, is_public check).

### Phase 7: Team & access completion

**Priority:** Medium. **Effort:** 2–3 days.

Settings (members/roles/remove/leave/update/delete team), invites (create/revoke/accept + email), team domains (add/remove/retry + verification jobs), API keys UI (scopes, one-time reveal + `CopyButton`), account page, create-team, `update-language`, checkout.

### Phase 8: API v1

**Priority:** Medium. **Effort:** 2–3 days.

`requireApiKey(scope)` + every endpoint from the URL Surface list, copying request/response shapes from each OLD APP route file; `backfill-daily-stats`; `status`.

### Phase 9: Marketing site, docs, sitemap, polish

**Priority:** Low. **Effort:** 2–3 days.

The 36 static marketing pages, `/privacy`, `/terms`, `/docs` (markdown), `/sitemap.xml`, 404 page polish, i18n coverage pass over all views.

### Phase 10: Verification and cutover

**Priority:** High (gating). **Effort:** 1–2 days + soak.

1. Deploy the NEW APP (`bun run build`, migrate if needed, `bun run cf:deploy`) — still without queue consumer or custom domain. Browse it against production data on its workers.dev URL; compare every page with the live OLD APP.
2. Cutover, in this order: deploy OLD APP with crons and queue consumer removed → add `queues.consumers` + crons to the NEW APP and deploy → move the `uptime.sergiodxa.com` route to the NEW APP → verify checks resume and the queue backlog drains.
3. Soak for a week with the OLD APP dormant (rollback = reverse the three steps). Then delete the OLD APP worker and archive `apps/uptime` in a follow-up decision.
4. Update `apps/r3-uptime/README.md` and app docs; mark this ADR **Implemented**.

## Alternatives Considered

### 1. Incremental migration inside apps/uptime

Port route-by-route inside the OLD APP, mixing React Router and fetch-router. **Rejected because**: the stacks share nothing at the view layer (React vs remix/ui), the Vite/entry configuration conflicts, and the clean scaffold + specs already exist in the NEW APP.

### 2. Keep Tailwind for the NEW APP's styling

**Rejected because**: the monorepo rule for Remix v3 apps is `remix/ui` JSX with `css()` mixins; mixing systems would leave the app permanently off-standard. Visual parity is achieved by translating the classes.

### 3. New D1 database + data migration at cutover

**Rejected because**: it adds an export/import with downtime risk for zero product benefit; the explicit requirement is to reuse the same resources. Schema evolution can happen later through normal migrations.

### 4. Drop i18n to shrink the port

**Rejected because**: language preference is a shipped user-facing feature and the goal is full parity; the server-only approach keeps the cost to copied locale files + one middleware.

### 5. Deploy the NEW APP over the existing `ping` worker name

Would inherit domain/queue/DO automatically. **Rejected because**: it makes cutover all-or-nothing with no side-by-side verification window. The two-worker cutover is reversible; the DO is stateless so nothing is lost.

## References

- Feature specs (acceptance criteria): `apps/r3-uptime/docs/README.md` + the 11 feature files next to it
- OLD APP key files: `apps/uptime/wrangler.jsonc`, `app/entry.worker.ts`, `app/routes.ts`, `db/schema.ts`, `app/modules/auth.ts`, `app/session.ts`, `app/workflows/ping.ts`, `app/do/geo-fetch.ts`, `app/jobs/`, `app/services/`, `app/models/`, `app/routes/`
- NEW APP scaffold: `apps/r3-uptime/bootstrap/`, `routes/web.ts`, `app/http/`, `resources/`, `AGENTS.md`
- Working Remix v3 reference app: `apps/auth-saas` (`bootstrap/app.ts`, `bootstrap/worker.ts`, `app/lib/container.ts`, `app/http/controllers/`, `app/http/middleware/`)
- Remix v3 vendor docs: `docs/vendor/@remix-run/{fetch-router,ui,data-schema,data-table,auth,auth-middleware,session-middleware,cop-middleware,response}/`
- Related ADRs: [ADR-008 service container](../ADR-008-service-container-for-remix-v3.md), [ADR-011 data-table-d1 extraction](../ADR-011-oidc-provider-engine-package.md), [ADR-001 package extraction](../ADR-001-new-package-extraction.md), [uptime ADR-001 Analytics Engine migration](../uptime/ADR-001-analytics-engine-migration.md)
- Repo rules: root `AGENTS.md`, `apps/r3-uptime/AGENTS.md`, `docs/guides/{package-documentation,app-documentation,adr-writing}.md`

## Current Progress

- [x] Phase 0: Foundation repair
- [ ] Phase 1: App skeleton — auth, teams, layout — code complete (container, session/auth/i18n/cop middleware, `requireUser`/`requireTeam`/`requireRole`, `/auth`+`/logout`+`returnTo` cookie, `/app`+`/app/:team`+`/app/:team/dashboard`+`/healthcheck`, app shell + `resources/styles.ts`, locales copied); typecheck/lint/test/build/`wrangler deploy --dry-run` all green. **Not yet done:** a live click-through login against auth.sergiodxa.com — this sandbox has no real `CLIENT_ID`/`CLIENT_SECRET` for a registered localhost redirect URI, and `COOKIE_SESSION_SECRET`'s `secrets_store_secrets` binding has no local value here (`wrangler secrets-store secret create` needs interactive confirmation this session couldn't give). Whoever picks this up next should run `bun run --cwd apps/r3-uptime dev`, sign in for real, confirm the empty dashboard shell renders, and sign out — then check this box.
- [ ] Phase 2: HTTP monitors end-to-end
- [ ] Phase 3: DNS, TCP, and cron-job monitors
- [ ] Phase 4: Alerts and maintenance windows
- [ ] Phase 5: SSL monitoring and analytics aggregation
- [ ] Phase 6: Status pages
- [ ] Phase 7: Team & access completion
- [ ] Phase 8: API v1
- [ ] Phase 9: Marketing site, docs, sitemap, polish
- [ ] Phase 10: Verification and cutover

## Notes

- **`remix/data-table`'s auto-timestamp `touch` is opt-in per call, and its default clock returns a `Date`.** `db.create(table, values, { touch: true, returnRow: true })` / `db.update(table, id, changes, { touch: true })` only stamp `created_at`/`updated_at` when `touch: true` is passed explicitly. `app/lib/container.ts` overrides the `Database`'s `now` option to `() => Date.now()` so those stamps are epoch-ms integers (matching the `c.integer()` columns), not the library's default `Date` object, which D1 cannot bind. Any code creating a `Database` instance elsewhere (tests included) must pass the same `now` override or timestamps will silently mismatch.
- **SSL "checking" is metadata-based.** Workers cannot inspect TLS certificates. The OLD APP stores expiry/issuer values and `checkSsl` classifies them against dates and the warning threshold. Port that behavior; do not attempt a real TLS handshake.
- **`not_contains` passes on an empty response body; `contains` and `regex` fail on it** (product rule from `docs/content-checks.md`).
- **Alerting is transition-based**: alerts fire on state changes (up→down, down→up, →degraded), not on every failed check; cooldown suppresses repeats and suppressed deliveries are still recorded in `alert_events` with status `skipped_cooldown`.
- **The queue message contract is the cutover seam.** Renaming a message `type` or payload field breaks messages in flight during cutover.
- **`wrangler d1 migrations apply` tracks applied migrations by filename** in the `d1_migrations` table — that is why copying the migrations directory unchanged makes production consider them already applied.
- **`bunx wrangler deploy --dry-run`** validates bundling + bindings without uploading; use it liberally.
- The monorepo root `TODO.md` documents two accepted quirks that also apply here: `ctx.params.x!` is the accepted idiom for context-erased route params, and oxlint `jsx-key` warnings on remix/ui component arrays are a known false positive (do not "fix" them by adding `key` to components).
- **`database/schema.ts` timestamp columns are `c.integer()`, not `c.text()`.** Other Remix v3 apps in this repo store audit timestamps as ISO text; this app's production D1 database already has `created_at`/`updated_at`/etc. as INTEGER (milliseconds since epoch), written by the OLD APP's Drizzle `timestamp_ms` mode. Write epoch-ms integers (e.g. `Date.now()`), not ISO strings, when inserting/updating these columns in later phases — mixing representations would break ordering and comparisons against existing rows.
- **`wrangler d1 migrations apply` needs the binding name as a positional argument** (`bunx wrangler d1 migrations apply DB --local`) — omitting it fails with "Not enough non-option arguments" on this wrangler version. `db:local:migrate`/`db:remote:migrate` already pass it.
- **`createAction`-typed handlers need `as RequestHandler<any>` in `router.map()` calls that add per-route middleware beyond the global chain.** A handler built with `createAction(route, fn)` fixes its context's middleware-entries tuple at `[]`; a `router.map(route, { middleware: [...], handler })` call with one or more plain (untransformed) `Middleware` values instead types the merged context's entries as an opaque `any[]`, and the two tuple shapes never unify. `bootstrap/app.tsx`'s `/app`, `/app/:team`, and `/app/:team/dashboard` mappings cast the handler `as RequestHandler<any>` to route around this; `ctx.team`/`ctx.membership`/etc. stay correctly typed inside the handler regardless, since those come from the global `declare module "remix/fetch-router"` augmentations in each middleware's own file, not from the entries tuple.
- **`wrangler deploy`/`wrangler dev` do not build the Vite app themselves.** Run `bun run build` (`vite build`) first so `dist/client` and `dist/ssr/wrangler.json` exist; only then does `@cloudflare/vite-plugin`'s config redirection make `wrangler deploy --dry-run` (or a real deploy) succeed. A stale `.wrangler/deploy/config.json` pointing at a deleted `dist/` also fails — delete it if you clean `dist/` out from under a redirect.
