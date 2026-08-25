/**
 * Low-resolution text drawing and layout helpers.
 *
 * Text renders through the bitmap font in `./font`, blitting lit pixels for a
 * crisp look at the integer-scaled retro resolution. Measuring, wrapping, and
 * alignment share one fixed glyph width; `Typewriter` reveals text over time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { blitGlyph, GLYPH_ADVANCE, GLYPH_HEIGHT } from "./font";
import * as theme from "./theme";

/**
 * Pixel height of one line of text, including a little leading below the glyph so
 * stacked lines do not touch. Callers space rows by this amount.
 */
export const LINE_HEIGHT = 12;

/** Options controlling one `drawText` call. */
export interface TextOptions {
	color?: string;
	align?: CanvasTextAlign;
	baseline?: CanvasTextBaseline;
}

/**
 * The rendered pixel width of `count` glyphs at the fixed bitmap metrics.
 *
 * Each glyph occupies a full `GLYPH_ADVANCE` cell, including after the last
 * glyph, so measuring, drawing, and alignment stay consistent.
 */
function widthOf(count: number): number {
	return count * GLYPH_ADVANCE;
}

/** Maps a canvas text baseline to the pixel offset of the glyph top from `y`. */
function baselineOffset(baseline: CanvasTextBaseline): number {
	switch (baseline) {
		case "middle":
			return -Math.round(GLYPH_HEIGHT / 2);
		case "bottom":
		case "alphabetic":
		case "ideographic":
			return -GLYPH_HEIGHT;
		default:
			return 0;
	}
}

/** Draws a single line of text at `(x, y)` with pixel-crisp defaults. */
export function drawText(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	options: TextOptions = {},
) {
	let align = options.align ?? "left";
	let baseline = options.baseline ?? "top";
	ctx.fillStyle = options.color ?? theme.TEXT.default;

	let width = widthOf(text.length);
	let left = Math.round(x);
	if (align === "center") left = Math.round(x - width / 2);
	else if (align === "right" || align === "end") left = Math.round(x - width);
	let top = Math.round(y) + baselineOffset(baseline);

	for (let index = 0; index < text.length; index++) {
		blitGlyph(ctx, text[index]!, left + index * GLYPH_ADVANCE, top);
	}
}

/** Measures the rendered pixel width of a string in the presentation font. */
export function measureText(_ctx: CanvasRenderingContext2D, text: string): number {
	return widthOf(text.length);
}

/** Wraps text to a maximum pixel width, breaking on spaces, into display lines. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	let lines: string[] = [];
	for (let paragraph of text.split("\n")) {
		let words = paragraph.split(" ");
		let line = "";
		for (let word of words) {
			let candidate = line ? `${line} ${word}` : word;
			if (measureText(ctx, candidate) > maxWidth && line) {
				lines.push(line);
				line = word;
			} else {
				line = candidate;
			}
		}
		lines.push(line);
	}
	return lines;
}

/** Reveals a string one character at a time at a fixed rate. */
export class Typewriter {
	/** Characters revealed so far, as a float that floors to a count. */
	private revealed = 0;

	/**
	 * @param text - The full string to reveal.
	 * @param charsPerSecond - Reveal speed in characters per second.
	 */
	constructor(
		private readonly text: string,
		private readonly charsPerSecond = 40,
	) {}

	/** Advances the reveal by `dt` milliseconds. */
	update(dt: number) {
		this.revealed = Math.min(this.text.length, this.revealed + (this.charsPerSecond * dt) / 1000);
	}

	/** Reveals the whole string immediately. */
	skip() {
		this.revealed = this.text.length;
	}

	/** The portion of the string revealed so far. */
	get visibleText(): string {
		return this.text.slice(0, Math.floor(this.revealed));
	}

	/** True once the entire string is revealed. */
	get done(): boolean {
		return this.revealed >= this.text.length;
	}
}
