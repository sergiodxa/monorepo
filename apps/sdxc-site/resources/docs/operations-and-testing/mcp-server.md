---
title: Expose your app over MCP
description: Declare tools and resources, answer them with your app's own context, cache the expensive ones, and mount the server as a route.
section:
    title: Operations & testing
    order: 9
order: 2
lastUpdated: 2026-10-25
outcomes:
    - "How to declare MCP tools and resources for your app"
    - "How to answer them with your app's own context and cache the expensive ones"
    - "How to mount the server as a route and scope tools to a credential"
---

An agent that can call your app over the Model Context Protocol can search it, read from it
and cite it, without scraping HTML. This guide adds an MCP endpoint to a Remix v3 app on
Workers: a tool that searches open job postings, a resource that reads one in full, a cache
in front of the search, and a route that serves it all.

[`@sdxc/mcp`](/api/mcp) implements the stateless Streamable HTTP revision of MCP, where a call
is one `POST` answered by one response. That makes the server an ordinary route: tools and
resources are declared like routes, answered like actions, and run behind the same middleware
as every page. [`@sdxc/cache`](/api/cache) keeps repeated searches off the database, and
[`@sdxc/authz`](/api/authz) decides which tools a credential may call.

```bash
npm add @sdxc/authz @sdxc/cache @sdxc/get-client-ip @sdxc/json-schema @sdxc/lazy-route \
	@sdxc/logger @sdxc/mcp @sdxc/rate-limit @sdxc/result remix
npm add -D @sdxc/cloudflare-mocks
```

## Declare the tools

A tool declaration is a route table for a model: the name a client calls, the description
the model chooses it by, and the [`@sdxc/json-schema`](/api/json-schema) schema its arguments
satisfy, which `tools/list` publishes as JSON Schema. Keep declarations in the folder's
`index.ts`, apart from the files that answer them.

```typescript {% title="app/mcp/tools/index.ts" %}
import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { tool, tools } from "@sdxc/mcp";

export default tools({
	searchJobs: tool("search_jobs", {
		title: "Search jobs",
		description:
			"Search open positions by title, company or location. " +
			"Returns the id of each match; read a position in full " +
			"through the posting resource.",
		input: s.object({
			query: s.string().pipe(checks.minLength(1), checks.maxLength(100)),
			limit: s.defaulted(s.integer().pipe(checks.min(1), checks.max(50)), 10),
		}),
		annotations: { readOnlyHint: true, openWorldHint: false },
	}),
});
```

The handler's `ctx.input` is typed from this schema, so `query` is a `string` and `limit` is
a `number` with no second declaration. Because `limit` is `defaulted`, the type marks it
present and the handler never writes `?? 10`. The validator is shaped around what models
send: it drops undeclared properties, treats `null` as absent, and reports every failed
constraint in one answer. Write the description as guidance, because it is the only thing a
model reads before choosing the tool.

## Declare a resource

A tool is chosen by the model; a resource is attached by the person, from the picker their
client fills with `resources/list`. A resource is addressed by a URI, declared with the same
pattern syntax as your routes.

```typescript {% title="app/mcp/resources/index.ts" %}
import { resource, resources } from "@sdxc/mcp";

export default resources({
	posting: resource("jobs://postings/:id", {
		name: "Job posting",
		description: "One open position, as Markdown.",
		mimeType: "text/markdown",
	}),
});
```

`jobs://` is a scheme of your own, which is right for content a client cannot fetch for
itself. When the resource already answers at a public `.md` URL, declare that `https://` URL
instead, so attaching it and fetching it give the same text. A pattern RFC 6570 cannot
express, such as an optional segment, throws at declaration rather than publishing a template
the server would never match.

## Answer them with your app's context

Each implementation lives in its own file beside the declarations, as that file's default
export. `createTool` types a handler against its declaration, so `ctx.input` is typed away
from the `map` call. Handlers receive the router's
`RequestContext`, so `ctx.models` and everything else your middleware publishes is already there.

```typescript {% title="app/mcp/tools/search-jobs.ts" %}
import { createTool, ToolError } from "@sdxc/mcp";

import resourceset from "~/app/mcp/resources";
import toolset from "~/app/mcp/tools";

export default createTool(toolset.searchJobs, async (ctx) => {
	let found = await ctx.models.posting.search(ctx.input.query, ctx.input.limit);
	if (found.length === 0)
		throw new ToolError("Nothing matched. Try a broader query.");
	return found.map((posting) => ({
		uri: resourceset.posting.href({ id: posting.id }),
		title: posting.title,
		company: posting.company,
	}));
});
```

