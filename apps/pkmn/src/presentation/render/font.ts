/**
 * An original 5×7 pixel bitmap font and a low-level glyph blitter.
 *
 * The presentation targets a crisp, integer-scaled retro look, where the
 * browser's anti-aliased `fillText` renders blurry. This module supplies a
 * hand-authored monospaced font — every glyph is designed here from scratch as a
 * grid of lit/unlit pixels, so nothing is copied from any real or proprietary
 * typeface. Each glyph is `GLYPH_WIDTH`×`GLYPH_HEIGHT` and encoded as an array of
 * row bit-strings (`"0"` empty, any other char lit) for compact, readable data.
 * `blitGlyph` paints one glyph by filling a 1×1 rect per lit pixel in the
 * context's current `fillStyle`; `blitString` walks a string, advancing by
 * `GLYPH_ADVANCE` (glyph width plus one pixel of letter spacing) and falling back
 * to a box glyph for characters the font does not define. Higher-level layout,
 * color, and alignment live in `text.ts`; this module only knows pixels.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Width in pixels of every glyph's cell. */
export const GLYPH_WIDTH = 5;

/** Height in pixels of every glyph's cell. */
export const GLYPH_HEIGHT = 7;

/** Horizontal distance between the left edges of adjacent glyphs (width + 1px spacing). */
export const GLYPH_ADVANCE = GLYPH_WIDTH + 1;

/**
 * The glyph drawn for any character the font does not define: a hollow box that
 * spans the full cell, so missing characters are visible but never crash.
 */
export const FALLBACK_GLYPH: readonly string[] = [
	"11111",
	"10001",
	"10001",
	"10001",
	"10001",
	"10001",
	"11111",
];

/**
 * The bitmap glyph table, keyed by character.
 *
 * Every entry is exactly `GLYPH_HEIGHT` rows of `GLYPH_WIDTH` characters; a `"0"`
 * is an empty pixel and anything else is lit. Space is intentionally all-empty so
 * it advances the cursor without drawing. Designed by hand for this game.
 */
export const GLYPHS: Readonly<Record<string, readonly string[]>> = {
	" ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],

	// Uppercase letters.
	A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
	B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
	C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
	D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
	E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
	F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
	G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
	H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
	I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
	J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
	K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
	L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
	M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
	N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
	O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
	P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
	Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
	R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
	S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
	T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
	U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
	V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
	W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
	X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
	Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
	Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],

	// Lowercase letters.
	a: ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
	b: ["10000", "10000", "10110", "11001", "10001", "10001", "11110"],
	c: ["00000", "00000", "01110", "10001", "10000", "10001", "01110"],
	d: ["00001", "00001", "01101", "10011", "10001", "10001", "01111"],
	e: ["00000", "00000", "01110", "10001", "11111", "10000", "01110"],
	f: ["00110", "01001", "01000", "11100", "01000", "01000", "01000"],
	g: ["00000", "01111", "10001", "10001", "01111", "00001", "01110"],
	h: ["10000", "10000", "10110", "11001", "10001", "10001", "10001"],
	i: ["00100", "00000", "01100", "00100", "00100", "00100", "01110"],
	j: ["00010", "00000", "00110", "00010", "00010", "10010", "01100"],
	k: ["10000", "10000", "10010", "10100", "11000", "10100", "10010"],
	l: ["01100", "00100", "00100", "00100", "00100", "00100", "01110"],
	m: ["00000", "00000", "11010", "10101", "10101", "10101", "10101"],
	n: ["00000", "00000", "10110", "11001", "10001", "10001", "10001"],
	o: ["00000", "00000", "01110", "10001", "10001", "10001", "01110"],
	p: ["00000", "11110", "10001", "10001", "11110", "10000", "10000"],
	q: ["00000", "01111", "10001", "10001", "01111", "00001", "00001"],
	r: ["00000", "00000", "10110", "11001", "10000", "10000", "10000"],
	s: ["00000", "00000", "01111", "10000", "01110", "00001", "11110"],
	t: ["01000", "01000", "11100", "01000", "01000", "01001", "00110"],
	u: ["00000", "00000", "10001", "10001", "10001", "10011", "01101"],
	v: ["00000", "00000", "10001", "10001", "10001", "01010", "00100"],
	w: ["00000", "00000", "10001", "10001", "10101", "10101", "01010"],
	x: ["00000", "00000", "10001", "01010", "00100", "01010", "10001"],
	y: ["00000", "10001", "10001", "01111", "00001", "00001", "01110"],
	z: ["00000", "00000", "11111", "00010", "00100", "01000", "11111"],

	// Digits.
	"0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
	"1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
	"2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
	"3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
	"4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
	"5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
	"6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
	"7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
	"8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
	"9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],

	// Punctuation.
	".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
	",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
	"!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
	"?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
	"'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
	'"': ["01010", "01010", "01010", "00000", "00000", "00000", "00000"],
	":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
	";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
	"-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
	_: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
	"/": ["00001", "00001", "00010", "00100", "01000", "10000", "10000"],
	"(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
	")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
	"+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
	"×": ["00000", "10001", "01010", "00100", "01010", "10001", "00000"],
	"…": ["00000", "00000", "00000", "00000", "00000", "00000", "10101"],

	// Gender signs and game-specific symbols.
	"♂": ["00111", "00011", "00101", "01000", "10100", "01010", "00100"],
	"♀": ["00100", "01010", "01010", "00100", "01110", "00100", "00100"],
	"₽": ["11110", "10001", "11110", "10000", "11100", "10000", "10000"],
	"▲": ["00000", "00100", "00100", "01110", "01110", "11111", "11111"],
	"▼": ["11111", "11111", "01110", "01110", "00100", "00100", "00000"],
};

/**
 * A minimal recorder of the `fillRect` calls a blitter needs, so callers can pass
 * either a real `CanvasRenderingContext2D` or a lightweight fake for testing.
 */
export interface GlyphContext {
	fillRect(x: number, y: number, w: number, h: number): void;
}

/** Returns the glyph rows for `char`, falling back to the box glyph when unknown. */
export function glyphFor(char: string): readonly string[] {
	return GLYPHS[char] ?? FALLBACK_GLYPH;
}

/**
 * Blits one glyph's lit pixels at `(x, y)` as 1×1 rects in the current fill color.
 *
 * `x` and `y` are the top-left of the glyph cell in device pixels. Unknown
 * characters render the fallback box. Returns nothing; the caller advances the
 * cursor by `GLYPH_ADVANCE`.
 */
export function blitGlyph(ctx: GlyphContext, char: string, x: number, y: number) {
	let rows = glyphFor(char);
	for (let row = 0; row < rows.length; row++) {
		let bits = rows[row]!;
		for (let col = 0; col < bits.length; col++) {
			if (bits[col] !== "0") ctx.fillRect(x + col, y + row, 1, 1);
		}
	}
}

/**
 * Blits a whole string starting at `(x, y)`, advancing one `GLYPH_ADVANCE` per
 * character. Each glyph is drawn in the context's current fill color; newlines are
 * not handled here (callers pre-split into lines).
 */
export function blitString(ctx: GlyphContext, text: string, x: number, y: number) {
	for (let index = 0; index < text.length; index++) {
		blitGlyph(ctx, text[index]!, x + index * GLYPH_ADVANCE, y);
	}
}
