---
title: Call an MCP server
description: Call a modern Streamable HTTP MCP endpoint from a Worker, browser, Node, or Bun.
section:
    title: Operations & testing
    order: 9
order: 2.1
lastUpdated: 2026-10-28
outcomes:
    - "How to open a session with connect and prefer using so it closes with the scope"
    - "How to discover, list, and call tools, and read resources"
    - "How to type tool names with a catalog and optionally validate a call's result"
---

An MCP server that speaks the stateless Streamable HTTP revision is an ordinary URL: one
`POST` is one exchange. When you want your own Worker, Durable Object, browser page, or CLI
to call that URL — list tools, invoke one, attach a resource — reach for a client that speaks
the same revision.

[`@sdxc/mcp/client`](/api/mcp) is that client. It posts revision `2026-07-28`, keeps protocol
headers and `_meta` inside the package, and returns every outcome as a
[`@sdxc/result`](/api/result) value. The same import runs in a Worker, a browser, Node, and
Bun.

```bash
npm add @sdxc/mcp @sdxc/result
```

Add [`@sdxc/json-schema`](/api/json-schema) when you pass a result schema to `call`.

## Open a session

`connect` is sync. It stores the URL, your client's name and version, and optional auth
headers; the first RPC opens the wire. Prefer Explicit Resource Management so the session
closes when the scope ends:

```typescript {% title="src/mcp-client.ts" %}
import { connect } from "@sdxc/mcp/client";
import { isFailure } from "@sdxc/result";

using mcp = connect({
	url: "https://example.com/mcp",
	client: { name: "documents-app", version: "1.0.0" },
	headers: { Authorization: `Bearer ${token}` },
});

let listed = await mcp.list();
if (isFailure(listed)) throw listed.error;

let called = await mcp.call("search_documents", { query: "remix" });
if (isFailure(called)) throw called.error;
// called.data.isError is model-facing guidance from the tool
```

`McpClient` implements `Disposable`: `[Symbol.dispose]` and `close()` share one path that
aborts in-flight requests and marks the session closed. Prefer `using`; call `close()` when
the session opens outside a `using` scope. Pass `credentials` for a browser same-origin
cookie session; Workers and Node usually send a bearer header.

## Discover, list, call, and read

Tools are the hot path; resources use their own methods:

| Method              | Wire method                | Returns                       |
| ------------------- | -------------------------- | ----------------------------- |
| `discover()`        | `server/discover`          | capabilities, instructions, … |
| `list()`            | `tools/list`               | tool descriptors              |
| `call(name, args?)` | `tools/call`               | content, optional structured  |
| `resources()`       | `resources/list`           | resource entries              |
| `templates()`       | `resources/templates/list` | URI templates                 |
| `read(uri)`         | `resources/read`           | resource contents             |
| `close()`           | —                          | tears the session down        |

```typescript
await mcp.discover();
await mcp.list();
await mcp.call("search_documents", { query: "…" });
await mcp.resources();
await mcp.templates();
await mcp.read("https://example.com/articles/hello.md");
```

The protocol version stays internal: every POST speaks `2026-07-28`, and a `-32022`
unsupported-version answer is retried once with a supported intersection.

A transport or JSON-RPC failure is a `Result` failure (`McpClientError`). A tool result with
`isError: true` is still a successful RPC — that flag is model-facing guidance from the
tool.

## Type tools with a catalog

Untyped `connect()` accepts any string name and a `Record` of arguments. For a first-party
server you already know, pass a catalog generic so `call` names and arguments are typed. A
catalog alone is compile-time typing; add a result schema when you want a runtime check:

```typescript {% title="src/uptime-tools.ts" %}
import { connect } from "@sdxc/mcp/client";
import { unwrap } from "@sdxc/result";

interface UptimeTools {
	list_monitors: {
		input: { limit?: number };
		output: { monitors: { id: string }[] };
	};
}

using mcp = connect<UptimeTools>({
	url: "https://uptime.example.com/mcp",
	client: { name: "uptime-bridge", version: "1.0.0" },
	headers: { Authorization: `Bearer ${token}` },
});

let result = unwrap(await mcp.call("list_monitors", { limit: 20 }));
```

## Validate a call's result

Put a `schema` field on the same object as the tool arguments to check the result at
runtime with an [`@sdxc/json-schema`](/api/json-schema) schema. Validation prefers
`structuredContent`; when that is absent it parses the first text `content` block as JSON.
A miss is an `InvalidToolResultError` inside a `Result` failure. A tool result with
`isError` skips the schema:

```bash
npm add @sdxc/json-schema
```

```typescript
import * as s from "@sdxc/json-schema";
import { connect } from "@sdxc/mcp/client";
import { isFailure } from "@sdxc/result";

let MonitorList = s.object({
	monitors: s.array(s.object({ id: s.string() })),
});

using mcp = connect({
	url: "https://uptime.example.com/mcp",
	client: { name: "uptime-bridge", version: "1.0.0" },
});

let result = await mcp.call("list_monitors", { limit: 20, schema: MonitorList });
if (isFailure(result)) {
	// InvalidToolResultError or McpClientError
	throw result.error;
}
```

## Where it runs

The client uses the global `fetch` and runs wherever that exists:

| Runtime                            | Notes                                                          |
| ---------------------------------- | -------------------------------------------------------------- |
| Cloudflare Worker / Durable Object | Prefer `using`; headers for API keys                           |
| Browser                            | Same import; set `credentials` when cookies matter             |
| Node 24+ / Bun 1.4+                | `using` and `Symbol.dispose` work; good fit for CLIs and tests |

Serving tools is a different entry — import [`@sdxc/mcp/server`](/api/mcp) and follow
[Expose your app over MCP](/docs/operations-and-testing/mcp-server). Agents that still speak
the handshake protocol need a local stdio face —
[Bridge Agents to a modern MCP server](/docs/operations-and-testing/mcp-bridge).

## Where to go next

- [Expose your app over MCP](/docs/operations-and-testing/mcp-server) — declare tools and
  resources and mount them as a route.
- [Bridge Agents to a modern MCP server](/docs/operations-and-testing/mcp-bridge) — the
  `mcp-bridge` bin for handshake-era agents.
- [Result everywhere](/docs/conventions/result-everywhere) — the `Result` shape every method
  returns.
