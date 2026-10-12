# @sdxc/logger

One wide event per Worker invocation, attached at the router and the job dispatcher.

Each invocation builds one record while it runs and writes it once when it settles. Fields are
flat scalars under dotted keys, so every one of them is a filter in the log index; the narrative
lives in a capped `notes` array, read once a query has found the record.

## Installation

```sh
npm add @sdxc/logger
```

The `@sdxc/logger/middleware` entry point needs [`remix`](https://www.npmjs.com/package/remix)
v3 installed alongside it. The current log lives in `AsyncLocalStorage`, so the Worker enables
the `nodejs_compat` compatibility flag.

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

That request writes one record:

```jsonc
{
	"service": "api",
	"version": "…",
	"kind": "request",
	"team.id": "team_…",
	"db.count": 1,
	"db.duration_ms": 31.4,
	"members.count": 12,
	"http.status": 200,
	"route": "/teams/:teamId/members",
	"http.method": "GET",
	"outcome": "ok",
	"duration_ms": 84.2,
}
```

`route` is the pattern, with each param's value substituted back out of the pathname, so a
query groups by route. The URL, headers and colo stay on the platform's own log.

### Record what the work learned

```typescript
router.post("/invoices/:id/charge", async (ctx) => {
	ctx.log.note("charge.start", { attempt: 1 });
	ctx.log.inc("charge.attempts");

	let cached = await readCache(ctx.params.id);
	if (cached === null) ctx.log.warn("cache.unavailable", { key: ctx.params.id });

	try {
		await chargeInvoice(ctx.params.id);
	} catch (error) {
		ctx.log.fail(error, { invoice: { id: ctx.params.id } });
		return new Response(null, { status: 502 });
	}

	return new Response(null, { status: 204 });
});
```

`set` merges fields, `inc` adds to a counter, and `time` adds to `<name>.count` and
`<name>.duration_ms`. `note` leaves a breadcrumb; `warn` leaves one and marks the record
`degraded`; `fail` marks it `error` and records `error.type`, `error.message` and the stack. A
handler that throws is failed for you.

### Enrich from anywhere inside the invocation

```typescript
import { currentLog } from "@sdxc/logger";

export async function readThrough(key: string) {
	let hit = await cache.get(key);
	currentLog()?.inc(hit ? "cache.hit" : "cache.miss");
	return hit ?? compute(key);
}
```

`currentLog()` answers `undefined` outside an invocation, so `?.` makes the call free where no
log is open.

### Open a log for any other entry point

A queue consumer, a scheduled handler or a Durable Object opens its log through the logger, and
`run()` makes it current, fails it on a throw and writes it once the body settles:

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

Each child writes a record of its own, adds to the batch's `job.count`, and degrades the batch
when it does not end `ok`. A router called inside `run()` joins the current log, so one record
carries both the entry point's fields and the route.

## API

### `createLogger(options: Logger.Options): Logger`

The worker's logging configuration, carried by every log opened through it. A `keep` condition
compiles here, once.

- `options.service`: The worker's name, on every record so a query can group by it.
- `options.environment`: The environment name, on every record when given.
- `options.version`: The deployed version, usually from the platform's version metadata.
- `options.sample`: A `Sample.Options`. Omitted, every log is written.
- `options.sink`: `(record, outcome) => void` receiving each written record. Defaults to the
  console.

### `Logger`

`logger.options` is the configuration as given; `logger.open(kind, fields?)` returns a new `Log`
carrying it.

### `Log`

One invocation's record. Every mutating method returns the log, so calls chain.

#### `new Log(options: Log.Options, fields?: Log.Fields)`

Builds a log directly from a `kind` plus the same fields `createLogger` takes. A test uses it to
collect records through its own `sink`.

#### `log.kind`, `log.outcome`, `log.parent`

The invocation's kind; `"ok"` until `warn()` or `fail()` changes it; the log `child()` opened
this one from.

#### `log.set(fields: Log.Fields): this`

Merges fields. One level of nesting flattens to dotted keys (`{ user: { id } }` becomes
`user.id`), anything deeper is stored as its JSON, and `undefined` values are skipped.

#### `log.inc(field: string, by?: number): this`

Adds `by` (default 1) to a counter, starting it at zero.

#### `log.time<T>(name: string, fn: () => T | Promise<T>): Promise<T>`

Awaits `fn` and adds to `${name}.count` and `${name}.duration_ms` whether it returns or throws,
rethrowing what it threw.

#### `log.note(name: string, fields?): this` and `log.warn(name: string, fields?): this`

Add a breadcrumb with its offset in milliseconds from when the log opened. `warn` also degrades
the outcome. A log keeps 200 notes and counts the rest in `notes.dropped`.

#### `log.fail(error: unknown, fields?: Log.Fields): this`

Sets the outcome to `error` and records `error.type`, `error.message`, and `error.code` and
`error.retriable` when the error carries them. The stack is attached when the record is written.

#### `log.child(kind: Log.Kind, fields?: Log.Fields): Log`

A log of another kind sharing this one's configuration. When it is written it adds to this
log's `${kind}.count` and degrades this log unless it ended `ok`.

#### `log.run<T>(fn: (log) => T | Promise<T>): Promise<T>`

Binds the log as current for `fn`, fails it if `fn` throws (rethrowing), writes it once `fn`
settles, and returns what `fn` returned.

#### `log.emit(): void`

Writes the record once, or drops it when the sampler says so. The console level follows the
outcome: `log` for `ok`, `warn` for `degraded`, `error` for `error`. Later calls do nothing.

### `currentLog(): Log | undefined`

The log of the invocation the call runs inside, or `undefined` outside one.

### `log(logger?: Logger)` from `@sdxc/logger/middleware`

Router middleware publishing the invocation's log as `ctx.log`. It joins the current log when
one is open; otherwise it opens a `request` log with `logger`'s configuration, records
`http.status`, and writes it once the response settles. Either way it records `route` and
`http.method`. Without a `logger` the record carries no `service`.

### `CurrentLog` from `@sdxc/logger/middleware`

The context key `log()` publishes under, read as `ctx.get(CurrentLog)` by code that receives a
context without knowing its middleware.

### Types

- `Log.Kind`: `"request" | "cron" | "queue" | "job" | "alarm"`.
- `Log.Outcome`: `"ok" | "degraded" | "error"`.
- `Log.Value`: `string | number | boolean | null`.
- `Log.Fields`: a record of values, or of one level of nested values.
- `Log.Note`: a breadcrumb with `at`, `level` (`"info" | "warn" | "error"`), `name` and its own
  values.
- `Log.Sink`: `(record: Readonly<Record<string, unknown>>, outcome: Log.Outcome) => void`.
- `Log.Options`: `Logger.Options` plus `kind`, with `service` optional.
- `Logger.Options`: the options of `createLogger`.
- `Sample.Options`: `rate` (fraction of `ok` logs kept, default 1), `slowerThanMs` (an `ok` log
  at least this slow is kept) and `keep` (an `ok` log is kept when it holds). `degraded` and
  `error` logs are always written, and both exemptions win over the rate.
- `Sample.Predicate`: `(fields) => boolean` over the record's flattened fields, `kind` included.
- `Sample.Condition`: the same test as data, in the
  [`@sdxc/expression`](https://www.npmjs.com/package/@sdxc/expression) language. A dotted field
  reads a namespaced value, so `tenant.id` matches `set({ tenant: { id } })`. A condition that
  does not compile keeps every log.

## Pattern: Shared Namespaces From Middleware

The fields a query starts from are known by the middleware that resolves them, so set them
there once:

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

Keep each namespace meaning the same thing in every worker (`user`, `team`, `tenant`, `db`,
`cache`, `http`, `job`, `error`) so one query spans them all. Put values in fields, never in
keys: `set({ team: { id } })` adds one field, while a key per id adds one per value.

## Pattern: Logging Jobs Through the Dispatcher

[`@sdxc/jobs`](https://www.npmjs.com/package/@sdxc/jobs) takes the same logger, so cron ticks,
queue batches and each job write records with the worker's `service` and `version`:

```typescript
import { createJobDispatcher } from "@sdxc/jobs";
import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware";
import { env } from "cloudflare:workers";
import { createRouter } from "remix/router";

export const logger = createLogger({ service: "api", version: env.CF_VERSION_METADATA?.id });

export const router = createRouter({ middleware: [log(logger)] });
export const dispatcher = createJobDispatcher({ logger });
```

Inside a job handler, `ctx.log` and `currentLog()` read the job's own log.

## Pattern: A Durable Object Alarm

An entry point no router or dispatcher wraps opens its log with `logger.open()`:

```typescript
import { createLogger } from "@sdxc/logger";
import { DurableObject } from "cloudflare:workers";

let logger = createLogger({ service: "sessions" });

export class SessionStore extends DurableObject {
	async alarm() {
		await logger.open("alarm", { store: { id: this.ctx.id.toString() } }).run(async (log) => {
			let removed = await log.time("storage", () => this.removeExpired());
			log.set({ sessions: { removed } });
		});
	}

	async removeExpired(): Promise<number> {
		return 0;
	}
}
```

## Pattern: Sampling One Kind

Every log is written by default. When volume grows, `keep` confines the rate to the successful
background runs where the volume is:

```typescript
import { createLogger } from "@sdxc/logger";

export const logger = createLogger({
	service: "api",
	sample: { rate: 0.05, slowerThanMs: 2000, keep: ({ kind }) => kind !== "job" },
});
```

Every request is kept, every failed or retried job is kept, every job slower than two seconds
is kept, and one in twenty other successful jobs is kept. The same exemption can come from
configuration as a condition:

```typescript
import { createLogger } from "@sdxc/logger";

export const logger = createLogger({
	service: "api",
	sample: {
		rate: 0.05,
		keep: {
			op: "any",
			of: [
				{ op: "ne", field: "kind", value: "job" },
				{ op: "eq", field: "tenant.plan", value: "enterprise" },
			],
		},
	},
});
```

## Pattern: Asserting on Records in a Test

A `Log` with its own `sink` collects records instead of printing them, and a router called
inside its `run()` joins it:

```typescript
import { Log } from "@sdxc/logger";
import { expect, test } from "vitest";

test("records the team", async () => {
	let records: Array<Readonly<Record<string, unknown>>> = [];
	let log = new Log({ kind: "request", sink: (record) => records.push(record) });

	await log.run(() => router.fetch(new Request("https://api.example.com/teams/t1/members")));

	expect(records[0]).toMatchObject({
		route: "/teams/:teamId/members",
		"team.id": "t1",
		outcome: "ok",
	});
});
```

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
