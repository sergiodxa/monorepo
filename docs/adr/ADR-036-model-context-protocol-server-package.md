# ADR-036: Model Context Protocol Server Package

## Status

**Accepted** - 2026-08-25

## Background

Agents are becoming a way people read and operate software, and the Model Context Protocol is how a server tells an agent what it can do. Two apps here have something worth exposing that way: the blog holds writing an agent should be able to search and read on its owner's behalf, and the uptime app holds live operational state plus the ability to start watching something new.

Protocol revision `2026-07-28` — the one released on that date, two revisions after `2025-06-18` — changes what an MCP server costs to build. It removed the `initialize` handshake, protocol sessions, the standalone SSE stream, and stream resumability, and replaced them with per-request metadata. An MCP server is now a function from a request to a response. That is an ordinary route, which is the observation this package is built on.

## Context

### What Revision `2026-07-28` Removed And Added

| Removed                                              | Added                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `initialize` / `notifications/initialized` handshake | Per-request `_meta`: protocol version, client info, client capabilities |
| `Mcp-Session-Id` and protocol-level sessions         | `server/discover`, which servers **MUST** implement                     |
| The GET stream, `resources/subscribe`                | `subscriptions/listen` as one opt-in POST stream                        |
| `Last-Event-ID` stream resumability                  | `Mcp-Method` / `Mcp-Name` headers mirroring the body                    |
| `ping`, `logging/setLevel`                           | `resultType` required on every result                                   |
| Batched requests                                     | `ttlMs` / `cacheScope` required on list results                         |
| —                                                    | `-32020`/`-32021`/`-32022` in a reserved error sub-range                |

Statelessness is now the specification's own position, not a deployment preference: _"all the information needed to process a request is contained in the request itself."_

### Current State

| Situation                                                         | Consequence                                                          |
| ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| No MCP implementation anywhere in the repo                        | Every app that wants one starts from JSON-RPC                        |
| `remix/data-schema` is the validation standard                    | It is Standard Schema v1: no introspection, no JSON Schema emitter   |
| Every app is a Worker on `remix/router`                           | Anything shaped as `Request => Response` maps as an ordinary route   |
| Apps already have middleware for session, logging, database, auth | An MCP surface with its own middleware layer would redefine all four |
| Two prospective consumers with opposite auth                      | One is anonymous and public, the other credentialed and scope-gated  |

### The Schema Problem

MCP puts JSON Schema on the wire: `tools/list` advertises each tool's `inputSchema`, and that is what a client validates against and what a model reads. A JSON Schema literal has to exist regardless.

`remix/data-schema` cannot produce one. It is Standard Schema v1 compatible, and Standard Schema deliberately exposes no introspection — a schema is a validate function, not a description of itself. Nothing can walk one to emit the equivalent JSON Schema without reaching into internals, and `.refine()` predicates are closures no emitter could describe anyway.

That leaves the wire format and the runtime validation needing two declarations of one contract, which is the kind of duplication that drifts silently and in the worst direction: a client advertised a constraint the server does not enforce.

## Decision

Create `@pkg/mcp`: a stateless Streamable HTTP transport for revision `2026-07-28`, with tools declared the way routes are declared and handled the way controllers are. A tool's single JSON Schema serves the wire, the validator, and the handler's argument type. Request-level middleware is `remix/router`'s, unchanged and unwrapped.

### 1. One Revision, `2026-07-28`

`SUPPORTED_PROTOCOL_VERSIONS` holds one entry. The handshake-based revisions are a different _era_ rather than a lower version — the specification uses exactly that word — and supporting one means implementing `initialize`, sessions, a GET stream, and resumability: the whole machinery this design exists without. A dual-era server is two servers.

A request naming another version is refused with `UnsupportedProtocolVersionError` (`-32022`) carrying the supported list, which is the spec's own mechanism for telling a client to retry rather than fall back.

