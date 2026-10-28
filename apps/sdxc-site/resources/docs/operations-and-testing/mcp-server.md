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
    - "How to mount the server as a route and test a tool call"
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
npm add @sdxc/cache @sdxc/json-schema @sdxc/mcp @sdxc/result remix
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
import { tool, tools } from "@sdxc/mcp/server";

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

The handler's `ctx.input` is typed from this schema, and because `limit` is `defaulted`, the
handler never writes `?? 10`. Write the description as guidance, because it is the only thing
a model reads before choosing the tool.

## Declare a resource

A tool is chosen by the model; a resource is attached by the person, from the picker their
client fills with `resources/list`. A resource is addressed by a URI, declared with the same
pattern syntax as your routes.

```typescript {% title="app/mcp/resources/index.ts" %}
import { resource, resources } from "@sdxc/mcp/server";

export default resources({
	posting: resource("jobs://postings/:id", {
		name: "Job posting",
		description: "One open position, as Markdown.",
		mimeType: "text/markdown",
	}),
});
```

`jobs://` is a scheme of your own, which is right for content a client cannot fetch for
itself.

## Cache the expensive search

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

Open the cache per call: an instance holds its own deferred writes until KV has them, and
handing it `waitUntil` means a miss never waits on the KV put. Rethrowing a `fetch` failure's
cause makes the tool fail the same way with or without the cache.

<note>
KV refuses a TTL under 60 seconds.
</note>

## Answer them with your app's context

Each implementation lives in its own file beside the declarations, as that file's default
export. Handlers receive the router's `RequestContext`, so `ctx.models` and everything else
your middleware publishes is already there.

```typescript {% title="app/mcp/tools/search-jobs.ts" %}
import { createTool, ToolError } from "@sdxc/mcp/server";

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

A returned string is the answer verbatim, and anything else is serialized as JSON. A
`ToolError` reaches the model as a result it can act on, so write its message as advice; any
other exception reaches it only as "the tool failed". `href` builds a URI from the resource's
pattern. The key stays bounded because the schema caps `query` at 100 characters.

<warning>
Every caller shares these cache entries, which is correct only while the endpoint is anonymous.
Once a tool answers per credential, the credential belongs in the cache key.
</warning>

A resource implements `read`, and optionally a `list` that fills the client's picker:

```typescript {% title="app/mcp/resources/posting.ts" %}
import { createResource } from "@sdxc/mcp/server";

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

`ctx.variables.id` is typed from the pattern, and `toMarkdown` is your own function. Returning
`null` reports the resource as missing.

`createHandler` builds the server, and `map` binds each declaration to its implementation
through `lazy()`, so a call imports only the handler it reaches:

```typescript {% title="app/initializers/mcp.ts" %}
import { createHandler, lazy } from "@sdxc/mcp/server";

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

A list that includes a lazy handler is `"private"` by default; every caller sees the same tools
here, so `cacheScope: "public"` lets a shared cache hold the lists.

## Mount the endpoint

The server's `fetch` takes the router's context, so the endpoint is one controller. An app from
`sdxc create` has it already: the route is `mcp: post("/mcp")` in `routes/api.ts`, and its
controller runs the API chain before handing the request to the server:

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

## Test a tool call

A tool call is a `POST` to the route, so a test sends one through the same router the Worker
builds and reads the result out of the JSON-RPC answer. The cache reads its binding through
`cloudflare:workers`, so give the test environment a mock of it, and the `waitUntil` the cache
hands its writes to:

```typescript {% title="app/test/cloudflare-workers.ts" %}
import { createKVNamespace } from "@sdxc/cloudflare-mocks";

export const env = {
	CACHE: createKVNamespace(),
	// …the bindings the template already mocks
} as Partial<Cloudflare.Env> as Cloudflare.Env;

export function waitUntil(promise: Promise<unknown>) {
	return promise;
}
```

Then call the tool once with a query that matches and once with one that matches nothing:

```typescript {% title="app/mcp/tools/search-jobs.test.ts" %}
import { LATEST_PROTOCOL_VERSION, MetaKey } from "@sdxc/mcp/server";
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

## Where to go next

- [Call an MCP server](/docs/operations-and-testing/mcp-client) — `@sdxc/mcp/client` against
  the endpoint you just mounted.
- [Bridge Cursor to a modern MCP server](/docs/operations-and-testing/mcp-bridge) — stdio
  `mcp-bridge` for handshake-era agents.
- [Test Workers apps](/docs/operations-and-testing/testing) — the mocks, factories and MSW the
  test above builds on.
- [Cache on Cloudflare Workers](/docs/data-and-background-work/cache-on-workers) — the cache
  adapters and their failure codes.
- [Decide who can do what](/docs/identity-and-security/authorization) — the policy that decides
  which tools a credential may call.
