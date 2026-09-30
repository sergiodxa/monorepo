---
title: Test Workers apps
description: Vitest through Vite+, real bindings in the Workers pool, in-memory mocks, MSW, and executable specs against a running app.
section:
    title: Operations & testing
    order: 8
order: 3
lastUpdated: 2026-09-29
---

A Remix v3 app on Workers has three kinds of behavior worth testing: what the router answers,
what it does to its bindings, and what it sends to the outside world. This guide sets up a
test suite that covers all three without a hand-written fake in sight. Vitest runs through
Vite+ (`vp test`), tests that need a real binding run inside workerd,
[`@sdxc/cloudflare-mocks`](/api/cloudflare-mocks) supplies in-memory bindings that really
store and really run SQL, MSW answers outbound HTTP, and the memory adapters of
[`@sdxc/mail`](/api/mail) and [`@sdxc/jobs`](/api/jobs) record what the app sent. On top,
[`@sdxc/spec`](/api/spec) runs executable `.spec` suites against the app as a client sees it.

```bash
npm add -D vite-plus vitest @cloudflare/vitest-pool-workers msw
npm add -D @sdxc/cloudflare-mocks @sdxc/spec
```

## Configure two projects

Most tests run fastest on Node threads. A few need Cloudflare's own implementation of a
binding, because the thing being asserted is a guarantee only the platform can confirm: that
a KV entry written with a TTL is found again, or that a query D1 would reject fails. Split
them by file name and give each group its own project.

```typescript {% title="vite.config.ts" %}
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vite-plus";
import { defaultExclude } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			{
				resolve: { tsconfigPaths: true },
				test: {
					name: "unit",
					include: ["app/**/*.test.ts?(x)"],
					exclude: [...defaultExclude, "**/*.workers.test.ts?(x)"],
					pool: "threads",
				},
			},
			{
				plugins: [
					cloudflareTest({
						wrangler: { configPath: "./wrangler.jsonc" },
						remoteBindings: false,
					}),
				],
				resolve: { tsconfigPaths: true },
				test: { name: "workers", include: ["app/**/*.workers.test.ts?(x)"] },
			},
		],
	},
});
```

`exclude` spreads Vitest's defaults back in, because naming it replaces them. The Workers
project reads its bindings from your own `wrangler.jsonc`, and `remoteBindings: false` keeps
a binding declared with `remote: true` from opening a session against your real account. Add
`@cloudflare/vitest-pool-workers/types` to `compilerOptions.types` in your `tsconfig.json`
so `cloudflare:test` type-checks, and set `"test": "vp test run"` in `package.json`.
`vp test run --project workers` runs one project, `vp test run app/mcp` scopes to a path, and
`vp test watch` reruns on change.

## Drive the real router

The test that catches the most is one request through the same middleware chain, controllers
and jobs the Worker builds. Make the app factory take the services a test substitutes as
parameters, and write one helper that opens a database and fetches through the router.

```typescript {% title="app/test/router.ts" %}
import { readFileSync } from "node:fs";

import { createD1Database } from "@sdxc/cloudflare-mocks";
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import * as memory from "@sdxc/jobs/memory";
import { Database } from "remix/data-table";

import application from "~/bootstrap/app";

export const ORIGIN = "https://app.test";

export const queue = memory.queue();

const MIGRATION = readFileSync(
	new URL("../../database/migrations/0001-init.sql", import.meta.url),
	"utf8",
);

export async function createTestDatabase(): Promise<Database> {
	let binding = createD1Database();
	await binding.exec(MIGRATION);
	return new Database(createD1DatabaseAdapter(binding));
}

export async function fetchApp(db: Database, path: string, init: RequestInit = {}) {
	let headers = new Headers(init.headers);
	if (init.method && init.method !== "GET") headers.set("origin", ORIGIN);
	let request = new Request(new URL(path, ORIGIN), { ...init, headers });
	return await application(() => db, queue).fetch(request);
}
```

`createD1Database()` is a D1 binding over an in-memory SQLite database, so a malformed
statement or a constraint violation fails in the test rather than in production, and
`exec()` takes the migration file as it stands. The app factory hands `queue` to
`jobEnqueuer(queue)` from `@sdxc/jobs/router`, so whatever a handler enqueues through
`ctx.jobs` lands in a memory queue the test can drain (see
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron)). Setting `origin` on writes keeps
cross-origin protection in the chain under test instead of turning it off. A test is then a
request and an assertion:

