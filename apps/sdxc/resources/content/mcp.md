# The MCP endpoint

`https://sdxc.sergiodxa.com/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io)
server over the {% $packageCount %} packages documented on this site. It speaks stateless
Streamable HTTP, so there is no handshake and no session to keep: one `POST` is one exchange.

Nothing here is behind a credential, every tool is read-only, and everything a tool answers
with is already public as a page.

## Connecting

Point a client at the endpoint. Most take a URL directly; the ones that read a configuration
file take this:

```json {% title="mcp.json" %}
{
	"mcpServers": {
		"sdxc": {
			"url": "https://sdxc.sergiodxa.com/mcp"
		}
	}
}
```

## What it offers a model

Every page on this site already answers on a `.md` URL, so anything that can fetch can already
read all of it. What it cannot do is find the thing, and that is what these tools are for.

| Tool              | What it answers                                                              |
| ----------------- | ---------------------------------------------------------------------------- |
| `search_packages` | "Is there a package for X?", over every name, description and README         |
| `list_packages`   | The whole set, grouped by the problem each group solves                      |
| `get_package`     | One package in full: its README, its exports, and what installs alongside it |
| `search_docs`     | Where something is explained, answered with the heading's own URL            |

## What it offers a reader

Every guide and every package reference is also a resource, listed by name, so a client's
picker carries the whole corpus and a person can attach one page before they start. Each
resource's URI is the page's own markdown address, which means attaching it and fetching it
give the same text.

<note>
Prefer a tool when you are looking for something and a resource when you already know what you
want to read.
</note>

## Reading it another way

The same content is published as [a markdown map of the site](/llms.txt), as
[a search index](/search.json), and as [a feed](/rss.xml).