### 2. Stateless, With No Session And No Stream

`createHandler(options)` returns `{ map, fetch }`, where `fetch` answers `POST` and refuses every other method with `405`. No Durable Object, no session store, no held-open connection; any isolate can answer any request.

The one place statelessness costs something is a tool that needs to relate one call to the next. The spec's own answer applies: return an explicit handle from a creation tool and accept it as an argument later. Nothing in the package is needed for that.

### 3. Tools Are Declared Like Routes And Handled Like Controllers

The split mirrors `remix/routes` and `remix/router`, and it holds because the parts correspond. A tool's **name** is its address and its **input schema** is the contract that types the handler, exactly as a route's pattern types `ctx.params`. Handlers and middleware belong to the application, so they attach at `map()`.

```typescript
// The table
export default tools({
	searchPosts: tool("search_posts", { description: "…", input: { /* … */ } }),
	posts: tools({ list: tool("list_posts", { /* … */ }), get: tool("get_post", { /* … */ }) }),
});

// The handlers
mcp.map(toolset.searchPosts, (ctx) => Post.search(ctx.get(Database), ctx.input.query));

mcp.map(toolset.posts, {
	middleware: [requireScope("posts:read")],
	actions: { list: (ctx) => /* … */, get: { middleware: [/* … */], handler: (ctx) => /* … */ } },
});
```

Every rule follows `remix/router` rather than being invented: an action is a bare handler or `{ middleware, handler }`; a controller is `{ middleware, actions }`; a nested group cannot appear in an `actions` object and is mapped by its own call; and **mapping is what registers a tool**, so one declared and never mapped does not exist, the way an unmapped route is not served. Within a mapped group the type requires an action per tool, so a group cannot be half-mapped.

Duplicate names throw at `tools()`, and a name outside MCP's allowed character set throws at `tool()` — the latter because such a name does not fail at declaration otherwise, it fails later inside a client, on one transport, as a header mismatch.

### 4. One Schema, Three Consumers

A tool declares its arguments as a JSON Schema literal. That object is published in `tools/list`, validated against at `tools/call`, and mapped to a TypeScript type by `FromObjectSchema`:

```typescript
let getPost = tool("get_post", {
	description: "Reads one published post in full, as Markdown.",
	input: {
		type: "object",
		properties: {
			type: { type: "string", enum: ["articles", "tutorials"] },
			slug: { type: "string" },
			limit: { type: "integer", default: 10 },
		},
		required: ["type", "slug"],
	},
});
// ctx.input.type is "articles" | "tutorials"; ctx.input.limit is number, not number | undefined
```

The enum narrows to its literals with no `as const`, because `tool` takes its schema through a `const` type parameter. A property carrying a `default` is typed present, since the validator substitutes it — typing it optional would make every handler write a `?? 10` restating the default the schema already declares.

This revision loosened `inputSchema` to permit any JSON Schema 2020-12. The subset stays narrow anyway: no `oneOf`, no `nullable`, no unions. Each makes a schema harder for a model to satisfy without making the tool more capable — a model offered a choice between a value and `null` supplies `null`, and one offered a discriminated union picks the wrong arm. Four clearly named tools beat one with a union argument.

### 5. Request Middleware Is `remix/router`'s

`fetch` accepts a `RequestContext`, not only a `Request`:

```typescript
router.map(routes.mcp, { middleware: [requireApiKey()], handler: (ctx) => mcp.fetch(ctx) });
```

So the app's existing middleware — session, logger, database, authentication — _is_ the MCP surface's middleware, and a tool reads what it provided with the same `ctx.get(Database)` every other handler in the app uses. Nothing about authentication, logging, or dependency provision is MCP-specific, so none of it is redefined here: no `RequestMiddleware` type, no `createContextKey`, no context implementation, no `UnauthorizedError`.

