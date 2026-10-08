/**
 * A `Markdown.walk` visitor that rewrites the URLs a document points at: a link's
 * href, an image's src, and the href and src of an allowlisted element. A file
 * written to be read in one place renders its relative links correctly in another.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Markdown } from "../index.js";

/** The element attributes holding a URL the visitor rewrites. */
const URL_ATTRIBUTES = ["href", "src"] as const;

/** A scheme at the start of a URL, which is what makes it absolute. */
const SCHEME = /^[a-z][a-z\d+.-]*:/i;

/** The nodes whose URLs the visitor rewrites, handed to the rewrite hook beside the URL. */
export type LinkedNode = Markdown.Link | Markdown.Image | Markdown.Element;

/** Where relative URLs resolve, and the caller's own mapping run after that. */
export interface LinksOptions {
	/**
	 * The absolute URL a relative one resolves against, the way a browser resolves it
	 * against a page. Absolute URLs, `mailto:`/`tel:` and fragment-only `#id` links,
	 * which point inside the page, keep what the author wrote.
	 */
	base?: string | URL;
	/**
	 * Runs on every URL once `base` has resolved it, absolute ones included, so it can
	 * map a `.md` file to a route or a registry page to a local one.
	 * @returns The URL to write, or `undefined` to keep the one it was given
	 */
	rewrite?: (url: string, node: LinkedNode) => string | undefined;
}

/**
 * Builds the visitor. A node whose URLs come out as written is handed back as the
 * same object, so a walk over a document with nothing to rewrite shares it whole.
 *
 * @param options - The base to resolve against and the rewrite hook
 * @returns A visitor to pass to `Markdown.walk`, alone or spread beside others
 * @throws {TypeError} Inside the walk, at the node, when `base` is no absolute URL
 * @example Markdown.walk(document, links({ base: "https://github.com/acme/repo/blob/main/" }))
 */
export function links(options: LinksOptions = {}) {
	let { base, rewrite } = options;

	/** The URL resolved against the base and passed through the hook. */
	function rewriteURL(url: string, node: LinkedNode): string {
		let resolved = base !== undefined && isRelative(url) ? new URL(url, base).href : url;
		return rewrite?.(resolved, node) ?? resolved;
	}

	return {
		link(node) {
			let href = rewriteURL(node.href, node);
			if (href === node.href) return undefined;
			return { ...node, href };
		},
		image(node) {
			let src = rewriteURL(node.src, node);
			if (src === node.src) return undefined;
			return { ...node, src };
		},
		/** Only string values are URLs here; one holding a variable waits for its value. */
		element(node) {
			let attributes: Markdown.Attributes | undefined;
			for (let name of URL_ATTRIBUTES) {
				let value = node.attributes[name];
				if (typeof value !== "string") continue;
				let url = rewriteURL(value, node);
				if (url === value) continue;
				attributes ??= { ...node.attributes };
				attributes[name] = url;
			}
			if (!attributes) return undefined;
			return { ...node, attributes };
		},
	} satisfies Markdown.Visitor;
}

/**
 * A URL with no scheme that is more than a fragment. An empty one stays empty,
 * since resolving it would point at the base itself.
 */
function isRelative(url: string): boolean {
	return url !== "" && !url.startsWith("#") && !SCHEME.test(url);
}
