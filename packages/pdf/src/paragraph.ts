/**
 * Paragraphs: runs of styled text wrapped to a width before they are placed, so a caller can
 * read their height and split them at a page break before drawing them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Canvas } from "./canvas.js";
import type { Color } from "./color.js";
import type { EmbeddedFont } from "./font.js";

import { addLink } from "./link.js";
import { showText } from "./text.js";

/** Slack for floating-point sums, so text measured to exactly the width still fits. */
const EPSILON = 1e-6;

/** Whitespace that collapses into one breakable space; no-break spaces stay glyphs. */
const COLLAPSIBLE = /^[^\S\n\u00a0\u2007\u202f]$/u;

/** Characters a line may break after, keeping the character on the first line. */
const HYPHENS = new Set(["-", "\u2010"]);

/** A span of text with its own style; anything it leaves out comes from the paragraph. */
export interface Run {
	text: string;
	font?: EmbeddedFont;
	size?: number;
	color?: Color;
	/** A URI; every line fragment the run occupies becomes a link to it. */
	href?: string;
}

/** The paragraph's width and the style its runs inherit. */
export interface ParagraphOptions {
	/** The width lines wrap to, in points. */
	width: number;
	font: EmbeddedFont;
	/** Font size in points. */
	size: number;
	/**
	 * Line height as a multiple of each run's font size.
	 * @default 1.2
	 */
	lineHeight?: number;
	/**
	 * @default "#000000"
	 */
	color?: Color;
	/**
	 * How each line sits in the width; a justified paragraph leaves its last line, and every
	 * line that ends in a `"\n"`, at the left.
	 * @default "left"
	 */
	align?: "left" | "center" | "right" | "justify";
}

/** A piece of one line drawn in a single style, positioned relative to the line. */
export interface Fragment {
	text: string;
	font: EmbeddedFont;
	size: number;
	color: Color;
	href: string | undefined;
	/** Left edge from the paragraph's left edge, alignment and justification applied. */
	x: number;
	/** Drawn width, justification included. */
	width: number;
	/** Extra points after each space, set on justified lines. */
	wordSpacing: number;
}

/** One wrapped line. */
export interface Line {
	/** Adjacent text in one style shares a fragment; trailing spaces are left out. */
	fragments: Fragment[];
	/** Offset of the line's top from the paragraph's top. */
	y: number;
	/** The baseline's offset from the line's top. */
	baseline: number;
	height: number;
	/** The natural width of the text, before alignment and justification. */
	width: number;
}

/** A laid-out paragraph. Obtain one from `pdf.paragraph()`. */
export class Paragraph {
	/** The width the lines wrap to. */
	readonly width: number;
	readonly lines: Line[];
	/** The sum of the line heights. */
	readonly height: number;

	/**
	 * @param width - The wrapping width.
	 * @param lines - The lines, with `y` counted from this paragraph's top.
	 */
	constructor(width: number, lines: Line[]) {
		this.width = width;
		this.lines = lines;
		this.height = lines.reduce((sum, line) => sum + line.height, 0);
	}

	/**
	 * Splits the paragraph after the last whole line that fits in `height`. When even the
	 * first line is taller than `height`, the first half has no lines and zero height and the
	 * rest is the whole paragraph, so the caller moves it to the next page.
	 *
	 * @param height - The space available, in points.
	 * @returns The lines that fit and the rest, with its lines counted from its own top; the
	 *   rest is `null` when everything fits.
	 */
	split(height: number): [Paragraph, Paragraph | null] {
		let used = 0;
		let count = 0;
		for (let line of this.lines) {
			if (used + line.height > height + EPSILON) break;
			used += line.height;
			count += 1;
		}
		if (count === this.lines.length) return [this, null];
		if (count === 0) return [new Paragraph(this.width, []), this];
		let rest = this.lines.slice(count).map((line) => ({ ...line, y: line.y - used }));
		return [new Paragraph(this.width, this.lines.slice(0, count)), new Paragraph(this.width, rest)];
	}
}

/** A run's resolved style; pieces in equal styles merge into one fragment. */
interface Style {
	font: EmbeddedFont;
	size: number;
	color: Color;
	href: string | undefined;
}

/** Text in one style that the line breaker treats as a unit or part of one. */
interface Piece {
	text: string;
	style: Style;
}

/**
 * An unbreakable stretch of text, possibly in several styles, and what may follow it: a
 * collapsed space, a break after its hyphen, a forced line break, or the end of the text.
 */
interface Segment {
	pieces: Piece[];
	after: "space" | "hyphen" | "newline" | "end";
	/** The style of the space that follows, which sets its width. */
	spaceStyle: Style;
	/** The style an otherwise empty line takes its height from. */
	style: Style;
}

/** A line before it is positioned: its pieces with trailing spaces removed. */
interface Draft {
	pieces: Piece[];
	/** Set when a `"\n"` ended the line, which keeps it out of justification. */
	forced: boolean;
	style: Style;
}

