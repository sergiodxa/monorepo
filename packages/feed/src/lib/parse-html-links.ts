/**
 * Scans an HTML document for its `<link>` and `<base>` elements.
 *
 * A dedicated scanner rather than the XML parser, because HTML that is perfectly
 * ordinary is not well-formed XML: `<link>` is void and so reads as unclosed, and
 * a page carrying an entity from outside the XHTML sets fails the whole document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** How much of a document is scanned when it declares no `</head>`. */
const MAXIMUM_SCANNED_LENGTH = 512 * 1024;

const ELEMENT_PATTERN = /<(link|base)\b([^>]*)>/gi;
const ATTRIBUTE_PATTERN = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

/** The elements a scan found, with the base that applies to them. */
export interface HtmlLinks {
	base?: string;
	links: Record<string, string>[];
}

/**
 * Reads the `<link>` elements out of a document's head.
 *
 * The scan stops at `</head>` when the document has one, and is otherwise capped,
 * so a page with a very long body costs no more than one with a short one.
 *
 * @param html - The document text
 * @returns The links in document order, and the declared base
 */
export function parseHtmlLinks(html: string): HtmlLinks {
	let head = readHead(html);
	let links: Record<string, string>[] = [];
	let base: string | undefined;

	ELEMENT_PATTERN.lastIndex = 0;
	let match = ELEMENT_PATTERN.exec(head);

	while (match) {
		let attributes = readAttributes(match[2] ?? "");

		if (match[1]?.toLowerCase() === "base") {
			base ??= attributes["href"];
		} else {
			links.push(attributes);
		}

		match = ELEMENT_PATTERN.exec(head);
	}

	return { base, links };
}

/** Narrows the text to the document's head, or to a bounded prefix when it has none. */
function readHead(html: string): string {
	let end = html.search(/<\/head\s*>/i);
	if (end !== -1) return html.slice(0, end);
	return html.slice(0, MAXIMUM_SCANNED_LENGTH);
}

/**
 * Reads one element's attributes.
 *
 * Names are lowercased because HTML is case-insensitive about them; values are
 * left alone apart from `&amp;`, which query strings carry routinely and which
 * would otherwise reach a caller as a literal entity in a URL.
 */
function readAttributes(source: string): Record<string, string> {
	let attributes: Record<string, string> = {};

	ATTRIBUTE_PATTERN.lastIndex = 0;
	let match = ATTRIBUTE_PATTERN.exec(source);

	while (match) {
		let name = match[1]?.toLowerCase();
		let value = match[2] ?? match[3] ?? match[4] ?? "";
		if (name) attributes[name] = value.replaceAll("&amp;", "&");
		match = ATTRIBUTE_PATTERN.exec(source);
	}

	return attributes;
}
