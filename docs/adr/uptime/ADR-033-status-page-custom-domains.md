# ADR-033: Serve Status Pages on Customer Domains

## Status

**Proposed** - 2026-10-08. Builds on [`@sdxc/hostname`](../../../packages/hostname) and on the
public status page as it is served today. Closes the gap recorded in
[ADR-022](./ADR-022-tenant-and-monitor-durable-objects.md): `status_pages.custom_domain` is stored
and editable but no code routes on it.

## Background

A status page is public at `https://uptime.sergiodxa.com/status/:slug`. Customers, agencies most
of all, want it at an address of their own such as `status.acme.com`: that is the URL their users
already expect, it carries their brand, and it keeps working as a link when they change vendors.

The product half-promises this already. The `/api/v1/status-pages` resource accepts and returns a
`customDomain`, the API reference documents it as "Custom domain for the status page", and the
column exists in D1. Nothing registers the domain with Cloudflare, nothing issues a certificate
for it, and a request arriving on that hostname never reaches the Worker. A customer who sets the
field gets a stored string and no status page. This ADR designs the feature end to end.

## Context

### What exists today

| Piece                       | Where                                                                                                                                                 | State                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `custom_domain` column      | `database/schema.ts`, `database/migrations/20260208120000_status_pages.sql`                                                                           | nullable `text`, no unique constraint, no index                                                                            |
| API create / update / patch | `app/http/controllers/api/status-pages.ts`, `api/status-page.ts`, `app/http/openapi/status-pages.ts`                                                  | `customDomain` accepted as any non-empty string; `null` clears it                                                          |
| Dashboard create action     | `app/http/controllers/actions/status-pages.ts`                                                                                                        | always writes `custom_domain: null`; the form has no field for it                                                          |
| Public page                 | `routes/web.ts` (`/status/:slug`, `/status/:slug/maintenance.ics`, `/status/:slug/maintenance/:windowId.ics`), `app/http/controllers/status-page.tsx` | loaded by slug through `StatusPage.findBySlugPublic`; private pages 404; 60 s HTTP cache                                   |
| Worker routing              | `wrangler.jsonc`                                                                                                                                      | one route, `uptime.sergiodxa.com` as a Workers Custom Domain; plus `workers_dev`                                           |
| Worker entry                | `bootstrap/worker.ts`                                                                                                                                 | every request goes to the one `application()` router                                                                       |
| Global middleware           | `bootstrap/app.tsx`                                                                                                                                   | session (KV-backed, `uptime:session` cookie), auth, flags, attribution, `cop`, security headers, renderer — on every route |
| Security headers            | `app/http/security-policy.ts`                                                                                                                         | CSP report-only, `frame-ancestors 'none'`, HSTS one year                                                                   |
| Canonical URLs              | `app/lib/seo.ts`                                                                                                                                      | resolve onto `https://uptime.sergiodxa.com`                                                                                |
| Team domains                | `app/data/team-domain.ts`, `app/jobs/verify-domain-ownership.ts`, `enqueue-pending-domains.ts`                                                        | a different feature: TXT proof of an email domain for auto-join, swept every 10 min                                        |
| Entitlement                 | `app/data/subscription.ts` (`Subscription.isActive(ownerId)`)                                                                                         | D1 projection of the team owner's Polar subscription                                                                       |
| Custom-hostname client      | `packages/hostname`                                                                                                                                   | create (DV over TXT), status, getByName, listByEntity, refresh, delete; throws `HostnameApiError`                          |

### Problems to solve

