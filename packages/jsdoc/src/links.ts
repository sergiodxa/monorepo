/**
 * Reads the inline `{@link}` family out of comment text. The offsets travel with
 * each link so a renderer can swap the tag for an anchor without re-scanning the
 * markdown around it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocLink } from "./types.js";

/**
 * Matches `{@link target}`, `{@link target|label}` and `{@link target label}`. Any
 * whitespace separates the parts, since a comment wraps where its line ends and a tag
 * is as likely to be broken across lines as anything else in the prose around it.
 */
const INLINE_LINK = /\{@link(?:code|plain)?\s+([^}|\s]+)(?:\s*\|\s*|\s+)?([^}]*)\}/g;

/**
 * Find every inline link in a description or tag text.
 *
 * @param text - Markdown from a `DocComment` description or a `DocTag`.
 * @returns Each link with the text it replaces and where that text starts.
 *
 * @example
 * inlineLinks("See {@link parseComment} first.")[0].target; // "parseComment"
 */
export function inlineLinks(text: string): DocLink[] {
	let links: DocLink[] = [];

	for (let match of text.matchAll(INLINE_LINK)) {
		let label = match[2]?.trim() ?? "";
		links.push({
			raw: match[0],
			target: match[1] ?? "",
			text: label === "" ? null : label,
			index: match.index,
		});
	}

	return links;
}
