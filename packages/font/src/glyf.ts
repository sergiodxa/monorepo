/**
 * Decodes TrueType `glyf` outlines into point contours and turns those into move/line/quad
 * commands. Composite glyphs are flattened with their transforms here, so every consumer of
 * an outline sees one list of contours in font units, y up.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font } from "./font.js";
import type { Reader } from "./reader.js";

/** One outline point in font units; `on` is false for a quadratic control point. */
export interface Point {
	x: number;
	y: number;
	on: boolean;
}

/** Where a font's glyph data lives, everything `decodeGlyph` needs to find one glyph. */
export interface GlyphSource {
	reader: Reader;
	numGlyphs: number;
	locaOffset: number;
	/** `0` for 16-bit offsets stored halved, `1` for 32-bit offsets. */
	indexToLocFormat: number;
	glyfOffset: number;
	glyfLength: number;
}

/** A point drawn as part of a command list. */
interface CommandPoint {
	x: number;
	y: number;
}

/**
 * Composite nesting deeper than this is treated as corrupt: real fonts nest two or three
 * levels, and the cap also stops a glyph that references itself.
 */
const MAX_COMPOSITE_DEPTH = 8;

const ON_CURVE = 0x01;
const X_SHORT = 0x02;
const Y_SHORT = 0x04;
const REPEAT = 0x08;
const X_SAME_OR_POSITIVE = 0x10;
const Y_SAME_OR_POSITIVE = 0x20;

const ARGS_ARE_WORDS = 0x0001;
const ARGS_ARE_XY_VALUES = 0x0002;
const HAS_SCALE = 0x0008;
const MORE_COMPONENTS = 0x0020;
const HAS_XY_SCALE = 0x0040;
const HAS_TWO_BY_TWO = 0x0080;
const SCALED_COMPONENT_OFFSET = 0x0800;
const UNSCALED_COMPONENT_OFFSET = 0x1000;

/**
 * The contours of one glyph, composites resolved. A glyph with no data (a space), an
 * out-of-range index, or data that runs past its `loca` bounds answers no contours.
 *
 * @param source - The font's glyph tables.
 * @param glyph - Glyph index.
 * @returns Contours in font units, y up.
 */
export function decodeGlyph(source: GlyphSource, glyph: number): Point[][] {
	return decode(source, glyph, 0);
}

/**
 * Recursive step of `decodeGlyph`, carrying the composite depth so a cycle terminates.
 *
 * @param source - The font's glyph tables.
 * @param glyph - Glyph index.
 * @param depth - How many composites enclose this glyph.
 */
function decode(source: GlyphSource, glyph: number, depth: number): Point[][] {
	if (depth > MAX_COMPOSITE_DEPTH) return [];
	let range = glyphRange(source, glyph);
	if (range === null) return [];
	let contourCount = source.reader.i16(range.start);
	if (contourCount >= 0) return decodeSimple(source.reader, range.start, range.end, contourCount);
	return decodeComposite(source, range.start, range.end, depth);
}

/**
 * The absolute byte range of a glyph's data, or `null` when it has none or `loca` points
 * outside `glyf`.
 *
 * @param source - The font's glyph tables.
 * @param glyph - Glyph index.
 */
export function glyphRange(
	source: GlyphSource,
	glyph: number,
): { start: number; end: number } | null {
	if (!Number.isInteger(glyph) || glyph < 0 || glyph >= source.numGlyphs) return null;
	let { reader, locaOffset } = source;
	let start: number;
	let end: number;
	if (source.indexToLocFormat === 0) {
		start = reader.u16(locaOffset + glyph * 2) * 2;
		end = reader.u16(locaOffset + glyph * 2 + 2) * 2;
	} else {
		start = reader.u32(locaOffset + glyph * 4);
		end = reader.u32(locaOffset + glyph * 4 + 4);
	}
	if (end - start < 10 || end > source.glyfLength) return null;
	return { start: source.glyfOffset + start, end: source.glyfOffset + end };
}