| Problem                                                              | Consequence if ignored                                                                                                       |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Traffic for `status.acme.com` never reaches the Worker               | the stored field is a broken promise                                                                                         |
| `custom_domain` is not unique and is not normalised                  | two pages, or two teams, can claim one hostname; `Status.Acme.com.` and `status.acme.com` are different rows                 |
| No ownership proof                                                   | a team could claim a hostname it does not control and have Cloudflare issue a certificate attempt for it                     |
| The router serves the whole app on any host it receives              | on a customer hostname, `/app`, `/auth`, `/api/v1` and the session cookie would all be reachable under the customer's origin |
| Status page links are built with `routes.statusPage*.href({ slug })` | every link on a custom-domain page would point at `/status/:slug/...`, a path that hostname does not serve                   |
| Canonical URL is always the product origin                           | search engines see two copies of one page and rank the product origin                                                        |
| `@sdxc/hostname` throws on API errors                                | the repo requires `@sdxc/result` at app boundaries, so calls need wrapping                                                   |

### Cloudflare for SaaS in one paragraph

A SaaS zone with Cloudflare for SaaS enabled accepts _custom hostnames_. The customer points
`status.acme.com` at a CNAME target inside the SaaS zone; Cloudflare validates ownership (a TXT
record, or the CNAME itself once it resolves) and issues a DV certificate (validated over TXT, as
`@sdxc/hostname` requests). Traffic for an active custom hostname is served by whatever the zone's
_fallback origin_ resolves to, and a Worker route on the SaaS zone puts the Worker in front of it,
with the request's `Host` header still `status.acme.com`. Per-hostname `custom_metadata` reaches the
Worker as `request.cf.hostMetadata` only on plans that include custom metadata.

## Decision

Serve a status page on a customer hostname through Cloudflare for SaaS, with a dedicated
**status-host router** that serves nothing but that one page, chosen in `bootstrap/worker.ts`
by the request's hostname. Domains get their own table, a registration job and a polling sweep,
and every request re-checks entitlement and visibility at the Worker.

### 1. Data model: `status_page_domains`

`status_pages.custom_domain` stops being the source of truth. A new table holds one row per
hostname and mirrors Cloudflare's state:

| Column                       | Type              | Notes                                                    |
| ---------------------------- | ----------------- | -------------------------------------------------------- |
| `id`                         | text PK           | UUID                                                     |
| `team_id`                    | text              | owning team, for authorization and the entitlement check |
| `status_page_id`             | text, unique      | one custom domain per status page                        |
| `hostname`                   | text, unique      | normalised (see below); unique across every team         |
| `cloudflare_id`              | text, nullable    | the custom hostname id; null until registration succeeds |
| `state`                      | text              | see the state machine in section 3                       |
| `hostname_status`            | text, nullable    | Cloudflare `status`, verbatim                            |
| `ssl_status`                 | text, nullable    | Cloudflare `ssl.status`, verbatim                        |
| `validation_txt_name`        | text, nullable    | from `HostnameClient.getValidationTxtRecord`             |
| `validation_txt_value`       | text, nullable    |                                                          |
| `last_error`                 | text, nullable    | `HostnameClient.getStatusMessage` when validation fails  |
| `checked_at`, `activated_at` | integer, nullable |                                                          |
| `created_at`, `updated_at`   | integer           |                                                          |

The API's `customDomain` field keeps its name and shape; it reads and writes through this table,
and responses gain a read-only `customDomainStatus` object (`state`, `records`, `message`). The
migration copies every non-null `custom_domain` into a row in state `unregistered`, which the
registration sweep then picks up, and a later migration drops the column. The chain stays
applicable to an empty database (`test/migration-replay.test.ts`).

**Hostname normalisation and refusal**, applied by a `remix/data-schema` schema shared by the API
and the dashboard action:

- parse through `new URL("https://" + input)` to get IDNA/punycode, lowercase, strip a trailing dot;
  refuse anything with a port, path, credentials or wildcard;
- require at least three labels: an apex such as `acme.com` cannot hold a CNAME, and apex proxying
  is a plan feature this ADR does not assume;
- refuse IP literals, `localhost`, reserved TLDs, and every hostname inside the product's own zones
  (`sergiodxa.com` and the SaaS zone);
- refuse a hostname already held by any row, reporting it as taken without naming the holder.

### 2. Registration

