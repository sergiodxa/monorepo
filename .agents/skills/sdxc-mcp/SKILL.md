---
name: sdxc-mcp
description: "@sdxc/mcp builds Model Context Protocol servers as remix/router actions over stateless Streamable HTTP: tools declared with tool()/tools() and JSON Schema arguments, resources addressed by route pattern, and one fetch() that takes a Request or a RequestContext. Use when exposing tools or resources to an MCP client, mounting an MCP endpoint on a router, or validating tool arguments a model sent."
---

# @sdxc/mcp

Model Context Protocol servers as `remix/router` actions, served over stateless Streamable HTTP. Revision `2026-07-28` made MCP stateless — no handshake, no session id, no held-open stream — so what is left is a function from a request to a response: a tool's name and input schema are its route, a handler and its middleware are its controller, and `fetch` takes the `RequestContext` an application already has. `createHandler()` builds the server, `tool()`/`tools()` and `resource()`/`resources()` declare the tables, `mcp.tools.map()` and `mcp.resources.map()` attach handlers, and argument types are derived from the declared JSON Schema with no second declaration.

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
{ "dependencies": { "@sdxc/mcp": "workspace:*" } }
```

```ts
import { tool, tools } from "@sdxc/mcp";

export default tools({
	searchDocuments: tool("search_documents", {
		description: "Searches published documents by title, excerpt and tags.",
		input: {
			type: "object",
			properties: {
				query: { type: "string", description: "What to search for." },
				limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
			},
			required: ["query"],
		},
		annotations: { readOnlyHint: true },
	}),
});
```

```ts
import { createHandler, ToolError } from "@sdxc/mcp";

let mcp = createHandler({
	name: "documents",
	version: "1.0.0",
	instructions: "Search and read the documents this server publishes.",
});

mcp.tools.map(toolset.searchDocuments, async (ctx) => {
	let documents = await search(ctx.input.query, ctx.input.limit);
	if (documents.length === 0) throw new ToolError("Nothing matched. Try a broader query.");
	return documents;
});

export default { fetch: mcp.fetch };
```

## Suggestions

- Mount it on a route and let the router's own middleware do authentication, logging and value provision: it runs for every method, which is what `tools/list` needs too, since the list a caller sees depends on the credential. A host with nothing to provide passes the bare `Request` straight to `mcp.fetch`.
- A `ToolError` message reaches the model verbatim, so write it as guidance: what was wrong and what would work instead. Any other exception reaches `onError` and the caller gets only a generic failure.
- A controller answers every tool in the group it names, so adding a tool to the declaration is a type error until it is handled; a nested group needs its own `map()` call.
- Argument validation is shaped around what models send: an undeclared property is dropped rather than refused, `null` counts as absent, a `default` is substituted and marks the property present, every constraint is reported in one round trip, and values are taken as sent so `"20"` is not `20`. It runs before tool middleware, so middleware can read `ctx.input` as a typed value.
- A resource pattern is a `remix/route-pattern` and the RFC 6570 template is derived from it, so `resource()` throws at declaration for a pattern with no equivalent — optionals, search constraints, unnamed wildcards, braces, repeated capture names. A resource needing an optional segment is two resources.
- Build a resource URI with `resource.href({ … })` rather than concatenating, and return `null` from a `read` to report the resource missing — an empty array is reserved for a resource that exists with nothing to show.
- Captures arrive as `ctx.variables`, leaving `RequestContext.params` to the route's own params.

## Related

- `@sdxc/logger` — the invocation log a handler enriches through `currentLog()`; skill `sdxc-logger`
- `@sdxc/result` — how argument validation reports its outcome; skill `sdxc-result`