/**
 * Wraps runs to a width. Whitespace collapses to single spaces, `"\n"` forces a break,
 * lines break at spaces and after hyphens, and a word wider than the line breaks between
 * code points. Line heights follow the CSS model: each fragment's half-leading is added
 * above its ascent and below its descent, and the line spans the largest of each.
 *
 * @param runs - The paragraph's text, in order.
 * @param options - Width and inherited style.
 */
export function layoutParagraph(runs: Run[], options: ParagraphOptions): Paragraph {
	let base: Style = {
		font: options.font,
		size: options.size,
		color: options.color ?? "#000000",
		href: undefined,
	};
	let drafts = wrap(segment(runs, base), options.width, base);
	let lineHeight = options.lineHeight ?? 1.2;
	let align = options.align ?? "left";
	let y = 0;
	let lines = drafts.map((draft, index) => {
		let last = draft.forced || index === drafts.length - 1;
		let line = position(
			draft,
			options.width,
			lineHeight,
			align === "justify" && last ? "left" : align,
			y,
		);
		y += line.height;
		return line;
	});
	return new Paragraph(options.width, lines);
}

/**
 * Draws a paragraph with its top-left corner at `(x, y)` and links its `href` runs, each
 * link covering its fragment's width and the full height of its line.
 *
 * @param canvas - The page drawn on.
 * @param paragraph - A laid-out paragraph.
 * @param x - Left edge.
 * @param y - Top edge.
 * @returns The y just below the last line.
 */
export function drawParagraph(canvas: Canvas, paragraph: Paragraph, x: number, y: number): number {
	for (let line of paragraph.lines) {
		for (let fragment of line.fragments) {
			showText(canvas, {
				font: fragment.font,
				size: fragment.size,
				color: fragment.color,
				x: x + fragment.x,
				baseline: y + line.y + line.baseline,
				text: fragment.text,
				wordSpacing: fragment.wordSpacing,
			});
			if (fragment.href === undefined) continue;
			let box = { x: x + fragment.x, y: y + line.y, width: fragment.width, height: line.height };
			addLink(canvas, box, fragment.href);
		}
	}
	return y + paragraph.height;
}

/**
 * The run's style with the paragraph's filling every field it leaves out.
 *
 * @param run - One run.
 * @param base - The paragraph's style.
 */
function resolve(run: Run, base: Style): Style {
	return {
		font: run.font ?? base.font,
		size: run.size ?? base.size,
		color: run.color ?? base.color,
		href: run.href,
	};
}

/**
 * Whether two styles draw identically and link to the same place.
 *
 * @param a - One style.
 * @param b - The other.
 */
function sameStyle(a: Style, b: Style): boolean {
	return a.font === b.font && a.size === b.size && a.color === b.color && a.href === b.href;
}

/**
 * Cuts the runs into unbreakable segments. Leading whitespace, whitespace after another
 * space and whitespace next to a `"\n"` collapse away; a hyphen is a break opportunity only
 * after another character, so `-5` and `--flag` stay whole.
 *
 * @param runs - The paragraph's text.
 * @param base - The paragraph's style.
 */
function segment(runs: Run[], base: Style): Segment[] {
	let segments: Segment[] = [];
	let pieces: Piece[] = [];
	let previous = "";
	let close = (after: Segment["after"], style: Style) => {
		segments.push({ pieces, after, spaceStyle: style, style });
		pieces = [];
		previous = "";
	};
	for (let run of runs) {
		let style = resolve(run, base);
		for (let char of run.text) {
			let last = segments.at(-1);
			if (char === "\n") {
				if (pieces.length > 0) close("newline", style);
				else if (last !== undefined && last.after !== "newline") last.after = "newline";
				else close("newline", style);
			} else if (COLLAPSIBLE.test(char)) {
				if (pieces.length > 0) close("space", style);
				else if (last?.after === "hyphen") {
					last.after = "space";
					last.spaceStyle = style;
				}
			} else {
				append(pieces, char, style);
				let breaks = HYPHENS.has(char) && previous !== "" && !HYPHENS.has(previous);
				previous = char;
				if (breaks) close("hyphen", style);
			}
		}
	}
	if (pieces.length > 0) close("end", base);
	return segments;
}

/**
 * Adds text to a list of pieces, extending the last piece when the style matches.
 *
 * @param pieces - The list, changed in place.
 * @param text - The text to add.
 * @param style - Its style.
 */
function append(pieces: Piece[], text: string, style: Style): void {
	let last = pieces.at(-1);
	if (last !== undefined && sameStyle(last.style, style)) last.text += text;
	else pieces.push({ text, style });
}

/**
 * Pieces with adjacent equal styles merged, the form text is measured and drawn in.
 *
 * @param pieces - Pieces in order.
 */
function merge(pieces: Piece[]): Piece[] {
	let merged: Piece[] = [];
	for (let piece of pieces) append(merged, piece.text, piece.style);
	return merged;
}

/**
 * The width the pieces draw at side by side, kerning inside each merged piece included.
 *
 * @param pieces - Pieces in order.
 */
