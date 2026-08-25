# @pkg/mcp

Model Context Protocol servers as `remix/router` actions: tools and resources are declared like routes, handled like controllers, and served over stateless Streamable HTTP.

## Overview

Protocol revision `2026-07-28` made MCP stateless. There is no `initialize` handshake, no
session id, and no held-open stream — every request states its own protocol version and
client capabilities, and the server answers it independently. That removes the reason an
MCP server needed infrastructure of its own: what is left is a function from a request to
a response, which is an ordinary route.

So this package treats it as one. A tool's name and input schema are its route; a handler
and its middleware are its controller; and `fetch` takes the `RequestContext` an
application already has, so the middleware that provides a database, a session, or an
authenticated caller is the same middleware the MCP surface runs under. There is no second
context system and no second place to configure authentication.

A tool's JSON Schema is written once. MCP puts JSON Schema on the wire, so it has to exist
anyway; the handler's argument type is derived from it rather than declared beside it.

## Usage

### Declaring tools — like a route table

```typescript
// app/mcp/tools.ts
import { tool, tools } from "@pkg/mcp";

export default tools({
	searchPosts: tool("search_posts", {
		description: "Searches published posts by title, excerpt and tags.",
		input: {
			type: "object",
			properties: {
				query: { type: "string", description: "What to search for." },
				type: { type: "string", enum: ["articles", "tutorials"] },
				limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
			},
			required: ["query"],
		},
		annotations: { readOnlyHint: true },
	}),

	posts: tools({
		list: tool("list_posts", { description: "…", input: { type: "object", properties: {} } }),
		get: tool("get_post", { description: "…", input: { type: "object", properties: {} } }),
	}),
});
```

### Handling them — like controllers

```typescript
// bootstrap/mcp.ts
import { createHandler, ToolError } from "@pkg/mcp";
import toolset from "~/app/mcp/tools";

let mcp = createHandler({
	name: "blog",
	version: "1.0.0",
	instructions: "Search and read the posts published on this blog.",
});

mcp.tools.map(toolset.searchPosts, async (ctx) => {
	// ctx.input.query is string, ctx.input.type is "articles" | "tutorials" | undefined,
	// ctx.input.limit is number — all derived from the schema, with no second declaration.
	let posts = await Post.search(ctx.get(Database), ctx.input.query, ctx.input);
	return { posts: posts.map(serialize) };
});

mcp.tools.map(toolset.posts, {
	actions: {
		list: (ctx) => Post.listItems(ctx.get(Database)),
		get: async (ctx) => {
			let post = await Post.findBySlug(ctx.get(Database), ctx.input.slug);
			if (!post) throw new ToolError("No published post has that slug. Try search_posts.");
			return serialize(post);
		},
	},
});

export default mcp;
```

### Mounting it

`fetch` takes a `RequestContext` or a bare `Request`, which covers every host:

```typescript
// In the app's own router — everything the app's middleware provides reaches tools.
router.map(routes.mcp, (ctx) => mcp.fetch(ctx));

// A Worker, with nothing to provide.
export default { fetch: mcp.fetch };

// A Durable Object, providing its own values.
export class BlogMcp extends DurableObject {
	fetch(request: Request) {
		let ctx = new RequestContext(request);
		ctx.set(Database, this.db);
		return mcp.fetch(ctx);
	}
}
```

## Handlers in their own files

`createTool`, `createToolController` and `createResource` are this package's
`createAction` / `createController`: type anchors that let an implementation live apart
from the `map()` call and still receive a fully typed context.

```typescript
// app/mcp/controllers/posts.ts
import { createToolController } from "@pkg/mcp";
import toolset from "~/app/mcp/tools";

export default createToolController(toolset.posts, {
	middleware: [requireScope("posts:read")],
	actions: {
		list: (ctx) => Post.listItems(ctx.get(Database)),
		get: (ctx) => Post.findBySlug(ctx.get(Database), ctx.input.slug), // ctx.input.slug: string
	},
});

// bootstrap/mcp.ts
mcp.tools.map(toolset.posts, postsController);
```

A controller must answer **every** tool in the group it names, so adding a tool to the
declaration is a type error until it is handled. `createTool` does the same for one tool,
and `createResource` for one resource.

## Resources

A resource is addressed by URI, and a URI is a URL — so the pattern is a
`remix/route-pattern`, the same syntax the app declares routes with. The RFC 6570 template
MCP publishes is derived from it, so there is no second declaration to keep in step.

