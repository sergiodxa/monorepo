/**
 * Low-resolution text drawing and layout helpers.
 *
 * The presentation targets a crisp pixel look; this module uses the canvas text
 * API with a small monospace stack as an acceptable first pass (a bundled bitmap
 * font can replace it later without touching callers). It centralises the font
 * string, measuring, and word-wrapping to a pixel width so dialogue and menus
 * page consistently. A `Typewriter` reveals text one character at a time for
 * message windows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Pixel height of one line of text at the default size. */
export const LINE_HEIGHT = 12;

/** The canvas font string used for all presentation text. */
const FONT = '10px "Courier New", monospace';

/** Options controlling one `drawText` call. */
export interface TextOptions {
	color?: string;
	align?: CanvasTextAlign;
	baseline?: CanvasTextBaseline;
}

/** Draws a single line of text at `(x, y)` with pixel-crisp defaults. */
export function drawText(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	options: TextOptions = {},
) {
	ctx.font = FONT;
	ctx.fillStyle = options.color ?? "#202020";
	ctx.textAlign = options.align ?? "left";
	ctx.textBaseline = options.baseline ?? "top";
	ctx.fillText(text, Math.round(x), Math.round(y));
}

/** Measures the rendered pixel width of a string in the presentation font. */
export function measureText(ctx: CanvasRenderingContext2D, text: string): number {
	ctx.font = FONT;
	return ctx.measureText(text).width;
}

/** Wraps text to a maximum pixel width, breaking on spaces, into display lines. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	ctx.font = FONT;
	let lines: string[] = [];
	for (let paragraph of text.split("\n")) {
		let words = paragraph.split(" ");
		let line = "";
		for (let word of words) {
			let candidate = line ? `${line} ${word}` : word;
			if (ctx.measureText(candidate).width > maxWidth && line) {
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
