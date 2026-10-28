---
title: Bridge Agents to a modern MCP server
description: Point handshake-era agents at a 2026-07-28 Streamable HTTP MCP URL through the mcp-bridge bin on @sdxc/mcp.
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
`2026-07-28`: one `POST`, mirrored protocol headers, `_meta` on every body, no `initialize`,
no session id, no GET SSE. That design keeps the Worker a plain route.

Many agents still open with the **handshake** protocol — typically through `2025-11-25`.
Against a modern-only URL they send `initialize` or omit `MCP-Protocol-Version`, the server
refuses, SSE fallback gets `405`, and tools never appear. Cursor's remote MCP client is one
example; Claude Desktop's stdio launcher and other handshake-era clients hit the same wall.

`mcp-bridge` is the first-party stdio process that closes that gap. The agent spawns a local
command; the process answers handshake-era MCP on stdio and posts `2026-07-28` Streamable
HTTP upstream. For first-party servers it replaces configuring `@abluva/mcp-remote` (or other
third-party mcp-remote forks). OAuth is not on the bridge yet — pass a header or bearer
token.

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

`bunx @sdxc/mcp@latest …` works the same way when you prefer Bun. Stdout is the MCP byte
stream the agent reads. Logs go to **stderr** only — never write debug noise on stdout.

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

Claude Desktop's `claude_desktop_config.json` is **stdio-only**: each entry needs `command`
and `args` (optional `env`). It does not accept a raw Streamable HTTP `url` in that file —
point it at `mcp-bridge` the same way you would any local MCP process.

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

Restart Claude Desktop after saving. Prefer a real secret in `YOUR_TOKEN` (or an `env` value
your launcher expands into `args`) rather than committing the token to the file.

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

Codex can also speak Streamable HTTP with a `url` entry. Use that only when the remote
already accepts the dialect Codex sends; for a modern-only `@sdxc/mcp/server` endpoint,
prefer the stdio `mcp-bridge` path above until the client negotiates `2026-07-28` natively.

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
out of an agent config while still letting a local `wrangler`/`bun` server through.

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
| Direct URL in the agent config  | Clients that already speak `2026-07-28` Streamable HTTP natively                  |
| `@sdxc/mcp/client` in your code | Your Worker, browser, or Node app calling the endpoint                            |
| Third-party mcp-remote          | Only when you still need a feature the bridge has not shipped (for example OAuth) |

When agents negotiate `2026-07-28` natively, the bridge becomes optional for open or
header-auth remotes. Keep it for stdio-only clients and for auth headers a raw URL config
cannot attach.

## Where to go next

- [Expose your app over MCP](/docs/operations-and-testing/mcp-server) — build the
  `2026-07-28` endpoint the bridge points at.
- [Call an MCP server](/docs/operations-and-testing/mcp-client) — the same client the bridge
  uses, from your own code.
- [Build a command line](/docs/operations-and-testing/build-a-command-line) — other first-party
  CLIs on the same package graph.