`ToolContext` is not a wrapper. It is the request's own context with `input` and `tool` installed via `ctx.set(key, value, { property })`, which is the shape remix's own provider guidance recommends. It has to be the same object rather than a derived one: `headers` and `router` are prototype getters over private fields, so anything reading them through an `Object.create` wrapper throws.

For a host with no router — a bare Worker, a Durable Object — `RequestContext` is publicly constructible, so the caller builds one and puts in what tools need. One entry point covers all three cases.

### 6. Tool Middleware Is The One Middleware Type This Package Owns

```typescript
type ToolMiddleware<Input = Record<string, unknown>> = (
	ctx: ToolContext<Input>,
	next: () => Promise<CallToolResult>,
) => Awaitable<CallToolResult>;
```

It cannot be remix's `Middleware`, because a tool call is not an HTTP request and its answer is not a `Response`. The case that decides it is metering: a middleware that bills for a call has to see whether the call succeeded, and reaching that through a `Response` would mean parsing a JSON-RPC envelope inside every such middleware.

It attaches at three levels — `createHandler({ toolMiddleware })`, a controller's `middleware`, an action's `middleware` — running outermost first, which is `remix/router`'s own model with the router level replaced by the handler level.

`Input` is erased by default, and because function parameters are contravariant a middleware written against the default is assignable to a slot typed for any specific tool. So generic middleware needs no type parameter and no cast, while a middleware that reads `ctx.input` names one tool's input with `InputOf` and becomes a type error if attached to a tool without that field.

Arguments are validated _before_ tool middleware runs, which is what makes `ctx.input` a typed value inside it. The cost is that middleware cannot rewrite raw arguments ahead of the schema — deliberate, since a middleware editing arguments behind a tool's declared contract is a bug factory.

### 7. `available` Decides Existence, Separately From Middleware

An action may declare `available(ctx)`. A tool it refuses is absent from `tools/list` **and** reported by `tools/call` as an unknown tool, so a read-only credential never learns that a write tool is there.

It is separate from middleware because middleware only runs on a call, and `tools/list` needs an answer before any call happens. The consequence is that a scope appears twice — once to hide the tool, once to enforce it — and the second is the backstop for a client working from a stale list. Deriving visibility by dry-running the middleware chain would require every middleware to be cheap and free of side effects, which metering is not.

A predicate rather than a `scope: string` field plus a granted-scopes option, because the package has no business holding an authorization vocabulary: the blog's server has no scopes, the uptime app's will start from API key scopes and later derive them from OAuth grants, and a third consumer might gate on a subscription tier.

Declaring any `available` also flips the tool list's `cacheScope` to `private`. A list that varies by credential must not be held by a shared intermediary, and inferring that from the declaration is safer than leaving it to be set correctly by hand.

### 8. Two Places A Failure Is Reported, And They Are Not Interchangeable

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

The split matters in both directions. A JSON-RPC error never reaches the model, so reporting a recoverable failure there makes it vanish — the agent learns the call failed at the protocol level and has nothing to act on. Conversely a tool result is read by the model and often shown to a person, which is the wrong home for a `D1_ERROR` naming a column.

The two HTTP statuses that are not `200` are load-bearing rather than cosmetic. `404` for an unimplemented method is how a client distinguishes a modern server missing a method from a legacy server missing the endpoint; `400` with a recognized modern error body is how it knows not to fall back to `initialize`.

`ToolError` is the only exception whose message passes through, and it should be written as guidance: what was wrong, and what would work. Everything else reaches `onError` and is replaced with a generic sentence. A handler with no `onError` wired fails silently from an operator's side, which is why the option exists rather than a swallowed `catch`.

### 9. Header And Body Agreement Is Checked As A Security Boundary

This revision mirrors `method` and `params.name` into `Mcp-Method` and `Mcp-Name` so gateways can route and authorize without parsing bodies. The server validates that they agree, answering `-32020` when they do not — because a load balancer authorizing on a header while this code executes the body means the two are looking at different requests. `Mcp-Name` is decoded from the `=?base64?…?=` sentinel before comparison, since a name outside printable ASCII arrives that way and comparing without decoding would refuse exactly those calls.

