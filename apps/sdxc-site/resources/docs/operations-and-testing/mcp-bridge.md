---
title: Bridge Cursor to a modern MCP server
description: Point Cursor and other handshake-era agents at a 2026-07-28 Streamable HTTP MCP URL through the mcp-bridge bin on @sdxc/mcp.
section:
    title: Operations & testing
    order: 9
order: 2.2
lastUpdated: 2026-10-28
outcomes:
    - "Why a modern-only MCP URL refuses Cursor's initialize handshake"
    - "How to add mcp-bridge to mcp.json with npx or bunx"
    - "How to pass Authorization headers, bearer tokens, and allow local http"
---

First-party MCP endpoints built with [`@sdxc/mcp/server`](/api/mcp) speak only revision
`2026-07-28`: one `POST`, mirrored protocol headers, `_meta` on every body, no `initialize`,
no session id, no GET SSE. That design keeps the Worker a plain route.

Cursor's remote MCP client (and peers in the same era) still open with the **handshake**
protocol — typically through `2025-11-25`. Against a modern-only URL they send `initialize`
or omit `MCP-Protocol-Version`, the server refuses, SSE fallback gets `405`, and tools never
appear.

`mcp-bridge` is the first-party stdio process that closes that gap. The agent spawns a local
command; the process answers handshake-era MCP on stdio and posts `2026-07-28` Streamable
HTTP upstream. For first-party servers it replaces configuring `@abluva/mcp-remote` (or other
third-party mcp-remote forks) in `mcp.json`. OAuth is not on the bridge yet — pass a header
or bearer token.

The binary ships on [`@sdxc/mcp`](/api/mcp). It uses `@sdxc/mcp/client` under the hood; you
do not import Remix to run it.

## Add it to mcp.json

Point the bridge at your server's MCP URL. `npx` (or `bunx`) downloads `@sdxc/mcp` and runs
the `mcp-bridge` bin:

```json {% title="mcp.json" %}
{
	"mcpServers": {
		"documents": {
			"command": "npx",
			"args": [
				"-y",
				"@sdxc/mcp@latest",
				"https://example.com/mcp",
				"--header",
				"Authorization:Bearer ${DOCUMENTS_MCP_TOKEN}"
			]
		}
	}
}
```

With Bun, swap the command:

```json {% title="mcp.json" %}
{
	"mcpServers": {
		"documents": {
			"command": "bunx",
			"args": [
				"@sdxc/mcp@latest",
				"https://example.com/mcp",
				"--token",
				"${DOCUMENTS_MCP_TOKEN}"
			]
		}
	}
}
```

Once the package is on your `PATH`, invoke the bin by name:

```sh
mcp-bridge https://example.com/mcp --token "$DOCUMENTS_MCP_TOKEN"
mcp-bridge http://127.0.0.1:8787/mcp --allow-http
```

Stdout is the MCP byte stream the agent reads. Logs go to **stderr** only — never write
debug noise on stdout.

## Flags

| Flag                  | Role                                                |
| --------------------- | --------------------------------------------------- |
| `<url>`               | Upstream Streamable HTTP endpoint (`https://…/mcp`) |
| `--header Name:value` | Extra request header (repeatable)                   |
| `--token <token>`     | Shorthand for `Authorization: Bearer <token>`       |
| `--allow-http`        | Permit cleartext `http://` URLs (local development) |
| `--help` / `-h`       | Usage                                               |
| `--version` / `-v`    | Version string                                      |

The URL must be `https://` unless you pass `--allow-http`. That keeps accidental cleartext
out of a Cursor config while still letting a local `wrangler`/`bun` server through.

## What the bridge does

| Face              | Transport            | Revision     | Job                                                                                |
| ----------------- | -------------------- | ------------ | ---------------------------------------------------------------------------------- |
| Inbound (agent)   | stdio JSON-RPC       | `2025-11-25` | Local `initialize` / `notifications/initialized`, capabilities, in-process session |
| Outbound (server) | Streamable HTTP POST | `2026-07-28` | Via `@sdxc/mcp/client`: headers, `_meta`, no `Mcp-Session-Id` upstream             |

It translates `tools/list`, `tools/call`, `resources/list`, `resources/templates/list`, and
`resources/read`. The Worker server stays modern-only — dual-era support lives in this local
Node/Bun process, not on the Remix route.

## Prefer this over third-party mcp-remote

| Approach                        | When                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `mcp-bridge` on `@sdxc/mcp`     | First-party `@sdxc/mcp/server` URLs, API-key / bearer auth                        |
| Direct URL in `mcp.json`        | Clients that already speak `2026-07-28` Streamable HTTP natively                  |
| `@sdxc/mcp/client` in your code | Your Worker, browser, or Node app calling the endpoint                            |
| Third-party mcp-remote          | Only when you still need a feature the bridge has not shipped (for example OAuth) |

When Cursor and peers negotiate `2026-07-28` natively, the bridge becomes optional for open
or header-auth remotes. Keep it for stdio-only clients and for auth headers a raw URL config
cannot attach.

## Where to go next

- [Expose your app over MCP](/docs/operations-and-testing/mcp-server) — build the
  `2026-07-28` endpoint the bridge points at.
- [Call an MCP server](/docs/operations-and-testing/mcp-client) — the same client the bridge
  uses, from your own code.
- [Build a command line](/docs/operations-and-testing/build-a-command-line) — other first-party
  CLIs on the same package graph.
