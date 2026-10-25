---
title: Dependency health checks
description: Answer GET /health with a report on every store and service your Worker depends on, in the application/health+json format monitors read.
section:
    title: Operations & testing
    order: 9
order: 1.5
lastUpdated: 2026-10-25
outcomes:
    - "How to answer `GET /health` with a dependency report from `@sdxc/health`"
    - "How to probe D1, KV, R2, Durable Objects and third-party APIs without writing anything"
    - "How to read another service's health report"
---

A health check that answers `200` as soon as the Worker starts tells a monitor very little:
a dropped R2 bucket, a misconfigured KV id or a payment provider that is down all leave it
green while the pages that need them fail. This guide answers `GET /health` with a report on
every dependency the app reads, using [`@sdxc/health`](/api/health). Each probe is a short
function you write against your own bindings, the runner gives every one a timeout, and the
response follows the `application/health+json` format that load balancers and uptime monitors
recognize.

```bash
npm add @sdxc/health @sdxc/result remix
npm add -D msw
```

## Answer `/health`

Build one `HealthCheck` in its own module, typed with the context your router builds, and
register a probe per dependency. The options describe the service in the report: `serviceId`
names it, and `releaseId` says which deploy answered, here read from a version-metadata
binding named `CF_VERSION_METADATA`.

```typescript {% title="app/initializers/health.ts" %}
import { HealthCheck } from "@sdxc/health";
import { env } from "cloudflare:workers";
import { sql } from "remix/data-table";

import type { AppContext } from "~/app/initializers/router";

export const health = new HealthCheck<AppContext>({
	serviceId: "jobs-board",
	releaseId: env.CF_VERSION_METADATA.id,
});

health.probe("database", (ctx) => ctx.db.exec(sql`SELECT 1`), {
	componentType: "datastore",
});
```

`ctx.db` is the database your middleware publishes, so the probe runs through the same
adapter every query uses. A probe passes when it resolves, and fails when it rejects, times
out, resolves to a failed `@sdxc/result` value or resolves to a `Response` with a status
outside 2xx.

The route is a plain `GET` in your contract, `health: get("/health")`, and its controller
hands the context to `respond`:

```typescript {% title="app/http/controllers/health.ts" %}
import { createAction } from "remix/router";

import { health } from "~/app/initializers/health";
import routes from "~/routes/web";

export default createAction(routes.health, (ctx) => health.respond(ctx));
```

`respond` runs every probe in parallel and answers with the report: `200` when the status is
`pass` or `warn`, `503` when it is `fail`, `Content-Type: application/health+json`, and
`Cache-Control: max-age=0` so no cache answers a poll with an old verdict.

```json
{
	"status": "pass",
	"serviceId": "jobs-board",
	"releaseId": "8f3a5c1e-7d2b-4c9a-b0e4-2a6f1d9c3b7e",
	"checks": {
		"database:responseTime": [
			{
				"componentType": "datastore",
				"status": "pass",
				"observedValue": 4,
				"observedUnit": "ms",
				"time": "2026-10-24T12:00:00.000Z"
			}
		]
	}
}
```

Each check is keyed `<name>:responseTime` and records how long its probe took. A check that
did not pass carries an `output` naming the kind of failure (`"error"`, `"timeout"`,
`"HTTP 503"`), so an alert says which dependency broke. The error itself goes to the request's
log and stays out of the public response.

## Probe every binding, read-only

A monitor polls every minute, so a probe only reads: a write per poll would cost money and
leave traffic behind. Pick the cheapest call that still reaches the store.

```typescript {% title="app/initializers/health.ts" %}
health.probe("cache", () => env.CACHE.get("health"), { componentType: "datastore" });

health.probe("uploads", () => env.UPLOADS.head("health"), {
	componentType: "datastore",
});

health.probe("feeds", () => env.FEED.getByName("healthcheck").ping(), {
	componentType: "component",
});
```

- **KV**: `get` of a key nobody writes. A miss resolves to `null`, which passes: reaching the
  namespace is what is checked, and a read costs less than a `list`.
- **R2**: `head` reads metadata only, with no body transfer, and a missing key resolves to
  `null` too. When the app needs one particular object, throw when `head` answers `null`, so
  the check fails while that object is gone.
- **D1**: `SELECT 1` through your `Database`, as above.
- **Durable Objects**: an RPC call on the instance named `healthcheck`, so the probe creates
  at most one extra instance per class, ever. Calling it constructs the class, so a
  constructor that throws fails the check.