`x-mcp-header` — mirroring a tool's own parameters into headers — is not supported, which is a server's choice under the spec. So no `Mcp-Param-*` header is recognized, and none has to be validated. Sensitive arguments could not be mirrored anyway; header values are visible to every intermediary.

### 10. Tools And Resources; Not Prompts, And Never Sampling

The omissions are not one category. Sorting them by the specification's own status:

| Feature                  | Status in this revision   | Here                                                       |
| ------------------------ | ------------------------- | ---------------------------------------------------------- |
| Tools                    | Active                    | Yes                                                        |
| Resources                | Active                    | Yes ([ADR-037](./ADR-037-resources-in-the-mcp-package.md)) |
| Prompts                  | Active                    | Deferred                                                   |
| `completion/complete`    | Active                    | Deferred                                                   |
| `subscriptions/listen`   | Active                    | No, for a reason of its own                                |
| Sampling, Roots, Logging | **Deprecated** (SEP-2577) | Never                                                      |

Sampling, roots and logging are on a twelve-month removal clock, so omitting them is the
specification's position rather than a scope decision. Prompts and completion are active and
deferred: prompts are user-invoked templates, which needs a workflow worth curating before
it is worth building, and completion exists to autocomplete prompt arguments and
resource-template variables, so it follows whichever of those arrives first.

`subscriptions/listen` is the one omission with an architectural reason. It is a long-lived
SSE stream the _server_ holds open, which in a Worker means billed wall-clock and a
connection pinned to one isolate — the cost model this whole design exists to avoid. The
`ttlMs` hint covers freshness instead. A Durable Object would be the honest home for it,
which is precisely the thing this revision says the protocol no longer needs.

## Consequences

### Positive

- The protocol is implemented once. An app adds a route, a tool table, and handlers.
- An app's middleware is the MCP surface's middleware. Authentication is configured in one place, and a tool reads a database the same way every other handler does.
- A tool's wire contract, its validation, and its handler's argument type cannot disagree, because there is one declaration.
- Scope-gated tool lists come free, and a conditional list cannot accidentally be advertised as publicly cacheable.
- Internal error messages cannot reach a model by accident, since only `ToolError` passes through.
- The handler runs in a Worker, a Durable Object, or behind an existing router, with no infrastructure of its own.
- One runtime dependency beyond `remix`: `@pkg/result`.

### Negative

- The schema subset is hand-written JSON Schema — more verbose than a data-schema chain, and with no `.refine()`. A constraint the subset cannot express is checked in the handler and reported as a `ToolError`.
- `FromObjectSchema` is type-level machinery. It is the part a future reader is least likely to want to modify, and a mistake in it surfaces at the tool declaration rather than where the mapper is wrong.
- Two middleware types now exist in one file's worth of concepts, and the same key name (`middleware`) means `remix/router`'s type on a route and this package's inside `map`.
- A scope is written twice for a conditional tool: once in `available`, once in the middleware that enforces it.
- Statelessness rules out progress notifications on a long call and resource subscriptions. Adding either means revisiting the transport, not just the dispatch table.
- Two schema dialects exist in the repo — `remix/data-schema` for HTTP requests, this subset for tool arguments — and a reader has to know which surface they are on.

### Neutral

- Only revision `2026-07-28` is spoken. A client pinned to an older revision is refused with a list of what works, rather than served.
- Tool-execution failures ride inside a `200`. Anything monitoring these routes by status alone sees a healthy server while every call fails.
- Tool names are not namespaced. A server whose tools might collide inside an aggregating client prefixes them itself.
- Batching is refused. No known client depends on it.

## Implementation Plan

### Phase 1: Schema And Validation

