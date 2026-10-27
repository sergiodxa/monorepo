/**
 * Decodes a TrueType glyph at an instance of a variable font: `gvar` deltas move a simple
 * glyph's points and a composite's component offsets, and the phantom points carry the
 * varied advance. Components are varied themselves before they are placed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FontData } from "../font.js";
import type { Point } from "../glyf.js";

import { decodeGlyph, glyphRange } from "../glyf.js";

import type { GvarTable, PointPosition } from "./gvar.js";

import { glyphDeltas } from "./gvar.js";

/** A glyph's outline and horizontal phantom points at an instance, rounded to font units. */
export interface VariedGlyph {
	contours: Point[][];
	/** Phantom point 1's x: the glyph origin. */
	originX: number;
	/** Phantom point 2's x: where the pen ends, so the advance is `advanceX - originX`. */
	advanceX: number;
}

/** What decoding a varied glyph reads: the default font, its `gvar` and the instance. */
export interface VariedGlyphSource {
	data: FontData;
	gvar: GvarTable | null;
	coords: readonly number[];
}

/** One component record of a composite glyph. */
interface Component {
	glyph: number;
	flags: number;
	arg1: number;
	arg2: number;
	a: number;
	b: number;
	c: number;
	d: number;
}

/** Composite nesting deeper than this is treated as corrupt, which also ends a cycle. */
const MAX_COMPOSITE_DEPTH = 8;

const ARGS_ARE_WORDS = 0x0001;
const ARGS_ARE_XY_VALUES = 0x0002;
const HAS_SCALE = 0x0008;
const MORE_COMPONENTS = 0x0020;
const HAS_XY_SCALE = 0x0040;
const HAS_TWO_BY_TWO = 0x0080;
const SCALED_COMPONENT_OFFSET = 0x0800;
const UNSCALED_COMPONENT_OFFSET = 0x1000;

/**
 * A glyph at the instance, composites resolved from varied components. A glyph `gvar`
 * leaves alone answers its default outline and `hmtx` phantom points.
 *
 * @param source - The default font, its `gvar` and the instance coordinates.
 * @param glyph - Glyph index.
 */
export function variedGlyph(source: VariedGlyphSource, glyph: number): VariedGlyph {
	return decodeVaried(source, glyph, 0);
}

/**
 * Recursive step of `variedGlyph`, carrying the composite depth.
 *
 * @param source - The default font, its `gvar` and the instance coordinates.
 * @param glyph - Glyph index.
 * @param depth - How many composites enclose this glyph.
 */
function decodeVaried(source: VariedGlyphSource, glyph: number, depth: number): VariedGlyph {
	let { data } = source;
	let range = glyphRange(data, glyph);
	let xMin = range === null ? 0 : data.reader.i16(range.start + 2);
	let originX = xMin - leftSideBearing(data, glyph);
	let advanceX = originX + defaultAdvance(data, glyph);
	if (depth > MAX_COMPOSITE_DEPTH) return { contours: [], originX, advanceX };
	if (range !== null && data.reader.i16(range.start) < 0) {
		return decodeComposite(source, glyph, range, { originX, advanceX }, depth);
	}

	let contours = decodeGlyph(data, glyph);
	let positions: PointPosition[] = contours.flat();
	let contourEnds: number[] = [];
	let total = 0;
	for (let contour of contours) {
		total += contour.length;
		contourEnds.push(total - 1);
	}
	let deltas = withPhantoms(source, glyph, positions, contourEnds, originX, advanceX);
	if (deltas === null) return { contours, originX, advanceX };
	let index = 0;
	let varied = contours.map((contour) =>
		contour.map((point) => {
			let moved = {
				x: Math.round(point.x + (deltas.x[index] ?? 0)),
				y: Math.round(point.y + (deltas.y[index] ?? 0)),
				on: point.on,
			};
			index++;
			return moved;
		}),
	);
	return {
		contours: varied,
		originX: Math.round(originX + (deltas.x[total] ?? 0)),
		advanceX: Math.round(advanceX + (deltas.x[total + 1] ?? 0)),
	};
}

/**
 * Appends the four phantom points to a glyph's points and reads its deltas. Each phantom
 * point is its own contour, so IUP never moves it.
 *
 * @param source - The default font, its `gvar` and the instance coordinates.
 * @param glyph - Glyph index.
 * @param positions - The glyph's own points (or component offsets).
 * @param contourEnds - Last index of each of their contours.
 * @param originX - Default x of phantom point 1.
 * @param advanceX - Default x of phantom point 2.
 */
function withPhantoms(
	source: VariedGlyphSource,
	glyph: number,
	positions: PointPosition[],
	contourEnds: number[],
	originX: number,
	advanceX: number,
): { x: Float64Array; y: Float64Array } | null {
	if (source.gvar === null) return null;
	let total = positions.length;
	let points = [
		...positions,
		{ x: originX, y: 0 },
		{ x: advanceX, y: 0 },
		{ x: 0, y: 0 },
		{ x: 0, y: 0 },
	];
	let ends = [...contourEnds, total, total + 1, total + 2, total + 3];
	return glyphDeltas(source.gvar, glyph, points, ends, source.coords);
}

/**
 * Places each varied component with its transform and its varied offset. `gvar` numbers a
 * composite's points as one per component, then the phantom points; a component placed by
 * point matching aligns varied points and ignores its offset delta.
 *
 * @param source - The default font, its `gvar` and the instance coordinates.
 * @param glyph - Glyph index of the composite.
 * @param range - Absolute byte range of its `glyf` data.
 * @param phantom - Default phantom x positions.
 * @param depth - How many composites enclose it.
 */
