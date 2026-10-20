---
title: Test Workers apps
description: Vitest through Vite+, real bindings in the Workers pool, in-memory mocks, MSW, and executable specs against a running app.
section:
    title: Operations & testing
    order: 9
order: 3
lastUpdated: 2026-10-19
outcomes:
    - "How the template runs Vitest through Vite+"
    - "When to use the real bindings in the Workers pool and when the in-memory mocks"
    - "How to answer outbound HTTP with MSW and record mail and jobs in memory"
---

For the tests `sdxc make` writes and how to run one file or one case, start with
[Test your app](/docs/operations-and-testing/test-your-app); this guide covers the configuration
under them.

A Remix v3 app on Workers has three kinds of behavior worth testing: what the router answers,
what it does to its bindings, and what it sends to the outside world. This guide covers the
suite an app from `sdxc create` starts with, which tests all three without a hand-written fake
in sight. Vitest runs through Vite+ (`vp test`),
[`@sdxc/cloudflare-mocks`](/api/cloudflare-mocks) supplies in-memory bindings that really
store and really run SQL, MSW answers outbound HTTP, and tests that need Cloudflare's own
implementation of a binding run inside workerd. On top, [`@sdxc/spec`](/api/spec) runs
executable `.spec` suites against the app as a client sees it.

The template already depends on Vite+, Vitest and `@sdxc/cloudflare-mocks`. Add the rest as you
reach for them:

```bash
npm add -D msw @cloudflare/vitest-pool-workers @sdxc/spec
```

## How the template runs tests

The project's `test` script is `vp test run`, and `vite.config.ts` gives Vitest one project on
Node:

```typescript {% title="vite.config.ts" %}
test: {
	include: ["app/**/*.test.ts?(x)", "resources/**/*.test.ts?(x)"],
	alias: {
		"cloudflare:workers": new URL("app/test/cloudflare-workers.ts", import.meta.url).pathname,
	},
},
```

The alias is what lets a module that imports `env` from `cloudflare:workers` load under Node.
`app/test/cloudflare-workers.ts` answers it with an in-memory mock for every binding
`cloudflare.config.ts` declares, and the development values of the secrets:

```typescript {% title="app/test/cloudflare-workers.ts" %}
import {
	createD1Database,
	createKVNamespace,
	createQueue,
	createRateLimit,
	createSendEmail,
} from "@sdxc/cloudflare-mocks";

export const env = {
	DB: createD1Database(),
	EMAIL: createSendEmail(),
	QUEUE: createQueue(),
	RATE_LIMITER: createRateLimit(),
	SESSIONS: createKVNamespace(),
	SESSION_SECRET: "development-session-secret",
	HONEYPOT_SECRET: "development-honeypot-secret",
	TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
	TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
} as Partial<Cloudflare.Env> as Cloudflare.Env;
```

When you declare a binding, add its mock here too. Each test file starts from a fresh module graph, so each
file starts with empty bindings. `vp test run app/mcp` scopes a run to a path, and
`vp test watch` reruns on change.

## Drive the real router

The test that catches the most is one request through the same middleware chain, controllers
and jobs the Worker builds. The router reads its bindings through `cloudflare:workers`, so a
test builds it exactly as `bootstrap/worker.ts` does, with `createWebRouter()`, and
`app/test/database.ts` prepares the database it reads:

```typescript {% title="app/http/controllers/postings/index.test.tsx" %}
import { beforeAll, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { factories, migrate } from "~/app/test/database";
import { PostingFactory } from "~/database/factories/posting";
import routes from "~/routes/web";

beforeAll(migrate);

test("lists the open positions", async () => {
	await factories().create(PostingFactory, { title: "Senior Remix Engineer" });

	let response = await createWebRouter().fetch(
		new URL(routes.postings.index.href(), "https://example.com"),
	);

	expect(response.status).toBe(200);
	expect(await response.text()).toContain("Senior Remix Engineer");
});
```

`migrate()` applies every file in `database/migrations/` to the `DB` mock, a D1 binding over an
in-memory SQLite database, so a malformed statement or a constraint violation fails in the test
rather than in production. `factories()` writes through your own models, with values drawn
from a fixed seed, as [Generate believable test data](/docs/operations-and-testing/test-data)
covers. A page that needs a signed-in visitor gets a session cookie from `signIn()` in
`app/test/session.ts`, and a form post carries the honeypot fields from
`honeypot.issue()`, as the tests `sdxc scaffold` writes do.

## Run some tests in the Workers pool

