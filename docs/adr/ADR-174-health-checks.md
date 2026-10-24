# ADR-174: Dependency Health Checks and `@sdxc/health`

## Status

**Accepted** - 2026-10-24

## Background

Every deployed app should answer a health check that an uptime monitor can poll, and a
`200` from it should mean the whole app works, not only that the Worker started. Today three
apps have no health check, and most of the others either answer without touching anything or
probe one dependency out of several. A misconfigured binding, an R2 bucket that is gone, a
Durable Object class that fails to construct or a payment provider that is down all leave the
health check green while the pages that need them fail.

## Context

### Current state

| App       | Path                            | What it probes            | Response                          |
| --------- | ------------------------------- | ------------------------- | --------------------------------- |
| auth-saas | `/health`                       | nothing                   | `200 { status, timestamp }`       |
| blog      | `/healthcheck`                  | D1 (`count(users)`)       | `200`/`503 { status }`            |
| books     | `/healthcheck`                  | nothing (deliberately)    | `200 text/plain OK`               |
| demo      | none                            | -                         | -                                 |
| r3-auth   | `/healthcheck`                  | D1, KV (`list()`)         | `200`/`500` text, names the probe |
| reader    | none                            | -                         | -                                 |
| sdxc-site | none                            | -                         | -                                 |
| uptime    | `/healthcheck`                  | D1 (`count(teams)`)       | `200`/`503 { status }`            |
| uptime    | `/healthcheck/analytics-engine` | AE binding + SQL read API | `200 ok`/`200 degraded`/`503`     |
| kit app   | `/api/health`                   | nothing                   | `200 { status: "ok" }`            |

`apps/pkmn` runs in the browser and `apps/agentic-hub` is a note, so neither has a Worker to
check.

### Issues identified

| Issue                                                | Impact                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| Three deployed apps have no health check             | A monitor can only poll a page, which may be cached or static       |
| KV, R2, Durable Objects and Secrets Store unprobed   | A broken binding surfaces as user-facing 500s, not a red monitor    |
| Third-party services the app needs are unprobed      | A Polar outage breaks checkout while every monitor stays green      |
| Four response shapes and three status codes for down | Each monitor is configured differently; uptime cannot read a report |
| Probes have no timeout                               | A hanging dependency makes the monitor time out instead of failing  |
| Failure details are either hidden or sent as text    | Either the alert says nothing, or the internals answer the public   |
| Each controller hand-rolls `allSettled` and catch    | Eight copies of the same runner once every app has one              |

## Decision

