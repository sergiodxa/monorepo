/**
 * Derives the plain-text alternative of an email from its rendered HTML, so every
 * message ships both parts without a second authoring step. The conversion is
 * heuristic by design: it keeps link targets and block structure, and drops
 * anything a reader cannot act on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** HTML comments, which never carry reader-visible content. */
const COMMENT = /<!--[\s\S]*?-->/g;

/** A document type declaration, which describes the document format. */
const DOCTYPE = /<!doctype[^>]*>/gi;

/**
 * Blocks hidden from sighted readers with `display:none`, such as a preheader.
 * Non-greedy matching closes at the first same-tag closing tag, which is correct
 * for the hidden single-element blocks email layouts use.
 */
const HIDDEN_BLOCK = /<(div|span|p)\b[^>]*display\s*:\s*none[^>]*>[\s\S]*?<\/\1>/gi;

/**
 * Blocks marked `data-skip-in-text`, the explicit signal an author gives that an
 * element belongs to the HTML part alone, covering visible content such as a
 * decorative rule, a spacer, or a logo's alt text.
 */
const SKIPPED_BLOCK = /<(\w+)\b[^>]*\bdata-skip-in-text\b[^>]*>[\s\S]*?<\/\1>/gi;

/** The same marker on an element that closes itself, which has nothing to drop between tags. */
const SKIPPED_VOID = /<\w+\b[^>]*\bdata-skip-in-text\b[^>]*\/?>/gi;

/** Elements whose content belongs to the document structure. */
const DROPPED_BLOCK = /<(head|script|style|title)\b[^>]*>[\s\S]*?<\/\1>/gi;

/** Explicit line breaks, the one inline element that carries layout meaning. */
const LINE_BREAK = /<br\s*\/?>/gi;

/** A link with its target, captured as double-quoted, single-quoted, or bare. */
const ANCHOR = /<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;

/** End of a list item, which separates entries with a single newline. */
const LIST_ITEM_END = /<\/li\s*>/gi;

/** Start of a list item, replaced by a bullet marker. */
const LIST_ITEM_START = /<li\b[^>]*>/gi;

/**
 * An ordered list, whose items are numbered in the order they appear. Matching
 * closes at the first same-tag closing tag, so a nested ordered list numbers
 * as part of its parent's sequence.
 */
const ORDERED_LIST = /<ol\b[^>]*>[\s\S]*?<\/ol\s*>/gi;

/**
 * An image, replaced by what it says. Alt text is the whole of an image in a text part,
 * and often in the HTML one too: every major client blocks remote images until asked.
 */
const IMAGE = /<img\b[^>]*\balt\s*=\s*("([^"]*)"|'([^']*)')[^>]*>/gi;

/** Boundaries that read as a paragraph break. */
const PARAGRAPH_BOUNDARY =
	/<\/?(p|div|h[1-6]|table|ul|ol|dl|blockquote|section|article|header|footer|hr|address|pre|figure)\b[^>]*>/gi;

/** End of a table cell, which separates cells on the same line with a space. */
const CELL_END = /<\/(td|th)\s*>/gi;

/** End of a table row or definition entry, which ends the line so the next row starts immediately below it. */
const ROW_END = /<\/(tr|dt|dd|caption)\s*>/gi;

/** Any remaining tag, dropped once its structural meaning has been applied. */
const TAG = /<[^>]+>/g;

/** A character reference in named, decimal, or hexadecimal form. */
const ENTITY = /&(#\d+|#x[0-9a-f]+|[a-z]+);/gi;

/** Named references worth decoding: the ones a renderer emits or copy commonly uses. */
const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	apos: "'",
	gt: ">",
	hellip: "…",
	lt: "<",
	mdash: "—",
	nbsp: " ",
	ndash: "–",
	quot: '"',
};

/** Runs of horizontal whitespace, including the no-break space entities decode to. */
const HORIZONTAL_WHITESPACE = /[ \t\r\f\v\u00a0]+/g;

/** Three or more newlines, collapsed so structure never turns into empty screens. */
const EXTRA_NEWLINES = /\n{3,}/g;

/** Removes markup from a fragment that has already had its structure applied. */
function stripTags(html: string): string {
	return html.replace(TAG, "");
}

/** Resolves character references to the characters they stand for, leaving unknown ones intact. */
function decodeEntities(text: string): string {
	return text.replace(ENTITY, (match: string, reference: string) => {
		let name = reference.toLowerCase();
		let code = name.startsWith("#x")
			? Number.parseInt(name.slice(2), 16)
			: name.startsWith("#")
				? Number.parseInt(name.slice(1), 10)
				: Number.NaN;
		if (Number.isNaN(code)) return NAMED_ENTITIES[name] ?? match;
		if (code < 1 || code > 0x10ffff) return match;
		return String.fromCodePoint(code);
	});
}

/**
 * Renders a link as text. The target is kept beside the label because a plain-text
 * reader has no other way to reach it, and dropped when the label already is the
 * target so the URL is not printed twice.
 */
function formatLink(href: string, label: string): string {
	let target = href.trim();
	let text = label.trim();
	if (!target) return text;
	if (!text) return target;
	if (text === target || text === target.replace(/^mailto:/i, "")) return text;
	return `${text} (${target})`;
}

/**
 * Converts rendered email HTML into its plain-text alternative, preserving link
 * targets as `label (href)`, image alt text, and block structure as blank lines
 * so the text part carries the same content the HTML conveys visually.
 *
 * @param html - Rendered HTML of an email body.
 * @returns The plain-text alternative, trimmed and with runs of blank lines collapsed.
 * @example htmlToText('<p>Hi <a href="https://x.dev">here</a></p>'); // "Hi here (https://x.dev)"
 */
export function htmlToText(html: string): string {
	let text = html
		.replace(COMMENT, "")
		.replace(DOCTYPE, "")
		.replace(HIDDEN_BLOCK, "")
		.replace(SKIPPED_BLOCK, "")
		.replace(SKIPPED_VOID, "")
		.replace(DROPPED_BLOCK, "")
		.replace(LINE_BREAK, "\n")
		.replace(
			ANCHOR,
			(
				_match: string,
				_target: string,
				double: string | undefined,
				single: string | undefined,
				bare: string | undefined,
				label: string,
			) => formatLink(double ?? single ?? bare ?? "", stripTags(label)),
		)
		.replace(IMAGE, (_match, _quoted, double: string | undefined, single: string | undefined) => {
			return double ?? single ?? "";
		})
		.replace(ORDERED_LIST, (list: string) => {
			let position = 0;
			return list.replace(LIST_ITEM_START, () => `${(position += 1)}. `);
		})
		.replace(LIST_ITEM_END, "\n")
		.replace(LIST_ITEM_START, "- ")
		.replace(CELL_END, " ")
		.replace(ROW_END, "\n")
		.replace(PARAGRAPH_BOUNDARY, "\n\n");

	return decodeEntities(stripTags(text))
		.replace(HORIZONTAL_WHITESPACE, " ")
		.split("\n")
		.map((line) => line.trim())
		.join("\n")
		.replace(EXTRA_NEWLINES, "\n\n")
		.trim();
}
