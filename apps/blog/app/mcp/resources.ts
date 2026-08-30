/**
 * The posts this blog offers as resources, declared as URL patterns.
 *
 * A resource is what a person browses before a slug exists; a tool is what a model calls
 * once it has one. URIs reuse this blog's own `.md` URLs, already served as Markdown, so
 * a client's direct fetch matches what a tool call returns.
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