A few tests need Cloudflare's own implementation of a binding, because the thing being asserted
is a guarantee only the platform can confirm: that a KV entry written with a TTL is found
again, or that a query D1 would reject fails. Name those files `*.workers.test.ts` and give them
a second project:

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
					include: ["app/**/*.test.ts?(x)", "resources/**/*.test.ts?(x)"],
					exclude: [...defaultExclude, "**/*.workers.test.ts?(x)"],
					alias: {
						"cloudflare:workers": new URL(
							"app/test/cloudflare-workers.ts",
							import.meta.url,
						).pathname,
					},
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

`exclude` spreads Vitest's defaults back in, because naming it replaces them. The pool reads
its bindings from a `wrangler.jsonc`, so a project that configures its Worker in
`cloudflare.config.ts` keeps one beside it that declares the same bindings; `remoteBindings:
false` keeps a binding declared with `remote: true` from opening a session against your real
account. Add `@cloudflare/vitest-pool-workers/types` to `compilerOptions.types` in your
`tsconfig.json` so `cloudflare:test` type-checks. `vp test run --project workers` runs one
project.

### Use the real binding

A file named `*.workers.test.ts` runs inside workerd, and its `env` holds the bindings your
Wrangler config declares, implemented by Cloudflare's own code.

```typescript {% title="app/initializers/cache.workers.test.ts" %}
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

```typescript {% title="bootstrap/worker.test.ts" %}
import {
	createEnv,
	createExecutionContext,
	createKVNamespace,
	createQueue,
} from "@sdxc/cloudflare-mocks";
import { expect, test } from "vitest";

import worker from "./worker";

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

```typescript {% title="app/services/billing.test.ts" %}
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

The template's mailer sends through the `EMAIL` binding, so in a test the mock records every
message on its `messages`, which a test reads through `toMatchObject`, since the binding's own
type leaves the mock's extras out. A queued email and a job a handler enqueues land on the
`QUEUE` mock's `messages`:

```typescript {% title="app/http/controllers/teams/invite.test.tsx" %}
import { unwrap } from "@sdxc/result";
import { env } from "cloudflare:workers";
import { beforeAll, expect, test } from "vitest";

import { honeypot } from "~/app/initializers/honeypot";
import { createWebRouter } from "~/app/initializers/router";
import { migrate } from "~/app/test/database";
import { signIn } from "~/app/test/session";
import routes from "~/routes/web";

beforeAll(migrate);

test("mails the invitation", async () => {
	let { token, tokenField } = unwrap(await honeypot.issue());
	let response = await createWebRouter().fetch(
		new Request(new URL(routes.teams.invite.href(), "https://example.com"), {
			method: "POST",
			headers: { cookie: await signIn() },
			body: new URLSearchParams({
				email: "ada@example.com",
				[tokenField]: token,
			}),
		}),
	);

	expect(response.status).toBe(303);
	expect(env.EMAIL).toMatchObject({
		messages: [expect.objectContaining({ subject: "Join Remix" })],
	});
});
```

Test an email's copy without a request: `mail.render(emails.teams.invite, { props })` from
`app/initializers/mail.ts` answers its subject, HTML and text, as the test `sdxc make email`
writes does. To test a job handler on its own, build its context with
`createJobContext(jobs.sendConfirmation, { id: "message-1", attempts: 1, input })`, `set` the
services its middleware would have published, and call it; the template's
`app/jobs/email.test.tsx` does this with a `MemoryTransport` from `@sdxc/mail/memory`, which
records every message a `Mailer` would have delivered. To assert on what a handler logged, pass
`log: new Log({ kind: "job", sink: (record) => records.push(record) })` and run the handler
inside `log.run(...)`.

MCP tools are routes too, so the same router drives them. A call carries the protocol version,
the method and the tool name in headers as well as in its body:

```typescript {% title="app/mcp/tools/search-jobs.test.ts" %}
import { LATEST_PROTOCOL_VERSION, MetaKey } from "@sdxc/mcp";
import { beforeAll, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { migrate } from "~/app/test/database";

beforeAll(migrate);

test("search_jobs answers a tools/call", async () => {
	let response = await createWebRouter().fetch(
		new Request("https://example.com/mcp", {
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
		}),
	);

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

- [Test your app](/docs/operations-and-testing/test-your-app) — the tests `sdxc make` writes
  and the helpers in `app/test/`.
- [Wire the router](/docs/building-remix-apps/wire-the-router) — the middleware that publishes
  `ctx.db`, `ctx.models` and `ctx.email`.
- [`@sdxc/spec`](/api/spec) — every capability and permission flag.
