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
 * Reads `{@link target}`, `{@link target|label}` and `{@link target label}`. Any
 * whitespace separates the parts, since a comment wraps where its line ends and a tag
 * is as likely to be broken across lines as anything else in the prose around it.
 * Each tag is read with forward searches only, so the cost stays linear in the text.
 *
 * @param text - Markdown from a `DocComment` description or a `DocTag`.
 * @returns Each link with the text it replaces and where that text starts.
 *
 * @example
 * inlineLinks("See {@link parseComment} first.")[0].target; // "parseComment"
 */
export function inlineLinks(text: string): DocLink[] {
	let links: DocLink[] = [];
	let position = 0;

	while (position < text.length) {
		let index = text.indexOf("{@link", position);
		if (index === -1) break;

		let cursor = index + "{@link".length;
		if (text.startsWith("code", cursor)) cursor += "code".length;
		else if (text.startsWith("plain", cursor)) cursor += "plain".length;

		let spaced = cursor;
		while (cursor < text.length && isSpace(text.charAt(cursor))) cursor++;
		let targetStart = cursor;
		while (cursor < text.length && isTargetChar(text.charAt(cursor))) cursor++;
		if (targetStart === spaced || cursor === targetStart) {
			position = index + 1;
			continue;
		}

		let close = text.indexOf("}", cursor);
		if (close === -1) break;

		links.push({
			raw: text.slice(index, close + 1),
			target: text.slice(targetStart, cursor),
			text: readLabel(text.slice(cursor, close)),
			index,
		});
		position = close + 1;
	}

	return links;
}

/** Whether the character is one JavaScript's `\s` matches, the separator between a tag's parts. */
function isSpace(char: string): boolean {
	return char.trim() === "";
}

/** Whether the character can belong to a link target, which ends at whitespace, `|` or `}`. */
function isTargetChar(char: string): boolean {
	return char !== "}" && char !== "|" && !isSpace(char);
}

/**
 * The label after a target: one leading `|` separator dropped, surrounding whitespace
 * trimmed, and `null` when nothing is left.
 */
function readLabel(rest: string): string | null {
	let label = rest.trimStart();
	if (label.startsWith("|")) label = label.slice(1);
	label = label.trim();
	return label === "" ? null : label;
}