1. `schema.ts` — the JSON Schema subset as types, plus `FromSchema` and `FromObjectSchema`.
2. `validate.ts` — the runtime checker, filling defaults, dropping unknown properties, collecting every failure.
3. `errors.ts` — `ToolError`, `ForbiddenError`, `InvalidArgumentsError`.

### Phase 2: Protocol And Declaration

1. `jsonrpc.ts` — envelope, this revision's error codes, the message guard.
2. `protocol.ts` — revision constants, reserved `_meta` keys, header validation, the Base64 sentinel.
3. `tools.ts` — `tool()`, `tools()`, descriptors, `InputOf`.

### Phase 3: Transport And Dispatch

1. `handler.ts` — `createHandler`, `map`, `fetch`, the middleware chain, and the failure mapping in §8.
2. Tests through real requests, including one mounted in an actual `remix/router` to prove the context flows.

### Phase 4: Adoption

1. The blog's read-only server ([blog ADR-003](./blog/ADR-003-mcp-server-for-the-blog.md)).
2. The uptime app's read-and-write server, which additionally needs a credential and a scope-derived context.

## Alternatives Considered

### 1. `@modelcontextprotocol/sdk`

Use the official TypeScript SDK.

**Rejected because**: it binds tool schemas to Zod, which this repo replaced with `remix/data-schema`, so adopting it reintroduces a validation library for one surface — and specifically the one the repo deliberately moved off. Its transports are shaped around Node's request and response objects rather than `Request` and `Response`. Most of what it provides beyond that is session management, SSE, and capabilities this server does not offer, all of which this revision made optional or removed. The remainder is the dispatch table in §8.

### 2. Cloudflare's `agents` Package And `McpAgent`

Run the server inside a Durable Object with SSE support.

**Rejected because**: it exists to give an MCP server durable per-session state and a held-open stream, and this revision has neither. Cloudflare says so directly — MCP no longer requires a Durable Object to speak the protocol. A DO per session would add a hop per call, a storage bill, and a scaling constraint in exchange for a stream that would carry nothing.

### 3. Emit JSON Schema From `remix/data-schema`

Declare arguments as data-schema and generate the wire schema.

**Rejected because**: it cannot be done through the public interface. Standard Schema v1 is deliberately a validate function with no introspection, so an emitter would read internals carrying no compatibility promise, and it would break on the first `.refine()`. Inverting the derivation, as §4 does, needs no introspection at all: JSON Schema is data, and TypeScript can read data.

### 4. Declare Both A JSON Schema And A data-schema

Write both, side by side, on each tool.

**Rejected because**: it is two statements of one contract with nothing keeping them in step, and the failure is silent in the worst direction — a client advertised a constraint the server does not enforce, or refused for one it was never told about. The duplication is per tool, so it grows with exactly the thing it makes riskier.

### 5. Implement It Per App

Skip the package.

**Rejected because**: it is the same dispatch table, the same header validation, and the same failure split in both places, with §8 being the part most likely to be got subtly differently in each. Nothing in the protocol layer is app-specific — what differs is data access and authentication, and both stay in the app under this design anyway.

### 6. A Request Middleware Layer Of Our Own

Give the package its own request-level middleware type, context keys, and `UnauthorizedError`, with `fetch(request)` as the only entry point.

**Rejected because**: it would duplicate, for one surface, four things the apps already have — authentication, logging, database provision, and a request-scoped context — and the duplication would be _divergent_, since the MCP copy would be configured somewhere else and could drift from the app's. Accepting a `RequestContext` instead makes the app's middleware the MCP surface's middleware, deletes three exported concepts, and costs a dependency on `remix` that every consumer already has. This was the first design; taking it out was the largest single simplification.

### 7. A `scope` Field On Tools

Give each tool a `scope: string` and the handler a `grantedScopes(ctx)` option.

**Rejected because**: it names one authorization model in a package that should not have one, and the two prospective consumers already disagree about the model. `available(ctx)` expresses every variant, is no longer to write, and leaves the package with nothing to be wrong about.

