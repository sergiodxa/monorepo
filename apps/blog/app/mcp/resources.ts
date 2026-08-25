/**
 * The posts this blog offers as resources, declared as URL patterns.
 *
 * Resources exist alongside the tools because they answer a different question. A tool is
 * chosen by the model, which is why `get_post` needs a slug it had to find first; a
 * resource is picked by the *person*, from a list their client shows them. Somebody who
 * wants to hand one post to their agent has no slug to type and, without this, nothing to
 * browse.
 *
 * The URIs are this blog's own `.md` URLs. `app/http/controllers/post.tsx` already
 * negotiates Markdown from both the extension and `Accept: text/markdown`, so a client may
 * fetch a post itself and never call this server — which is exactly when MCP says to use
 * the `https://` scheme. The extension rather than the header, because it holds for every
 * client regardless of what it sends.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { resource, resources } from "@pkg/mcp";

/**
 * Origin the resource URIs are built against.
 *
 * Fixed rather than read from the request: a resource URI is an identity a client may
 * store, hand to another tool, or open in a browser, so it must not change depending on
 * which hostname a particular request arrived on.
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
