# @sdxc/health

Dependency health checks that answer in the `application/health+json` format, and a reader for
reports other services send.

## Installation

```sh
npm add @sdxc/health
```

Validation runs on `remix/data-schema` from [`remix`](https://www.npmjs.com/package/remix),
through [`@sdxc/json-schema`](https://www.npmjs.com/package/@sdxc/json-schema).

## Usage

### Answer a health route

Register one probe per dependency, then answer the route with `respond`. Every probe runs in
parallel; the report is `200` while nothing fails and `503` once a critical probe does.

```typescript
import { HealthCheck } from "@sdxc/health";

let health = new HealthCheck<{ db: Database }>({ serviceId: "shop", timeout: 2_000 });

health.probe("database", (ctx) => ctx.db.exec("SELECT 1"), { componentType: "datastore" });
health.probe("cache", () => env.CACHE.get("health"));

export default createAction(routes.health, (ctx) => health.respond(ctx));
```

```json
{
	"status": "pass",
	"serviceId": "shop",
	"checks": {
		"database:responseTime": [
			{
				"componentType": "datastore",
				"status": "pass",
				"observedValue": 4,
				"observedUnit": "ms",
				"time": "2026-10-24T12:00:00.000Z"
			}
		],
		"cache:responseTime": [
			{
				"status": "pass",
				"observedValue": 9,
				"observedUnit": "ms",
				"time": "2026-10-24T12:00:00.000Z"
			}
		]
	}
}
```

### Probe a third-party service

A probe receives an `AbortSignal` that aborts at its timeout. A `Response` passes on 2xx, so a
probe can return `fetch` as is; `critical: false` turns its failure into a `warn`.

```typescript
health.probe(
	"payments",
	(ctx, signal) =>
		fetch("https://api.example.com/healthz", {
			signal: AbortSignal.any([ctx.request.signal, signal]),
		}),
	{ critical: false, timeout: 5_000, affectedEndpoints: ["/checkout"] },
);
```

### Read another service's report

```typescript
import { isHealthResponse, parseHealth } from "@sdxc/health";
import { isSuccess } from "@sdxc/result";

let response = await fetch("https://api.example.com/health");
if (isHealthResponse(response)) {
	let report = parseHealth(await response.text());
	if (isSuccess(report)) report.data.status; // "pass" | "warn" | "fail"
}
```

### Validate with the JSON Schema

```typescript
import * as s from "@sdxc/json-schema";
import HEALTH_REPORT from "@sdxc/health/schema";

let report = s.parse(HEALTH_REPORT, json);
s.toJSONSchema(HEALTH_REPORT); // the document, for an OpenAPI response body
```

The same document ships as `@sdxc/health/schema.json` and is published at
`https://sdxc.dev/schemas/health.json`.

## API

### `new HealthCheck<Context>(options?)`

Options, all optional: `timeout` (ms per probe, default `2000`), the report's `serviceId`,
`description`, `version`, `releaseId`, `notes` and `links`, `maxAge` (seconds sent as
`Cache-Control: max-age`, default `0`), `failStatus` (the status of a `fail`, default `503`)
and `exposeErrors` (put error messages in `output`, default `false`). Out-of-range values
throw a `RangeError`.

### `health.probe(name, probe, options?)`

Registers `probe(context, signal)` as the check `<name>:responseTime`, replacing one of the same
name; a name with a colon throws a `RangeError`. It passes when it resolves, and fails when it
rejects, times out, or resolves to a non-2xx `Response` or a failed `@sdxc/result`. A response
that is itself a health report is judged by its status too: `fail` fails, `warn` warns. Options:
`critical` (default `true`), `timeout`, `componentType`, `componentId`, `links` and
`affectedEndpoints`. Returns the instance.

### `health.check(context)` and `health.respond(context)`

`check` resolves to the report and never rejects; every check not passing is logged on the
current [`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger) log with its error.
`respond` is that report as an `application/health+json` response.

### `parseHealth(body: string): Result<Health.Report, Error>`

Validates a report's JSON text and normalizes every status (`ok`, `up`, `error`, `down`, any
case) to `pass`, `warn` or `fail`. Fails on a body that is not JSON or not a report.

### `isHealthResponse(response: Response): boolean`

Whether the `Content-Type` is `application/health+json`, ignoring parameters and case.

### `HEALTH_MEDIA_TYPE`

`"application/health+json"`.

### `@sdxc/health/schema` and `@sdxc/health/schema.json`

The format as an `@sdxc/json-schema` schema (default export), and as a static JSON Schema
2020-12 document. Both accept everything the format allows, from any service.

### Types

`Health.Report`, `Health.Check`, `Health.Status`, `Health.Probe`, `Health.Options` and
`Health.ProbeOptions`.

## Pattern: Fail When a Dependency Reports Itself Unhealthy

A service that also serves this format is judged by what it reports, not only by its status
code, so a dependency answering `200` with `fail` fails this check too.

```typescript
import { HealthCheck } from "@sdxc/health";

let health = new HealthCheck({ serviceId: "storefront" });

health.probe("identity", (_, signal) => fetch("https://id.example.com/health", { signal }), {
	componentType: "system",
});

let report = await health.check();
report.checks?.["identity:responseTime"]?.[0]?.output; // "reported fail" while identity is down
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/health": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
