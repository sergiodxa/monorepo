---
title: Expose your app over MCP
description: Declare tools and resources, answer them with your app's own context, cache the expensive ones, and mount the server as a route.
section:
    title: Operations & testing
    order: 8
order: 2
lastUpdated: 2026-09-29
---

An agent that can call your app over the Model Context Protocol can search it, read from it
and cite it, without scraping HTML. This guide adds an MCP endpoint to a Remix v3 app on
Workers: a tool that searches open job postings, a resource that reads one in full, a cache
in front of the search, and a route that serves it all.

[`@sdxc/mcp`](/api/mcp) implements the stateless Streamable HTTP revision of MCP, where a call
is one `POST` answered by one response. That makes the server an ordinary route: tools and
resources are declared like routes, answered like actions, and run behind the same middleware
as every page. [`@sdxc/cache`](/api/cache) keeps repeated searches off the database.

```bash
npm add @sdxc/mcp @sdxc/json-schema @sdxc/cache
```

## Declare the tools

A tool declaration is a route table for a model: the name a client calls, the description
the model chooses it by, and the [`@sdxc/json-schema`](/api/json-schema) schema its arguments
satisfy, which `tools/list` publishes as JSON Schema. Keep declarations in their own module,
apart from the code that answers them.

```typescript {% title="app/mcp/tools.ts" %}
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

```typescript {% title="app/mcp/resources.ts" %}
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

Each implementation lives in its own file. `createTool` types a handler against its
declaration, so `ctx.input` is typed away from the `map` call. Handlers receive the router's
`RequestContext`, so `ctx.db` and everything else your middleware publishes is already there.

```typescript {% title="app/mcp/controllers/search-jobs.ts" %}
import { createTool, ToolError } from "@sdxc/mcp";

import Posting from "~/app/data/posting";
import resourceset from "~/app/mcp/resources";
import toolset from "~/app/mcp/tools";

export const searchJobs = createTool(toolset.searchJobs, async (ctx) => {
	let found = await Posting.search(ctx.db, ctx.input.query, ctx.input.limit);
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
search points the model at the resource without concatenating a string by hand. `Posting` is
your app's own model.

A resource implements `read`, and optionally a `list` that fills the client's picker:

```typescript {% title="app/mcp/controllers/posting.ts" %}
import { createResource } from "@sdxc/mcp";

import Posting from "~/app/data/posting";
import { toMarkdown } from "~/app/mcp/markdown";
import resourceset from "~/app/mcp/resources";

export const postingResource = createResource(resourceset.posting, {
	list: async (ctx) =>
		(await Posting.listOpen(ctx.db, 50)).map((posting) => ({
			uri: resourceset.posting.href({ id: posting.id }),
			name: `${posting.title} at ${posting.company}`,
		})),

	read: async (ctx) => {
		let posting = await Posting.find(ctx.db, ctx.variables.id);
		return posting ? toMarkdown(posting) : null;
	},
});
```

`ctx.variables.id` is what the pattern captured, typed from it, and `toMarkdown` is your own
function that writes a posting as Markdown. Returning `null` reports the resource as missing,
which is the answer the protocol reserves for that case.

`createHandler` builds the server, and `map` binds each declaration to its implementation:

```typescript {% title="bootstrap/mcp.ts" %}
import { createHandler } from "@sdxc/mcp";

import { postingResource } from "~/app/mcp/controllers/posting";
import { searchJobs } from "~/app/mcp/controllers/search-jobs";
import resourceset from "~/app/mcp/resources";
import toolset from "~/app/mcp/tools";

const mcp = createHandler({
	name: "jobs-board",
	title: "Jobs board",
	version: "1.0.0",
	instructions:
		"Search open positions with search_jobs, then read one as a resource.",
});

mcp.tools.map(toolset.searchJobs, searchJobs);
mcp.resources.map(resourceset.posting, postingResource);

export default mcp;
```

Building the server at module scope is fine: mapping is object construction, with no I/O and
no parsing, so nothing runs in the Worker's global scope. A group of tools declared with
`tools({...})` is implemented the same way with `createToolController`.

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
waits on the KV put. KV refuses a TTL under 60 seconds. A `fetch` failure means the search
itself failed, so rethrowing its cause makes the tool fail the same way with or without the
cache. Because the tool lives in its own file, caching it changes only that file:

```typescript {% title="app/mcp/controllers/search-jobs.ts" %}
import { createTool, ToolError } from "@sdxc/mcp";

import Posting from "~/app/data/posting";
import { cachedSearch } from "~/app/mcp/cache";
import resourceset from "~/app/mcp/resources";
import toolset from "~/app/mcp/tools";

export const searchJobs = createTool(toolset.searchJobs, async (ctx) => {
	let { query, limit } = ctx.input;
	let key = `search_jobs:${limit}:${query.toLowerCase()}`;
	let found = await cachedSearch(key, () => Posting.search(ctx.db, query, limit));
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
anonymous and every caller sees the same data. Once a tool answers per credential, the
credential belongs in the key.

To cache every tool at once, write tool middleware instead and pass it to `createHandler` as
`toolMiddleware`. A `ToolMiddleware` reads `ctx.tool.name` and `ctx.input`, awaits `next()`
for the `CallToolResult`, and can skip storing a result whose `isError` is set.

## Mount the endpoint

The server's `fetch` takes the router's context, so the endpoint is one route with whatever
middleware you want in front of it. An anonymous endpoint needs a caller budget, since every
call costs you a search.

```typescript {% title="bootstrap/app.tsx" %}
import { getClientIP } from "@sdxc/get-client-ip";
import { CloudflareAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";
import { env } from "cloudflare:workers";

import { createRouter } from "remix/router";

import routes from "~/routes/web";

import mcp from "./mcp";

function mcpBudget() {
	return rateLimit({
		adapter: new CloudflareAdapter(env.MCP_RATE_LIMITER, {
			limit: 60,
			window: "1 minute",
		}),
		prefix: "mcp",
		key: (ctx) => getClientIP(ctx.request) ?? "unknown",
	});
}

export default function application() {
	let router = createRouter();
	router.map(routes.mcp, {
		middleware: [mcpBudget()],
		handler: (ctx) => mcp.fetch(ctx),
	});
	return router;
}
```

The route is `mcp: post("/mcp")` in your route table, and the rate limiter is a binding named
`MCP_RATE_LIMITER` in your Wrangler config. Your real `createRouter` call carries your global
middleware; with `log(logger)` in that chain, the
request's record gains `mcp.method`, `mcp.tool` and `mcp.is_error`, so one filter finds every
call a model did not get a clean answer to. Authentication, when you add it, is ordinary
request middleware on this route; it runs for `tools/list` too, which matters because the
list a caller sees can depend on the credential. To hide a tool from callers without the
right scope, give its action an `available` predicate, and enforce the scope again in the
action's `middleware`, since `available` only shapes the list.

## Where to go next

- [Test Workers apps](/docs/operations-and-testing/testing) drives this endpoint through the
  router with a `tools/call` request and asserts on the answer.
- [Cache on Cloudflare Workers](/docs/data-and-background-work/cache-on-workers) covers the
  cache adapters and their failure codes.
- [Protect forms from bots and abuse](/docs/identity-and-security/protect-forms) explains
  rate limiting in more depth.
- [`@sdxc/mcp`](/api/mcp) lists where each kind of failure is reported, and the schema subset
  tools accept.
