/**
 * The posts this blog offers as resources, declared as URL patterns.
 *
 * Resources sit beside the tools because they're picked differently: a tool is what the
 * model chooses once it already has a slug, while a resource is what a person browses from
 * a list in their client before any slug exists.
 *
 * The URIs reuse this blog's own `.md` URLs, already served as Markdown by
 * `app/http/controllers/post.tsx` — the `https://` scheme MCP calls for when a client
 * fetches a post directly. The extension holds regardless of what the client sends.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { resource, resources } from "@pkg/mcp";

/**
 * Origin the resource URIs are built against.
 *
 * Fixed, since a resource URI is an identity a client may store or hand to another tool,
 * so it must stay the same regardless of which hostname a request arrives on.
 */
const ORIGIN = "https://sergiodxa.com";

/** The resource tree the MCP handler is mapped against. */
export default resources({
	article: resource(`${ORIGIN}/articles/:slug.md`, {
		name: "article",
		title: "Article",
		description: "A published article from this blog, as Markdown.",
		mimeType: "text/markdown",
	}),

	tutorial: resource(`${ORIGIN}/tutorials/:slug.md`, {
		name: "tutorial",
		title: "Tutorial",
		description: "A published tutorial from this blog, as Markdown.",
		mimeType: "text/markdown",
	}),
});
