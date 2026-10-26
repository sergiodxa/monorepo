/**
 * What a page records while it is drawn on: content operators, the fonts and images they
 * name, and the link areas over them. Each drawing module writes into a `Canvas`, and the
 * document turns it into a page object when the file is written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { EmbeddedFont } from "./font.js";
import type { EmbeddedImage } from "./image.js";

/**
 * A content operator. A function is resolved when the document is written, after every font
 * is subset, so text drawn early still writes the glyph ids its font's subset ends up with.
 */
export type Operator = string | (() => string);

/** A clickable rectangle in PDF space (origin bottom-left), as `[x1, y1, x2, y2]`. */
export interface LinkArea {
	rect: [number, number, number, number];
	href: string;
}

/** One page's drawing state; every coordinate written into `ops` is already in PDF space. */
export interface Canvas {
	/** Page width in points. */
	readonly width: number;
	/** Page height in points; `height - y` turns a top-down y into PDF space. */
	readonly height: number;
	readonly ops: Operator[];
	/** The fonts the page's text uses, listed in its resources by `resource` name. */
	readonly fonts: Set<EmbeddedFont>;
	/** The images the page draws, listed in its resources by `resource` name. */
	readonly images: Set<EmbeddedImage>;
	readonly links: LinkArea[];
}
