---
name: sdxc-logger
description: "@sdxc/logger emits one wide event per invocation — flat scalar fields under dotted keys, plus a capped notes array — with createLogger, Log, currentLog and a log() middleware for remix/router. Use when adding structured logging to a worker, replacing scattered console.log calls, recording timings and counters on a request or job, or sampling successful logs by kind."
---

# @sdxc/logger

One wide event per invocation, attached at the router or at any other entry point. Fields are flat scalars under dotted keys, so every one of them is a filter in the log index; the narrative lives in a capped `notes` array, read once a query has found the record. The surface is `createLogger()` for the worker's configuration, `Log` for one invocation's record (`set`, `inc`, `time`, `note`, `warn`, `fail`, `child`, `run`, `emit`), `currentLog()` for code deep inside an invocation, and a `log()` middleware that publishes the log as `ctx.log`. The current-log accessor is `AsyncLocalStorage`, so a Worker enables `nodejs_compat`.

Full API, options and examples: [packages/logger/README.md](packages/logger/README.md)

## When to reach for it

- A worker logs with `console.log` and there is no way to ask "which requests for this tenant were slow yesterday".
- A request, queue batch or scheduled run should produce exactly one queryable record instead of a line per step.
- A handler wants to attach a timing or a counter (`db.duration_ms`, `cache.hit`) without threading a logger through every function.
- Log volume is approaching the allotment and successful background runs should be sampled while failures are always kept.
- A test needs to read back what a handler recorded, by handing it a `Log` with its own sink.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/logger": "workspace:*" } }
```

```ts
import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware";
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

An entry point nothing else wraps opens its log directly:

```ts
let batch = logger.open("queue", { queue: { size: tasks.length } });

await batch.run(async () => {
	for (let task of tasks) {
		await batch.child("job", { job: { name: task.name } }).run(() => handle(task));
	}
});
```

### Entry points

- `@sdxc/logger` — `createLogger`, `Log`, `currentLog`, and the `Logger` / `Sample` types. No router dependency.
- `@sdxc/logger/middleware` — the `log()` middleware for a `remix/router` router, and the `CurrentLog` key it publishes under.

## Suggestions

- Set the fields a query starts from — who, which tenant — in the middleware that resolves them, so handlers stop repeating it.
- Never build a key out of a value: `set({ team: { id } })` stores `team.id`, while a key per id grows the index by one field per value forever. Keep namespaces (`user`, `team`, `db`, `fetch`, `cache`, `error`, `http`, `job`) meaning the same thing everywhere, which is what makes a cross-worker query possible at all.
- `currentLog()` is `undefined` outside an invocation, so `currentLog()?.inc(…)` costs nothing in a library that may run without one.
- A log with no `service` is the visible sign the host running the router never wrapped its entry point with `logger.open().run()`.
- `emit()` writes once, so calling it in a `finally` is safe, and a `degraded` or `error` log is always written — `sample.rate` applies to `ok` logs only, with `slowerThanMs` and `keep` as exemptions over it.
- `log.set` flattens one level of nesting to dotted keys; anything deeper than a scalar is stored as its JSON and `undefined` is skipped.

## Related

- `@sdxc/jobs` — its dispatcher opens a `cron`, `queue` and `job` log through this package's `Logger`; skill `sdxc-jobs`
