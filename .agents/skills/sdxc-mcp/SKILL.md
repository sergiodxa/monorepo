---
name: sdxc-mcp
description: "@sdxc/mcp builds Model Context Protocol servers as remix/router actions over stateless Streamable HTTP: tools declared with tool()/tools() and @sdxc/json-schema arguments, resources addressed by route pattern, and one fetch() that takes a Request or a RequestContext. Use when exposing tools or resources to an MCP client, mounting an MCP endpoint on a router, or validating tool arguments a model sent."
---

# @sdxc/mcp

Model Context Protocol servers as `remix/router` actions, served over stateless Streamable HTTP. Revision `2026-07-28` made MCP stateless — no handshake, no session id, no held-open stream — so what is left is a function from a request to a response: a tool's name and input schema are its route, a handler and its middleware are its controller, and `fetch` takes the `RequestContext` an application already has. `createHandler()` builds the server, `tool()`/`tools()` and `resource()`/`resources()` declare the tables, `mcp.tools.map()` and `mcp.resources.map()` attach handlers, and one `@sdxc/json-schema` schema per tool is published as JSON Schema in `tools/list`, parses every call, and types `ctx.input` with no second declaration.

Full API, options and examples: [packages/mcp/README.md](packages/mcp/README.md)

## When to reach for it

- An application should expose some of what it does to an MCP client, as tools a model can call.
- A corpus — articles, documents, records — should show up in a client's resource picker, addressed by URI.
- An MCP endpoint needs the same authentication, logging and database middleware every other route already has.
- Tool arguments arrive from a language model and need validating in a way that tolerates what models actually send.
- A tool should be hidden from callers without a given credential, or metered per call.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/json-schema": "workspace:*", "@sdxc/mcp": "workspace:*" } }
```

```ts
import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { tool, tools } from "@sdxc/mcp";

export default tools({
	searchDocuments: tool("search_documents", {
		description: "Searches published documents by title, excerpt and tags.",
		input: s.object({
			query: s.string().meta({ description: "What to search for." }),
			limit: s.defaulted(s.integer().pipe(checks.min(1), checks.max(50)), 10),
		}),
		annotations: { readOnlyHint: true },
	}),
});
```

```ts
import { createHandler, ToolError } from "@sdxc/mcp";

import toolset from "./tools.js";

let mcp = createHandler({
	name: "documents",
	version: "1.0.0",
	instructions: "Search and read the documents this server publishes.",
});

mcp.tools.map(toolset.searchDocuments, async (ctx) => {
	// ctx.input is the schema's parse output: query is string, limit is number with the default applied.
	let documents = await search(ctx.input.query, ctx.input.limit);
	if (documents.length === 0) throw new ToolError("Nothing matched. Try a broader query.");
	return documents;
});

export default { fetch: mcp.fetch };
```

A resource is addressed by a `remix/route-pattern`; `list` is optional and `read` is required:

```ts
import { resource, resources } from "@sdxc/mcp";

let resourceset = resources({
	article: resource("https://example.com/articles/:slug.md", {
		name: "Article",
		description: "A published article, as Markdown.",
		mimeType: "text/markdown",
	}),
});

mcp.resources.map(resourceset.article, {
	list: async (ctx) => {
		let articles = await listArticles(ctx.get(Database));
		return articles.map((article) => ({
			uri: resourceset.article.href({ slug: article.slug }),
			name: article.title,
		}));
	},
	read: async (ctx) => {
		let article = await findArticle(ctx.get(Database), ctx.variables.slug);
		return article?.content ?? null;
	},
});
```

An action object carries `available` to hide a tool from a caller and `middleware` to wrap its calls; a `ToolMiddleware` receives the `CallToolResult`, so it can meter or log the outcome:

```ts
import type { ToolMiddleware } from "@sdxc/mcp";

function meterUsage(): ToolMiddleware {
	return async (ctx, next) => {
		let result = await next();
		if (!result.isError) await recordUsage(ctx.get(ApiKey).teamId, ctx.tool.name);
		return result;
	};
}

mcp.tools.map(toolset.documents.create, {
	available: (ctx) => ctx.get(ApiKey).scopes.includes("documents:write"),
	middleware: [requireScope("documents:write"), meterUsage()],
	handler: (ctx) => createDocument(ctx.get(Database), ctx.input),
});
```

## Suggestions

- Mount it on a route and let the router's own middleware do authentication, logging and value provision: it runs for every method, which is what `tools/list` needs too, since the list a caller sees depends on the credential. A host with nothing to provide passes the bare `Request` straight to `mcp.fetch`.
- A `ToolError` message reaches the model verbatim, so write it as guidance: what was wrong and what would work instead. Any other exception reaches `onError` and the caller gets only a generic failure.
- A controller answers every tool in the group it names, so adding a tool to the declaration is a type error until it is handled; a nested group needs its own `map()` call.
- Declare `input` (and optionally `output`) with `@sdxc/json-schema` builders, never a raw JSON Schema object literal: the schema's root must be `s.object(…)`, since MCP requires `type: "object"`, and `tool()` throws at declaration for a root `s.union`, `s.variant` or `s.nullable`. Keep arguments to scalars, enums and arrays — four clearly named tools beat one with a union argument.
- Argument validation follows `remix/data-schema` semantics, shaped around what models send: `s.object` drops an undeclared property, `null` counts as absent unless the property is `s.nullable`, `s.defaulted` substitutes its value and types the property as present, every constraint is reported in one round trip, values are taken as sent so `"20"` is not `20` under `s.integer()` (an `@sdxc/json-schema/coerce` schema accepts both), and transforms run so `ctx.input` holds the schema's output. It runs before tool middleware, so middleware can read `ctx.input` as a typed value — name it with `ToolMiddleware<InputOf<typeof tool>>` only when the middleware reads it.
- `available` hides a tool or resource from `tools/list` and answers a call to it as an unknown tool; middleware runs only on a call, so enforce the same scope there too, and throw `ForbiddenError` as the backstop. Declaring any `available` makes list caching `private`.
- Tool middleware nests innermost last: `createHandler({ toolMiddleware })`, then a controller's `middleware`, then an action's.
- Put an implementation in its own file with `createTool(tool, action)`, `createToolController(group, controller)` or `createResource(resource, action)`, which keep `ctx.input` and `ctx.variables` typed.
- A resource pattern is a `remix/route-pattern` and the RFC 6570 template is derived from it, so `resource()` throws at declaration for a pattern with no equivalent — optionals, search constraints, unnamed wildcards, braces, repeated capture names. A resource needing an optional segment is two resources.
- Build a resource URI with `resource.href({ … })` rather than concatenating, and return `null` from a `read` to report the resource missing — an empty array is reserved for a resource that exists with nothing to show.
- Captures arrive as `ctx.variables`, leaving `RequestContext.params` to the route's own params.

## Related

- `@sdxc/logger` — the invocation log a handler enriches through `currentLog()`; skill `sdxc-logger`
- `@sdxc/result` — how argument validation reports its outcome; skill `sdxc-result`