```typescript {% title="app/http/controllers/board.test.ts" %}
import { beforeEach, expect, test } from "vitest";

import Posting from "~/app/data/posting";
import { createTestDatabase, fetchApp } from "~/app/test/router";

let db: Awaited<ReturnType<typeof createTestDatabase>>;
beforeEach(async () => (db = await createTestDatabase()));

test("lists the open positions", async () => {
	await Posting.publish(db, { title: "Senior Remix Engineer", company: "Acme" });

	let response = await fetchApp(db, "/");

	expect(response.status).toBe(200);
	expect(await response.text()).toContain("Senior Remix Engineer");
});
```

A fresh database per test removes any cleanup step. Code that imports `env` from
`cloudflare:workers` at module scope has no such module on Node threads: pass the binding in
through the factory as above, alias the specifier to a small stub module with Vite's
`resolve.alias` in the unit project, or move the test to the Workers pool.

## Use the real binding in the Workers pool

A file named `*.workers.test.ts` runs inside workerd, and its `env` holds the bindings your
Wrangler config declares, implemented by Cloudflare's own code.

```typescript {% title="app/lib/cache.workers.test.ts" %}
import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { unwrap } from "@sdxc/result";
import { env } from "cloudflare:test";
import { beforeEach, expect, test } from "vitest";

beforeEach(async () => {
	for (let key of (await env.CACHE.list({ prefix: "test:" })).keys) {
		await env.CACHE.delete(key.name);
	}
});

test("serves a stored value on the second read", async () => {
	let calls = 0;
	let load = async () => ++calls;
	let cache = new WorkerKVCache(env.CACHE);

	unwrap(await cache.fetch("test:answer", load, { ttl: "5 minutes" }));
	expect(unwrap(await cache.fetch("test:answer", load, { ttl: "5 minutes" }))).toBe(
		1,
	);
});
```

Storage persists between tests in the pool, so start each one from a clean slate. Recent
versions of the pool also expose the same `env` through `cloudflare:workers`. One limit to
know: `node:sqlite` does not exist in workerd, so a test whose database comes from an
in-memory SQLite engine stays in the unit project.

## Reach for the in-memory mocks elsewhere

Everything else lives in `@sdxc/cloudflare-mocks`. Each factory returns isolated state typed
against the platform interface, so a mock that drifts from the platform's shape fails
typecheck.

```typescript {% title="app/jobs/refresh.test.ts" %}
import {
	createEnv,
	createExecutionContext,
	createKVNamespace,
	createQueue,
} from "@sdxc/cloudflare-mocks";
import { expect, test } from "vitest";

import worker from "~/bootstrap/worker";

test("a refresh request enqueues one message", async () => {
	let queue = createQueue<{ id: string }>();
	let env = createEnv<Cloudflare.Env>({ CACHE: createKVNamespace(), QUEUE: queue });
	let ctx = createExecutionContext();

	await worker.fetch(new Request("https://app.test/refresh"), env, ctx);
	await ctx.settled();

	expect(queue.messages).toHaveLength(1);
});
```

`worker` is your Worker's default export, called the way the platform calls it, and
`Cloudflare.Env` is the binding type your Wrangler config generates.

`createEnv` throws by name when code reads a binding the test did not supply, and
`ctx.settled()` awaits every `waitUntil` promise, which is also what surfaces a rejected one.
There are mocks for R2, Durable Object state and namespaces, rate limiting, `send_email`,
secrets and service bindings too. When you build a `remix/data-table` SQLite database
yourself, `openDatabase(":memory:")` from `@sdxc/cloudflare-mocks/sqlite` picks whichever
built-in SQLite module the runtime has, so one test file runs under Node or Bun. Read the
package's list of where a mock is more permissive than the platform before trusting a green
run with anything size- or limit-related.

## Answer outbound HTTP with MSW

Mock the network, not `fetch`. MSW intercepts requests at the boundary, so your code calls
the global `fetch` exactly as it does in production.

```typescript {% title="app/lib/billing.test.ts" %}
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

let server = setupServer(
	http.get("https://billing.example.com/invoices", () => HttpResponse.json([])),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest: "error"` turns a request you forgot to mock into a failure instead of a
real call. `server.use(...)` inside one test overrides a handler for that test only.

## Record mail and jobs in memory

`MemoryTransport` records every message a `Mailer` would have delivered, normalized the way a
provider receives it, and the memory queue holds jobs until the test drains them.

