/**
 * A page of a document: the surface every drawing method writes to, in points with the origin
 * at the top-left corner and y growing downward. Each method appends operators in call
 * order, so what is drawn later paints over what was drawn before.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Canvas } from "./canvas.js";
import type { EmbeddedImage, ImageOptions } from "./image.js";
import type { LinkBox } from "./link.js";
import type { Paragraph } from "./paragraph.js";
import type { LineOptions, RectOptions } from "./shapes.js";
import type { TextOptions } from "./text.js";

import { drawImage } from "./image.js";
import { addLink } from "./link.js";
import { drawParagraph } from "./paragraph.js";
import { drawLine, drawRect } from "./shapes.js";
import { drawText } from "./text.js";

/** A page of a document. Obtain one from `pdf.page()`. */
export class Page {
	/** Width in points. */
	readonly width: number;
	/** Height in points. */
	readonly height: number;

	#canvas: Canvas;

	/**
	 * @param canvas - The drawing state the document keeps for this page and writes out.
	 */
	constructor(canvas: Canvas) {
		this.width = canvas.width;
		this.height = canvas.height;
		this.#canvas = canvas;
	}

	/**
	 * Draws one line of text with the top of its line box at `y`.
	 *
	 * @param text - The line; line breaks are not interpreted.
	 * @param options - Position, font, size, color and alignment.
	 * @example page.text("Total", { x: 572, y: 40, font, size: 10, align: "right" })
	 */
	text(text: string, options: TextOptions): void {
		drawText(this.#canvas, text, options);
	}

	/**
	 * Draws a wrapped paragraph with its top-left corner at `(x, y)`, linking every run that
	 * has an `href`.
	 *
	 * @param paragraph - A paragraph from `pdf.paragraph()`.
	 * @param position - Its top-left corner.
	 * @returns The y just below its last line, where the next block can start.
	 */
	paragraph(paragraph: Paragraph, position: { x: number; y: number }): number {
		return drawParagraph(this.#canvas, paragraph, position.x, position.y);
	}

	/**
	 * Strokes a straight line.
	 *
	 * @param options - Endpoints, width and color.
	 * @example page.line({ from: [40, 76], to: [572, 76], width: 0.5, color: "#999999" })
	 */
	line(options: LineOptions): void {
		drawLine(this.#canvas, options);
	}

	/**
	 * Fills and/or strokes a rectangle, optionally with rounded corners.
	 *
	 * @param options - Box, paint and radius.
	 * @example page.rect({ x: 40, y: 40, width: 100, height: 20, fill: "#eeeeee", radius: 4 })
	 */
	rect(options: RectOptions): void {
		drawRect(this.#canvas, options);
	}

	/**
	 * Draws an image scaled into a box, keeping its aspect ratio when `height` is omitted.
	 *
	 * @param image - An image from `pdf.image()` on the same document.
	 * @param options - The box.
	 */
	image(image: EmbeddedImage, options: ImageOptions): void {
		drawImage(this.#canvas, image, options);
	}

	/**
	 * Makes a rectangle clickable, opening `href`, over whatever is drawn there.
	 *
	 * @param box - The area, top-left corner at `(x, y)`.
	 * @param href - The URI it opens.
	 */
	link(box: LinkBox, href: string): void {
		addLink(this.#canvas, box, href);
	}
}