Adding or changing a domain (dashboard edit form or `PATCH /api/v1/status-pages/:id`) writes the
row in state `unregistered` and enqueues `registerStatusPageDomain` through `ctx.jobs`, so the
request never waits on the Cloudflare API and a Cloudflare outage cannot fail a form submit. The
job:

1. reads the row; returns if it is gone or already has a `cloudflare_id`;
2. calls `getByName(hostname)` first, so a retry after a create that succeeded but whose write was
   lost adopts the existing hostname instead of failing on a duplicate;
3. otherwise `create(hostname, teamId)` with `metadataKey: "team_id"`, so `listByEntity(teamId)`
   can reconcile a team's hostnames later;
4. stores `cloudflare_id`, the statuses, the TXT record, and moves to `pending`.

Calls go through one module, `app/services/status-page-domains.ts`, that builds the
`HostnameClient` once and turns `HostnameApiError` into a `@sdxc/result` failure; outbound requests
reach `api.cloudflare.com` through the global `fetch` and are mocked with MSW in tests.

Changing a page's hostname is a removal of the old row (section 6) followed by an add.

### 3. States and the instructions shown

```text
unregistered --register job--> pending --poll: active+active--> active
     |                           |  ^                              |
     |                           |  +--refresh (customer action)---+ (cert renewal / record removed)
     |                           +--poll: validation errors------> failed --refresh--> pending
     |                           +--pending for 14 days----------> expired --refresh--> pending
     +--removal----------------> deleting --delete job--> (row gone)
```

| State          | What the dashboard shows                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `unregistered` | "Setting up…" plus the CNAME record, which is known before Cloudflare answers                                             |
| `pending`      | the CNAME record (`status.acme.com CNAME <cname-target>`), the TXT record from `validation_txt_*`, and `getStatusMessage` |
| `active`       | the live URL and the certificate state                                                                                    |
| `failed`       | `last_error` and a **Check again** button that calls `refresh`                                                            |
| `expired`      | the same button; polling has stopped                                                                                      |
| `deleting`     | nothing actionable; the row disappears when the job finishes                                                              |

The CNAME target is one fixed hostname in the SaaS zone, configured as an environment value, not
derived per customer.

### 4. Polling

The existing `*/10 * * * *` trigger already sweeps team-domain verification. It also enqueues
`checkStatusPageDomain` for every row in `unregistered` (re-attempting registration) or `pending`,
with bounded concurrency as the other sweeps do. Each check calls `status(cloudflare_id)`, writes
the statuses back, and transitions:

- `HostnameClient.isActive` → `active`, sets `activated_at`, and writes the hostname's KV entry
  (section 5);
- validation errors → `failed`;
- still pending after 14 days → `expired` and stops being swept.

`active` rows are re-read once a day on the existing `0 6 * * *` SSL trigger, so a certificate that
failed to renew or a customer who deleted the CNAME moves the row back to `pending` and removes
the KV entry. A **Check again** action in the dashboard enqueues the same job immediately, rate
limited per row.

### 5. Routing a request on a customer hostname

`bootstrap/worker.ts` chooses the router before anything else runs:

```typescript
async fetch(request: Request) {
	let { hostname } = new URL(request.url);
	if (isProductHost(hostname)) return await trackCost(ledger, () => app.fetch(request));
	return await trackCost(ledger, () => statusHost.fetch(request));
}
```

`isProductHost` is an allowlist (`uptime.sergiodxa.com`, `*.workers.dev`, `localhost` in dev).
Every other hostname goes to the **status-host router**, built in `bootstrap/status-host.tsx`
from its own route map `routes/status-host.ts`:

| Path                         | Serves                             |
| ---------------------------- | ---------------------------------- |
| `/`                          | the status page                    |
| `/maintenance.ics`           | the maintenance calendar feed      |
| `/maintenance/:windowId.ics` | one maintenance event              |
| `/robots.txt`                | allow all, sitemap pointing at `/` |
| `/.well-known/security.txt`  | the product's security contact     |

