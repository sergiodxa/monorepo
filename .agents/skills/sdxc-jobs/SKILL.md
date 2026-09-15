---
name: sdxc-jobs
description: "@sdxc/jobs declares background jobs in one map and runs them through a dispatcher over a pluggable queue backend, with cron scheduling, per-run logging, timeouts, retries and a dead-letter path. Use when wiring a queue consumer or scheduled handler, declaring jobs with job()/jobs(), writing a handler with createJobHandler, enqueuing with dispatcher.enqueue or messageBody(), or testing a handler with createJobContext."
---

# @sdxc/jobs

Background jobs declared in one map, run by one dispatcher, over a queue backend of your choosing. A job is a declaration — name, payload schema, cron, `meta` — with no handler attached, so importing the map costs only its schemas; the handler lives in its own module and is loaded on the message that needs it. The public surface is `jobs()` and `job()` for the map, `createJobHandler()` for a handler, `createJobDispatcher()` for the runtime, and `createJobContext()` for tests. Adapters ship for Cloudflare Queues and for memory; context keys come from `remix/router`, so one key serves an HTTP middleware and a job middleware alike.

Full API, options and examples: [packages/jobs/README.md](packages/jobs/README.md)

## When to reach for it

- A worker needs to do work outside the request: send, recompute, clean up, fan out over many rows.
- Cron triggers currently run work inline in the `scheduled` handler, with no retries, timeout or per-run record.
- Handlers are spread across ad-hoc queue consumers, each parsing its own message body and deciding its own retry policy.
- A job needs to say "retry in five minutes", "this input will never be valid", or "I timed out" and have the delivery settled accordingly.
- You need one queryable record per job run — fields, notes, durations, outcome — rather than scattered `console.log` calls.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/jobs": "workspace:*" } }
```

```ts
import { job, jobs } from "@sdxc/jobs";
import * as s from "remix/data-schema";

export default jobs({
	clean: job({ cron: "0 0 * * *" }),
	checkHttp: job({ input: s.object({ monitorId: s.string() }) }),
});
```

```ts
import { createJobDispatcher } from "@sdxc/jobs";
import * as cloudflare from "@sdxc/jobs/cloudflare";

export const dispatcher = createJobDispatcher({
	logger,
	queue: cloudflare.queue(() => env.QUEUE),
	timeout: "5 minutes",
});

dispatcher.map(jobs.checkHttp, () => import("./jobs/check-http"));
```

### Entry points

- `@sdxc/jobs` — `jobs()`, `job()`, `createJobHandler()`, `createJobDispatcher()`, `createJobContext()`, `messageBody()`, and the `Job` ending classes.
- `@sdxc/jobs/cloudflare` — the Cloudflare Queues adapter: `queue()` and `worker()` for the `queue` and `scheduled` exports.
- `@sdxc/jobs/memory` — an in-process queue for tests and for anything running without a platform behind it.
- `@sdxc/jobs/queue` — the `JobQueue` contract, for writing a third adapter.
- `@sdxc/jobs/conformance` — the Vitest suite every adapter is expected to pass.
- `@sdxc/jobs/errors` — each ending class individually, which is what a type position needs.
- `@sdxc/jobs/uptime` — `createUptimeReporter()`, a cron-monitor ping a dispatcher's `onEnd` calls; wired to nothing by default.

## Suggestions

- Map a loader, not a handler: `() => import(…)` keeps job code out of the request path's module graph. For the same reason, a controller that enqueues should build `messageBody()` and send it through the app's own queue helper rather than importing the dispatcher.
- Treat a map key as a wire contract. The key is the address a message carries, and messages enqueued by the previous deploy are still in flight when the next one starts consuming.
- A cron on a job must be spelled exactly as the matching trigger in `wrangler.jsonc`; `job()` validates the expression but cannot know the platform config, so assert `dispatcher.crons` against it in a test.
- Never swallow an ending: a `catch` around a `ctx.retry()` / `ctx.exit()` call catches the thrown ending too. Re-throw with `if (error instanceof Job.Ending) throw error;`, and write `return ctx.retry(…)` so the compiler treats the lines below as unreachable.
- Pass `ctx.signal` to every fetch — it is what makes the dispatcher's timeout cancel work rather than merely stop waiting for it.
- `@cloudflare/workers-types`, `remix` and `vitest` are optional peers, needed only by the Cloudflare adapter, the typed context key store, and the conformance suite respectively.

## Related

- `@sdxc/logger` — the `Log` each run records into and the `createLogger()` configuration the dispatcher's records carry; skill `sdxc-logger`
- `@sdxc/cron` — parses the cron a job declares and rejects one the platform would not accept; skill `sdxc-cron`
- `@sdxc/duration` — the duration strings a retry delay and a timeout take; skill `sdxc-duration`
