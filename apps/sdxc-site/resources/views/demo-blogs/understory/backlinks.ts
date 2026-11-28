/**
 * Understory's link graph: which posts a post's Markdown links to, read from the sources
 * themselves, so a post page can list the glossary terms it uses and the posts linking back
 * to it. Plain text loses link targets, so the graph reads the raw files.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DemoBlogPost } from "~/app/services/demo-blogs";

/** Every post's raw Markdown, keyed by its path relative to this file; plain strings, no parse. */
const SOURCES = import.meta.glob<string>("./posts/*.md", {
	query: "?raw",
	import: "default",
	eager: true,
});

/** The address prefix every link between Understory's posts starts with. */
const POST_LINK = /\]\(\/showcase\/understory\/demo\/([a-z-]+\/[a-z0-9-]+)\)/g;

/**
 * The post paths (`<kind>/<slug>`) one post links to, each once, in the order they appear.
 *
 * @returns An empty list for a post that links nowhere inside the blog.
 */
export function outboundPaths(post: DemoBlogPost): string[] {
	let source = SOURCES[`./posts/${post.slug}.md`] ?? "";
	let paths = [...source.matchAll(POST_LINK)].map((match) => match[1] ?? "");
	return [...new Set(paths)].filter((path) => path !== post.path && path !== "");
}

/**
 * The posts whose body links to one, newest first, which is what "Linked from" lists.
 *
 * @param posts Every post, newest first.
 */
export function backlinksTo(posts: DemoBlogPost[], post: DemoBlogPost): DemoBlogPost[] {
	return posts.filter((other) => outboundPaths(other).includes(post.path));
}

/**
 * The glossary terms a post's body links to, in the order it first uses them.
 *
 * @param posts Every post, which the linked paths are resolved against.
 */
export function termsUsedBy(posts: DemoBlogPost[], post: DemoBlogPost): DemoBlogPost[] {
	return outboundPaths(post).flatMap((path) => {
		let target = posts.find((other) => other.path === path);
		return target !== undefined && target.kind === "glossary" ? [target] : [];
	});
}
