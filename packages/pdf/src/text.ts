/**
 * Single lines of text: `drawText` places a line by the top of its line box and an alignment,
 * and `showText` is the primitive paragraphs draw each fragment with, positioned by baseline.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Canvas } from "./canvas.js";
import type { Color } from "./color.js";
import type { EmbeddedFont } from "./font.js";

import { fill } from "./color.js";
import { name, num } from "./objects.js";

/** Where `page.text()` puts a line and how it paints it. */
export interface TextOptions {
	/** The left edge, the center or the right edge of the line, by `align`. */
	x: number;
	/** The top of the line box; the baseline sits the font's ascent below it. */
	y: number;
	font: EmbeddedFont;
	/** Font size in points. */
	size: number;
	/**
	 * @default "#000000"
	 */
	color?: Color;
	/**
	 * Which point of the line `x` names.
	 * @default "left"
	 */
	align?: "left" | "center" | "right";
}

/** One run of glyphs at a known baseline, the unit paragraphs draw with. */
export interface ShowTextOptions {
	font: EmbeddedFont;
	size: number;
	color: Color;
	/** Left edge of the run, top-down page coordinates. */
	x: number;
	/** Baseline, top-down page coordinates. */
	baseline: number;
	text: string;
	/**
	 * Extra points after every space, which justified lines spread their slack with.
	 * @default 0
	 */
	wordSpacing?: number;
}

/**
 * Draws one line of text. The baseline sits the font's ascent below `y`, and `center` or
 * `right` shift the line by its measured width, kerning included, so `x` names that point.
 *
 * @param canvas - The page drawn on.
 * @param text - The line; line breaks are not interpreted.
 * @param options - Position, font and paint.
 */
export function drawText(canvas: Canvas, text: string, options: TextOptions): void {
	let { font, size, align = "left" } = options;
	let x = options.x;
	if (align !== "left") {
		let width = font.measure(text, size);
		x -= align === "center" ? width / 2 : width;
	}
	showText(canvas, {
		font,
		size,
		color: options.color ?? "#000000",
		x,
		baseline: options.y + font.ascent(size),
		text,
	});
}

/**
 * Draws a run of text with its baseline at `baseline` and its left edge at `x`. The glyphs
 * are recorded with the font now, and the `BT … ET` block is written when the file is, once
 * the font knows the ids of its embedded subset.
 *
 * @param canvas - The page drawn on.
 * @param options - The run.
 */
export function showText(canvas: Canvas, options: ShowTextOptions): void {
	let { font, size, x, baseline } = options;
	canvas.fonts.add(font);
	let tj = font.encode(options.text, size, options.wordSpacing ?? 0);
	let head = [
		"BT",
		fill(options.color),
		`${name(font.resource)} ${num(size)} Tf`,
		`${num(x)} ${num(canvas.height - baseline)} Td`,
	].join("\n");
	canvas.ops.push(() => `${head}\n${tj()} TJ\nET`);
}
