# @sdxc/mcp

Model Context Protocol servers as `remix/router` actions, served over stateless Streamable HTTP.

Revision `2026-07-28` of the [Model Context Protocol](https://modelcontextprotocol.io) made
MCP stateless: no handshake, no session id, no held-open stream. What is left is a function
from a request to a response, which is an ordinary route — so a tool's name and input schema
are its route, a handler and its middleware are its controller, and `fetch` takes the
`RequestContext` an application already has.

## Installation

```bash
npm add @sdxc/mcp
```

Handlers receive the `RequestContext` from [`remix`](https://www.npmjs.com/package/remix),
argument validation reports through
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), and log enrichment goes through
[`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger). All three install alongside this
package.

## Usage

### Declare A Tool

A tool declaration is the route table: the name a client calls, the prompt a model chooses it
by, and the [JSON Schema](https://json-schema.org) its arguments satisfy.

```typescript
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

### Handle It

```typescript
import { createHandler, ToolError } from "@sdxc/mcp";

import toolset from "./tools.js";

let mcp = createHandler({
	name: "documents",
	version: "1.0.0",
	instructions: "Search and read the documents this server publishes.",
});

mcp.tools.map(toolset.searchDocuments, async (ctx) => {
	// ctx.input.query is string and ctx.input.limit is number, both derived from the
	// schema, with no second declaration.
	let documents = await search(ctx.input.query, ctx.input.limit);
	if (documents.length === 0) throw new ToolError("Nothing matched. Try a broader query.");
	return documents;
});

export default { fetch: mcp.fetch };
```

A returned string becomes the answer verbatim, and any other value is serialized as JSON. A
`ToolError` message reaches the model as a result it can act on, so it reads as guidance: what
was wrong, and what would work instead.

### Group Tools Under One Controller

Grouping is what lets one `map()` call cover several tools under a shared middleware chain. A
tool's address stays the name it was declared with, wherever it sits in the tree.

```typescript
import { tool, tools } from "@sdxc/mcp";

let toolset = tools({
	documents: tools({
		list: tool("list_documents", { description: "…", input: { type: "object", properties: {} } }),
		get: tool("get_document", {
			description: "…",
			input: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] },
		}),
	}),
});

mcp.tools.map(toolset.documents, {
	middleware: [requireScope("documents:read")],
	actions: {
		list: (ctx) => listDocuments(ctx.get(Database)),
		get: (ctx) => findDocument(ctx.get(Database), ctx.input.slug), // ctx.input.slug: string
	},
});
```

A controller answers **every** tool in the group it names, so adding a tool to the declaration
is a type error until it is handled. A nested group needs its own `map()` call.

### Declare A Resource

A resource is addressed by URI, and a URI is a URL — so the pattern is a
`remix/route-pattern`, the same syntax an application declares routes with.

```typescript
import { resource, resources } from "@sdxc/mcp";

let resourceset = resources({
	article: resource("https://example.com/articles/:slug.md", {
		name: "Article",
		title: "Published article",
		description: "A published article, as Markdown.",
		mimeType: "text/markdown",
	}),
});

mcp.resources.map(resourceset.article, {
	// Optional. Enumerates instances for resources/list.
	list: async (ctx) => {
		let articles = await listArticles(ctx.get(Database));
		return articles.map((article) => ({
			uri: resourceset.article.href({ slug: article.slug }), // typed, never concatenated
			name: article.title,
		}));
	},

	// Required. null reports the resource as missing.
	read: async (ctx) => {
		let article = await findArticle(ctx.get(Database), ctx.variables.slug);
		return article?.content ?? null;
	},
});
```

Tools and resources differ by who reaches for them: a tool is chosen by the _model_, a resource
is picked by the _person_ or attached by their client, and `resources/list` is what puts a
corpus in the client's picker. Captures arrive as `ctx.variables`, leaving
`RequestContext.params` to the route's own params.

## Resource URIs

The RFC 6570 template MCP publishes is derived from the pattern, so there is no second
declaration to keep in step: `:name` becomes `{name}`, and `*name` becomes `{+name}`, whose
reserved expansion is what allows the `/` a wildcard matches.

`resource()` converts the pattern at declaration and throws when it cannot. Optionals
(`(.:ext)`), search constraints (`?draft=1`), unnamed wildcards (`*`), braces and repeated
capture names have no [RFC 6570](https://datatracker.ietf.org/doc/html/rfc6570) equivalent.
Refusing early beats publishing a template a client would expand into a URI this server never
matches; a resource needing an optional segment is two resources.

Which list a declaration lands in follows from the declaration itself:

| Declaration                    | `resources/list`         | `resources/templates/list` |
| ------------------------------ | ------------------------ | -------------------------- |
| Captures variables, has `list` | the enumerated instances | yes                        |
| Captures variables, no `list`  | —                        | yes                        |
| Captures nothing               | itself                   | —                          |

A read has no `isError` channel: MCP gives it only JSON-RPC errors, so returning `null` is
`-32602` carrying the URI, and any exception is `-32603` plus `onError`. `null` rather than an
empty array, which the specification reserves for a resource that exists with nothing to show.

## Argument Handling

Arguments are filled in by a language model, so the validator is shaped around what a model
actually sends rather than around strictness for its own sake.

- An **undeclared property is dropped**, not refused. A model that invents an argument has
  still asked for something the tool can do.
- **`null` counts as absent.** Models spell an omitted optional as `null` constantly, and
  treating it as a type error refuses a call that was perfectly clear.
- A **`default` is substituted**, and the derived type marks that property present — so a
  handler reads `ctx.input.limit` rather than `ctx.input.limit ?? 20`, which would restate the
  default the schema already declares.
- **Every constraint is checked** before answering, so a caller that got two arguments wrong
  learns about both in one round trip.
- Values are taken as sent: `"20"` is not `20`. A model that sent a string for a number misread
  the schema, and quietly accepting it hides that from the next call.

Validation runs before tool middleware, which is what lets middleware read `ctx.input` as a
typed value.

The schema subset is `string` (with `enum`, `minLength`, `maxLength`, `pattern`, `format`,
`default`), `number` and `integer` (with `minimum`, `maximum`, `default`), `boolean`, `array`
(with `items`, `minItems`, `maxItems`), and `object` (with `properties`, `required`), nested
however deep. There is no `oneOf`, no `nullable` and no union: each makes a schema harder for a
model to satisfy without making the tool more capable, and four clearly named tools beat one
tool with a union argument.

## Where Each Kind Of Failure Is Reported

MCP reports two categories in two places, and putting one in the other is the mistake worth
avoiding: a JSON-RPC error never reaches the model, so a failure it could act on disappears,
while a tool result the model reads is the wrong home for a stack trace.

| Situation                            | Reported as                             | HTTP | The model sees        |
| ------------------------------------ | --------------------------------------- | ---- | --------------------- |
| Unknown RPC method                   | `-32601`                                | 404  | Nothing               |
| Unknown tool, or one `available` hid | `-32602`                                | 200  | Nothing               |
| Arguments fail the schema            | `-32602`, with every failed constraint  | 200  | Nothing               |
| `ForbiddenError` from middleware     | `-32602`                                | 200  | Nothing               |
| `ToolError` from a handler           | Result with `isError`, message intact   | 200  | The message, verbatim |
| Any other exception                  | Result with `isError`, message replaced | 200  | That the tool failed  |
| Header disagrees with body           | `-32020`                                | 400  | Nothing               |
| Unsupported protocol version         | `-32022`, listing supported             | 400  | Nothing               |
| Missing `_meta` protocol fields      | `-32602`                                | 400  | Nothing               |

`ToolError`'s message is the one written for a model. Every other exception was written for an
operator and may carry a query fragment or an upstream URL, so only `onError` receives it.

Below the message layer, a request that is not a `POST` is answered with `405`, a disallowed
`Origin` with `403`, a body that is not declared `application/json` with `415`, and a
notification — a message with no `id` — with `202`.

`SUPPORTED_PROTOCOL_VERSIONS` lists what this package speaks: `2026-07-28` only, so a request
naming any other version is refused with the supported list, which is how a client is told to
retry rather than to fall back. Batched requests are refused, since this revision removed them.
The surface is tools and resources, and `capabilities` advertises only what is actually mapped.

## API

### `createHandler(options: HandlerOptions): McpHandler`

Builds the handler for one server. Tools and resources register in insertion order, so every
list stays deterministic for whatever cache a client keeps of it.

- `name`: Stable identifier for this server.
- `title?`: Human-readable name for a client that renders one.
- `version`: This server's own version, independent of the protocol revision.
- `instructions?`: How to use the server as a whole, delivered with `server/discover` for a
  client to put in the model's system prompt.
- `toolMiddleware?`: Middleware wrapping every tool call, before any group or action
  middleware.
- `listTtlMs?`: How long a client may cache a list result. Defaults to `60000`.
- `cacheScope?`: `"public"` or `"private"`. Defaults to `"private"` once any tool or resource
  declares `available`, since such a list varies by credential.
- `allowedOrigins?`: A list of origins or a predicate, checked when a request carries `Origin`.
  Omitting it allows any origin.
- `onError?`: Receives an exception a handler did not expect, along with the method, tool and
  URI, while the caller receives only a generic failure.

### `mcp.tools.map(tool: Tool, action: ActionOrHandler): void`

Binds a handler to one tool, or an action object carrying that tool's own `middleware` and
`available`. Mapping is what registers a tool: only a mapped tool exists, the same way only a
mapped route is served. Mapping the same tool twice throws.

### `mcp.tools.map(group: ToolGroup, controller: Controller): void`

Binds one action per tool in a group, under the controller's shared `middleware`. A nested
group typed as an action is a type error, and throws at map time.

### `mcp.resources.map(resource: Resource, action: ResourceAction): void`

Binds `read`, and optionally `list` and `available`, to one resource. Every pattern joins one
matcher, so a URI matching more than one resource resolves to the most specific match.

### `mcp.fetch(input: Request | RequestContext): Promise<Response>`

Answers one MCP request. Pass the `RequestContext` when there is one, so handlers read what the
surrounding middleware provided; pass a bare `Request` and one is built.

### `tool(name: string, definition: ToolDefinition): Tool`

Declares one tool. `name` is limited to the 1–128 characters MCP allows — letters, digits, `_`,
`-` and `.` — and anything else throws at declaration rather than failing a call later.
`definition` carries `description`, `input`, and optionally `title`, `output` and
`annotations`.

### `tools(group: ToolGroup): ToolGroup`

Groups declared tools and nested groups, returning the tree unchanged. Two tools sharing a name
throw, since one of them would be permanently unreachable.

### `walk(group: ToolGroup): Generator<Tool>`

Yields every tool in a declaration tree, depth first in declaration order.

### `createTool(tool: Tool, action: ActionOrHandler): ActionOrHandler`

Types one tool's implementation against its declaration so it can live in its own file. A type
anchor at runtime: it returns what it was given, and `ctx.input` stays typed from the schema.

### `createToolController(group: ToolGroup, controller: Controller): Controller`

The same for a whole group, requiring one action per tool the group declares.

### `resource(pattern: string, declaration: ResourceDeclaration): Resource`

Declares one resource from a `remix/route-pattern` source. `declaration` carries `name`, and
optionally `title`, `description` and `mimeType`. A pattern RFC 6570 cannot express throws; see
[Resource URIs](#resource-uris).

### `resource.href(...args): string`

Builds this resource's URI from its variables, typed by the declared pattern, so a listing
never concatenates one by hand.

### `resources(group: ResourceGroup): ResourceGroup`

Groups declared resources, returning the tree unchanged. Two resources sharing a name or a
pattern throw.

### `walkResources(group: ResourceGroup): Generator<Resource>`

Yields every resource in a declaration tree, depth first in declaration order.

### `createResource(resource: Resource, action: ResourceAction): ResourceAction`

Types one resource's `list` and `read` against its declaration, so they can live in their own
file with `ctx.variables` typed from the pattern.

### `validateArguments(schema: ObjectSchema, value: unknown): Result<Record<string, unknown>, InvalidArgumentsError>`

Checks a `tools/call` arguments object against a schema, filling in defaults and dropping
undeclared properties. The handler runs this for you; call it directly to apply the same rules
somewhere else.

### `contextFor(input: Request | RequestContext): RequestContext`

Returns a `RequestContext` unchanged, or builds one around a bare `Request`. This is what lets
`fetch` accept either.

### Errors

#### `ToolError`

A tool ran and could not do what was asked. Its message reaches the model verbatim, as a result
carrying `isError`.

#### `ForbiddenError`

A tool call is not permitted for this caller, reported as `-32602`. Reaching it means a call
got past the `available` predicate meant to hide the tool — the backstop for a client working
from a stale list.

#### `InvalidArgumentsError`

Arguments did not satisfy a tool's declared schema. Its `issues` array holds one entry per
failed constraint, each naming the property path it applies to.

### Protocol Constants

#### `SUPPORTED_PROTOCOL_VERSIONS`

The revisions this package implements, newest first. A refusal carries this list.

#### `LATEST_PROTOCOL_VERSION`

The revision a server announces when it has to name one.

#### `MetaKey`

The `_meta` keys this revision reserves: `ProtocolVersion`, `ClientInfo`, `ClientCapabilities`
and `ServerInfo`.

#### `ErrorCode`

The JSON-RPC codes this server answers with, from `ParseError` through
`UnsupportedProtocolVersion`.

### Context Keys

`ToolInput`, `CurrentTool`, `ResourceUri`, `ResourceVariables` and `CurrentResource` are the
keys the dispatcher publishes `ctx.input`, `ctx.tool`, `ctx.uri`, `ctx.variables` and
`ctx.resource` through. Read them with `ctx.get()` from code holding only a plain
`RequestContext`.

### Types

- `ToolContext<Input>` and `ResourceContext<Variables>` — a `RequestContext` plus what a tool or
  resource handler reads off it. `AnyRequestContext` is the context generic over any middleware
  chain, and `ResourceVariableValues` is what a pattern captured.
- `HandlerOptions`, `McpHandler` and `CacheScope` — what `createHandler` takes and returns.
- `Tool`, `ToolGroup`, `ToolDefinition`, `ToolDescriptor`, `ToolAnnotations`, `Action`,
  `ActionOrHandler`, `Controller`, `ToolHandler`, `ToolMiddleware`, `CallToolResult`,
  `TextContent` and `InputOf` — the tool side.
- `Resource`, `ResourceGroup`, `ResourceDeclaration`, `ResourceDescriptor`, `ResourceAction`,
  `ResourceListing`, `ResourceContents` and `ReadResult` — the resource side.
- `ObjectSchema`, `StringSchema`, `NumberSchema`, `BooleanSchema`, `ArraySchema`,
  `PropertySchema`, `FromSchema` and `FromObjectSchema` — the schema subset, and the two types
  that derive a handler's argument type from it.
- `Implementation` and `ClientCapabilities` — a self-reported name and version, and what a
  client declares it can do.

## Pattern: Mounting On Any Host

`fetch` takes a `RequestContext` or a bare `Request`, which covers every host. Mounted on a
route, everything the application's middleware provides reaches tools and resources:

```typescript
import { createHandler } from "@sdxc/mcp";

let mcp = createHandler({ name: "documents", version: "1.0.0" });

router.map(routes.mcp, {
	middleware: [requireApiKey()], // an ordinary remix middleware
	handler: (ctx) => mcp.fetch(ctx),
});
```

Request middleware is the router's own — authentication, logging, providing a database, none of
it MCP-specific — and it runs for every method, which is what authentication needs:
`tools/list` must be authenticated too, since the list a caller sees depends on the credential.

A host with no middleware of its own passes the request straight through, and one with values
to provide builds the context itself:

```typescript
import { RequestContext } from "remix/router";

// A Worker, with nothing to provide.
export default { fetch: mcp.fetch };

// A Durable Object, providing its own values.
export class DocumentsMcp extends DurableObject {
	fetch(request: Request) {
		let ctx = new RequestContext(request);
		ctx.set(Database, this.db);
		return mcp.fetch(ctx);
	}
}
```

## Pattern: Hiding A Tool From A Caller

`available` decides whether a tool exists for this caller. One it refuses is absent from
`tools/list` **and** reported by `tools/call` as an unknown tool, so a read-only credential
never learns that a write tool is there:

```typescript
mcp.tools.map(toolset.documents.create, {
	available: (ctx) => ctx.get(ApiKey).scopes.includes("documents:write"),
	middleware: [requireScope("documents:write")],
	handler: (ctx) => createDocument(ctx.get(Database), ctx.input),
});
```

The scope appears twice because middleware only runs on a call, while `tools/list` needs an
answer before any call happens: once to hide the tool, once to enforce it. Declaring any
`available` also flips the list's `cacheScope` to `private`, since a list that varies by
credential must not be held by a shared intermediary. Resources take the same predicate, with
the same effect on their lists and reads.

## Pattern: Metering A Tool Call

Tool middleware is this package's own, because a tool call is not an HTTP request and its
answer is not a `Response` — a middleware that meters or logs an outcome needs the result:

```typescript
import type { ToolMiddleware } from "@sdxc/mcp";

export function meterUsage(): ToolMiddleware {
	return async (ctx, next) => {
		let result = await next();
		if (!result.isError) await recordUsage(ctx.get(ApiKey).teamId, ctx.tool.name);
		return result;
	};
}
```

It attaches at three levels, innermost last: `createHandler({ toolMiddleware })` wraps every
call, a controller's `middleware` wraps that group's calls, and an action's `middleware` wraps
one tool's.

`ToolMiddleware`'s input type is erased by default, and because parameters are contravariant a
middleware written that way is assignable anywhere. Name a tool's input only when the middleware
reads it:

```typescript
import type { InputOf, ToolMiddleware } from "@sdxc/mcp";

import { ToolError } from "@sdxc/mcp";

function requireOwnDocument(): ToolMiddleware<InputOf<typeof toolset.documents.get>> {
	return async (ctx, next) => {
		let document = await findDocument(ctx.get(Database), ctx.input.slug); // typed
		if (document?.teamId !== ctx.get(ApiKey).teamId) throw new ToolError("No such document.");
		return next();
	};
}
```

## Pattern: Enriching The Request Log

The handler writes into the request's own log, so the record a request already emits gains what
only the handler knows:

| Method                  | Fields                                                               |
| ----------------------- | -------------------------------------------------------------------- |
| Every method            | `mcp.method`, `mcp.protocol_version`                                 |
| `tools/call`            | `mcp.tool`, and `mcp.is_error` once there is a result                |
| `resources/read`        | `mcp.resource` — the matched pattern                                 |
| An unexpected exception | `outcome: "error"` with the error's fields, in addition to `onError` |

`mcp.is_error` is `true` for a `ToolError` result, for refused arguments, for a
`ForbiddenError`, and for an unexpected exception, so one filter finds every call the model did
not get a clean answer to. Only the last of those fails the log — a `ToolError` is the tool
answering as designed.

`mcp.resource` records the pattern (`https://example.com/articles/:slug.md`), never the URI: the
URI carries the slug, and a field with one value per document grows the index forever.

The enrichment goes through [`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger)'s
`currentLog()`, so it reaches a bare Worker or a Durable Object that opened a log around its own
`fetch` just as it reaches a router with `log()` in its chain. A host with no log open is served
the same, with nothing recorded.

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
