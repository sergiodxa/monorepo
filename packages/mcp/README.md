# @sdxc/mcp

Model Context Protocol servers as `remix/router` actions, a Streamable HTTP client, and an
`mcp-bridge` bin for agent stdio.

Revision `2026-07-28` of the [Model Context Protocol](https://modelcontextprotocol.io) is
stateless: every request carries everything it needs and gets one complete response. Import the
face you need — there is no root `@sdxc/mcp` export.

| Entry              | Role                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| `@sdxc/mcp/server` | Declare tools and resources; serve them over Streamable HTTP         |
| `@sdxc/mcp/client` | Call a `2026-07-28` endpoint (`connect`, one-word session methods)   |
| `mcp-bridge`       | Stdio bridge for agents (body ships in a follow-up; bin is reserved) |

## Installation

```sh
npm add @sdxc/mcp
```

`@sdxc/mcp/server` needs the [`remix`](https://www.npmjs.com/package/remix) peer (optional at
install time — required when you import `/server`). `@sdxc/mcp/client` and `mcp-bridge` do not.
Tool schemas use [`@sdxc/json-schema`](https://www.npmjs.com/package/@sdxc/json-schema). The package
also depends on [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result),
[`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger), and
[`@sdxc/uuid`](https://www.npmjs.com/package/@sdxc/uuid).

## Usage

### Call a server

```typescript
import { connect } from "@sdxc/mcp/client";

using mcp = connect({
	url: "https://example.com/mcp",
	client: { name: "my-app", version: "1.0.0" },
	headers: { Authorization: `Bearer ${token}` },
});

await mcp.discover();
await mcp.list();
await mcp.call("search_documents", { query: "…" });
await mcp.resources();
await mcp.templates();
await mcp.read("https://example.com/articles/hello.md");
```

`connect` is sync and opens no network until the first RPC. The session implements `Disposable`:
prefer `using`; call `close()` when `using` is unavailable. Methods return
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) — a tool result with `isError` is still
a successful RPC.

### Typed tools and result schemas

Untyped `connect()` keeps string names and `Record` args. Pass a catalog generic for
first-party servers — names and arguments become typed; without a schema that is types only
(no runtime check of the result).

```typescript
import * as s from "@sdxc/json-schema";
import { connect } from "@sdxc/mcp/client";

interface UptimeTools {
	list_monitors: { input: { limit?: number }; output: { monitors: { id: string }[] } };
}

using mcp = connect<UptimeTools>({
	url: "https://uptime.example.com/mcp",
	client: { name: "uptime-bridge", version: "1.0.0" },
});

await mcp.call("list_monitors", { limit: 20 });
```

Pass an [`@sdxc/json-schema`](https://www.npmjs.com/package/@sdxc/json-schema) schema as the
third argument to validate the result at runtime. Validation prefers `structuredContent`;
when that is absent it parses the first text `content` block as JSON. A miss is an
`InvalidToolResultError` inside a `Result` failure — never a throw. A tool result with
`isError` skips the schema (it is model-facing guidance).

```typescript
let MonitorList = s.object({
	monitors: s.array(s.object({ id: s.string() })),
});

let result = await mcp.call("list_monitors", { limit: 20 }, MonitorList);
```

### Declare a tool

A tool's name is what a client calls, its description is what a model chooses it by, and its
input schema is published in `tools/list`, parses every call, and types the handler.

```typescript
import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { tool, tools } from "@sdxc/mcp/server";

export let toolset = tools({
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

`tools/list` publishes the input side as a self-contained JSON Schema object:

```json
{
	"type": "object",
	"properties": {
		"query": { "type": "string", "description": "What to search for." },
		"limit": { "type": "integer", "minimum": 1, "maximum": 50, "default": 10 }
	},
	"required": ["query"]
}
```

Arguments are parsed the way a model sends them: undeclared properties are dropped, `null` counts
as absent unless the property is `s.nullable`, defaults are filled in, transforms run, and every
failed constraint is reported in one answer. Values are taken as sent, so `"20"` fails
`s.integer()`; use an `@sdxc/json-schema/coerce` schema to accept both.

### Handle it and serve requests

```typescript
import { createHandler, ToolError } from "@sdxc/mcp/server";

import { toolset } from "./tools.js";

let mcp = createHandler({
	name: "documents",
	version: "1.0.0",
	instructions: "Search and read the documents this server publishes.",
});

mcp.tools.map(toolset.searchDocuments, async (ctx) => {
	let documents = await search(ctx.input.query, ctx.input.limit); // limit: number, defaulted
	if (documents.length === 0) throw new ToolError("Nothing matched. Try a broader query.");
	return documents;
});

export default { fetch: mcp.fetch };
```

A returned string is the answer verbatim and any other value is serialized as JSON. A `ToolError`
message reaches the model as a result it can act on, so write it as guidance. Any other exception
reaches the model as a generic failure and goes to `onError` in full.

### Expose a resource

A resource is addressed by URI, declared with a `remix/route-pattern`. A tool is chosen by the
model; a resource is picked by the person or attached by their client.

```typescript
import { resource, resources } from "@sdxc/mcp/server";

let resourceset = resources({
	article: resource("https://example.com/articles/:slug.md", {
		name: "Article",
		description: "A published article, as Markdown.",
		mimeType: "text/markdown",
	}),
});

mcp.resources.map(resourceset.article, {
	async list() {
		let articles = await listArticles();
		return articles.map((article) => ({
			uri: resourceset.article.href({ slug: article.slug }),
			name: article.title,
		}));
	},
	async read(ctx) {
		let article = await findArticle(ctx.variables.slug); // slug: string
		return article?.content ?? null; // null reports the resource as missing
	},
});
```

`list` is optional: without it a resource with variables appears only in
`resources/templates/list`, the right shape for a corpus too large to enumerate. The template
published there (`https://example.com/articles/{slug}.md`) is derived from the pattern.

## API

### Client (`@sdxc/mcp/client`)

### `connect<Tools>(options: ConnectOptions): McpClient<Tools>`

Binds a session to a Streamable HTTP endpoint. `options` holds `url`, `client` (`name` /
`version`, optional `title`), and optional `headers` / `credentials`. Protocol version and
transport stay internal (`2026-07-28`, with one `-32022` retry). `Tools` defaults to an untyped
catalog; pass a map of `{ input; output? }` for typed `call` names and arguments.

### `McpClient<Tools>`

One-word methods: `discover`, `list`, `call(name, args?, schema?)`, `resources`, `templates`,
`read(uri)`, plus `close()` and `[Symbol.dispose]()`. Each RPC returns `Result<…, McpClientError>`.
An optional third `call` argument is an `@sdxc/json-schema` schema for the tool result.

### `McpClientError` / `InvalidToolResultError`

Transport or JSON-RPC failure (`McpClientError`, optional `code` / `data`). A result-schema miss
is `InvalidToolResultError` with `issues`.

### Server (`@sdxc/mcp/server`)

### `createHandler(options: HandlerOptions): McpHandler`

Builds the handler for one server. Tools and resources list in the order they were mapped.

- `name`, `version`: The server's identity, sent with every result. `title?` adds a display name.
- `instructions?`: Guidance for the server as a whole, sent with `server/discover` for a client to
  put in the model's system prompt.
- `toolMiddleware?`: `ToolMiddleware` wrapping every tool call, outside any group or action
  middleware.
- `listTtlMs?`: How long a client may cache a list result. Defaults to `60000`.
- `cacheScope?`: `"public"` or `"private"`. Defaults to `"private"` once any mapped tool or
  resource declares `available` or is mapped through `lazy()`, and `"public"` otherwise.
- `allowedOrigins?`: An origin list or a predicate, checked when a request carries `Origin`.
  Omitted, any origin is allowed; set it for a server bound to localhost.
- `onError?(error, { method, tool?, uri? })`: Receives every unexpected exception, including a
  failed `lazy()` import.

### `mcp.tools.map(tool: Tool, action: ActionOrHandler | Lazy<ActionOrHandler>): void`

Registers one tool with its handler, or an action `{ handler, middleware?, available? }`. Only a
mapped tool exists; mapping one twice throws.

### `mcp.tools.map(group: ToolGroup, controller: Controller | Lazy<Controller>): void`

Registers every tool in a group with `{ middleware?, actions }`, one action per tool, so a tool
added to the group is a type error until it is handled. A nested group needs its own `map()`.

### `mcp.resources.map(resource: Resource, action: ResourceAction | Lazy<ResourceAction>): void`

Registers a resource with `read`, and optionally `list` and `available`. A URI matching several
resources resolves to the most specific pattern; mapping one twice throws.

### `mcp.fetch(input: Request | RequestContext): Promise<Response>`

Answers one MCP request. A `RequestContext` carries what the surrounding middleware provided; a
bare `Request` gets a fresh context.

### `tool(name: string, definition: ToolDefinition): Tool`

Declares a tool. `name` is 1–128 characters of letters, digits, `_`, `-` and `.`. `definition`
holds `description`, `input`, and optionally `title`, `output` and `annotations`
(`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`, `title`). `input` and
`output` must describe a JSON Schema object, so a root `s.union`, `s.variant` or `s.nullable`
throws at declaration, as does an invalid name.

### `tools(group: ToolGroup): ToolGroup`

Groups tools and nested groups, returning the tree unchanged. A tool keeps its declared name
wherever it sits; two tools sharing a name throw.

### `walk(group: ToolGroup): Generator<Tool>`

Yields every tool in a tree, depth first in declaration order.

### `createTool(tool, action)` and `createToolController(group, controller)`

Return their second argument, typed against the declaration, so an implementation in its own file
keeps `ctx.input` typed from the schema.

### `resource(pattern: string, declaration: ResourceDeclaration): Resource`

Declares a resource. `declaration` holds `name`, and optionally `title`, `description` and
`mimeType`. The pattern may use static text, `:name` (published as `{name}`) and `*name`
(published as `{+name}`, which spans `/`). Optionals, search constraints, unnamed wildcards,
braces and repeated names have no [RFC 6570](https://datatracker.ietf.org/doc/html/rfc6570) form
and throw. A custom scheme such as `notes://` works the same as `https://`.

### `resource.href(variables): string`

Builds the resource's URI from its variables, typed by the pattern.

### `resources(group: ResourceGroup): ResourceGroup`

Groups resources, returning the tree unchanged. Two resources sharing a name or a pattern throw.

### `walkResources(group: ResourceGroup): Generator<Resource>`

Yields every resource in a tree, depth first in declaration order.

### `createResource(resource, action)`

Returns `action`, typed against the declaration, so `ctx.variables` stays typed in its own file.

### `lazy(load: () => Promise<{ default: Target }>): Lazy<Target>`

Wraps a dynamic import wherever `map()` takes an implementation. The module loads on the first
request that needs it, once per isolate; a failed import is retried by the next request.

### `validateArguments(tool: Tool, value: unknown): Result<Input, InvalidArgumentsError>`

Parses an `arguments` object with a tool's input schema, with the rules described under
[Declare a tool](#declare-a-tool). The handler runs it before middleware; call it to apply the
same rules elsewhere.

### `contextFor(input: Request | RequestContext): RequestContext`

Returns a `RequestContext` unchanged, or builds one around a bare `Request`.

### Errors

- `ToolError`: Thrown by a handler or middleware; its message reaches the model as a result with
  `isError`.
- `ForbiddenError`: Thrown by middleware to refuse a call, reported as JSON-RPC `-32602`.
- `InvalidArgumentsError`: Arguments failed the schema. `issues` holds one `path: message` entry
  per failed constraint (`page.size: Expected integer`, `query: Required`).

How each failure reaches the client:

| Situation                                 | Answer                                  | HTTP |
| ----------------------------------------- | --------------------------------------- | ---- |
| `ToolError`                               | Result with `isError`, message intact   | 200  |
| Any other exception in a tool             | Result with `isError`, generic message  | 200  |
| Unknown or unavailable tool or resource   | `-32602`                                | 200  |
| Invalid arguments, or `ForbiddenError`    | `-32602`, with `issues` for arguments   | 200  |
| Read returns `null`                       | `-32602`, with the URI                  | 200  |
| Exception in a resource read              | `-32603`                                | 200  |
| Unknown method                            | `-32601`                                | 404  |
| Header disagrees with body, or is missing | `-32020`                                | 400  |
| Unsupported protocol version              | `-32022`, with the supported versions   | 400  |
| Missing `_meta` protocol fields           | `-32602`                                | 400  |
| Not `POST` / origin refused / not JSON    | `405` / `403` / `415`, no JSON-RPC body | —    |

A notification (a message without `id`) is answered with `202`, and a batched request is refused.

### Protocol constants

- `SUPPORTED_PROTOCOL_VERSIONS`: The revisions this package implements, `["2026-07-28"]`.
- `LATEST_PROTOCOL_VERSION`: The newest of them.
- `MetaKey`: The reserved `_meta` keys `ProtocolVersion`, `ClientInfo`, `ClientCapabilities` and
  `ServerInfo`.
- `ErrorCode`: The JSON-RPC codes the server answers with, `ParseError` through
  `UnsupportedProtocolVersion`.

### Context keys

`ToolInput`, `CurrentTool`, `ResourceUri`, `ResourceVariables` and `CurrentResource` hold what
handlers read as `ctx.input`, `ctx.tool`, `ctx.uri`, `ctx.variables` and `ctx.resource`; read them
with `ctx.get()` from code typed with a plain `RequestContext`.

### Types

- `ToolContext<Input>`, `ResourceContext<Variables>`: The request's context plus what a tool or
  resource handler reads. `AnyRequestContext` is a context over any middleware chain, and
  `ResourceVariableValues` is what a pattern captured.
- `HandlerOptions`, `McpHandler`, `CacheScope`: What `createHandler` takes and returns.
- `Tool`, `ToolGroup`, `ToolDefinition`, `ToolDescriptor`, `ToolAnnotations`, `ToolSchema`,
  `Action`, `ActionOrHandler`, `Controller`, `ToolHandler`, `ToolMiddleware`, `CallToolResult`,
  `TextContent`: The tool side. `InputOf<typeof tool>` is a tool's parsed input.
- `Resource`, `ResourceGroup`, `ResourceDeclaration`, `ResourceDescriptor`, `ResourceAction`,
  `ResourceListing`, `ResourceContents`, `ReadResult`: The resource side. `Routable<Pattern>` is the
  `https` form a custom-scheme pattern is matched under.
- `Lazy<Target>`: What `lazy()` returns.
- `Implementation`, `ClientCapabilities`: A self-reported name and version, and what a client
  declares it can do.

## Pattern: Mounting On A Router With Its Middleware

Mounted on a route, the router's middleware authenticates every MCP method, `tools/list`
included, and whatever it provides reaches handlers through `ctx.get()`. With
[`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger)'s `log()` in the chain, the request's
record gains `mcp.method`, `mcp.protocol_version`, `mcp.tool` with `mcp.is_error`, or
`mcp.resource` (the pattern, never the URI).

```typescript
import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware";
import { createHandler } from "@sdxc/mcp/server";
import { createRouter } from "remix/router";
import { route } from "remix/routes";

import { requireApiKey } from "./auth.js";
import { Database, database } from "./database.js";
import { toolset } from "./tools.js";

let mcp = createHandler({ name: "documents", version: "1.0.0" });

mcp.tools.map(toolset.searchDocuments, (ctx) =>
	ctx.get(Database).search(ctx.input.query, ctx.input.limit),
);

let routes = route({ mcp: "/mcp" });
let router = createRouter({
	middleware: [log(createLogger({ service: "documents" })), database()],
});

router.map(routes.mcp, {
	middleware: [requireApiKey()],
	handler: (ctx) => mcp.fetch(ctx),
});
```

A host without a router builds the context itself, such as a Durable Object providing its own
storage:

```typescript
import { DurableObject } from "cloudflare:workers";
import { RequestContext } from "remix/router";

export class DocumentsServer extends DurableObject {
	fetch(request: Request) {
		let ctx = new RequestContext(request);
		ctx.set(Database, this.database);
		return mcp.fetch(ctx);
	}
}
```

## Pattern: Grouping Tools Under One Controller

Nest tools in a group to map them together under shared middleware. A tool's address stays its
declared name.

```typescript
import * as s from "@sdxc/json-schema";
import { createHandler, tool, tools } from "@sdxc/mcp/server";

import { requireScope } from "./auth.js";

let toolset = tools({
	documents: tools({
		list: tool("list_documents", { description: "Lists every document.", input: s.object({}) }),
		get: tool("get_document", {
			description: "Reads one document in full.",
			input: s.object({ slug: s.string() }),
		}),
	}),
});

let mcp = createHandler({ name: "documents", version: "1.0.0" });

mcp.tools.map(toolset.documents, {
	middleware: [requireScope("documents:read")],
	actions: {
		list: () => listDocuments(),
		get: (ctx) => findDocument(ctx.input.slug), // slug: string
	},
});
```

## Pattern: One File Per Handler, Imported On First Use

`createTool`, `createToolController` and `createResource` keep a handler typed in its own module,
and `lazy()` defers that module until a request needs it, so a Worker starts without the code for
every tool.

```typescript
// tools/search-documents.ts
import { createTool } from "@sdxc/mcp/server";

import { toolset } from "../tools.js";

export default createTool(toolset.searchDocuments, (ctx) => search(ctx.input.query));
```

```typescript
// resources/article.ts
import { createResource } from "@sdxc/mcp/server";

import { resourceset } from "../resources.js";

export default createResource(resourceset.article, {
	read: (ctx) => findArticleContent(ctx.variables.slug),
});
```

```typescript
// server.ts
import { createHandler, lazy } from "@sdxc/mcp/server";

import { resourceset } from "./resources.js";
import { toolset } from "./tools.js";

let mcp = createHandler({ name: "documents", version: "1.0.0", cacheScope: "public" });

mcp.tools.map(
	toolset.searchDocuments,
	lazy(() => import("./tools/search-documents.js")),
);
mcp.tools.map(
	toolset.documents,
	lazy(() => import("./tools/documents.js")),
);
mcp.resources.map(
	resourceset.article,
	lazy(() => import("./resources/article.js")),
);
```

`tools/call` and `resources/read` import only the module they reach. Lists import every module,
since `available` and `list` live there. A lazy handler makes lists `"private"` by default; set
`cacheScope: "public"` when no handler declares `available`.

## Pattern: Hiding A Tool From A Caller

A tool whose `available` returns `false` is absent from `tools/list` and answered as unknown by
`tools/call`, so a read-only credential never learns a write tool exists. Middleware enforces the
same rule on the call itself, for a client working from a stale list.

```typescript
import type { ToolMiddleware } from "@sdxc/mcp/server";

import { ForbiddenError } from "@sdxc/mcp/server";

import { ApiKey } from "./auth.js";

function requireScope(scope: string): ToolMiddleware {
	return (ctx, next) => {
		if (!ctx.get(ApiKey).scopes.includes(scope)) throw new ForbiddenError(`Requires ${scope}`);
		return next();
	};
}

mcp.tools.map(toolset.documents.create, {
	available: (ctx) => ctx.get(ApiKey).scopes.includes("documents:write"),
	middleware: [requireScope("documents:write")],
	handler: (ctx) => createDocument(ctx.input),
});
```

`ResourceAction` takes the same `available`: a hidden resource leaves every list and reads as not
found. Declaring `available` anywhere makes lists `"private"` by default.

## Pattern: Metering And Guarding Calls With Tool Middleware

Tool middleware receives the call's `CallToolResult` from `next()`, so it can record an outcome.
It runs after arguments are validated, in three layers: `toolMiddleware` on the handler, a
controller's `middleware`, then an action's. Type `ctx.input` with `InputOf` only where the
middleware reads it.

```typescript
import type { InputOf, ToolMiddleware } from "@sdxc/mcp/server";

import { createHandler, ToolError } from "@sdxc/mcp/server";

import { ApiKey } from "./auth.js";
import { toolset } from "./tools.js";

let meterUsage: ToolMiddleware = async (ctx, next) => {
	let result = await next();
	if (!result.isError) await recordUsage(ctx.get(ApiKey).teamId, ctx.tool.name);
	return result;
};

function requireOwnDocument(): ToolMiddleware<InputOf<typeof toolset.documents.get>> {
	return async (ctx, next) => {
		let document = await findDocument(ctx.input.slug);
		if (document?.teamId !== ctx.get(ApiKey).teamId) throw new ToolError("No such document.");
		return next();
	};
}

let mcp = createHandler({ name: "documents", version: "1.0.0", toolMiddleware: [meterUsage] });

mcp.tools.map(toolset.documents.get, {
	middleware: [requireOwnDocument()],
	handler: (ctx) => findDocument(ctx.input.slug),
});
```

## Pattern: Structured Results And Unexpected Failures

Declaring `output` publishes an `outputSchema`, and the handler's return value is then sent as
`structuredContent` as well as JSON text. `onError` receives what the model never sees.

```typescript
import * as s from "@sdxc/json-schema";
import { createHandler, tool, ToolError } from "@sdxc/mcp/server";

let getWeather = tool("get_weather", {
	description: "Current conditions for a city.",
	input: s.object({ city: s.string() }),
	output: s.object({ celsius: s.number(), summary: s.string() }),
	annotations: { readOnlyHint: true, openWorldHint: true },
});

let mcp = createHandler({
	name: "weather",
	version: "1.0.0",
	onError(error, { method, tool }) {
		reportException(error, { method, tool });
	},
});

mcp.tools.map(getWeather, async (ctx) => {
	let response = await fetch(
		`https://weather.example.com/v1/${encodeURIComponent(ctx.input.city)}`,
	);
	if (response.status === 404)
		throw new ToolError(`Unknown city ${ctx.input.city}. Try a nearby one.`);
	if (!response.ok) throw new Error(`Weather upstream answered ${response.status}`);
	let body = await response.json();
	return { celsius: body.temp_c, summary: body.condition };
});
```

The 404 reaches the model as guidance it can act on; the upstream failure reaches `onError`, while
the model reads only that `get_weather` failed.

## Pattern: Resources Under A Scheme Of Your Own

A custom scheme addresses content a client cannot fetch itself. Which list a resource appears in
follows from its declaration:

| Declaration                    | `resources/list`         | `resources/templates/list` |
| ------------------------------ | ------------------------ | -------------------------- |
| Captures variables, has `list` | the enumerated instances | yes                        |
| Captures variables, no `list`  | —                        | yes                        |
| Captures nothing               | itself                   | —                          |

```typescript
import { createHandler, resource, resources } from "@sdxc/mcp/server";

let resourceset = resources({
	index: resource("notes://index", { name: "Index", mimeType: "text/markdown" }),
	note: resource("notes://:folder/*path", { name: "Note", mimeType: "text/markdown" }),
	attachment: resource("notes://attachments/:id", { name: "Attachment" }),
});

let mcp = createHandler({ name: "notes", version: "1.0.0" });

mcp.resources.map(resourceset.index, { read: () => renderIndex() });

mcp.resources.map(resourceset.note, {
	async list() {
		let notes = await listNotes();
		return notes.map((note) => ({
			uri: resourceset.note.href({ folder: note.folder, path: note.path }), // notes://work/a/b.md
			name: note.title,
		}));
	},
	read: (ctx) => readNote(ctx.variables.folder, ctx.variables.path),
});

mcp.resources.map(resourceset.attachment, {
	async read(ctx) {
		let file = await findAttachment(ctx.variables.id);
		if (file === null) return null;
		return [{ mimeType: file.type, blob: file.base64 }];
	},
});
```

A read returns a string as text, a `Uint8Array` as a Base64 blob, or a `ResourceContents[]`;
`null` reports the resource as missing.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/mcp": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
