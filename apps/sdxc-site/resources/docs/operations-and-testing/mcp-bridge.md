---
title: Bridge Agents to a modern MCP server
description: Connect handshake-era agents to a modern Streamable HTTP MCP endpoint.
section:
    title: Operations & testing
    order: 9
order: 2.2
lastUpdated: 2026-10-28
outcomes:
    - "Why a modern-only MCP URL refuses a handshake-era initialize"
    - "How to wire mcp-bridge into Cursor, Claude Desktop, Claude Code, and Codex"
    - "How to pass Authorization headers, bearer tokens, and allow local http"
---

First-party MCP endpoints built with [`@sdxc/mcp/server`](/api/mcp) speak only revision
`2026-07-28`: one `POST`, mirrored protocol headers, and `_meta` on every body. Every
request carries its own version and identity, so the Worker stays a plain route.

Many agents still open with the **handshake** protocol — typically through `2025-11-25`.
Against a modern-only URL they send `initialize` or omit `MCP-Protocol-Version`, the server
answers with a protocol error, SSE fallback gets `405`, and the agent stops with an empty
tool list. Cursor's remote MCP client is one example; Claude Desktop's stdio launcher and
other handshake-era clients hit the same wall.

`mcp-bridge` is the first-party stdio process that closes that gap. The agent spawns a local
command; the process answers handshake-era MCP on stdio and posts `2026-07-28` Streamable
HTTP upstream. For first-party servers it is the recommended replacement for
`@abluva/mcp-remote` (and other third-party mcp-remote forks). Auth for v1 is a header or
bearer token.

The binary ships on [`@sdxc/mcp`](/api/mcp) and talks upstream through `@sdxc/mcp/client`.

## The command every agent runs

Whatever config file the agent reads, the process it spawns is the same:

```sh
npx -y @sdxc/mcp@latest https://example.com/mcp --token "$DOCUMENTS_MCP_TOKEN"
```

Or, once `@sdxc/mcp` is on your `PATH`:

```sh
mcp-bridge https://example.com/mcp --token "$DOCUMENTS_MCP_TOKEN"
mcp-bridge http://127.0.0.1:8787/mcp --allow-http
```

`bunx @sdxc/mcp@latest …` works the same way when you prefer Bun. Stdout carries the MCP
byte stream the agent reads; put logs on **stderr**.

## Cursor

Cursor reads an `mcp.json` (user or project). Put the bridge under `mcpServers` with
`command` and `args`:

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

With Bun, swap the command to `bunx` and drop `-y` if you like; `--token` is shorthand for
the Authorization header:

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

## Claude Desktop

Claude Desktop's `claude_desktop_config.json` launches **local stdio** processes: each entry
needs `command` and `args` (optional `env`). Point it at `mcp-bridge` the same way you would
any other local MCP process.

Config path:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json {% title="claude_desktop_config.json" %}
{
	"mcpServers": {
		"documents": {
			"command": "npx",
			"args": [
				"-y",
				"@sdxc/mcp@latest",
				"https://example.com/mcp",
				"--token",
				"YOUR_TOKEN"
			]
		}
	}
}
```

Restart Claude Desktop after saving. Put the secret in `YOUR_TOKEN` or an `env` value your
launcher expands into `args`, and keep that value out of version control.

## Claude Code

Claude Code registers local servers as stdio. From a project directory:

```sh
claude mcp add --transport stdio documents -- \
  npx -y @sdxc/mcp@latest https://example.com/mcp --token "$DOCUMENTS_MCP_TOKEN"
```

Everything after `--` is the process Claude Code spawns. The same shape belongs in a
project `.mcp.json` (or a user-scoped entry under `~/.claude.json`):

```json {% title=".mcp.json" %}
{
	"mcpServers": {
		"documents": {
			"type": "stdio",
			"command": "npx",
			"args": [
				"-y",
				"@sdxc/mcp@latest",
				"https://example.com/mcp",
				"--token",
				"${DOCUMENTS_MCP_TOKEN}"
			]
		}
	}
}
```

Claude Code expands `${VAR}` in `command`, `args`, and `env`. Project-scoped `.mcp.json`
servers ask for approval the first time the session sees them.

## Codex

Codex stores MCP servers in `~/.codex/config.toml` (or a project `.codex/config.toml` for
trusted projects), under `[mcp_servers.<name>]`. Stdio entries use `command` and `args` —
the same process as above:

```toml {% title="~/.codex/config.toml" %}
[mcp_servers.documents]
command = "npx"
args = [
  "-y",
  "@sdxc/mcp@latest",
  "https://example.com/mcp",
  "--token",
  "YOUR_TOKEN",
]
```

Or add it from the shell so the token expands once when you register the server:

```sh
codex mcp add documents -- \
  npx -y @sdxc/mcp@latest https://example.com/mcp --token "$DOCUMENTS_MCP_TOKEN"
```

Codex also supports Streamable HTTP with a `url` entry when the remote speaks the dialect
Codex sends. For a modern-only `@sdxc/mcp/server` endpoint, use the stdio `mcp-bridge` path
above so the agent gets a handshake face while the upstream stays `2026-07-28`.

## Flags

| Flag                  | Role                                                |
| --------------------- | --------------------------------------------------- |
| `<url>`               | Upstream Streamable HTTP endpoint (`https://…/mcp`) |
| `--header Name:value` | Extra request header (repeatable)                   |
| `--token <token>`     | Shorthand for `Authorization: Bearer <token>`       |
| `--allow-http`        | Permit cleartext `http://` URLs (local development) |
| `--help` / `-h`       | Usage                                               |
| `--version` / `-v`    | Version string                                      |

URLs are `https://` by default. Pass `--allow-http` for a local cleartext
`wrangler`/`bun` server on `http://`.

## What the bridge does

| Face              | Transport            | Revision     | Job                                                                                |
| ----------------- | -------------------- | ------------ | ---------------------------------------------------------------------------------- |
| Inbound (agent)   | stdio JSON-RPC       | `2025-11-25` | Local `initialize` / `notifications/initialized`, capabilities, in-process session |
| Outbound (server) | Streamable HTTP POST | `2026-07-28` | Via `@sdxc/mcp/client`: headers, `_meta`, per-request identity upstream            |

It translates `tools/list`, `tools/call`, `resources/list`, `resources/templates/list`, and
`resources/read`. The Worker server stays modern-only; the dual-era face lives in this local
Node/Bun process.

## Prefer this over third-party mcp-remote

| Approach                        | When                                                             |
| ------------------------------- | ---------------------------------------------------------------- |
| `mcp-bridge` on `@sdxc/mcp`     | First-party `@sdxc/mcp/server` URLs, API-key / bearer auth       |
| Direct URL in the agent config  | Clients that already speak `2026-07-28` Streamable HTTP natively |
| `@sdxc/mcp/client` in your code | Your Worker, browser, or Node app calling the endpoint           |
| Third-party mcp-remote          | Features still on the bridge roadmap (for example OAuth)         |

When agents negotiate `2026-07-28` natively, the bridge stays useful for stdio-only clients
and for auth headers the agent attaches through the local process.

## Where to go next

- [Expose your app over MCP](/docs/operations-and-testing/mcp-server) — build the
  `2026-07-28` endpoint the bridge points at.
- [Call an MCP server](/docs/operations-and-testing/mcp-client) — the same client the bridge
  uses, from your own code.
- [Build a command line](/docs/operations-and-testing/build-a-command-line) — other first-party
  CLIs on the same package graph.
