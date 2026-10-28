# ADR-180: MCP Stdio Protocol Bridge

## Status

**Accepted** - 2026-10-27

## Background

First-party MCP endpoints served by `@sdxc/mcp` speak only revision **`2026-07-28`**:
stateless Streamable HTTP, per-request `_meta` and mirrored headers, no `initialize`, no
session id, no GET SSE ([ADR-036](./ADR-036-model-context-protocol-server-package.md)).

Cursor's remote MCP client (and peers in the same era) still open with the **handshake**
protocol — typically through **`2025-11-25`**. Against a modern-only URL they send
`initialize` or omit `MCP-Protocol-Version`, the server refuses (`-32020` / unsupported
version), SSE fallback gets `405`, and tools never appear. Cursor staff have confirmed the
client does not yet negotiate `2026-07-28` for remote servers.

Today the practical workaround is configuring
[`@abluva/mcp-remote`](https://www.npmjs.com/package/@abluva/mcp-remote) (a fork of
`mcp-remote`) in `mcp.json`: a local **stdio** process that shims `initialize` toward the
agent and speaks `2026-07-28` POST upstream. We want a first-party bin on `@sdxc/mcp` so we
recommend our own tool for that job, not a third-party package.

Package shape and the isomorphic client API this bridge calls are
[ADR-179](./ADR-179-mcp-package-client-and-server-entries.md). This ADR is only the dual-face
bridge.

## Context

### The gap

| Side                                       | Speaks                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `@sdxc/mcp/server` (Worker / Remix route)  | `2026-07-28` only                                                                                      |
| Cursor remote MCP client (as of late 2026) | Handshake-era revisions through `2025-11-25` (also documents `2025-06-18`, `2025-03-26`, `2024-11-05`) |

Making the **Worker server** dual-era was rejected in ADR-036: sessions, GET streams, and
resumability are the machinery that design exists without. The escape hatch is a **local**
Node/Bun process where a long-lived stdio session is cheap.

### What `@abluva/mcp-remote` does (public behavior)

| Behavior                | Detail                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Role                    | stdio proxy: agent spawns `npx … <url>`; process speaks MCP on stdio, HTTP to remote                                     |
| `--protocol 2026-07-28` | POST-only upstream; `_meta` injection; local **initialize shim**; `_meta` strip / list shims toward Claude-class clients |
| `--protocol legacy`     | Stateful Streamable HTTP (`initialize` + session) toward older remotes                                                   |
| Also                    | OAuth callback / re-auth, `--transport` http/sse strategies, `--allow-http`                                              |

We match the **protocol-bridge** slice for first-party modern-only servers. Abluva's OAuth
machinery is out of scope for the first ship.

## Decision

Ship a **`mcp-bridge`** binary on `@sdxc/mcp` that presents two protocol faces in one
process.

### 1. Placement

- Same package as the server and client ([ADR-179](./ADR-179-mcp-package-client-and-server-entries.md)).
- Implemented under a CLI/bridge entry (e.g. `src/cli/` or `src/bridge/`), wired through
  `package.json` `bin`. Built with [`@sdxc/cli`](./ADR-145-cli-package.md).
- Uses `@sdxc/mcp/client` for upstream calls. Workers and browsers never import the CLI
  entry.
- No separate `@sdxc/mcp-bridge` package.

### 2. Faces

| Face                  | Transport            | Revision         | Responsibility                                                                                  |
| --------------------- | -------------------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| **Inbound** (agent)   | stdio JSON-RPC       | **`2025-11-25`** | Local `initialize` / `notifications/initialized`; capability reply; session illusion in-process |
| **Outbound** (server) | Streamable HTTP POST | **`2026-07-28`** | Via `./client`: headers, `_meta`, `resultType`; no `Mcp-Session-Id` upstream                    |

Translate `tools/list`, `tools/call`, `resources/list`, `resources/templates/list`, and
`resources/read`. Strip or rewrite modern-only response fields agents must not see
(validate against Cursor; do not invent a second dialect).

**Not in v1 inbound:** GET SSE toward the agent, `subscriptions/listen`, sampling / roots /
logging, every historical revision below `2025-11-25`.