function measure(pieces: Piece[]): number {
	return merge(pieces).reduce((sum, piece) => sum + width(piece), 0);
}

/**
 * The natural width of one piece.
 *
 * @param piece - Text in one style.
 */
function width(piece: Piece): number {
	return piece.style.font.measure(piece.text, piece.style.size);
}

/**
 * Breaks segments into lines greedily, measuring each candidate line whole so the width it
 * is checked against is the width it draws at.
 *
 * @param segments - The paragraph's segments.
 * @param limit - The line width.
 * @param base - The paragraph's style, which the final line falls back to.
 */
function wrap(segments: Segment[], limit: number, base: Style): Draft[] {
	let drafts: Draft[] = [];
	let current: Piece[] = [];
	let space: Style | null = null;
	let finish = (forced: boolean, style: Style) => {
		while (current.at(-1)?.text === " ") current.pop();
		drafts.push({ pieces: current, forced, style });
		current = [];
	};
	for (let next of segments) {
		if (next.pieces.length > 0) {
			let placed = false;
			if (current.length > 0) {
				let gap = space === null ? [] : [{ text: " ", style: space }];
				let candidate = [...current, ...gap, ...next.pieces];
				placed = measure(candidate) <= limit + EPSILON;
				if (placed) current = candidate;
				else finish(false, next.style);
			}
			if (!placed) {
				if (measure(next.pieces) <= limit + EPSILON) current = [...next.pieces];
				else
					current = breakWord(next.pieces, limit, (pieces) =>
						drafts.push({ pieces, forced: false, style: next.style }),
					);
			}
		}
		space = next.after === "space" ? next.spaceStyle : null;
		if (next.after === "newline") finish(true, next.style);
	}
	if (current.length > 0) finish(false, base);
	return drafts;
}

/**
 * Breaks a word wider than the line between code points, emitting every full line and
 * answering the remainder, which later words may join. Each line holds at least one code
 * point, so a glyph wider than the line still advances.
 *
 * @param pieces - The word.
 * @param limit - The line width.
 * @param emit - Receives each full line.
 */
function breakWord(pieces: Piece[], limit: number, emit: (pieces: Piece[]) => void): Piece[] {
	let line: Piece[] = [];
	for (let piece of pieces) {
		for (let char of piece.text) {
			let candidate = [...line, { text: char, style: piece.style }];
			if (line.length > 0 && measure(candidate) > limit + EPSILON) {
				emit(merge(line));
				candidate = [{ text: char, style: piece.style }];
			}
			line = candidate;
		}
	}
	return merge(line);
}

/**
 * The space a style takes above and below the baseline, its half-leading included.
 *
 * @param style - A fragment's style.
 * @param lineHeight - The line height as a multiple of the font size.
 * @returns `[above, below]` in points.
 */
function extent(style: Style, lineHeight: number): [number, number] {
	let ascent = style.font.ascent(style.size);
	let descent = style.font.descent(style.size);
	let leading = (style.size * lineHeight - (ascent + descent)) / 2;
	return [ascent + leading, descent + leading];
}

/**
 * Turns a draft into a positioned line: fragments merged and measured, aligned in the
 * width, and on a justified line the slack spread evenly over its spaces. A justified line
 * without spaces, or one already wider than the width, stays at the left.
 *
 * @param draft - The line's pieces.
 * @param limit - The paragraph's width.
 * @param lineHeight - The line height as a multiple of each font size.
 * @param align - How the line sits in the width.
 * @param y - The line's top within the paragraph.
 */
function position(
	draft: Draft,
	limit: number,
	lineHeight: number,
	align: NonNullable<ParagraphOptions["align"]>,
	y: number,
): Line {
	let pieces = merge(draft.pieces).map((piece) => ({
		...piece,
		width: width(piece),
		spaces: countSpaces(piece.text),
	}));
	let natural = pieces.reduce((sum, piece) => sum + piece.width, 0);
	let styles = pieces.length > 0 ? pieces.map((piece) => piece.style) : [draft.style];
	let extents = styles.map((style) => extent(style, lineHeight));
	let above = Math.max(...extents.map(([a]) => a));
	let below = Math.max(...extents.map(([, b]) => b));
	let total = pieces.reduce((sum, piece) => sum + piece.spaces, 0);
	let slack = limit - natural;
	let wordSpacing = align === "justify" && total > 0 && slack > 0 ? slack / total : 0;
	let x = 0;
	if (align === "center") x = slack / 2;
	if (align === "right") x = slack;
	let fragments = pieces.map((piece) => {
		let fragment: Fragment = {
			text: piece.text,
			...piece.style,
			x,
			width: piece.width + wordSpacing * piece.spaces,
			wordSpacing,
		};
		x += fragment.width;
		return fragment;
	});
	return { fragments, y, baseline: above, height: above + below, width: natural };
}

/**
 * The spaces in a fragment, each of which a justified line widens.
 *
 * @param text - The fragment's text.
 */
function countSpaces(text: string): number {
	let count = 0;
	for (let char of text) if (char === " ") count += 1;
	return count;
}
