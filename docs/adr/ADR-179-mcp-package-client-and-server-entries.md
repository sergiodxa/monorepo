# ADR-179: `@sdxc/mcp` Client And Server Entry Points

## Status

**Accepted** - 2026-10-27

## Background

[ADR-036](./ADR-036-model-context-protocol-server-package.md) shipped `@sdxc/mcp` as a
**server** package: tools and resources as Remix actions over Streamable HTTP revision
`2026-07-28`. Apps mount that surface today. Nothing in the monorepo yet **consumes** an MCP
endpoint as a first-class library — callers either invent JSON-RPC by hand (the `@sdxc/spec`
MCP plugin, kit test helpers) or rely on a third-party stdio proxy to reach modern-only
servers from Cursor.

We need a client API in this repo, and a packaging shape that does not force Remix (or
server-only deps) onto browser, Worker, Durable Object, or CLI consumers. This ADR records
how `@sdxc/mcp` grows that client without a second npm package, and how the public TypeScript
surface looks.

The companion decision for the agent-facing stdio bridge is
[ADR-180](./ADR-180-mcp-stdio-protocol-bridge.md).

## Context

### Current package

| Fact      | Detail                                                                                      |
| --------- | ------------------------------------------------------------------------------------------- |
| Export    | Single `"."` → `packages/mcp/src/index.ts`                                                  |
| Hard deps | `@sdxc/json-schema`, `@sdxc/logger`, `@sdxc/result`                                         |
| Remix     | **Peer** `remix` `3.1.0` (also `devDependency`); not in `dependencies`; not marked optional |
| Protocol  | `2026-07-28` only (`SUPPORTED_PROTOCOL_VERSIONS` in `src/protocol.ts`)                      |

### Where Remix actually lands

Runtime Remix imports sit only on the server graph:

| Module                                                              | Remix                                                 |
| ------------------------------------------------------------------- | ----------------------------------------------------- |
| `src/context.ts`                                                    | `remix/router` (`RequestContext`, `createContextKey`) |
| `src/handler.ts`                                                    | `remix/route-pattern/match`                           |
| `src/resources.ts`                                                  | `remix/route-pattern/href` (+ match types)            |
| `src/jsonrpc.ts`, `src/protocol.ts`, `src/errors.ts`, `src/lazy.ts` | none                                                  |
| `src/tools.ts`                                                      | type-only import from `context.js` (erased at emit)   |

Importing `@sdxc/mcp` today always pulls Remix because `index.ts` re-exports the server
modules. A separate entry that never imports those modules does not.

### Precedent

`@sdxc/passkey` exports `./client` and `./server` and **omits** a root `"."` export. Subpath
discipline, not a second package, keeps the browser half free of the relying-party half.

## Decision

Keep **one** publishable package, `@sdxc/mcp`, and reshape its exports.

### 1. Entry points (breaking)

| Specifier          | Role                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `@sdxc/mcp/server` | Today's API: `createHandler`, `tool` / `tools`, `resource` / `resources`, `lazy`, server errors, protocol constants re-exported for servers |
| `@sdxc/mcp/client` | New isomorphic client: `connect` and the session object below                                                                               |
| (no `"."`)         | **Omit** the root export, same as passkey. No throw stub and no alias of `/server`                                                          |

Every current `from "@sdxc/mcp"` import migrates to `@sdxc/mcp/server` (apps, kit templates,
docs, any `packages/sdxc` re-export). A bare `@sdxc/mcp` fails at resolve time.

### 2. Remix is an optional peer

Keep `remix` as a peerDependency. Add `peerDependenciesMeta.remix.optional = true`. Document
that **`/server` requires Remix**; `/client` and the bridge bin do not. Do not promote Remix
to a hard dependency.

### 3. Client module graph

`./client` must not import `context.ts`, `handler.ts`, `resources.ts`, or any module that
value-imports Remix. It may share `protocol.ts` and `jsonrpc.ts` (Remix-free) with the
server. Prefer a client-local `McpClientError` over reusing server `ToolError` semantics.

Hard deps `@sdxc/json-schema` and `@sdxc/logger` stay package dependencies for the server;
the client entry simply does not import them. That install noise is acceptable for one
package.

### 4. One-word public client API

`connect` is **sync**: it stores URL, identity, and auth and returns a session; the first RPC
opens the wire. That matches Explicit Resource Management’s sync `using` binding.

```typescript
import { connect } from "@sdxc/mcp/client";

using mcp = connect({
	url: "https://example.com/mcp",
	client: { name: "my-app", version: "1.0.0" },
	headers: { Authorization: `Bearer ${token}` },
});

await mcp.discover();
await mcp.list(); // tools/list
await mcp.call("search_documents", { query: "…" }); // tools/call
await mcp.resources(); // resources/list
await mcp.templates(); // resources/templates/list
await mcp.read("https://example.com/articles/hello.md");
// scope end → [Symbol.dispose]()
```

- **`list` / `call`** are the tool surface (the hot path).
- **`resources` / `templates` / `read`** cover resources.
- Compound names (`listTools`, `callTool`, `readResource`) are rejected.
- Protocol version and transport stay **internal**. Upstream speaks `2026-07-28` only;
  on `-32022`, retry once with a supported intersection — app code never picks a revision.
- I/O and protocol failures use `@sdxc/result`. A tool result with `isError` is a successful
  RPC carrying model-facing guidance, not a thrown exception.
- **`connect()` stays untyped by default.** Optional `connect<Tools>(…)` types `call` names and
  arguments from a first-party catalog (`{ input; output? }` per tool). An optional third
  `call` argument is an `@sdxc/json-schema` schema that validates the result at runtime
  (`structuredContent`, else JSON text content) and narrows success; without a schema the
  catalog's `output` is types-only.