```typescript
// app/mcp/resources.ts
export default resources({
	article: resource("https://sergiodxa.com/articles/:slug.md", {
		name: "Article",
		title: "Blog article",
		description: "A published article, as Markdown.",
		mimeType: "text/markdown",
	}),
});

// bootstrap/mcp.ts
mcp.resources.map(resourceset.article, {
	available: (ctx) => true,

	// Optional. Enumerates instances for resources/list.
	list: async (ctx) => {
		let posts = await ArticlePost.listItems(ctx.get(Database));
		return posts.map((post) => ({
			uri: resourceset.article.href({ slug: post.slug }), // typed, never concatenated
			name: post.title,
		}));
	},

	// Required. null means the resource does not exist.
	read: async (ctx) => {
		let post = await ArticlePost.findBySlug(ctx.get(Database), ctx.variables.slug);
		return post?.meta.content ?? null;
	},
});
```

**Why resources as well as tools.** They differ by who reaches for them: a tool is chosen
by the _model_, a resource is picked by the _person_ or attached by their client. A reader
who wants to hand one post to their agent has no slug to give a tool, and no tool can be
browsed — `resources/list` is what puts the corpus in the client's picker.

`ctx.variables`, not `ctx.params`: `RequestContext.params` already holds the route's own
params, and installing URI captures there would shadow them.

### Which list a declaration lands in

Derived from the declaration, not configured:

| Declaration                    | `resources/list`         | `resources/templates/list` |
| ------------------------------ | ------------------------ | -------------------------- |
| Captures variables, has `list` | the enumerated instances | yes                        |
| Captures variables, no `list`  | —                        | yes                        |
| Captures nothing               | itself                   | —                          |

### The pattern subset

`resource()` converts the pattern to RFC 6570 at declaration and throws when it cannot:
optionals (`(.:ext)`), protocol alternation (`http(s)://`), search constraints (`?draft=1`),
unnamed wildcards (`*`) and repeated capture names have no equivalent. Refusing early beats
publishing a template a client would expand into a URI this server never matches. A
resource needing an optional segment is two resources.

`:name` becomes `{name}`; `*name` becomes `{+name}`, whose reserved expansion is what
allows the `/` a wildcard matches.

### Resources have no `isError` channel

The sharpest asymmetry with tools. A tool can hand the model a recoverable message through
`isError`; a resource read cannot — MCP gives it only JSON-RPC errors. So there is no
`ToolError` equivalent for a read: returning `null` is `-32602` (not found, carrying the
URI), and any exception is `-32603` plus `onError`.

`null` rather than an empty array because the specification forbids an empty `contents` for
a resource that does not exist — it cannot be told apart from one that is simply empty.

## Middleware

Two kinds, and the split follows what each one wraps.

**Request middleware is `remix/router`'s.** Authentication, logging, providing a
database — none of it is MCP-specific, so none of it is redefined here:

```typescript
router.map(routes.mcp, {
	middleware: [requireApiKey()], // an ordinary remix Middleware
	handler: (ctx) => mcp.fetch(ctx),
});
```

It runs for every MCP method, which is what authentication needs: `tools/list` must be
authenticated too, since the list a caller sees depends on their credential.

**Tool middleware is this package's**, because a tool call is not an HTTP request and its
answer is not a `Response` — a middleware that meters or logs an outcome needs the result:

```typescript
export function meterUsage(): ToolMiddleware {
	return async (ctx, next) => {
		let result = await next();
		if (!result.isError) await recordUsage(ctx.get(ApiKey).team_id, ctx.tool.name);
		return result;
	};
}
```

It attaches at three levels, innermost last:

```typescript
createHandler({ toolMiddleware: [meterUsage()] }); // every tool call

mcp.tools.map(toolset.monitors, {
	middleware: [requireScope("monitors:read")], // this group's calls
	actions: {
		create: {
			available: (ctx) => ctx.get(ApiKey).scopes.includes("monitors:write"),
			middleware: [requireScope("monitors:write")], // this call only
			handler: (ctx) => Monitor.create(/* … */),
		},
	},
});
```

`ToolMiddleware`'s input type is erased by default, and because parameters are
contravariant a middleware written that way is assignable anywhere. Name a tool's input
only when the middleware reads it:

```typescript
function requireOwnMonitor(): ToolMiddleware<InputOf<typeof toolset.monitors.get>> {
	return async (ctx, next) => {
		let monitor = await Monitor.find(ctx.get(Database), ctx.input.monitorId); // typed
		if (monitor?.team_id !== ctx.get(ApiKey).team_id) throw new ToolError("No such monitor.");
		return next();
	};
}
```

## `available` — hiding a tool from a caller

`available` decides whether a tool exists for this caller. One it refuses is absent from
`tools/list` **and** reported by `tools/call` as an unknown tool, so a read-only credential
never learns that a write tool is there.

It is separate from middleware because middleware only runs on a call, and `tools/list`
needs an answer before any call happens. A scope therefore appears twice — once to hide
the tool, once to enforce it — and the second is the backstop for a client working from a
stale list.

Declaring any `available` also flips the tool list's `cacheScope` to `private`, since a
list that varies by credential must not be held by a shared intermediary.

## Where each kind of failure is reported

MCP reports two categories in two places, and putting one in the other is the mistake
worth avoiding: a JSON-RPC error never reaches the model, so a failure it could act on
disappears, while a tool result the model reads is the wrong home for a stack trace.

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

`ToolError`'s message is the one written for a model, so it should read as guidance — what
was wrong, and what would work instead. Every other exception was written for an operator
and may carry a query fragment or an upstream URL, so only `onError` receives it.

## Argument handling

Arguments are filled in by a language model, and the validator is shaped around what a
model actually sends rather than around strictness for its own sake.

- An **undeclared property is dropped**, not refused. A model that invents an argument has
  still asked for something the tool can do.
- **`null` counts as absent.** Models spell an omitted optional as `null` constantly, and
  treating it as a type error refuses a call that was perfectly clear.
- A **`default` is substituted**, and the derived type marks that property present — so a
  handler reads `ctx.input.limit` rather than `ctx.input.limit ?? 20`, which would restate
  the default the schema already declares.
- **Every constraint is checked** before answering, so a caller that got two arguments
  wrong learns about both in one round trip.
- Nothing is **coerced**: `"20"` is not `20`. A model that sent a string for a number
  misread the schema, and quietly accepting it hides that from the next call.

Validation runs before tool middleware, which is what lets middleware read `ctx.input` as
a typed value. The cost is that middleware cannot rewrite raw arguments ahead of the
schema, which is deliberate.

## The schema subset

Objects of scalars, enums, and arrays, plus nested objects. `string` (with `enum`,
`minLength`, `maxLength`, `pattern`, `format`, `default`), `number` and `integer` (with
`minimum`, `maximum`, `default`), `boolean`, `array` (with `items`, `minItems`,
`maxItems`), and `object` (with `properties`, `required`).

This revision loosened `inputSchema` to permit any JSON Schema 2020-12, and the subset is
narrower on purpose. There is no `oneOf`, no `nullable`, and no union: each makes a schema
harder for a model to satisfy without making the tool more capable — a model offered a
choice between a value and `null` supplies `null`, and one offered a discriminated union
picks the wrong arm. Four clearly named tools beat one tool with a union argument.

## Protocol revision

`SUPPORTED_PROTOCOL_VERSIONS` lists what this package speaks: `2026-07-28` only. The
handshake-based revisions (`2025-11-25` and earlier) are a different era rather than a
lower version — supporting one would mean implementing `initialize`, sessions, and a
GET stream, which is the machinery this design exists without.

A request naming any other version is refused with `UnsupportedProtocolVersion` carrying
the supported list, which is how a client is told to retry rather than to fall back.

Batched requests are refused. This revision removed them.

## Scope

Tools and resources. No prompts, no completions, and no `subscriptions/listen`, so a `GET`
or `DELETE` is answered with `405` and `capabilities` advertises only what is actually
mapped.

Sampling, roots and logging are **deprecated** in this revision and will never be added.
Prompts and `completion/complete` are active and deliberately omitted: prompts are
user-invoked templates, which needs a workflow worth curating before it is worth building,
and completion exists to autocomplete prompt arguments and resource-template variables, so
it follows whichever of those arrives first.

`subscriptions/listen` is the one omission with an architectural reason rather than a scope
one. It is a long-lived SSE stream the server holds open, which in a Worker means billed
wall-clock and a connection pinned to one isolate — the cost model this design exists to
avoid. `ttlMs` covers freshness instead. A Durable Object would be the honest home if it is
ever wanted.