A returned string is the answer verbatim, and anything else is serialized as JSON. A
`ToolError` reaches the model as a result it can act on, so write its message as advice.
Any other exception reaches the model only as "the tool failed", because its message was
written for you and may carry a query or an upstream URL; pass `onError` to
`createHandler` to receive those. `href` builds a URI from the resource's pattern, so the
search points the model at the resource without concatenating a string by hand. `search` is a
method on your app's `posting` model.

A resource implements `read`, and optionally a `list` that fills the client's picker:

```typescript {% title="app/mcp/resources/posting.ts" %}
import { createResource } from "@sdxc/mcp";

import { toMarkdown } from "~/app/mcp/markdown";
import resourceset from "~/app/mcp/resources";

export default createResource(resourceset.posting, {
	list: async (ctx) =>
		(await ctx.models.posting.listOpen(50)).map((posting) => ({
			uri: resourceset.posting.href({ id: posting.id }),
			name: `${posting.title} at ${posting.company}`,
		})),

	read: async (ctx) => {
		let posting = await ctx.models.posting.find(ctx.variables.id);
		return posting ? toMarkdown(posting) : null;
	},
});
```

`ctx.variables.id` is what the pattern captured, typed from it, and `toMarkdown` is your own
function that writes a posting as Markdown. Returning `null` reports the resource as missing,
which is the answer the protocol reserves for that case.

`createHandler` builds the server, and `map` binds each declaration to its implementation.
`lazy()` wraps the import of each handler's file, so a call imports only the handler it
reaches:

```typescript {% title="app/initializers/mcp.ts" %}
import { createHandler, lazy } from "@sdxc/mcp";

import resourceset from "~/app/mcp/resources";
import toolset from "~/app/mcp/tools";

const mcp = createHandler({
	name: "jobs-board",
	title: "Jobs board",
	version: "1.0.0",
	instructions:
		"Search open positions with search_jobs, then read one as a resource.",
	cacheScope: "public",
});

mcp.tools.map(
	toolset.searchJobs,
	lazy(() => import("~/app/mcp/tools/search-jobs")),
);
mcp.resources.map(
	resourceset.posting,
	lazy(() => import("~/app/mcp/resources/posting")),
);

export default mcp;
```

Building the server at module scope is fine: mapping is object construction, with no I/O and
no parsing, so nothing runs in the Worker's global scope. A list that includes a lazy handler
is `"private"` by default, because whether a handler is visible is unknown until it loads;
every caller sees the same tools here, so `cacheScope: "public"` lets a shared cache hold the
lists. A group of tools declared with `tools({...})` is implemented the same way with
`createToolController`.

## Cache the expensive tool

A search reads every open posting, and an agent often asks the same question more than once
in a conversation. `cache.fetch` returns a stored answer or computes and stores it, and it
absorbs everything the store does wrong, so a KV outage costs a database read rather than an
error.

```typescript {% title="app/mcp/cache.ts" %}
import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { isFailure } from "@sdxc/result";
import { env, waitUntil } from "cloudflare:workers";

export async function cachedSearch<T>(key: string, search: () => Promise<T>) {
	let cache = new WorkerKVCache(env.CACHE, { waitUntil });
	let stored = await cache.fetch(`mcp:${key}`, search, { ttl: "5 minutes" });
	if (isFailure(stored)) throw stored.error.cause ?? stored.error;
	return stored.data;
}
```

Open the cache per call: an instance holds its own deferred writes until KV has them, which
is what lets a request read what it just wrote, and handing it `waitUntil` means a miss never
waits on the KV put. A `fetch` failure means the search itself failed, so rethrowing its cause
makes the tool fail the same way with or without the cache.

<note>
KV refuses a TTL under 60 seconds.
</note>

Because the tool lives in its own file, caching it changes only that file:

```typescript {% title="app/mcp/tools/search-jobs.ts" %}
import { createTool, ToolError } from "@sdxc/mcp";

import { cachedSearch } from "~/app/mcp/cache";
import resourceset from "~/app/mcp/resources";
import toolset from "~/app/mcp/tools";

export default createTool(toolset.searchJobs, async (ctx) => {
	let { query, limit } = ctx.input;
	let key = `search_jobs:${limit}:${query.toLowerCase()}`;
	let found = await cachedSearch(key, () =>
		ctx.models.posting.search(query, limit),
	);
	if (found.length === 0)
		throw new ToolError("Nothing matched. Try a broader query.");
	return found.map((posting) => ({
		uri: resourceset.posting.href({ id: posting.id }),
		title: posting.title,
		company: posting.company,
	}));
});
```

The key stays bounded because the schema caps `query` at 100 characters. What comes back is
what reads back out of KV, so a `Date` field arrives as its string; the type says so. The TTL
is also how long a new posting can be missing from a repeated search, so pick it for your
content. Every caller shares these entries, which is correct only because the endpoint is
anonymous and every caller sees the same data.

<warning>
Once a tool answers per credential, the credential belongs in the cache key; a shared key would
hand one caller's answer to another.
</warning>

To cache every tool at once, write tool middleware instead and pass it to `createHandler` as
`toolMiddleware`. A `ToolMiddleware` reads `ctx.tool.name` and `ctx.input`, awaits `next()`
for the `CallToolResult`, and can skip storing a result whose `isError` is set.

## Mount the endpoint

The server's `fetch` takes the router's context, so the endpoint is one controller with
whatever middleware you want in front of it. An app from `sdxc create` has it already: the
route is `mcp: post("/mcp")` in `routes/api.ts`, and its controller runs the API chain, which
answers CORS and binds every caller as a guest, before handing the request to the server:

```typescript {% title="app/http/controllers/mcp.ts" %}
import { createAction } from "remix/router";

import api from "~/app/http/middleware/api";
import mcp from "~/app/initializers/mcp";
import routes from "~/routes/api";

export default createAction(routes.mcp, {
	middleware: api,
	handler: (ctx) => mcp.fetch(ctx),
});
```

An anonymous endpoint needs a caller budget of its own, since every call costs you a search.
Give it to the route as `lazy()`'s second argument in the router, so an over-budget caller is
refused before the controller's module loads:

```typescript {% title="app/initializers/router.tsx" %}
import { lazy } from "@sdxc/lazy-route";
import { addressKey, CloudflareAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";
import { env } from "cloudflare:workers";

import apiRoutes from "~/routes/api";

router.map(
	apiRoutes.mcp,
	lazy(
		() => import("~/app/http/controllers/mcp"),
		[
			rateLimit({
				adapter: new CloudflareAdapter(env.MCP_RATE_LIMITER, {
					limit: 60,
					window: "1 minute",
				}),
				prefix: "mcp",
				key: (ctx) => addressKey(ctx.ip),
			}),
		],
	),
);
```

`MCP_RATE_LIMITER` is a rate limit binding you declare in `cloudflare.config.ts`, and
`addressKey()` from `@sdxc/rate-limit` keys each caller by the address `getClientIP()`
published in the router's global chain, an IPv6 caller by its /64. With `log(logger)` in
that chain, the request's record gains `mcp.method`, `mcp.tool` and `mcp.is_error`, so one
filter finds every call a model did not get a clean answer to. Authentication, when you add it,
is ordinary request middleware in the API chain; it runs for `tools/list` too, which matters
because the list a caller sees can depend on the credential.

## Scope tools to a credential

Once callers bring a token, a tool's `available` predicate decides whether it exists for them:
a tool it answers `false` for is absent from `tools/list` and reported as unknown by
`tools/call`. With an [`@sdxc/authz`](/api/authz) policy, the predicate is an ability. Bind
the token's holder with `access()` from `@sdxc/authz/middleware/router`, giving
the token's scope as `within`, a ceiling of roles every check must also pass, and listing the
claims the predicates read under `load`, since `available` answers synchronously:

```typescript {% title="app/http/middleware/api.ts" %}
access(policy, {
	roles: (ctx) => [ctx.member.role],
	within: (ctx) => [`agent:${ctx.token.scope}`],
	load: [abilities.agent],
});
```

