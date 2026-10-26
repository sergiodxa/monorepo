/**
 * Link annotations: a clickable rectangle that opens a URI, recorded on the page's canvas in
 * PDF space and written as a `Link` annotation with no visible border.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Canvas, LinkArea } from "./canvas.js";
import type { Dict } from "./objects.js";

import { Name, Text } from "./objects.js";

/** A link's box with its top-left corner at `(x, y)`, in top-down page coordinates. */
export interface LinkBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Records a clickable area over whatever is drawn there. A box with a negative width or
 * height still covers the area between its edges.
 *
 * @param canvas - The page drawn on.
 * @param box - The area.
 * @param href - The URI it opens.
 */
export function addLink(canvas: Canvas, box: LinkBox, href: string): void {
	let top = canvas.height - box.y;
	let bottom = top - box.height;
	let right = box.x + box.width;
	canvas.links.push({
		rect: [
			Math.min(box.x, right),
			Math.min(top, bottom),
			Math.max(box.x, right),
			Math.max(top, bottom),
		],
		href,
	});
}

/**
 * The annotation dictionary for a recorded link area: a borderless `Link` whose action opens
 * the URI, written as the 7-bit ASCII string PDF requires of a URI action.
 *
 * @param area - The area and its URI.
 */
export function linkAnnotation(area: LinkArea): Dict {
	return {
		Type: new Name("Annot"),
		Subtype: new Name("Link"),
		Rect: area.rect,
		Border: [0, 0, 0],
		A: { Type: new Name("Action"), S: new Name("URI"), URI: new Text(asciiURI(area.href)) },
	};
}

/**
 * A URI in printable ASCII. An absolute URL is first normalized by the URL parser, which
 * turns an international host into Punycode; then every character outside `!`–`~` is
 * percent-encoded as UTF-8, so spaces and non-ASCII text survive the trip through the file.
 *
 * @param href - The URI as the caller wrote it.
 * @example asciiURI("https://example.com/café") // "https://example.com/caf%C3%A9"
 */
export function asciiURI(href: string): string {
	let normalized = URL.canParse(href) ? new URL(href).href : href;
	let out = "";
	for (let character of normalized) {
		let code = character.codePointAt(0) ?? 0;
		if (code >= 0x21 && code <= 0x7e) {
			out += character;
			continue;
		}
		for (let byte of new TextEncoder().encode(character)) {
			out += `%${byte.toString(16).padStart(2, "0").toUpperCase()}`;
		}
	}
	return out;
}
