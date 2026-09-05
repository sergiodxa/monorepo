# @sdxc/logger

One wide event per Worker invocation, attached at the router and the job dispatcher.

## Overview

Cloudflare already writes one log per invocation — the request, the response, timing, the
colo — and correlates every `console` call made during it. What it cannot know is what the
invocation meant: which route matched, which user and team it was for, how many queries it
ran, how it ended. This package records exactly that, once per invocation, as one flat JSON
record: every field a scalar under a dotted key, so each is a filter in the log index, plus
a capped `notes` array for the narrative you read once a query has found the record.

A worker states its configuration once with `createLogger()` and hands it to the two places
every invocation passes through: the router's middleware chain, through `log(logger)`, and
the job dispatcher, through its `logger` option. Anything running inside the invocation —
a service, a package, a job — reaches the same record through `currentLog()`, which is
`AsyncLocalStorage` under `nodejs_compat`, so nothing has to be handed the log to enrich it.

## Usage

### Configure once

```typescript
// bootstrap/logger.ts
import { createLogger } from "@sdxc/logger";
import { env } from "cloudflare:workers";

export const logger = createLogger({
	service: "uptime",
	environment: env.ENVIRONMENT,
	version: env.CF_VERSION_METADATA?.id,
});
```

### Attach at the router

```typescript
import { log } from "@sdxc/logger/middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [log(logger), session(), database()] });

router.get("/teams/:teamId/monitors", async (ctx) => {
	ctx.log.set({ team: { id: ctx.params.teamId } });
	let monitors = await ctx.log.time("db", () => Monitor.list(ctx.database, ctx.params.teamId));
	ctx.log.set({ monitors: { count: monitors.length } });
	return Response.json(monitors);
});
```

The record that request emits:

```jsonc
{
	"service": "uptime",
	"environment": "production",
	"version": "5f2a…",
	"kind": "request",
	"route": "/teams/:teamId/monitors",
	"http.method": "GET",
	"http.status": 200,
	"team.id": "team_…",
	"db.count": 1,
	"db.duration_ms": 31.4,
	"monitors.count": 12,
	"outcome": "ok",
	"duration_ms": 84.2,
}
```

`route` is the pattern, never the path: the middleware substitutes each param's value back
out of the pathname once the handler has run. `http.method` and `http.status` are recorded
alongside it; the URL, headers, and colo are already on Cloudflare's own log.

### Attach at the job dispatcher

```typescript
import { createJobDispatcher } from "@sdxc/jobs";

export const dispatcher = createJobDispatcher({ logger, send, middleware: [database()] });
```

A cron trigger, a queue batch, and every job in the batch each get a log of their own kind,
and a handler reads its own as `ctx.log`.

### Any other entry point

A host with neither a router nor a dispatcher in front of it opens a log directly:

```typescript
export class Tenant extends DurableObject {
	override fetch(request: Request) {
		return logger.open("request", { tenant: { id: this.id } }).run(() => this.#app.fetch(request));
	}

	override alarm() {
		return logger.open("alarm", { tenant: { id: this.id } }).run(() => this.#app.cleanup());
	}
}
```

`run()` binds the log as current for the body, fails it if the body throws, and emits it
once the body settles. A router inside that body finds the log current and joins it, so the
tenant's request produces one record carrying both `tenant.id` and the route.

### From anywhere inside the invocation

```typescript
import { currentLog } from "@sdxc/logger";

export async function readThroughCache(key: string) {
	let hit = await cache.get(key);
	currentLog()?.inc(hit ? "cache.hit" : "cache.miss");
	return hit ?? compute(key);
}
```

`currentLog()` is `undefined` outside an invocation, so the `?.` makes the call free in a
test that opened none.

## API

### `createLogger(options: Logger.Options): Logger`

The worker's configuration. Every log opened through it, or through a `log()` or dispatcher
it was handed to, carries these values.

- `options.service`: The worker's name, the same on every log so a query can group by it.
- `options.environment`: Whatever the bootstrap decides the environment is.
- `options.version`: The deployed version, from the platform's version metadata when the
  worker binds it.
- `options.sample`: A `Sample.Options`. Off unless given: every log is written.
- `options.sink`: Where records go. Defaults to the console; a test collects them instead.

### `Logger`

- `logger.options`: The configuration as given.
- `logger.open(kind, fields?)`: A `Log` carrying the configuration, for an entry point
  nothing else wraps.

### `Log`

One invocation's record. `new Log(options, fields?)` builds one directly, which a test does
to hand a handler a log it can read back; everything else opens one through a `Logger`.

- `log.kind`: `"request" | "cron" | "queue" | "job" | "alarm"`.
- `log.outcome`: `"ok"` until `warn()` or `fail()` says otherwise.
- `log.parent`: The log this one was opened under, when it was opened with `child()`.
- `log.set(fields)`: Merges fields. One level of nesting is accepted and flattened to dotted
  keys, so `{ user: { id } }` is stored as `user.id`. Values are scalars; an `undefined` is
  skipped.
- `log.inc(field, by?)`: Adds to a counter, creating it at zero.
- `log.time(name, fn)`: Runs `fn` and adds to `${name}.count` and `${name}.duration_ms`
  however it returns; rethrows what `fn` threw.
