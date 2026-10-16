/**
 * Fits text into a box with a font's own metrics: wraps at spaces, shrinks in 2 px steps to
 * stay within a line limit, and ends with an ellipsis when the smallest size still overflows.
 * The widths that decide each break are the widths the glyphs are drawn at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Raster } from "./types.js";

/** How much a size shrinks per attempt while fitting. */
const SHRINK_STEP = 2;

/** The baseline distance, as a multiple of the size, when the caller sets none. */
const DEFAULT_LINE_HEIGHT = 1.15;

/** A run of text after fitting: the lines and the size and tracking to draw them at. */
export interface FittedText extends Raster.TextMetrics {
	tracking: number;
	lineHeight: number;
}

/**
 * Lays `content` out under `options`. Tracking scales with the size, so a shrunk title keeps
 * the same letter-spacing proportion it was designed with.
 */
export function fitText(content: string, options: Raster.TextOptions): FittedText {
	let lineHeight = options.lineHeight ?? DEFAULT_LINE_HEIGHT;
	let minSize = Math.min(options.minSize ?? options.size, options.size);
	let size = options.size;
	let lines = wrap(content, options, size);
	while (options.maxLines !== undefined && lines.length > options.maxLines && size > minSize) {
		size = Math.max(minSize, size - SHRINK_STEP);
		lines = wrap(content, options, size);
	}
	if (options.maxLines !== undefined && lines.length > options.maxLines) {
		lines = lines.slice(0, Math.max(1, options.maxLines));
		let lastIndex = lines.length - 1;
		lines[lastIndex] = ellipsize(lines[lastIndex] ?? "", options, size);
	}
	let width = Math.max(0, ...lines.map((line) => measure(line, options, size)));
	return {
		size,
		lines,
		width,
		height: lines.length * size * lineHeight,
		tracking: trackingAt(options, size),
		lineHeight,
	};
}

/** The line's width at `size`, with tracking scaled to that size. */
export function measure(text: string, options: Raster.TextOptions, size: number): number {
	return options.font.measure(text, size, {
		tracking: trackingAt(options, size),
		kerning: options.kerning ?? true,
	});
}

/** Tracking scaled from the designed size to `size`. */
function trackingAt(options: Raster.TextOptions, size: number): number {
	return ((options.tracking ?? 0) * size) / options.size;
}

/**
 * Greedy word wrap. Runs of whitespace collapse to one space, and a word wider than the box
 * on its own is broken between characters, so no line ever exceeds `maxWidth`.
 */
function wrap(content: string, options: Raster.TextOptions, size: number): string[] {
	let words = content.trim().split(/\s+/).filter(Boolean);
	let maxWidth = options.maxWidth;
	if (maxWidth === undefined) return [words.join(" ")];
	let lines: string[] = [];
	let current = "";
	for (let word of words) {
		let candidate = current ? `${current} ${word}` : word;
		if (measure(candidate, options, size) <= maxWidth) {
			current = candidate;
			continue;
		}
		if (current) lines.push(current);
		current = "";
		for (let piece of breakWord(word, options, size, maxWidth)) {
			if (current) lines.push(current);
			current = piece;
		}
	}
	if (current || lines.length === 0) lines.push(current);
	return lines;
}

/** Splits a word into pieces no wider than `maxWidth`, keeping at least one character each. */
function breakWord(
	word: string,
	options: Raster.TextOptions,
	size: number,
	maxWidth: number,
): string[] {
	if (measure(word, options, size) <= maxWidth) return [word];
	let pieces: string[] = [];
	let piece = "";
	for (let character of word) {
		if (piece && measure(piece + character, options, size) > maxWidth) {
			pieces.push(piece);
			piece = "";
		}
		piece += character;
	}
	if (piece) pieces.push(piece);
	return pieces;
}

/**
 * Trims the line until it fits with an ellipsis appended. A font with no `…` glyph gets three
 * full stops instead, so the truncation always draws.
 */
function ellipsize(line: string, options: Raster.TextOptions, size: number): string {
	let mark = options.font.glyphIndex(0x2026) === 0 ? "..." : "…";
	let maxWidth = options.maxWidth ?? Infinity;
	let characters = Array.from(line);
	while (
		characters.length > 0 &&
		measure(characters.join("").trimEnd() + mark, options, size) > maxWidth
	) {
		characters.pop();
	}
	return characters.join("").trimEnd() + mark;
}
