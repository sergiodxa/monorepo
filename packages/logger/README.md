# @sdxc/logger

One wide event per Worker invocation, attached at the router and the job dispatcher.

Fields are flat scalars under dotted keys, so every one of them is a filter in the log index.
The narrative lives in a capped `notes` array, read once a query has found the record.

## Installation

```bash
npm add @sdxc/logger
```

It builds on [`remix`](https://www.npmjs.com/package/remix) v3, installed alongside it, and
the current-log accessor is `AsyncLocalStorage`, so a Worker enables `nodejs_compat`.

Two entry points:

- `@sdxc/logger` — `createLogger`, `Log`, `currentLog`, and the `Logger`/`Sample` types. No
  router dependency.
- `@sdxc/logger/middleware` — the `log()` middleware for a `remix/router` router, and the
  `CurrentLog` key it publishes under.

## Usage

### Configure once, attach at the router

```typescript
import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware";
import { env } from "cloudflare:workers";
import { createRouter } from "remix/router";

export const logger = createLogger({ service: "api", version: env.CF_VERSION_METADATA?.id });

let router = createRouter({ middleware: [log(logger)] });

router.get("/teams/:teamId/members", async (ctx) => {
	ctx.log.set({ team: { id: ctx.params.teamId } });
	let members = await ctx.log.time("db", () => listMembers(ctx.params.teamId));
	ctx.log.set({ members: { count: members.length } });
	return Response.json(members);
});
```

That request emits one record, every field of it a filter:

```jsonc
{
	"service": "api",
	"kind": "request",
	"route": "/teams/:teamId/members",
	"http.method": "GET",
	"http.status": 200,
	"team.id": "team_…",
	"db.count": 1,
	"db.duration_ms": 31.4,
	"members.count": 12,
	"outcome": "ok",
	"duration_ms": 84.2,
}
```

`route` is the pattern, never the path: each param's value is substituted back out of the
pathname once the handler ran. The URL, the headers and the colo are on the platform's own log.

### Any other entry point

A queue consumer, a scheduled handler or a Durable Object opens its log directly:

```typescript
async function consume(tasks: Task[]) {
	let batch = logger.open("queue", { queue: { size: tasks.length } });

	await batch.run(async () => {
		for (let task of tasks) {
			await batch.child("job", { job: { name: task.name } }).run(() => handle(task));
		}
	});
}
```

Each child emits a record of its own and adds to the batch's `job.count`. A router inside
that body joins the log already current, so one record carries both the entry point's fields
and the route.

### From anywhere inside the invocation

```typescript
import { currentLog } from "@sdxc/logger";

export async function readThrough(key: string) {
	let hit = await cache.get(key);
	currentLog()?.inc(hit ? "cache.hit" : "cache.miss");
	return hit ?? compute(key);
}
```

`currentLog()` is `undefined` outside an invocation, so `?.` costs nothing where none is open.

## API

### `createLogger(options: Logger.Options): Logger`

The worker's configuration, carried by every log opened through it or through a `log()` it
was handed to.

- `options.service`: The worker's name, the same on every log so a query can group by it.
- `options.environment`: Whatever the bootstrap decides the environment is.
- `options.version`: The deployed version, from the platform's version metadata.
- `options.sample`: A `Sample.Options`. Off unless given: every log is written.
- `options.sink`: Where records go. Defaults to the console; a test collects them instead.

### `Logger`

`logger.options` is the configuration as given, and `logger.open(kind, fields?)` returns a
`Log` carrying it, for an entry point nothing else wraps.

### `Log`

One invocation's record. `new Log(options, fields?)` builds one directly — a `Logger.Options`
plus the `kind`, which a test uses to hand a handler a log and read it back through its own
sink; everything else opens one through a `Logger`.

- `log.kind`, `log.outcome`, `log.parent`: the invocation's kind, `"ok"` until `warn()` or
  `fail()` says otherwise, and the log `child()` opened this one from.
- `log.set(fields)`: Merges fields. One level of nesting flattens to dotted keys, so
  `{ user: { id } }` is stored as `user.id`; anything deeper than a scalar is stored as its
  JSON, and an `undefined` is skipped.
- `log.inc(field, by?)`: Adds to a counter, creating it at zero; `by` defaults to 1.
  `log.time(name, fn)` awaits `fn` and adds to `${name}.count` and `${name}.duration_ms`
  however it returns, rethrowing what `fn` threw.
- `log.note(name, fields?)`: A breadcrumb, with its offset in milliseconds from when the log
  opened. Two hundred are kept; past that `notes.dropped` counts the rest. `log.warn()` takes
  the same arguments and degrades the outcome — recorded and kept, without being an alarm.
- `log.fail(error, fields?)`: Sets the outcome to `error` and records `error.type`,
  `error.message`, and — when the error carries them — `error.code` and `error.retriable`. The
  stack is attached when the record is written.
- `log.child(kind, fields?)`: A log of another kind sharing this one's configuration. On emit
  it adds to this log's `${kind}.count` and degrades this log if it did not end `ok`.
- `log.run(fn)`: Binds this log as the current one for `fn`, fails it if `fn` throws, emits it
  once `fn` settles, and returns what `fn` returned.
- `log.emit()`: Writes the record once — `console.log` for `ok`, `console.warn` for
  `degraded`, `console.error` for `error` — or drops it when the sampler says so. A second call
  does nothing, so emitting in a `finally` is safe.

### `currentLog(): Log | undefined`

The log of the invocation the call runs inside, or `undefined` outside one.

### `log(logger?: Logger)` — from `@sdxc/logger/middleware`

Router middleware publishing the invocation's log as `ctx.log`, which it declares on
`remix/router`'s request context. A log already current is joined, so a request served inside
another entry point's log produces one record; otherwise a `request` log opens, carrying
`logger`'s configuration when one is given, and emits once the response is settled. Either way
it records `route` and `http.method`, and `http.status` when it opened the log itself. Omitted,
`logger` leaves the log without a `service`, the visible sign that the host running the router
has not wrapped its entry point with `logger.open().run()`.

### `CurrentLog` — from `@sdxc/logger/middleware`

The context key `log()` publishes under, read as `ctx.get(CurrentLog)` by code that does not
know the middleware chain in front of it.

### Types

`Log.Kind` is `"request" | "cron" | "queue" | "job" | "alarm"` and `Log.Outcome` is
`"ok" | "degraded" | "error"`. A `Log.Value` is `string | number | boolean | null`, `Log.Fields`
is a record of those accepting one level of nesting, `Log.Sink` is
`(record, outcome) => void`, and a `Log.Note` carries `at`, `level`, `name` and its own scalars.

```typescript
namespace Sample {
	interface Options {
		/** Fraction of `ok` logs kept. Defaults to 1: everything. */
		rate?: number;
		/** An `ok` log at least this slow is kept whatever the rate. */
		slowerThanMs?: number;
		/** An `ok` log is kept whatever the rate when this returns true. */
		keep?: (fields: Readonly<Record<string, Log.Value>>) => boolean;
	}
}
```

A `degraded` or `error` log is always written; `rate` applies to `ok` logs only, and both
exemptions win over it.

## Pattern: Shared Namespaces From Middleware

The fields a query starts from — who, for which tenant — are known by the middleware that
resolves them, so set them there and handlers stop repeating it:

```typescript
import type { Middleware } from "remix/router";

export function requireUser(): Middleware {
	return async (ctx, next) => {
		let user = await userFromSession(ctx.request);
		if (!user) return new Response(null, { status: 401 });
		ctx.log.set({ user: { id: user.id, plan: user.plan } });
		return next();
	};
}
```

Keep a namespace meaning the same thing in every worker — `user`, `team`, `tenant`, `db`,
`fetch`, `cache`, `error`, `http`, `job` — which is what makes a query across workers possible
at all. Never build a key out of a value: `set({ team: { id } })` is `team.id`, while a key per
id grows the index by one field per value forever.

## Pattern: Turning Sampling On For One Kind

Logging bills per event written, and width costs nothing, so the default keeps every log. When
volume approaches the allotment, `keep` confines the rate to the successful background runs,
where the events are:

```typescript
export const logger = createLogger({
	service: "api",
	sample: { rate: 0.05, keep: ({ kind }) => kind !== "job" },
});
```

Every request is kept, every failed or retried job is kept, and one in twenty successful job
runs is kept.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written
`YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out
per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/logger": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later
release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