- `log.note(name, fields?)`: A breadcrumb, with its offset in milliseconds from when the
  log opened. Two hundred are kept; past that `notes.dropped` counts the rest.
- `log.warn(name, fields?)`: A breadcrumb that degrades the outcome — recorded and kept,
  without being an alarm.
- `log.fail(error, fields?)`: Sets the outcome to `error` and records `error.type`,
  `error.message`, and — when the error carries them — `error.code` and `error.retriable`.
  The stack is attached when the record is written.
- `log.child(kind, fields?)`: A log of another kind sharing this one's configuration. When
  it emits it adds to this log's `${kind}.count` and degrades this log if it did not end
  `ok`.
- `log.run(fn)`: Binds this log as the current one for `fn`, fails it if `fn` throws, emits
  it once `fn` settles, and returns what `fn` returned.
- `log.emit()`: Writes the record once — `console.log` for `ok`, `console.warn` for
  `degraded`, `console.error` for `error` — or drops it when the sampler says so. A second
  call does nothing.

### `currentLog(): Log | undefined`

The log of the invocation the call runs inside, or `undefined` outside one.

### `log(logger?: Logger)` — from `@sdxc/logger/middleware`

Router middleware publishing the invocation's log as `ctx.log`. When a log is already
current it is joined, so a request served inside a host's or a dispatcher's log produces one
record. Otherwise a `request` log opens — carrying `logger`'s configuration when one is
given — and emits once the response is settled. Either way it records `route` and
`http.method`, and `http.status` when it opened the log itself.

Omitting `logger` is for a package that builds its own router and cannot know the worker's
configuration: its logs carry no `service`, which is the visible sign that the host running
it has not wrapped its entry point with `logger.open().run()`.

### `CurrentLog` — from `@sdxc/logger/middleware`

The context key `log()` publishes under, for code that reads `ctx.get(CurrentLog)` off a
request context whose middleware chain it does not know.

### Types

#### `Sample.Options`

```typescript
interface Options {
	/** Fraction of `ok` logs kept. Defaults to 1: everything. */
	rate?: number;
	/** An `ok` log at least this slow is kept whatever the rate. */
	slowerThanMs?: number;
	/** An `ok` log is kept whatever the rate when this returns true. */
	keep?: (fields: Readonly<Record<string, Log.Value>>) => boolean;
}
```

A `degraded` or `error` log is always written. `rate` applies to `ok` logs only.

#### `Log.Fields`

```typescript
type Value = string | number | boolean | null;
type Fields = Record<string, Value | undefined | Record<string, Value | undefined>>;
```

## Pattern: Shared Namespaces From Middleware

The fields a query starts from — who, for which tenant — are known by the middleware that
resolves them, so set them there and handlers stop repeating it:

```typescript
export function requireUser(): Middleware {
	return async (ctx, next) => {
		let user = await User.fromSession(ctx.session);
		if (!user) return redirect(routes.login.href());
		ctx.log.set({ user: { id: user.id, plan: user.plan } });
		return next();
	};
}
```

`user`, `team`, `tenant`, `db`, `fetch`, `cache`, `error`, `http`, `job`, and `mcp` mean the
same thing in every worker, which is what makes a query across workers possible at all.

## Pattern: Turning Sampling On For One Kind

Workers Logs bills per event written, both Cloudflare's and this one. Width costs nothing,
so the default keeps every log. When a worker's volume approaches the plan's allotment, the
successful job runs are where the events are, and `keep` confines the rate to them:

```typescript
export const logger = createLogger({
	service: "uptime",
	sample: { rate: 0.05, keep: ({ kind }) => kind !== "job" },
});
```

Every request is kept, every failed or retried job is kept, and one in twenty successful
job runs is kept.

## Pattern: Testing What A Handler Records

A sink collects records, and a handler under test reads the log it was handed:

```typescript
import { Log } from "@sdxc/logger";

test("records the team it served", async () => {
	let records: Record<string, unknown>[] = [];
	let log = new Log({ kind: "request", sink: (record) => void records.push(record) });

	await log.run(() => handler(contextWith({ log })));

	expect(records[0]).toMatchObject({ "team.id": "team_1", outcome: "ok" });
});
```

## Related Packages

- [`@sdxc/jobs`](/packages/jobs) - Hands the dispatcher the same `Logger` so a cron trigger,
  a queue batch, and each job run get a log of their own
- [`@sdxc/mcp`](/packages/mcp) - Enriches the request's log with the MCP method and tool

## Tips

1. **Fields for filtering, notes for reading** - if you would ever want to query by it, it
   is a field. A note is for understanding one record after a query found it.
2. **Never put an id in a key** - `set({ team: { id } })` is `team.id`; a key built from a
   value grows the index by one field per value forever.
3. **Leave the request alone** - method, URL, headers, status, and colo are on Cloudflare's
   own log. Record what only the code knows.
4. **`time()` around anything with a duration** - a database call, an outbound fetch, a
   render. The count and the total arrive in the record with no bookkeeping at the call site.
5. **A log with no `service` means a host went unwrapped** - find the Durable Object or
   bare Worker that runs the router and open a log around its entry point.