1. Every app with a Worker, and the kit template, answers `GET /health` (see
   [The path](#the-path)).
2. The check probes **every stateful binding the app reads, read-only**: a probe never writes,
   sends or spends budget, so a monitor polling every minute changes nothing.
3. The check also probes **every third-party service a user-facing feature depends on**,
   through the provider's own health endpoint when it has one (see
   [Third-party services](#third-party-services)).
4. The body follows the IETF draft _Health Check Response Format for HTTP APIs_
   (`application/health+json`), as completely as the draft allows.
5. A new package, `@sdxc/health`, owns the runner, the format, reading a report another
   service sent, and the format's JSON Schema. The app owns the probes, as lambdas over its
   own context, bindings and `fetch`.

### The path

| Convention                    | Path                          | Meaning                                |
| ----------------------------- | ----------------------------- | -------------------------------------- |
| The IETF draft (section 9)    | `/health`                     | Suggested as the memorable, common URI |
| Spring Boot                   | `/actuator/health`            | Dependency health, `UP`/`DOWN`         |
| ASP.NET Core, NestJS Terminus | `/health` (by convention)     | Dependency health                      |
| Kubernetes components         | `/healthz` `/livez` `/readyz` | Liveness and readiness of a process    |
| Rails 7.1+                    | `/up`                         | Liveness only: the app boots           |
| Polar (seen above)            | `/healthz`                    | Liveness                               |

`/health` is the most common path for a dependency check and the one the draft names, while
`/healthz`, `/livez` and `/up` mark liveness probes, which this check goes beyond. Every app
moves to `/health`: blog, books, r3-auth and uptime from `/healthcheck`, and the kit template
from `/api/health`, which it used only because every JSON route in the template lives in the
`/api` contract. The template keeps documenting the route as an OpenAPI operation; it is
just no longer prefixed. The old paths are removed, not redirected, and each production
monitor moves in the same release.

### The package API

One configured object, with probes mapped onto it by name, in the shape of `@sdxc/jobs` and
`@sdxc/mcp`. Probe names are plain strings: nothing reads a check by its name in code, so a
typed name map would buy nothing.

```typescript
/** app/initializers/health.ts */
import { HealthCheck } from "@sdxc/health";
import { env } from "cloudflare:workers";

import type { AppContext } from "~/app/initializers/router";

export const health = new HealthCheck<AppContext>({
	serviceId: "books",
	description: "The book's sales and sample-chapter site",
	releaseId: env.CF_VERSION_METADATA.id,
	timeout: 2_000,
});

health.probe("polar", (_, signal) => fetch("https://api.polar.sh/healthz", { signal }), {
	componentType: "system",
	timeout: 5_000,
	affectedEndpoints: ["/checkout"],
});
health.probe("buttondown", (ctx, signal) =>
	fetch("https://api.buttondown.com/v1/ping", {
		headers: { Authorization: `Token ${env.BUTTONDOWN_API_KEY}` },
		signal: AbortSignal.any([ctx.request.signal, signal]),
	}),
);
```

```typescript
/** app/http/controllers/health.ts */
import { createAction } from "remix/router";

import { health } from "~/app/initializers/health";
import routes from "~/routes/web";

/** GET /health — probes every binding and service the app depends on. */
export default createAction(routes.health, (ctx) => health.respond(ctx));
```

#### `new HealthCheck<Context>(options)`

Every field the draft defines at the top level, and every behavior of the runner, is a
constructor option. All are optional.

| Option         | Default | Contract                                                                                    |
| -------------- | ------- | ------------------------------------------------------------------------------------------- |
| `timeout`      | `2_000` | Milliseconds each probe may take before it fails with `output: "timeout"`.                  |
| `serviceId`    | omitted | Draft `serviceId`: the service's unique id within the application.                          |
| `description`  | omitted | Draft `description`: a human-friendly description of the service.                           |
| `version`      | omitted | Draft `version`: the public version of the service.                                         |
| `releaseId`    | omitted | Draft `releaseId`: the deployed release, e.g. the Worker's version-metadata id.             |
| `notes`        | omitted | Draft `notes`: an array of strings sent with every report.                                  |
| `links`        | omitted | Draft `links`: link relation to URI; `self` is the health URL, `about` the docs.            |
| `maxAge`       | `0`     | Seconds of freshness sent as `Cache-Control: max-age=<n>`, the lifetime the draft asks for. |
| `failStatus`   | `503`   | HTTP status for a `fail` report; any 4xx or 5xx, as the draft requires.                     |
| `exposeErrors` | `false` | When `true`, a failed check's `output` carries the error message instead of its kind.       |

`pass` and `warn` always answer `200`, the draft's 2xx requirement for both.

#### `.probe(name, fn, options?)`

`fn(ctx, signal)` runs on every check. `signal` is an `AbortSignal` that aborts with a
`TimeoutError` when the probe's timeout elapses, so a probe that hands it to `fetch` (or any
API taking a signal) stops the work at the timeout instead of only being abandoned. The
runner leaves the request's own signal to the app: a probe that should also stop when the
client disconnects combines the two with `AbortSignal.any([ctx.request.signal, signal])`.
Binding calls that accept no signal (KV, R2, D1, Durable Object RPC) ignore it, and the
runner still stops waiting for them at the timeout.

Its outcome:

| `fn` settles with                     | Check status                                                             | Check `output`                               |
| ------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| any other value, `undefined` included | `pass`                                                                   | omitted                                      |
| a `Response` with a 2xx status        | `pass`                                                                   | omitted                                      |
| a `Response` with any other status    | `fail`                                                                   | `"HTTP 503"` (the status it got)             |
| a `Response` carrying a health report | see [Reading another service's report](#reading-another-services-report) |                                              |
| a failed `@sdxc/result` value         | `fail`                                                                   | `"error"`, or the error's message if exposed |
| a rejection                           | `fail`                                                                   | `"error"`, or the error's message if exposed |
| nothing within the timeout            | `fail`                                                                   | `"timeout"`                                  |
| a rejection with `signal`'s reason    | `fail`                                                                   | `"timeout"`                                  |

A `Response` probe's body is cancelled after its status is read, unless it carries a health
report, so a `fetch` probe never holds a connection open. A `fail` on a probe registered with `critical: false` is reported as
`warn`.

| Probe option        | Default     | Contract                                                                                  |
| ------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| `critical`          | `true`      | `false` reports a failure as `warn`, so the report stays `200`.                           |
| `timeout`           | the check's | Overrides the constructor's `timeout` for this probe, e.g. for a slower third party.      |
| `componentType`     | omitted     | Draft `componentType`: `datastore`, `component`, `system`, or a URI.                      |
| `componentId`       | omitted     | Draft `componentId`: a unique id of the instance probed.                                  |
| `links`             | omitted     | Draft `links` of the check, e.g. `{ about: "https://status.polar.sh" }`.                  |
| `affectedEndpoints` | omitted     | Draft `affectedEndpoints`: URI templates of the routes that break; sent only on non-pass. |

`.probe` returns the instance, so probes may chain. Registering a name twice replaces the
first probe.

#### `.check(ctx)` and `.respond(ctx)`

`check` runs every probe in parallel and resolves to the report; it never rejects. `respond`
is `check` as a `Response`: `Content-Type: application/health+json`, the status from the
report, and `Cache-Control: max-age=<maxAge>`. Every failure is also logged through
`currentLog()` from `@sdxc/logger` with the probe name and the full error, whatever
`exposeErrors` says, so the alert names the probe and the log says why.

#### Exports

| Entry point                | Export              | Purpose                                                                                                |
| -------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| `@sdxc/health`             | `HealthCheck`       | The runner above.                                                                                      |
| `@sdxc/health`             | `isHealthResponse`  | Whether a `Response`'s `Content-Type` is `application/health+json`, parameters ignored.                |
| `@sdxc/health`             | `parseHealth`       | Reads a report from its body text; see below.                                                          |
| `@sdxc/health`             | `HEALTH_MEDIA_TYPE` | `"application/health+json"`.                                                                           |
| `@sdxc/health`             | `Health`            | Types only: `Health.Report`, `Health.Check`, `Health.Status`, `Health.Options`, `Health.ProbeOptions`. |
| `@sdxc/health/schema`      | default             | The format as an `@sdxc/json-schema` schema: validates in code, emits JSON Schema.                     |
| `@sdxc/health/schema.json` | the file            | The same schema as a static JSON Schema 2020-12 document.                                              |

`schema.json` is generated from `./schema` by a package script and a test fails when the two
differ, so the file never drifts from the validator. It carries
`$id: "https://sdxc.dev/schemas/health.json"`, and sdxc-site serves the file at that URL, so
a tool outside JavaScript (an editor, a CI step, another monitor) can reference the schema by
URL or copy the file.

`parseHealth(body: string): Result<Health.Report>` parses the JSON, validates it against
`./schema`, and returns the report with every `status` normalized: the draft's values in any
case, and its `ok`/`up`/`error`/`down` aliases, become `pass`, `warn` or `fail`. A body that
is not JSON or does not validate is a failure naming why. Callers cap how much of a body they
read; `parseHealth` takes text so a caller that also needs the body (uptime's content checks)
reads it once.

### Reading another service's report

When a probe resolves to a `Response` that `isHealthResponse` accepts, the runner reads up to
64 KB of its body and passes it to `parseHealth`, so a dependency that speaks this format
(another of our apps, or a provider that adopts it) is judged by what it reports, not only by
its status code:

| HTTP status | Report        | Check status                         | Check `output`                             |
| ----------- | ------------- | ------------------------------------ | ------------------------------------------ |
| any         | `fail`        | `fail` (`warn` if `critical: false`) | `"reported fail"`                          |
| 2xx         | `warn`        | `warn`, whatever `critical` says     | `"reported warn"`                          |
| 2xx         | `pass`        | `pass`                               | omitted                                    |
| non-2xx     | `pass`/`warn` | `fail` (`warn` if `critical: false`) | `"HTTP 503"`                               |
| any         | unreadable    | judged by the status code alone      | `"unreadable health report"` on a non-pass |

A dependency's `warn` stays a `warn` here: it said it still serves, so it cannot fail this
service. What is copied from the report is its status and its `serviceId`, as the check's
`componentId`. The dependency's own checks, notes and output are never copied, since they
name its internals; with `exposeErrors` on, its top-level `output` becomes the check's
`output`, because that is the dependency's own public summary.

### The report

A check's key is `<name>:responseTime`, the draft's `componentName:measurementName` form with
its predefined `responseTime` measurement, and its value is a single-element array, as the
draft asks for a single-node component. Every check records `observedValue` (milliseconds),
`observedUnit: "ms"` and `time` (when the probe started). `output` and `affectedEndpoints`
appear only on a check that did not pass, and the top-level `output` lists the checks that did
not pass, as the draft reserves both for `warn` and `fail`.

```http
HTTP/1.1 200 OK
Content-Type: application/health+json
Cache-Control: max-age=0
```

```json
{
	"status": "warn",
	"serviceId": "books",
	"description": "The book's sales and sample-chapter site",
	"releaseId": "8f3a5c1e-7d2b-4c9a-b0e4-2a6f1d9c3b7e",
	"output": "Checks not passing: buttondown:responseTime",
	"checks": {
		"polar:responseTime": [
			{
				"componentType": "system",
				"status": "pass",
				"observedValue": 182,
				"observedUnit": "ms",
				"time": "2026-10-24T21:14:11.312Z"
			}
		],
		"buttondown:responseTime": [
			{
				"status": "warn",
				"observedValue": 2001,
				"observedUnit": "ms",
				"time": "2026-10-24T21:14:11.312Z",
				"output": "timeout"
			}
		]
	}
}
```

The report's status is `fail` when any check fails, else `warn` when any warns, else `pass`.
An app with no probes reports `pass` with an empty `checks`.

### The JSON Schema

`@sdxc/health/schema` describes what the draft allows, not only what `HealthCheck` emits, so
it validates any service's report:

- `status` is the only required field of a report (every field of a check is optional,
  as the draft makes them), and accepts the draft's values in any case along with the
  `ok`, `up`, `error` and `down` aliases. JSON Schema patterns take no flags, so
  case-insensitivity is spelled as a character-class pattern; `parseHealth` turns what it
  accepts into `pass`, `warn` or `fail`.
- `version`, `releaseId`, `serviceId`, `description` and `output` are strings; `notes` is an
  array of strings.
- `links` is an object whose values are URIs (`format: "uri"`); its keys are any string,
  since the draft allows a relation name or a URI.
- `checks` is an object whose keys match `^[^:]*(:[^:]*)?$` (at most one colon) and whose
  values are arrays of check objects.
- A check allows `componentId`, `componentType`, `observedValue` (any JSON value),
  `observedUnit`, `status`, `affectedEndpoints` (array of strings), `time`
  (`format: "date-time"`), `output` and `links`.
- Additional properties are allowed at both levels, since the draft lets an implementation
  add keys and a consumer ignore them.

The kit template's OpenAPI `health` operation uses `@sdxc/health/schema` as its response
body under `application/health+json`, so the published API reference and the runner agree.

### Probing each binding

| Binding                  | Probe                                                               | Why this one                                         |
| ------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------- |
| D1                       | `ctx.db.exec("SELECT 1")` through the app's `Database`              | Exercises the adapter the app queries with           |
| KV                       | `env.X.get("healthcheck")`                                          | A read; `list()` is billed as a list operation       |
| R2                       | `env.X.head(key)` of an object the app needs, else of `healthcheck` | Metadata only, no body transfer                      |
| Durable Object           | `env.X.getByName("healthcheck").ping()`                             | Constructs the class, so a failing constructor fails |
| Secrets Store            | `env.X.get()`                                                       | The read every request using the secret makes        |
| Analytics Engine (read)  | the app's SQL query, `critical: false`                              | Writes keep working while the read API is down       |
| Queue, Send Email        | not probed                                                          | Every probe would send a message or an email         |
| Rate limiter             | not probed                                                          | `limit()` spends the budget it reports on            |
| Analytics Engine (write) | not probed                                                          | `writeDataPoint` writes and returns nothing to check |
| Browser Rendering        | not probed                                                          | A session is billed by the second                    |

`R2.head` of a missing key resolves to `null`, which passes: reaching the bucket is what is
checked. A probe that needs the object throws when `head` answers `null`, as r3-auth's does
for its signing keys.

Each Durable Object class gains a `ping()` RPC method. A class with SQLite storage answers it
with `this.ctx.storage.sql.exec("SELECT 1")`, so a probe also reaches its storage; one
without storage returns. Probing always addresses the instance named `healthcheck`, so a DO
probe creates at most one extra instance per class, ever.

### Third-party services

A third-party service is probed when a user-facing feature depends on it, and the probe is
`critical` when the app's main purpose fails without it. In order of preference, a probe
calls:

1. **The provider's own health endpoint**, unauthenticated, e.g. Polar's
   `GET https://api.polar.sh/healthz` (`200 {"status":"ok"}`).
2. **The cheapest authenticated read that is free of side effects**, when the provider has no
   health endpoint. It also proves the app's credential still works, which a status page
   cannot: Buttondown's `GET /v1/ping`, GitHub's `GET /rate_limit` (which spends no rate
   limit).
3. **Another app of ours**, through its own `/health`, whose report is read as described in [Reading another service's report](#reading-another-services-report).

A provider's status page reports its incidents, not whether this Worker can reach it, so it
goes into the check's `links.about` rather than being probed. Services the visitor's browser
loads directly (ParityDeals, Turnstile's widget, Cloudflare Web Analytics) and per-customer
destinations (Slack and Discord webhooks, a tenant's social login providers) are not probed.

| Service               | Probe                                               | Apps (critical in **bold**)                   |
| --------------------- | --------------------------------------------------- | --------------------------------------------- |
| Polar                 | `GET https://api.polar.sh/healthz`                  | **books**, r3-auth, reader, uptime, auth-saas |
| Buttondown            | `GET https://api.buttondown.com/v1/ping` with token | **books**                                     |
| auth.sergiodxa.com    | `GET https://auth.sergiodxa.com/health`             | **reader**, blog, uptime                      |
| GitHub API            | `GET https://api.github.com/rate_limit`             | r3-auth, sdxc-site                            |
| Have I Been Pwned     | `GET https://api.pwnedpasswords.com/range/00000`    | r3-auth                                       |
| Cloudflare AE SQL API | the app's existing count query                      | uptime                                        |

- **books**: checkout is Polar and the sample chapter is Buttondown, so either one down is
  the site failing at its job.
- **reader**: every page needs a signed-in reader, so the identity provider being down is
  the app being down; blog only loses its editors' sign-in, and uptime keeps monitoring.
- **r3-auth**: GitHub is one sign-in method of several, Polar's mirror is best effort, and
  the breach check is advisory, so all three warn.
- **sdxc-site**: pages serve the cached GitHub data, so GitHub being down only warns.

### Per-app probes

| App       | Bindings                                                                                       | Third parties                         |
| --------- | ---------------------------------------------------------------------------------------------- | ------------------------------------- |
| auth-saas | `PLATFORM_DB`; the seven KV namespaces; `R2`; `TENANT` (`ping`)                                | Polar                                 |
| blog      | `DB`; `CACHE`, `AUTH`, `REDIRECTS`; `BACKUPS`, `SOCIAL_CARDS`; the six Secrets Store secrets   | auth                                  |
| books     | none                                                                                           | **Polar**, **Buttondown**             |
| demo      | `DB`                                                                                           | none                                  |
| r3-auth   | `DB`; `KV`; `R2` (the signing key object must exist); `POLAR_ACCESS_TOKEN` (`critical: false`) | GitHub, Polar, Have I Been Pwned      |
| reader    | `PLATFORM_DB`; `KV`; `USER` and `FEED` (`ping`); `UNSUBSCRIBE_SECRET`                          | **auth**, Polar                       |
| sdxc-site | `CACHE`; `SOCIAL_CARDS`                                                                        | GitHub                                |
| uptime    | `DB`; `KV`; `SOCIAL_CARDS`, `FLOW_TRACES`; `GEO_FETCH` (`ping`); `UNSUBSCRIBE_SECRET`          | auth, Polar, Analytics Engine SQL API |

`/healthcheck/analytics-engine` in uptime is removed: its read probe becomes the
non-critical `analytics-engine` probe of `/health`, and its `binding` field becomes moot
because an unbound `PING_RESULTS` fails type generation and deploy first.

Each app sets `serviceId` to its Worker name and `releaseId` from a version-metadata binding,
added where the app has none, so a report says which deploy answered it.

## Consequences

### Positive

- **A green check means the app works**: every stateful binding answers inside the timeout
  and every critical provider is up, so a bad binding id, a dropped bucket, a crashing Durable
  Object or a payment outage pages the monitor rather than the first user.
- **One standard format across apps**: every monitor is configured the same, any tool that
  reads `application/health+json` understands it, and uptime can validate other services'
  reports with the same schema.
- **Bounded**: the check answers within the longest probe timeout plus overhead, even when a
  dependency hangs.
- **New apps get it for free**: `sdxc create` ships the initializer with a database probe.

### Negative

- **Cost per poll**: each poll is a D1 read, one KV read per namespace (seven in auth-saas),
  R2 class B operations, a Durable Object request per class and one request per third party.
  At one poll a minute that is about 43,000 of each a month per app, well inside paid-plan
  allowances, but anyone can call the endpoint.
- **Third-party traffic**: Polar, Buttondown, GitHub and Have I Been Pwned each receive a
  request per poll per app. That is under their published limits, but a provider may still
  rate-limit it, which shows as a `warn` or `fail` that is about the probe, not the feature.
- **Coupled alerts**: reader fails whenever auth fails, so one auth outage pages twice. That
  is accurate (reader is unusable), and the report names `auth` as the cause.
- **One more method per Durable Object**: `ping()` exists only for the check.
- **Every monitor changes**: the path moves to `/health` for blog, books, r3-auth and uptime,
  and books' `OK` text body becomes a report, so each production monitor is updated in the
  release that ships its app's check.

### Neutral

- Writes are not exercised. A namespace that reads but rejects writes stays green; checking
  that would need a write per poll, which this ADR rules out.
- A probe's timeout always ends the wait, and ends the work only for probes that pass
  `signal` on: an HTTP probe's request is aborted, while a binding call continues in the
  background until it settles.
- The draft is an expired individual Internet-Draft with no IETF standing; it is the format
  load balancers and health tooling recognize, and nothing newer replaces it.

## Implementation Plan

1. `@sdxc/health`: the class, `parseHealth`, `./schema` and the generated `schema.json`; tests over passing,
   failing, timed-out, `Response`, result-failure and non-critical probes, and the draft's
   own example validating against the schema. README, LICENSE, `release:bootstrap`, docs-site
   group.
2. Each app, one commit each: `app/initializers/health.ts`, the controller on
   `/health`, `ping()` on its Durable Objects, third-party probes mocked with MSW, and a
   `*.workers.test.ts` where a probe reads a real binding.
3. Kit template: `/health` answers through `HealthCheck` with a database probe, and its
   OpenAPI operation documents `@sdxc/health/schema`.
4. Update each production monitor to the new path and to expect `503` for down.

## Alternatives Considered

### 1. Per-app controllers with no package

Each controller runs `Promise.allSettled` with a timeout and builds its own body.

**Rejected because**: eight copies of the runner and the report shape, and a change to the
format or the timeout lands in eight files.

### 2. Ship binding and HTTP probes in the package

`probes.kv(env.KV)`, `probes.r2(env.R2)`, `probes.http(url)` with structural binding types.

**Rejected because**: every probe is one line the app already writes against bindings it has
typed, and treating a non-2xx `Response` as a failure gives HTTP probes the one behavior a
helper would add. The Durable Object probe depends on a method the app defines.

### 3. Probes declared in the constructor, with typed names

`new HealthCheck({ probes: { database: … } })`, with the names as a type parameter.

**Rejected because**: nothing reads a check by name in code, and `.probe()` matches how jobs,
MCP tools and routes are mapped onto their runtime objects.

### 4. Probe providers through their status pages

Read `status.polar.sh` or `githubstatus.com` instead of calling the API.

**Rejected because**: a status page reports declared incidents, often minutes late, and says
nothing about whether this Worker reaches the API or whether its credential still works.

### 5. Cache the report for a few seconds

Answer repeated polls from an in-isolate copy of the last report.

**Rejected because**: isolates are many and short-lived, so the cache would rarely hit, and a
stale `pass` after an outage starts is the result the check exists to avoid. `maxAge` lets a
deployment opt into HTTP caching instead. Revisit with a rate limit if the endpoint is abused.

### 6. Write round-trips (KV put/get, R2 put/delete, a no-op job)

**Rejected because**: each poll would cost write operations and leave queue traffic.

## References

- [ADR-038 (uptime): Read health reports in HTTP monitors](./uptime/ADR-038-read-health-reports-in-http-monitors.md)

- [Health Check Response Format for HTTP APIs (IETF draft)](https://datatracker.ietf.org/doc/html/draft-inadarei-api-health-check-06)
- [RFC 6570: URI Template](https://www.rfc-editor.org/rfc/rfc6570)
- [ADR-033: Wide events as the logging contract](./ADR-033-wide-events-as-the-logging-contract.md)
- [ADR-129: App folder layout](./ADR-129-app-folder-layout.md)