It takes the place of the guest `access(policy, { load: [abilities] })` in the API chain, after
your token middleware, which publishes
`ctx.token` and `ctx.member`; `abilities` and `policy` are your catalog and policy, with a role
named `agent:read` and one named `agent:write`. `@sdxc/authz/mcp` then guards the tool, and
checks the record it touches once its arguments validate:

```typescript {% title="app/mcp/tools/close-posting.ts" %}
import type { InputOf } from "@sdxc/mcp";

import { guard, requireToolAbility } from "@sdxc/authz/mcp";
import { createTool } from "@sdxc/mcp";

import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

type Input = InputOf<typeof toolset.closePosting>;

export default createTool(toolset.closePosting, {
	...guard(abilities.agent.write),
	middleware: [
		requireToolAbility<typeof abilities.posting.close, Input>(
			abilities.posting.close,
			{
				context: async (ctx) => {
					let posting = await ctx.models.posting.find(ctx.input.id);
					return posting ? { posting } : null;
				},
				notFound: "No open posting has that id.",
			},
		),
	],
	handler: async (ctx) => {
		await ctx.models.posting.close(ctx.input.id);
		return "Closed.";
	},
});
```

Map it in `app/initializers/mcp.ts` like the others.

<warning>
Remove `cacheScope: "public"` from `app/initializers/mcp.ts` once a tool declares `available`:
the lists then vary by credential, and a shared cache would show one caller the tools of
another.
</warning>

A read-scoped token never sees `close_posting`, and a write-scoped one still
closes only the postings its holder may. A posting the holder may not see answers with the `notFound` message,
as a missing one does, and any other refusal answers as `ForbiddenError`. Cache keys for a
scoped tool carry the credential, as the cache section above explains. [Decide who can do
what](/docs/identity-and-security/authorization) writes the policy and the scope roles.

## Test a tool call

A tool call is a `POST` to the route, so a test sends one through the same router the Worker
builds and reads the result out of the JSON-RPC answer. The cache and the rate limiter read
their bindings through `cloudflare:workers`, so give the test environment a mock of each, and
the `waitUntil` the cache hands its writes to:

```typescript {% title="app/test/cloudflare-workers.ts" %}
import { createKVNamespace, createRateLimit } from "@sdxc/cloudflare-mocks";

export const env = {
	CACHE: createKVNamespace(),
	MCP_RATE_LIMITER: createRateLimit(),
	// …the bindings the template already mocks
} as Partial<Cloudflare.Env> as Cloudflare.Env;

export function waitUntil(promise: Promise<unknown>) {
	return promise;
}
```

Then call the tool once with a query that matches and once with one that matches nothing:

```typescript {% title="app/mcp/tools/search-jobs.test.ts" %}
import { LATEST_PROTOCOL_VERSION, MetaKey } from "@sdxc/mcp";
import { beforeAll, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { factories, migrate } from "~/app/test/database";
import { PostingFactory } from "~/database/factories/posting";

beforeAll(migrate);

async function searchJobs(query: string) {
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
					arguments: { query },
					_meta: {
						[MetaKey.ProtocolVersion]: LATEST_PROTOCOL_VERSION,
						[MetaKey.ClientCapabilities]: {},
					},
				},
			}),
		}),
	);
	let body = (await response.json()) as {
		result: { content: { text: string }[]; isError?: boolean };
	};
	return body.result;
}

test("search_jobs answers the matching postings", async () => {
	await factories().create(PostingFactory, { title: "Senior Remix Engineer" });

	let result = await searchJobs("Remix");

	expect(result.isError).toBeUndefined();
	expect(result.content[0]?.text).toContain("Senior Remix Engineer");
});

test("search_jobs tells the model to broaden an empty search", async () => {
	let result = await searchJobs("Cobol");

	expect(result).toEqual({
		content: [{ type: "text", text: "Nothing matched. Try a broader query." }],
		isError: true,
	});
});
```

A `ToolError` answers as a result with `isError` set, which the model reads and acts on, so the
second test asserts on that result rather than on a failed request.

## Where to go next

- [Test Workers apps](/docs/operations-and-testing/testing) — the mocks, factories and MSW the
  test above builds on.
- [Cache on Cloudflare Workers](/docs/data-and-background-work/cache-on-workers) — the cache
  adapters and their failure codes.
- [Decide who can do what](/docs/identity-and-security/authorization) — the policy a token's
  scope is checked against.