### 8. One Middleware Type, Reusing remix's Everywhere

Make tool middleware a `remix/router` `Middleware` too, short-circuiting by throwing and reading the outcome from a `ToolResult` context key after `next()`.

**Rejected because**: the tool result would travel invisibly through context instead of through the return value, and a raw `Response` returned mid-tool-dispatch would need defined behaviour it should not have. One invented type is the floor here, and it sits exactly where the thing being wrapped genuinely is not an HTTP request.

### 9. Support The Handshake Revisions Too

Serve `2025-11-25` and earlier alongside `2026-07-28`.

**Rejected because**: it is two servers. Sessions, an `initialize` handshake, a GET stream, and resumability are the machinery this design exists without, and adding them back for older clients means maintaining both eras and a detection path between them. The spec's own fallback mechanism — refusing with the supported list — tells a modern client what to do, and older clients are on a twelve-month deprecation clock.

### 10. Support Prompts Now

Implement the remaining active server-side features up front.

**Rejected because**: prompts serve no workflow either consumer has yet, and adding a feature whose value is speculative is how a protocol package grows surface nobody uses. Resources were the half of this that turned out to be worth building, and [ADR-037](./ADR-037-resources-in-the-mcp-package.md) records that — including the part of my original reasoning that was wrong, namely that adding them would need no transport change.

## References

- [MCP specification `2026-07-28`](https://modelcontextprotocol.io/specification/2026-07-28)
- [Key changes in `2026-07-28`](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Versioning and compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [JSON-RPC 2.0](https://www.jsonrpc.org/specification)
- [Standard Schema](https://standardschema.dev/)
- [ADR-001: New Package Extraction](./ADR-001-new-package-extraction.md)
- [ADR-029: Pagination Package](./ADR-029-pagination-package.md)
- [ADR-037: Resources In The MCP Package](./ADR-037-resources-in-the-mcp-package.md)
- [blog ADR-003: MCP Server For The Blog](./blog/ADR-003-mcp-server-for-the-blog.md)

## Current Progress

- [x] Phase 1: Schema And Validation
- [x] Phase 2: Protocol And Declaration
- [x] Phase 3: Transport And Dispatch
- [ ] Phase 4: Adoption

## Notes

- `SUPPORTED_PROTOCOL_VERSIONS` is the only place a version string appears. This revision landed after the model's knowledge cutoff and was read from the specification rather than recalled; re-read the changelog before adding a revision, since the last one removed more than it added.
- `FromObjectSchema` treats a property carrying `default` as always present. That is only true because `validateArguments` substitutes it; the two change together, and the tests assert the type and the runtime behaviour side by side for that reason.
- `ToolContext` is the request's own `RequestContext`, mutated in place. Deriving one with `Object.create` breaks `ctx.headers` and `ctx.router`, which are prototype getters over private fields — an easy change to make and a hard failure to attribute.
- `AnyRequestContext` is `RequestContext<any, ContextEntries>`, not `RequestContext<any, any>`. With `any` for the entries, both arms of the conditional that resolves `ctx.get()` match, and every lookup collapses to `{}`.
- `available` is consulted on `tools/list` and again on `tools/call`, so it must be cheap and free of side effects. Anything expensive belongs in the route's remix middleware, which runs once.
- A tool's `description` is a prompt, not documentation. It is the only thing a model reads when choosing between neighbouring tools, and `search_posts` against `list_posts` is the pair worth revising after watching an agent pick wrong.
- Tool-execution failures ride inside a `200`. Alerting on these routes should read the body or count `isError` results rather than status codes.
- Unknown properties are dropped silently, so a typo in an optional argument's name looks like the argument having no effect.
- A tool declared and never mapped does not exist, with no warning. That mirrors `remix/router`, and it is the one place where following that model costs a diagnostic.
