---
name: sdxc-cloudflare-mocks
description: "@sdxc/cloudflare-mocks gives tests in-memory, behavior-accurate Cloudflare binding mocks — `createKVNamespace`, `createD1Database`, `createSqlStorage`, `createR2Bucket`, `createQueue`, `createDurableObjectState`, `createExecutionContext`, `createEnv` — where D1 and SqlStorage run real SQL. Use when unit-testing a Worker handler, a repository's generated SQL, a queue producer and consumer, a Durable Object, or `waitUntil` work without wrangler."
---

# @sdxc/cloudflare-mocks

Storage bindings really store, and SQL bindings really run SQL through the runtime's own SQLite, so a malformed statement or a constraint violation fails in the test rather than in production. Every factory returns an isolated instance typed against the matching `@cloudflare/workers-types` interface, so a mock that drifts from the platform's shape fails typecheck. `createEnv` assembles them into an `Env`, and `createExecutionContext().settled()` awaits deferred work. Install it as a dev dependency.

Full API, options and examples: [packages/cloudflare-mocks/README.md](packages/cloudflare-mocks/README.md)

## When to reach for it

- Testing a Worker `fetch` handler that reads KV, D1, R2 or a queue, without a wrangler runtime.
- Covering a repository's generated SQL with ordinary unit tests, where a bad statement actually fails.
- Driving a queue consumer over what a producer sent, and asserting on retries and attempts.
- Exercising a Durable Object by construction, including its `alarm()` handler and SQL storage.
- Asserting that `waitUntil` background work finished before the test ends.

## Using it

Declare the workspace dev dependency, then import:

```json
{ "devDependencies": { "@sdxc/cloudflare-mocks": "workspace:*" } }
```

```ts
import { createD1Database, createEnv, createKVNamespace, createQueue } from "@sdxc/cloudflare-mocks";

let env = createEnv<Env>({
	DB: createD1Database(),
	CACHE: createKVNamespace(),
	QUEUE: createQueue(),
});

env.MAILER; // throws: env.MAILER was not provided to createEnv()
```

### Entry points

- `@sdxc/cloudflare-mocks` — every binding factory, its options type and its mock type
- `@sdxc/cloudflare-mocks/sqlite` — the narrow SQLite interface behind the SQL bindings, resolved to Bun's or Node's built-in module through the `bun` export condition

## Suggestions

- Call a factory in `beforeEach` for isolated state; when a binding must live at module scope because the code under test captured `env` on import, call its `reset()` in `beforeEach` instead — every stateful factory has one.
- `createEnv` throws by name for a binding that was not supplied, so a forgotten binding fails at the access that needed it rather than later as `undefined is not a function`. Bindings are copied by property descriptor, so a getter is re-read on every access and a test can swap what it resolves to.
- Delivery is manual: a queue holds messages until `consume()` is called, `setAlarm` records a time and the test calls the object's `alarm()` itself, and email is recorded rather than sent — which is what makes timing and content assertable.
- Read the README's permissiveness section before treating a green test as a production guarantee: D1 runs local SQLite, so unsupported SQL and oversized results pass; D1/KV/R2 size, time and consistency limits are unenforced; `idFromName` yields an id whose string form is the name; and `ExecutionContext.exports`/`tracing`, `DurableObjectState.exports`/`facets`, Hyperdrive, Vectorize, Workers AI and Browser Rendering have no mock at all.
- Pair `createDurableObjectNamespace` with `createDurableObjectState` — a namespace only routes, and the object behind a name is whatever the caller supplied.

## Related

- `@sdxc/data-table-d1` — the D1-backed driver most often tested against `createD1Database()`; skill `sdxc-data-table-d1`
- `@sdxc/data-table-sqlstorage` — the Durable Object driver tested against `createSqlStorage()`; skill `sdxc-data-table-sqlstorage`
- `@sdxc/cache` — its KV adapter is exercised against `createKVNamespace()`; skill `sdxc-cache`