```typescript {% title="app/test/mail.ts" %}
import { Mailer } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";

export const outbox = new MemoryTransport();

export const mailer = new Mailer({
	transport: outbox,
	from: { email: "jobs@app.test" },
});
```

Import `mailer` into `fetchApp` and pass it to `application()` next to the database and the
queue, the same way the Worker passes its real one. The confirmation is sent by a job, so the
test drains the queue through the app's own dispatcher before reading what was sent:

```typescript {% title="app/http/controllers/board.test.ts" %}
import { beforeEach, expect, test } from "vitest";

import { dispatcher } from "~/app/jobs/dispatcher";
import { outbox } from "~/app/test/mail";
import { createTestDatabase, fetchApp, queue } from "~/app/test/router";

beforeEach(() => outbox.clear());

test("publishes a submission and mails the poster", async () => {
	let db = await createTestDatabase();
	let body = new URLSearchParams({
		title: "Remix Engineer",
		contact: "hiring@acme.test",
	});
	let response = await fetchApp(db, "/", { method: "POST", body });
	await queue.drain((delivery) => dispatcher.deliver(delivery));

	expect(response.status).toBe(303);
	expect(outbox.last?.to[0]?.email).toBe("hiring@acme.test");
});
```

`queue.drain` runs every message the queue holds and answers once they have settled, so the
confirmation in the outbox is the proof the job ran; call `queue.reset()` in `beforeEach` to
start each test empty. To test one handler on its own, build
its context with
`createJobContext(jobs.sendConfirmation, { id: "message-1", attempts: 1, input })`, `set`
the services its middleware would have published, and call it. To assert on what it logged,
pass `log: new Log({ kind: "job", sink: (record) => records.push(record) })` and run the
handler inside `log.run(...)`.

MCP tools are routes too, so the same `fetchApp` drives them. A call carries the protocol
version, the method and the tool name in headers as well as in its body:

```typescript {% title="app/mcp/server.test.ts" %}
import { LATEST_PROTOCOL_VERSION, MetaKey } from "@sdxc/mcp";
import { expect, test } from "vitest";

import { createTestDatabase, fetchApp } from "~/app/test/router";

test("search_jobs answers a tools/call", async () => {
	let db = await createTestDatabase();
	let response = await fetchApp(db, "/mcp", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
			"Mcp-Method": "tools/call",
			"Mcp-Name": "search_jobs",
		},
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "tools/call",
			params: {
				name: "search_jobs",
				arguments: { query: "Remix" },
				_meta: {
					[MetaKey.ProtocolVersion]: LATEST_PROTOCOL_VERSION,
					[MetaKey.ClientCapabilities]: {},
				},
			},
		}),
	});

	expect(response.status).toBe(200);
});
```

## Specify behavior with `.spec` files

Unit tests say how the code behaves; an executable spec says how the running app behaves to
someone who only has its URL. `@sdxc/spec` reads `.spec` files written in a deliberately tiny
language (setup, action, expectation, no branches or loops) and runs each test in its own
workspace under permissions you grant explicitly. Point it at your dev server once:

```json {% title="spec/config.jsonc" %}
{
	"bases": {
		"web": { "env": "APP_BASE_URL", "default": "http://localhost:8787" }
	}
}
```

```text {% title="spec/board.spec" %}
use http
use html

test "the board lists open positions" {
	when {
		let page = http.get "/"
	}
	then {
		expect page.status 200
		expect html.element page.text heading "Open positions"
	}
}

test "a submission with no title is refused" {
	when {
		let response = http.post "/" form { title: "" }
	}
	then {
		expect response.status 400
	}
}
```

Relative targets resolve against the `web` base, so the same suite runs against a laptop,
staging or CI by changing one variable. Reaching the network is privileged, so grant exactly
the host:

```bash
npx spec run spec --allow-net=localhost:8787
```

Start with no flags and the denials tell you the suite's real footprint. The runner needs Bun
on your `PATH`. `html` reads a page's markup with no browser; `browser` drives a real one
when behavior depends on script; `db`, `sample` and shared `command` definitions under
`spec/commands/` cover seeding and generated input.

## Where to go next

- [Wire the router](/docs/building-remix-apps/wire-the-router) shows the app factory and the
  middleware that publishes `ctx.db`, which is what makes it substitutable.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) covers the
  dispatcher the memory queue stands in for.
- [Logs, traces and timings](/docs/operations-and-testing/observability) explains the
  records a `Log` sink collects.
- [`@sdxc/spec`](/api/spec) documents every capability and permission flag.