function decodeComposite(
	source: VariedGlyphSource,
	glyph: number,
	range: { start: number; end: number },
	phantom: { originX: number; advanceX: number },
	depth: number,
): VariedGlyph {
	let components = readComponents(source.data, range.start, range.end);
	let positions = components.map((component) =>
		component.flags & ARGS_ARE_XY_VALUES
			? { x: component.arg1, y: component.arg2 }
			: { x: 0, y: 0 },
	);
	let ends = positions.map((_, index) => index);
	let deltas = withPhantoms(source, glyph, positions, ends, phantom.originX, phantom.advanceX);

	let contours: Point[][] = [];
	for (let [index, component] of components.entries()) {
		let { a, b, c, d, flags } = component;
		let parts = decodeVaried(source, component.glyph, depth + 1).contours.map((contour) =>
			contour.map((point) => ({
				x: a * point.x + c * point.y,
				y: b * point.x + d * point.y,
				on: point.on,
			})),
		);
		let dx = 0;
		let dy = 0;
		if (flags & ARGS_ARE_XY_VALUES) {
			let x = Math.round(component.arg1 + (deltas?.x[index] ?? 0));
			let y = Math.round(component.arg2 + (deltas?.y[index] ?? 0));
			dx = x;
			dy = y;
			if (flags & SCALED_COMPONENT_OFFSET && !(flags & UNSCALED_COMPONENT_OFFSET)) {
				dx = a * x + c * y;
				dy = b * x + d * y;
			}
		} else {
			let anchor = contours.flat()[component.arg1];
			let target = parts.flat()[component.arg2];
			if (anchor !== undefined && target !== undefined) {
				dx = anchor.x - target.x;
				dy = anchor.y - target.y;
			}
		}
		for (let contour of parts) {
			contours.push(contour.map((point) => ({ x: point.x + dx, y: point.y + dy, on: point.on })));
		}
	}
	let total = components.length;
	return {
		contours,
		originX: Math.round(phantom.originX + (deltas?.x[total] ?? 0)),
		advanceX: Math.round(phantom.advanceX + (deltas?.x[total + 1] ?? 0)),
	};
}

/**
 * The component records of a composite glyph, stopping at the glyph's end.
 *
 * @param data - The font.
 * @param start - Absolute offset of the glyph header.
 * @param end - Absolute offset one past its data.
 */
function readComponents(data: FontData, start: number, end: number): Component[] {
	let { reader } = data;
	let components: Component[] = [];
	let offset = start + 10;
	let flags = MORE_COMPONENTS;
	while (flags & MORE_COMPONENTS && offset + 4 <= end) {
		flags = reader.u16(offset);
		let glyph = reader.u16(offset + 2);
		offset += 4;
		let signed = (flags & ARGS_ARE_XY_VALUES) !== 0;
		let arg1: number;
		let arg2: number;
		if (flags & ARGS_ARE_WORDS) {
			arg1 = signed ? reader.i16(offset) : reader.u16(offset);
			arg2 = signed ? reader.i16(offset + 2) : reader.u16(offset + 2);
			offset += 4;
		} else {
			arg1 = signed ? reader.i8(offset) : reader.u8(offset);
			arg2 = signed ? reader.i8(offset + 1) : reader.u8(offset + 1);
			offset += 2;
		}
		let component: Component = { glyph, flags, arg1, arg2, a: 1, b: 0, c: 0, d: 1 };
		if (flags & HAS_SCALE) {
			component.a = component.d = reader.f2dot14(offset);
			offset += 2;
		} else if (flags & HAS_XY_SCALE) {
			component.a = reader.f2dot14(offset);
			component.d = reader.f2dot14(offset + 2);
			offset += 4;
		} else if (flags & HAS_TWO_BY_TWO) {
			component.a = reader.f2dot14(offset);
			component.b = reader.f2dot14(offset + 2);
			component.c = reader.f2dot14(offset + 4);
			component.d = reader.f2dot14(offset + 6);
			offset += 8;
		}
		components.push(component);
	}
	return components;
}

/**
 * A glyph's default advance from `hmtx`; glyphs past `numberOfHMetrics` share the last one.
 *
 * @param data - The font.
 * @param glyph - Glyph index.
 */
export function defaultAdvance(data: FontData, glyph: number): number {
	if (!Number.isInteger(glyph) || glyph < 0 || glyph >= data.numGlyphs) return 0;
	let metric = Math.min(glyph, data.numberOfHMetrics - 1);
	return data.reader.u16(data.hmtxOffset + metric * 4);
}

/**
 * A glyph's default left side bearing from `hmtx`, `0` for one the table does not reach.
 *
 * @param data - The font.
 * @param glyph - Glyph index.
 */
export function leftSideBearing(data: FontData, glyph: number): number {
	let { reader, hmtxOffset, numberOfHMetrics } = data;
	let at = hmtxOffset + glyph * 4 + 2;
	if (glyph >= numberOfHMetrics)
		at = hmtxOffset + numberOfHMetrics * 4 + (glyph - numberOfHMetrics) * 2;
	let hmtx = data.tables.get("hmtx");
	if (hmtx === undefined || at + 2 > hmtx.offset + hmtx.length) return 0;
	return reader.i16(at);
}