The Durable Object needs the method the probe calls:

```typescript {% title="app/models/feed.ts" %}
import { DurableObject } from "cloudflare:workers";

export class Feed extends DurableObject<Env> {
	ping(): void {
		this.ctx.storage.sql.exec("SELECT 1");
	}
}
```

Leave out bindings whose every call has an effect: a queue `send` delivers a message,
`limit()` spends the rate-limit budget it reports on, and an email binding sends mail.

## Probe third-party services

A service a user-facing feature depends on gets a probe too. Prefer the provider's own health
endpoint; without one, the cheapest authenticated read with no side effects also proves your
credential still works. A probe can return `fetch` as it is, since a 2xx `Response` passes
and any other status fails with `"HTTP <status>"`.

```typescript {% title="app/initializers/health.ts" %}
health.probe(
	"payments",
	(_, signal) => fetch("https://api.payments.example.com/healthz", { signal }),
	{
		componentType: "system",
		timeout: 5_000,
		affectedEndpoints: ["/checkout"],
		links: { about: "https://status.payments.example.com" },
	},
);
```

`affectedEndpoints` names the routes that break while the check fails. Hand the probe's
`signal` to `fetch`, so the work stops at the probe's `timeout` (`2_000` milliseconds unless
you set one) instead of running on after the report is sent.

A probe is critical by default: its failure makes the report `fail` and the response `503`.
Register it with `critical: false` when the app keeps doing its job without the dependency,
for example when pages serve a cached copy of what the service returns. Its failure is then
reported as `warn` and the response stays `200`.

## Read another service's report

When a probe's `Response` is itself `application/health+json`, the runner reads the report
and judges the dependency by what it says: a service answering `200` with `"status": "fail"`
fails the check. Outside a probe, for a status page or a monitor of your own, read a report
with `parseHealth`, which validates the body and normalizes every status the format allows to
`pass`, `warn` or `fail`:

```typescript {% title="app/services/dependencies.ts" %}
import { isHealthResponse, parseHealth } from "@sdxc/health";
import { failure, isFailure, success } from "@sdxc/result";

export async function readStatus(url: string) {
	let response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
	if (!isHealthResponse(response)) {
		return success(response.ok ? "pass" : "fail");
	}

	let report = parseHealth(await response.text());
	if (isFailure(report)) return failure(report.error);
	return success(report.data.status);
}
```

`isHealthResponse` checks the `Content-Type`, ignoring parameters and case. `parseHealth`
returns a failed `Result` naming why when the body is not JSON or not a report, so a
malformed answer is something you branch on rather than an exception.

## Test the report

The probes call real bindings, so the test runs in the Workers pool, where KV, R2, D1 and the
Durable Object come from your Worker's configuration. The third-party services stand behind
[MSW](https://mswjs.io), answering as they do while up, and one test makes the payment
provider fail to show that a critical dependency turns the response into a `503`:

```typescript {% title="app/http/controllers/health.workers.test.ts" %}
import type { Health } from "@sdxc/health";

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";

let server = setupServer(
	http.get("https://api.payments.example.com/healthz", () => HttpResponse.json({})),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function check() {
	let response = await createWebRouter().fetch(
		new Request("https://jobs.example.com/health"),
	);
	return { response, report: (await response.json()) as Health.Report };
}

test("passes while every dependency answers", async () => {
	let { response, report } = await check();

	expect(response.status).toBe(200);
	expect(report.status).toBe("pass");
});

test("fails with 503 when the payment provider is down", async () => {
	server.use(
		http.get("https://api.payments.example.com/healthz", () =>
			HttpResponse.json({}, { status: 503 }),
		),
	);

	let { response, report } = await check();

	expect(response.status).toBe(503);
	expect(report.checks?.["payments:responseTime"]?.[0]).toMatchObject({
		status: "fail",
		output: "HTTP 503",
	});
});
```

`onUnhandledRequest: "error"` fails the run when a new probe reaches a service the test does
not answer, so every dependency you add arrives with its handler.

## Where to go next

- [Logs, traces and timings](/docs/operations-and-testing/observability) — the log every
  failed probe is written to.
- [Test Workers apps](/docs/operations-and-testing/testing) — set up the Workers pool the
  test above runs in.
- [`@sdxc/health`](/api/health) — every option and export.
