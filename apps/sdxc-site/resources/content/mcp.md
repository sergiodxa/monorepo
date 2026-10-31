<hero>
<split>
<split-copy>

# The MCP endpoint

`https://sdxc.dev/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server over
the {% $packageCount %} packages documented on this site. It speaks stateless Streamable HTTP, so
there is no handshake and no session to keep: one `POST` is one exchange.

Nothing here is behind a credential, every tool is read-only, and everything a tool answers with
is already public as a page.

<actions cta-href="#connecting" cta-label="Connect a client" alt-href="#tools" alt-label="See the tools" />

</split-copy>
<split-media>

<code-tabs>
<code-tab label="Request" selected>

```bash {% title="Terminal" %}
curl https://sdxc.dev/mcp \
  -H "content-type: application/json" \
  -H "accept: application/json" \
  -H "MCP-Protocol-Version: 2026-07-28" \
  -H "Mcp-Method: tools/call" \
  -H "Mcp-Name: search_packages" \
  -d @call.json
```

</code-tab>

<code-tab label="call.json">

```json {% title="call.json" %}
{
	"jsonrpc": "2.0",
	"id": 1,
	"method": "tools/call",
	"params": {
		"name": "search_packages",
		"arguments": {
			"query": "verify webhook signatures",
			"limit": 2
		},
		"_meta": {
			"io.modelcontextprotocol/protocolVersion": "2026-07-28",
			"io.modelcontextprotocol/clientCapabilities": {}
		}
	}
}
```

</code-tab>

<code-tab label="Response">

```json {% title="result.content[0].text" %}
[
	{
		"name": "@sdxc/webhooks",
		"description": "Sign and verify Standard Webhooks deliveries and deliver Security Event Tokens by push or poll, reporting every failure as a typed value",
		"url": "https://sdxc.dev/api/webhooks",
		"markdownUrl": "https://sdxc.dev/api/webhooks.md"
	},
	{
		"name": "@sdxc/outbound",
		"description": "Check, follow and read URLs a stranger chose: public hosts on every redirect, one deadline, bounded bodies",
		"url": "https://sdxc.dev/api/outbound",
		"markdownUrl": "https://sdxc.dev/api/outbound.md"
	}
]
```

</code-tab>
</code-tabs>

</split-media>
</split>
</hero>

<section-block id="tools" tone="tinted">
<split>
<split-copy>

## What it offers a model

Every page on this site already answers on a `.md` URL, so anything that can fetch can already
read all of it. What it cannot do is find the thing, and that is what these four tools are for.

</split-copy>
<split-media>

<feature-grid columns="2">
<feature title="search_packages">
"Is there a package for X?", over every name, description and README.
</feature>

<feature title="list_packages">
The whole set, grouped by the problem each group solves.
</feature>

<feature title="get_package">
One package in full: its README, its exports, and what installs alongside it.
</feature>

<feature title="search_docs">
Where something is explained, answered with the heading's own URL.
</feature>
</feature-grid>

</split-media>
</split>
</section-block>

<section-block id="connecting">
<split>
<split-copy>

## Connecting

The endpoint speaks the current MCP revision only. Clients that still open with the older
handshake connect through [`mcp-bridge`](/docs/operations-and-testing/mcp-bridge), a small stdio
process from [`@sdxc/mcp`](/api/mcp) that the client starts and that talks to the endpoint for it.

- No credential to issue, rotate or paste
- No session to keep alive between calls
- Every tool is read-only

</split-copy>
<split-media>

<code-tabs>
<code-tab label="Configuration file" selected>

```json {% title="mcp.json" %}
{
	"mcpServers": {
		"sdxc": {
			"command": "npx",
			"args": ["-y", "@sdxc/mcp@latest", "https://sdxc.dev/mcp"]
		}
	}
}
```

</code-tab>

<code-tab label="Claude Code">

```bash {% title="Terminal" %}
claude mcp add --transport stdio sdxc -- npx -y @sdxc/mcp@latest https://sdxc.dev/mcp
```

</code-tab>
</code-tabs>

</split-media>
</split>
</section-block>

<section-block id="resources" tone="tinted">
<split>
<split-copy>

## What it offers a reader

Every guide and every package reference is also a resource, listed by name, so a client's picker
carries the whole corpus and a person can attach one page before they start. Each resource's URI is
the page's own markdown address, which means attaching it and fetching it give the same text.

- Every package reference and every guide
- Every `@sdxc/u` utility and `@sdxc/ui` component
- The `@sdxc/ui` mixins, behaviors, animations and styles

</split-copy>
<split-media>

```json {% title="resources/list" %}
{
	"resources": [
		{
			"uri": "https://sdxc.dev/api/result.md",
			"name": "@sdxc/result",
			"title": "@sdxc/result",
			"description": "Result type for error handling"
		},
		{
			"uri": "https://sdxc.dev/docs/releases/versioning.md",
			"name": "releases/versioning",
			"title": "Versioning"
		}
	]
}
```

> [!NOTE]
> Prefer a tool when you are looking for something and a resource when you already know what you
> want to read.

</split-media>
</split>
</section-block>

<section-block id="another-way" title="Reading it another way" tone="grid" align="center">

The same content is published as [a markdown map of the site](/llms.txt), as
[a search index](/search.json), and as [a feed](/rss.xml).

<actions cta-href="/docs" cta-label="Read the docs" alt-href="/api" alt-label="Browse the API" />
</section-block>