Its middleware is `headRequests`, `asyncContext`, `log`, `trace`, `getClientIP`, `database`, a
**host resolver**, `i18n` (from `Accept-Language`, since there is no session), the status-host
security headers, and the renderer. It has no session, auth, flags, attribution, form data,
method override or `cop`; it answers `405` to anything but `GET`/`HEAD`, and a `404` to every other
path. Static client assets keep working because the `assets` binding serves `build/client` on any
host before the Worker runs.

**Host resolution** publishes `ctx.statusPage` and `ctx.team` on the request context
([ADR-057](../ADR-057-request-context-instead-of-a-service-container.md)), so tests install
their own:

1. read KV `status-host:<hostname>` → `{ statusPageId, teamId }`; the KV entry exists only for
   `active` rows and is written and deleted by the jobs;
2. on a miss, read `status_page_domains` by `hostname` where `state = 'active'`; write KV back on a
   hit, and cache a miss as `status-host-miss:<hostname>` for 60 s (KV's minimum TTL) so a
   scanner hitting random hostnames costs one D1 read per minute per hostname;
3. load the page by id **where `is_public`** and check `Subscription.isActive(team owner)`; on any
   failure answer a plain `404` page that names neither the team nor the page.

Step 3 runs on every request, not only on a KV miss: entitlement and visibility are enforced at
the boundary that receives the traffic, so a lapsed subscription or a page made private takes
effect within the page's 60 s HTTP cache window regardless of what KV still holds. The lookups are
two indexed D1 reads; `request.cf.hostMetadata` is read when present (it saves the KV read) but is
never trusted for entitlement.

The status page, calendar and event controllers take the page from `ctx.statusPage` instead of
`ctx.params.slug`; the `/status/:slug` routes keep a thin wrapper that resolves the slug and
calls the same rendering function. Links inside the page are built by a `statusPageHref(ctx, leaf)`
helper that answers `/maintenance.ics` on a custom host and `routes.statusPageCalendar.href({ slug })`
on the product host.

### 6. Removal and cleanup

Clearing the domain, deleting the page, deleting the team, or the daily account-erasure sweep
moves the row to `deleting`, deletes the KV entry at once, and enqueues `deleteStatusPageDomain`,
which calls `client.delete(cloudflare_id)`, treats a `404` as success, and then deletes the row.
A weekly reconciliation lists the zone's hostnames through `listByEntity` per team (or a full
listing) and deletes any Cloudflare hostname with no row, so a lost write can never leave a
certificate and route alive for a domain nobody owns.

### 7. Plan and authorization

- **Authorization**: adding, changing, refreshing or removing a domain requires team `admin`
  (`requireRole("admin")`, matching team domains and API keys), because it changes what a public
  hostname serves. The API requires `status-pages:write`; reads with `status-pages:read` include
  `customDomainStatus`.
- **Entitlement**: a custom domain requires an active subscription for the team owner, checked when
  the domain is added (refused with a problem detail otherwise) and on every request (section 5).
  A lapsed subscription keeps the row and the Cloudflare hostname, and the page answers `404`
  until it is renewed; the account-erasure sweep removes both.

### 8. Security on a customer origin

- **No cookies**: the status-host router never mounts the session middleware and strips any
  `Set-Cookie` from its responses, so a customer's origin can neither receive nor plant the
  product session. The product session cookie is host-only (no `Domain` attribute), so it is
  never sent to a customer hostname either; a test pins both properties.
- **No app surface**: the route map in section 5 is the whole surface; `/app`, `/auth`, `/api`,
  `/actions`, `/webhooks` and the marketing pages are `404` there. A regression test requests each
  product route prefix on a custom host.
- **CSP**: the status-host policy is the product policy minus Turnstile, with links to the product
  (sign-up, "powered by") as absolute URLs. `frame-ancestors 'none'` stays until embedding is a
  decided feature.