/**
 * Reads a simple glyph's flag and coordinate arrays into contours. Reading stops at the
 * glyph's end, so truncated coordinate data answers no contours rather than garbage.
 *
 * @param reader - The font bytes.
 * @param start - Absolute offset of the glyph header.
 * @param end - Absolute offset one past the glyph's data.
 * @param contourCount - `numberOfContours` from the header.
 */
function decodeSimple(reader: Reader, start: number, end: number, contourCount: number): Point[][] {
	if (contourCount === 0) return [];
	let offset = start + 10;
	let endPoints: number[] = [];
	for (let index = 0; index < contourCount; index++) {
		endPoints.push(reader.u16(offset));
		offset += 2;
	}
	let pointCount = (endPoints[contourCount - 1] ?? -1) + 1;
	let instructionLength = reader.u16(offset);
	offset += 2 + instructionLength;

	let flags = new Uint8Array(pointCount);
	for (let index = 0; index < pointCount;) {
		if (offset >= end) return [];
		let flag = reader.u8(offset++);
		flags[index++] = flag;
		if (flag & REPEAT) {
			let repeat = reader.u8(offset++);
			for (let count = 0; count < repeat && index < pointCount; count++) flags[index++] = flag;
		}
	}

	let xs = new Int32Array(pointCount);
	let value = 0;
	for (let index = 0; index < pointCount; index++) {
		let flag = flags[index] ?? 0;
		if (flag & X_SHORT) {
			let delta = reader.u8(offset++);
			value += flag & X_SAME_OR_POSITIVE ? delta : -delta;
		} else if (!(flag & X_SAME_OR_POSITIVE)) {
			value += reader.i16(offset);
			offset += 2;
		}
		xs[index] = value;
	}

	let ys = new Int32Array(pointCount);
	value = 0;
	for (let index = 0; index < pointCount; index++) {
		let flag = flags[index] ?? 0;
		if (flag & Y_SHORT) {
			let delta = reader.u8(offset++);
			value += flag & Y_SAME_OR_POSITIVE ? delta : -delta;
		} else if (!(flag & Y_SAME_OR_POSITIVE)) {
			value += reader.i16(offset);
			offset += 2;
		}
		ys[index] = value;
	}
	if (offset > end) return [];

	let contours: Point[][] = [];
	let first = 0;
	for (let last of endPoints) {
		if (last < first || last >= pointCount) return [];
		let contour: Point[] = [];
		for (let index = first; index <= last; index++) {
			contour.push({
				x: xs[index] ?? 0,
				y: ys[index] ?? 0,
				on: ((flags[index] ?? 0) & ON_CURVE) !== 0,
			});
		}
		contours.push(contour);
		first = last + 1;
	}
	return contours;
}

/**
 * Resolves each component of a composite glyph and places it with its 2×2 transform and
 * offset. A component positioned by point matching aligns its point to the parent's point
 * gathered so far; an out-of-range point index places it at the origin.
 *
 * @param source - The font's glyph tables.
 * @param start - Absolute offset of the glyph header.
 * @param end - Absolute offset one past the glyph's data.
 * @param depth - How many composites enclose this glyph.
 */