**Not in v1 outbound:** handshake-era / SSE-first remotes (Abluva's `legacy` mode).

### 3. Modes

| Mode        | Role                                                     | Default?                                                |
| ----------- | -------------------------------------------------------- | ------------------------------------------------------- |
| **bridge**  | stdio ↔ upstream HTTP — what Cursor/Claude spawn         | **Yes** when invoked with a URL the way `mcp-remote` is |
| poke / call | Non-interactive discover/list/call/read → JSON on stdout | Explicit subcommands                                    |
| REPL        | Human interactive                                        | Later; not required to displace Abluva                  |

Auth for v1: headers / bearer / env (and an `--allow-http` equivalent for local cleartext).
Logs go to **stderr** only; stdout is the MCP byte stream.

### 4. Recommended agent config (shape)

```json
{
	"mcpServers": {
		"uptime": {
			"command": "npx",
			"args": [
				"-y",
				"@sdxc/mcp@latest",
				"https://uptime.example.com/mcp",
				"--header",
				"Authorization:Bearer ${UPTIME_MCP_TOKEN}"
			]
		}
	}
}
```

Exact flag names and whether `npx` resolves via the `mcp-bridge` bin name vs package entry
are implementation details; the product name to document is **`mcp-bridge`** on `@sdxc/mcp`.

### 5. Phased rollout

1. **Client library** (`./client`, ADR-179) — foundation.
2. **Bridge CLI** — primary product; dogfood against a live `@sdxc/mcp/server` URL from
   Cursor until tools list and call succeed.
3. **Human poke / REPL** — debugging aid.
4. **OAuth / older inbound / legacy outbound** — only with a named need; do not claim OAuth
   parity with Abluva until shipped.

### 6. ADR-036 relationship

The Worker server stays **modern-only**. Dual-era support is **not** added to
`createHandler`. The bridge is the supported escape hatch for legacy agents.

## Consequences

### Positive

- First-party path to use `@sdxc/mcp/server` endpoints from Cursor without `@abluva/mcp-remote`.
- Dual-era complexity stays off the Worker bill and out of the Remix request path.
- One package to install and name in docs and `mcp.json`.

### Negative

- Two protocol implementations to maintain (inbound shim + outbound client), with agent
  dialect drift as an ongoing dogfood risk.
- Until OAuth lands, OAuth-gated third-party gateways may still need Abluva or equivalent.
- Stdio bridge is Node/Bun-only; not a Worker deployable.

### Neutral

- When Cursor (and peers) natively speak `2026-07-28` over Streamable HTTP, the bridge
  becomes optional for unauthenticated or header-auth remotes; keep it for stdio-only
  clients and for auth headers agents cannot attach to a raw URL config.
- Interactive CLI is not the success metric; a working Cursor session is.

## Implementation Plan

1. Land `./client` ([ADR-179](./ADR-179-mcp-package-client-and-server-entries.md)).
2. Implement stdio `2025-11-25` face + translation to `./client`.
3. Wire `mcp-bridge` bin; document Cursor `mcp.json`; dogfood checklist against a real
   deployment.
4. Optional poke subcommands; OAuth only if still required after step 3.

## Alternatives Considered

### 1. Dual-era `@sdxc/mcp/server` in the Worker

**Rejected:** Same as ADR-036 alternative 9 — sessions and SSE are a second server. The
bridge relocates that cost to a local process intentionally.

### 2. Separate `@sdxc/mcp-bridge` package

**Rejected:** Bridge is a thin face over `./client`; a second package fragments the thing we
want people to `npx` instead of Abluva.

### 3. Ship interactive REPL first, bridge later

**Rejected:** REPL does not unblock Cursor. Bridge is the primary CLI product.

### 4. Depend on `@abluva/mcp-remote` / upstream `mcp-remote`

**Rejected:** We need a first-party recommendation aligned with our protocol choices and
auth story; third-party OAuth fixes are not our differentiator for first-party servers.

## References

- [ADR-036: Model Context Protocol Server Package](./ADR-036-model-context-protocol-server-package.md)
- [ADR-179: `@sdxc/mcp` Client And Server Entry Points](./ADR-179-mcp-package-client-and-server-entries.md)
- [ADR-145: `@sdxc/cli` Package](./ADR-145-cli-package.md)
- [ADR-084: OAuth Protected Resource Metadata](./ADR-084-oauth-protected-resource-metadata.md) (future OAuth layering)
- [`@abluva/mcp-remote`](https://www.npmjs.com/package/@abluva/mcp-remote) / [ABLUVA-FORK.md](https://github.com/abluva-research/mcp-remote/blob/main/ABLUVA-FORK.md)
- [Cursor forum: modern-only `2026-07-28` servers](https://forum.cursor.com/t/mcp-client-cannot-connect-to-modern-only-2026-07-28-streamable-http-servers-legacy-initialize-rejected/172536)
- [MCP specification `2026-07-28`](https://modelcontextprotocol.io/specification/2026-07-28)
- [MCP specification `2025-11-25`](https://modelcontextprotocol.io/specification/2025-11-25)

## Current Progress

- [ ] `./client` prerequisite (ADR-179)
- [ ] stdio bridge + `mcp-bridge` bin
- [ ] Cursor dogfood against a live first-party MCP URL
- [ ] poke / REPL
- [ ] OAuth (if still needed)