- **HSTS**: `max-age` only, never `includeSubDomains` or `preload`, because those would bind the
  customer's sibling hostnames to a policy they did not choose.
- **Host spoofing**: a request can only resolve to a public page of an entitled team, which is
  exactly what `/status/:slug` already publishes, so a forged `Host` header reveals nothing new.
- **Ownership**: Cloudflare will not route or issue a certificate until DNS proves control; the
  app shows nothing on a hostname whose row is not `active`.

### 9. Canonical URLs and SEO

While a domain is `active`, the page's `<link rel="canonical">`, Open Graph URL and calendar feed
URL use `https://<hostname>/`, on both hosts. `/status/:slug` keeps serving rather than redirecting,
so a page whose domain lapses or is removed never breaks existing links; whether it should `301`
instead is open question 4.

## Consequences

### Positive

- **The stored field finally works** - an API customer who set `customDomain` gets the page they
  asked for once DNS is in place.
- **The customer origin is minimal by construction** - a separate router with its own route map
  makes "only the status page" a property of the code, not of a filter that a future route can
  forget.
- **Entitlement is enforced where traffic lands** - KV only maps a hostname to a page; it never
  decides whether the page is served.
- **Every Cloudflare call is off the request path** - the dashboard and API stay fast and stay up
  when the Cloudflare API does not.

### Negative

- **Cloudflare for SaaS has a cost and a quota** - custom hostnames beyond the included allowance
  are billed per hostname per month, and the per-request Worker invocation on customer traffic is
  ours to pay.
- **Two extra D1 reads per uncached status-page request** - the page's HTTP cache absorbs most of
  them, but a crawler that defeats it pays them every time.
- **A second router to maintain** - a status-page feature must remember both hosts; the shared
  rendering function and the host-aware href helper keep that to one place each.
- **KV is eventually consistent** - a removed domain can resolve for up to about a minute in other
  locations; the per-request visibility check and the Cloudflare deletion bound that.

### Neutral

- **One domain per status page** - several hostnames for one page can be added later by dropping
  the unique constraint on `status_page_id`.
- **Team domains stay separate** - they prove an email domain for auto-join; nothing here shares
  their table or job.

## Implementation Plan

### Phase 1: Cloudflare setup

**Priority:** High

1. Pick the SaaS zone (open question 1), enable Cloudflare for SaaS on it, create the fallback
   origin record and the CNAME target hostname.
2. Add a Worker route on the SaaS zone so custom-hostname traffic reaches the `ping` Worker.
3. Create an API token scoped to the zone's custom hostnames; set `CLOUDFLARE_SAAS_API_TOKEN`
   and add `CLOUDFLARE_SAAS_ZONE_ID` and `STATUS_PAGE_CNAME_TARGET` to `.env.example` and
   `wrangler.jsonc` (and as `bindings.secret()` once the app moves to `cloudflare.config.ts`).

### Phase 2: Data

1. Migration creating `status_page_domains` with unique `hostname` and `status_page_id`, and
   copying existing `custom_domain` values as `unregistered`.
2. `app/data/status-page-domain.ts` model; hostname schema with normalisation and refusals.
3. API `customDomain` reads and writes through the model; add `customDomainStatus`; update the
   OpenAPI snapshot and `resources/docs/api/resources/status-pages.md`.

### Phase 3: Lifecycle jobs

1. `app/services/status-page-domains.ts` wrapping `HostnameClient` in `Result`.
2. `registerStatusPageDomain`, `checkStatusPageDomain`, `deleteStatusPageDomain` jobs; sweeps on the
   10-minute and daily triggers; weekly reconciliation.
3. KV entry written on `active`, deleted on any other state.

### Phase 4: Status-host router

1. `routes/status-host.ts`, `bootstrap/status-host.tsx`, host resolver middleware, status-host
   security policy; `isProductHost` switch in `bootstrap/worker.ts`.
2. Extract the status page, calendar and event rendering so both routers call it; `statusPageHref`.
3. Canonical and Open Graph URLs from the active domain.