function decodeComposite(
	source: GlyphSource,
	start: number,
	end: number,
	depth: number,
): Point[][] {
	let reader = source.reader;
	let contours: Point[][] = [];
	let offset = start + 10;
	let flags = MORE_COMPONENTS;
	while (flags & MORE_COMPONENTS) {
		if (offset + 4 > end) break;
		flags = reader.u16(offset);
		let component = reader.u16(offset + 2);
		offset += 4;

		let arg1: number;
		let arg2: number;
		let signed = (flags & ARGS_ARE_XY_VALUES) !== 0;
		if (flags & ARGS_ARE_WORDS) {
			arg1 = signed ? reader.i16(offset) : reader.u16(offset);
			arg2 = signed ? reader.i16(offset + 2) : reader.u16(offset + 2);
			offset += 4;
		} else {
			arg1 = signed ? reader.i8(offset) : reader.u8(offset);
			arg2 = signed ? reader.i8(offset + 1) : reader.u8(offset + 1);
			offset += 2;
		}

		let a = 1;
		let b = 0;
		let c = 0;
		let d = 1;
		if (flags & HAS_SCALE) {
			a = d = reader.f2dot14(offset);
			offset += 2;
		} else if (flags & HAS_XY_SCALE) {
			a = reader.f2dot14(offset);
			d = reader.f2dot14(offset + 2);
			offset += 4;
		} else if (flags & HAS_TWO_BY_TWO) {
			a = reader.f2dot14(offset);
			b = reader.f2dot14(offset + 2);
			c = reader.f2dot14(offset + 4);
			d = reader.f2dot14(offset + 6);
			offset += 8;
		}

		let parts = decode(source, component, depth + 1).map((contour) =>
			contour.map((point) => ({
				x: a * point.x + c * point.y,
				y: b * point.x + d * point.y,
				on: point.on,
			})),
		);

		let dx = 0;
		let dy = 0;
		if (signed) {
			dx = arg1;
			dy = arg2;
			if (flags & SCALED_COMPONENT_OFFSET && !(flags & UNSCALED_COMPONENT_OFFSET)) {
				dx = a * arg1 + c * arg2;
				dy = b * arg1 + d * arg2;
			}
		} else {
			let anchor = contours.flat()[arg1];
			let target = parts.flat()[arg2];
			if (anchor !== undefined && target !== undefined) {
				dx = anchor.x - target.x;
				dy = anchor.y - target.y;
			}
		}

		for (let contour of parts) {
			contours.push(contour.map((point) => ({ x: point.x + dx, y: point.y + dy, on: point.on })));
		}
	}
	return contours;
}

/**
 * Turns quadratic contours into commands. Two consecutive control points imply an on-curve
 * point at their midpoint, which is emitted explicitly so every `quad` has exactly one
 * control; a contour starting off-curve starts at its last on-curve point or that midpoint.
 *
 * @param contours - Point contours from `decodeGlyph`.
 * @returns One `move` … `close` run per non-empty contour.
 */
export function contoursToCommands(contours: Point[][]): Font.Command[] {
	let commands: Font.Command[] = [];
	for (let contour of contours) {
		let first = contour[0];
		let last = contour[contour.length - 1];
		if (first === undefined || last === undefined) continue;

		let start: CommandPoint;
		let from = 0;
		let to = contour.length;
		if (first.on) {
			start = first;
			from = 1;
		} else if (last.on) {
			start = last;
			to = contour.length - 1;
		} else {
			start = midpoint(last, first);
		}
		commands.push({ type: "move", x: start.x, y: start.y });

		let control: CommandPoint | null = null;
		for (let index = from; index < to; index++) {
			let point = contour[index];
			if (point === undefined) continue;
			if (point.on) {
				if (control === null) commands.push({ type: "line", x: point.x, y: point.y });
				else commands.push({ type: "quad", cx: control.x, cy: control.y, x: point.x, y: point.y });
				control = null;
			} else {
				if (control !== null) {
					let mid = midpoint(control, point);
					commands.push({ type: "quad", cx: control.x, cy: control.y, x: mid.x, y: mid.y });
				}
				control = point;
			}
		}
		if (control !== null) {
			commands.push({ type: "quad", cx: control.x, cy: control.y, x: start.x, y: start.y });
		}
		commands.push({ type: "close" });
	}
	return commands;
}

/**
 * The implied on-curve point between two control points.
 *
 * @param a - First point.
 * @param b - Second point.
 */
function midpoint(a: CommandPoint, b: CommandPoint): CommandPoint {
	return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
