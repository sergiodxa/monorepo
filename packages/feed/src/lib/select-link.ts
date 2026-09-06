/**
 * Chooses which of an Atom element's links is the one a reader should follow.
 *
 * RFC 4287 defaults an absent `rel` to `alternate` and `@sdxc/atom` reports it as
 * the document wrote it, so applying that default is this module's job.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Atom } from "@sdxc/atom";

/**
 * Flattens the scalar-or-array link shape into a list.
 *
 * @param link - One link, several, or none
 * @returns The links, in document order
 */
export function toLinks(link?: Atom.LinkInput): Atom.Link[] {
	if (link === undefined) return [];
	return Array.isArray(link) ? link : [link];
}

/**
 * Finds the human-readable page a feed or entry points at.
 *
 * An HTML alternate wins over an untyped one, which wins over anything else,
 * so a feed listing both a web page and a media file yields the page.
 *
 * @param link - The links to choose from
 * @returns The alternate link's href, when there is one
 */
export function selectAlternate(link?: Atom.LinkInput): string | undefined {
	let links = toLinks(link);
	let alternates = links.filter((entry) => (entry.rel ?? "alternate") === "alternate");

	let html = alternates.find((entry) => entry.type === "text/html");
	if (html) return html.href;

	let untyped = alternates.find((entry) => entry.type === undefined);
	if (untyped) return untyped.href;

	return alternates[0]?.href;
}

/**
 * Finds the address a feed claims for itself, which is more trustworthy than the
 * URL it happened to be retrieved from when the two differ.
 *
 * @param link - The links to choose from
 * @returns The self link's href, when there is one
 */
export function selectSelf(link?: Atom.LinkInput): string | undefined {
	return toLinks(link).find((entry) => entry.rel === "self")?.href;
}

/**
 * Collects the links that publish a file alongside the post.
 *
 * @param link - The links to filter
 * @returns The enclosure links
 */
export function selectEnclosures(link?: Atom.LinkInput): Atom.Link[] {
	return toLinks(link).filter((entry) => entry.rel === "enclosure");
}