### Phase 5: Dashboard

1. Custom domain field and setup panel on the status page edit view, admin-only, with DNS records,
   status message, **Check again** and **Remove**.
2. Customer docs in `resources/docs` for setting up a custom domain; update `docs/status-pages.md`.

### Phase 6: Drop the old column

1. Migration dropping `status_pages.custom_domain` once nothing reads it.

### Testing

- MSW handlers for the Cloudflare custom-hostname endpoints drive the job tests through create,
  adopt-on-retry, pending, active, failed, renewal regression and `404` on delete.
- A `*.workers.test.ts` covers the resolver against the real KV binding, including the 60 s
  negative entry.
- Router tests on a custom `Host`: `/` renders the page; every product prefix is `404`; `POST` is
  `405`; no response carries `Set-Cookie`; a private page, an unentitled team, and a non-active
  row each `404`; links on the page point at host-relative paths; canonical is the custom domain.
- Schema tests for normalisation and every refusal, including another team's hostname.

## Alternatives Considered

### 1. Route on `status_pages.custom_domain` in the existing router

Look the `Host` up in middleware and rewrite the URL to `/status/:slug`.

**Rejected because**: the full middleware stack, the session cookie and every app route would
still run on the customer origin; isolation would depend on a path filter staying complete.

### 2. Read the mapping only from `request.cf.hostMetadata`

Store `status_page_id` in the custom hostname's `custom_metadata` and skip KV and D1.

**Rejected because**: custom metadata is a plan-gated feature, the value is only as current as the
last API write, and it would decide entitlement outside the database that owns it. It stays an
optional fast path.

### 3. Workers Custom Domains per customer

Add each customer hostname as a Worker custom domain through the Workers API.

**Rejected because**: it needs the customer's hostname in a zone on our account, which a customer
domain is not.

### 4. Register with Cloudflare inside the request

Call `create` from the form action and show the TXT record immediately.

**Rejected because**: a slow or failing Cloudflare API would fail the save; the CNAME instruction
is known up front, and the TXT record appears within one poll.

## Open Questions

1. **Which zone is the SaaS zone?** Enabling it on `sergiodxa.com` reuses an existing zone, but a
   Worker route there must not capture the zone's other hostnames, and the product origin would
   share a registrable domain with the CNAME target. A dedicated zone (a separate domain for status
   hosting) isolates both. Recommendation: a dedicated zone.
2. **Fallback origin** - a proxied `AAAA 100::` placeholder that only the Worker route ever serves,
   or a real hostname? The placeholder means a Worker route outage fails closed.
3. **Trial teams** - should a team in its free trial get a custom domain? Allowing it helps
   conversion; refusing it removes a free, certificate-backed phishing surface.
4. **Redirect `/status/:slug`** - `301` to the custom domain while active, or keep serving both with
   a canonical link?
5. **Apex domains** - worth supporting through apex proxying if the plan allows it, or always
   require a subdomain?
6. **Embedding** - do customers want to frame their status page, which would relax
   `frame-ancestors` on the status host?
7. **Existing values** - should values already stored in `custom_domain` be registered
   automatically by the migration, or cleared and the owners asked to add them again?

## References

- [`@sdxc/hostname`](../../../packages/hostname/README.md)
- [Cloudflare for SaaS: custom hostnames](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/)
- [Cloudflare for SaaS: Workers as your fallback origin](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/advanced-settings/worker-as-origin/)
- [ADR-022: Tenant and Monitor Durable Objects](./ADR-022-tenant-and-monitor-durable-objects.md)
- [ADR-016: Protect the Public Endpoints](./ADR-016-protect-the-public-endpoints.md)

## Current Progress

- [ ] Phase 1: Cloudflare setup
- [ ] Phase 2: Data
- [ ] Phase 3: Lifecycle jobs
- [ ] Phase 4: Status-host router
- [ ] Phase 5: Dashboard
- [ ] Phase 6: Drop the old column
