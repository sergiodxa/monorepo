---
title: MCP server
description: Connect this blog to your agent so it can search and read my writing.
---

This blog speaks the [Model Context Protocol](https://modelcontextprotocol.io). Connect it
to your agent once and it can search my articles, tutorials and glossary, then read any of
them in full.

That beats letting the model guess from what it saw in training, or from a web search that
might land on an old copy.

It is read only and you do not need an account. The endpoint is:

```
https://sergiodxa.com/mcp
```

## Connecting

In Claude Code:

```sh
claude mcp add --transport http sergiodxa https://sergiodxa.com/mcp
```

In a client you configure with a file:

```json
{
	"mcpServers": {
		"sergiodxa": {
			"type": "http",
			"url": "https://sergiodxa.com/mcp"
		}
	}
}
```

Claude Desktop does not speak this version of the protocol yet, so it needs a bridge:

```json
{
	"mcpServers": {
		"sergiodxa": {
			"command": "npx",
			"args": [
				"-y",
				"@abluva/mcp-remote@latest",
				"https://sergiodxa.com/mcp",
				"--protocol",
				"2026-07-28"
			]
		}
	}
}
```

## Tools

Your agent calls these on its own when it needs them.

- `search_posts` searches articles, tutorials and glossary entries by title, excerpt and
  tags. Start here. It gives you the slugs the other tools need.
- `list_posts` lists published articles or tutorials, newest first. Use it to see what is
  there rather than to look for a topic.
- `get_post` reads one article or tutorial in full, as Markdown.
- `list_glossary` lists every term I have defined. It is short, so there is no search for it.
- `get_glossary_term` reads one term's definition.
- `list_bookmarks` lists the links I have saved.

## Resources

These are for you, not for the model. If your client shows a picker, every post is in it,
so you can attach one yourself instead of hoping the model guesses the right slug.

- Article: `https://sergiodxa.com/articles/{slug}.md`
- Tutorial: `https://sergiodxa.com/tutorials/{slug}.md`

Both are normal URLs on this site, so your client can read them directly without going
through the MCP server.

Any page here can answer in Markdown. Add `.md` to the URL, or send `Accept: text/markdown`.
This page does it too.

## Good to know

- Nothing here writes. No tool can change anything on this blog.
- Drafts and scheduled posts are never visible.
- 60 requests a minute per caller. Far more than a conversation needs, and low enough to
  bore a scraper.
- Answers can be up to five minutes old, the same as a feed reader.
