/**
 * Derives the plain-text alternative of an email from its rendered HTML, so every
 * message ships both parts without a second authoring step. The conversion is
 * heuristic by design: it keeps link targets and block structure, and drops
 * anything a reader cannot act on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Elements whose content belongs to the document structure. */
const DROPPED_ELEMENTS = new Set(["head", "script", "style", "title"]);

/** Elements an email layout hides with `display:none`, such as a preheader. */
const HIDEABLE_ELEMENTS = new Set(["div", "span", "p"]);

/** The name an opening tag starts with, lowercased by the caller. */
const OPENING_NAME = /^<(\w+)/;

/** An inline style that hides an element from sighted readers. */
const DISPLAY_NONE = /display\s*:\s*none/i;

/**
 * The explicit signal an author gives that an element belongs to the HTML part
 * alone, covering visible content such as a decorative rule, a spacer, or a logo's alt text.
 */
const SKIP_IN_TEXT = /\bdata-skip-in-text\b/i;

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

/**
 * Removes markup from a fragment that has already had its structure applied. Each
 * tag runs from a `<` to the next `>`, and a `<` with no `>` after it stays as text,
 * so one forward pass leaves nothing that reads as a tag.
 */
function stripTags(html: string): string {
	let out = "";
	let index = 0;

	while (index < html.length) {
		let open = html.indexOf("<", index);
		if (open === -1) break;
		let close = html.indexOf(">", open + 1);
		if (close === -1) break;
		out += html.slice(index, open);
		index = close + 1;
	}

	return out + html.slice(index);
}

/**
 * The element an opening tag starts that the text part drops together with its
 * content, or `null` when the tag stays. A document type declaration counts as an
 * element with no content.
 */
function droppedElement(tag: string): string | null {
	let lower = tag.toLowerCase();
	if (lower.startsWith("<!doctype")) return "";
	let name = OPENING_NAME.exec(lower)?.[1];
	if (name === undefined) return null;
	if (DROPPED_ELEMENTS.has(name) || SKIP_IN_TEXT.test(tag)) return name;
	if (HIDEABLE_ELEMENTS.has(name) && DISPLAY_NONE.test(tag)) return name;
	return null;
}

/**
 * Drops comments, the doctype, and every element a reader cannot see in one forward
 * pass, so time stays linear and removing a region never joins its neighbours into a
 * new tag. An element ends at its first same-name closing tag, or loses only its opening tag.
 */
function dropInvisible(html: string): string {
	let lower = html.toLowerCase();
	let closings = new Map<string, number>();
	let out = "";
	let index = 0;

	while (index < html.length) {
		let open = html.indexOf("<", index);
		if (open === -1) break;
		out += html.slice(index, open);

		if (html.startsWith("<!--", open)) {
			let end = html.indexOf("-->", open + 4);
			index = end === -1 ? html.length : end + 3;
			continue;
		}

		let close = html.indexOf(">", open + 1);
		if (close === -1) {
			index = open;
			break;
		}

		let tag = html.slice(open, close + 1);
		let name = droppedElement(tag);
		index = close + 1;

		if (name === null) {
			out += tag;
			continue;
		}

		if (name === "" || tag.endsWith("/>")) continue;

		let closing = `</${name}>`;
		let found = closings.get(name);
		if (found === undefined || (found !== -1 && found < index)) {
			found = lower.indexOf(closing, index);
			closings.set(name, found);
		}
		if (found !== -1) index = found + closing.length;
	}

	return out + html.slice(index);
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
	let text = dropInvisible(html)
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