### 5. Explicit Resource Management (`Disposable`)

The session implements `Disposable`. Preferred Worker / Durable Object / CLI pattern:

```typescript
using mcp = connect(options);
```

| Symbol / method            | Contract                                                    |
| -------------------------- | ----------------------------------------------------------- |
| `[Symbol.dispose](): void` | Runtime calls this at end of `using` scope                  |
| `close(): void`            | Same teardown path; for callers that cannot use `using` yet |

Teardown is **sync**: abort in-flight work (`AbortController.abort`), mark the session closed,
refuse further RPCs. No `[Symbol.asyncDispose]` / `await using` for v1 — a fetch client does
not need async cleanup, and sync dispose is the right fit on Workers (where RpcTarget forbids
`Symbol.asyncDispose` for RPC stubs; that rule is RPC-specific and does not apply to this
client, but sync dispose avoids the question).

**Runtime support (verified / documented):**

| Runtime                | Notes                                                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node** v24.21.0      | `using` + `Symbol.dispose` works (verified on this machine)                                                                                          |
| **Bun** 1.4.2          | Same (verified)                                                                                                                                      |
| **Cloudflare Workers** | Wrangler v4+ parses `using` natively; workerd enabled explicit resource management (2025-05-22); CF docs recommend `using` for RPC stubs / lifecycle |

### 6. What we reject

| Alternative                                                           | Why not                                                                                                  |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Separate `@sdxc/mcp-client` / `@sdxc/mcp-server` / `@sdxc/mcp-bridge` | Three workspaces and names for an entry-point problem; Remix is already peer-only and separable          |
| Umbrella package + children                                           | Empty umbrella is not how this monorepo ships; renaming the server breaks every app                      |
| Keep `"."` as server (or a soft alias / throw stub)                   | Locked: passkey-style explicit subpaths; migrate once                                                    |
| Extract `@sdxc/jsonrpc` (or `@sdxc/mcp-protocol`) in v1               | MCP's envelope (`resultType`, `-3202x`) is not generic JSON-RPC; same package already shares the modules |
| Async `connect` + `await using` / `[Symbol.asyncDispose]` for v1      | Sync `connect` + sync dispose match the fetch lifecycle; no network at construct time                    |

### 7. Commits and release notes

Still one workspace (`mcp`). The path move is a **breaking** change for consumers:
`feat(mcp)!: …` with a migration step (`@sdxc/mcp` → `@sdxc/mcp/server`). Client and bridge
land as further `feat(mcp): …` commits as they ship.

## Consequences

### Positive

- One npm name and one dated release for server, client, and (per ADR-180) bridge.
- Browser / Worker / DO importers of `/client` do not load Remix when the entry graph is kept
  clean.
- Shared wire helpers without a third package or duplicated version constants.
- Explicit subpaths make the dual role obvious in import sites.
- `using mcp = connect(…)` ties session lifetime to scope on Node, Bun, and Workers without
  try/finally boilerplate; `close()` remains for non-`using` call sites.

### Negative

- Breaking import migration across every server consumer.
- Client-only external installs still receive `@sdxc/json-schema` / `@sdxc/logger` in the
  package's dependency list even when unused.
- Optional Remix peer means a server consumer that forgets Remix gets a runtime/resolve
  failure instead of an install-time required-peer signal — documented in the README.

### Neutral

- Conventional Commits stay scoped `mcp` for all three faces; release notes must say which
  entry changed.
- ADR-036's server design (stateless `2026-07-28`, Remix `RequestContext`, no dual-era Worker
  server) is unchanged; this ADR only adds packaging and a client face.

## Implementation Plan

1. Reshape `package.json` exports; mark Remix optional; migrate every `@sdxc/mcp` import to
   `/server`.
2. Add `./client` with the one-word API, sync `connect`, `Disposable` / `close`, and tests
   (MSW + in-package `createHandler`; a `using` scope test where the harness supports it).
3. Prove `/client` does not resolve Remix / `handler` / `context` in a Worker or browser
   bundle check.
4. Update package README / description for dual role.
5. Ship the stdio bridge per [ADR-180](./ADR-180-mcp-stdio-protocol-bridge.md).

## Alternatives Considered

### 1. Separate `@sdxc/mcp-client` package

**Rejected:** Correct dependency isolation, but Remix is not a hard dependency and the
server graph is already separable by entry. A second package invents release and discoverability
cost for no install win that subpaths cannot provide.

### 2. Keep root `.` as the server

**Rejected:** Locked preference for passkey-style explicit `/server` and `/client`, with no
root export and no long-lived alias.

### 3. Nested `mcp.tools.list` / stringly `list("tools")`

**Rejected:** One-word flat API; tools own `list`/`call`; resources get their own verbs.

## References

- [ADR-036: Model Context Protocol Server Package](./ADR-036-model-context-protocol-server-package.md)
- [ADR-037: Resources In The MCP Package](./ADR-037-resources-in-the-mcp-package.md)
- [ADR-102: MCP Tool Schemas From `@sdxc/json-schema`](./ADR-102-mcp-tool-schemas-from-json-schema.md)
- [ADR-180: MCP Stdio Protocol Bridge](./ADR-180-mcp-stdio-protocol-bridge.md)
- [MCP specification `2026-07-28`](https://modelcontextprotocol.io/specification/2026-07-28)
- `@sdxc/passkey` `exports`: `./client`, `./server` (no root)

## Current Progress

- [x] Export reshape + `/server` migration
- [x] `./client` library
- [x] Optional typed catalogs + result-schema `call` third argument
- [x] Optional Remix peer + README
- [ ] Bridge ([ADR-180](./ADR-180-mcp-stdio-protocol-bridge.md)) — bin stub only; body is a follow-up
