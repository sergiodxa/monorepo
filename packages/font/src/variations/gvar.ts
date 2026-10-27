/**
 * Reads `gvar` glyph variation data: the tuple headers, packed point numbers and packed
 * deltas of one glyph, scaled to an instance's coordinates and summed per point, with
 * untouched points of a contour inferred from their touched neighbours (IUP).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableRecord } from "../font.js";
import type { Reader } from "../reader.js";

import { axisScalar } from "../item-variation-store.js";

/** A located `gvar` table. */
export interface GvarTable {
	reader: Reader;
	axisCount: number;
	/** Absolute offset of the shared tuple records. */
	sharedTuplesOffset: number;
	sharedTupleCount: number;
	glyphCount: number;
	longOffsets: boolean;
	/** Absolute offset of the glyph offset array. */
	offsetsOffset: number;
	/** Absolute offset the glyph offsets count from. */
	dataOffset: number;
	/** Absolute offset one past the table. */
	end: number;
}

/** A point's position before variation, which IUP interpolates by. */
export interface PointPosition {
	x: number;
	y: number;
}

/** The summed deltas of every point of one glyph, unrounded. */
export interface GlyphDeltas {
	x: Float64Array;
	y: Float64Array;
}

const SHARED_POINT_NUMBERS = 0x8000;
const TUPLE_COUNT_MASK = 0x0fff;
const EMBEDDED_PEAK_TUPLE = 0x8000;
const INTERMEDIATE_REGION = 0x4000;
const PRIVATE_POINT_NUMBERS = 0x2000;
const TUPLE_INDEX_MASK = 0x0fff;
const POINTS_ARE_WORDS = 0x80;
const POINT_RUN_COUNT_MASK = 0x7f;
const DELTAS_ARE_ZERO = 0x80;
const DELTAS_ARE_WORDS = 0x40;
const DELTA_RUN_COUNT_MASK = 0x3f;

/**
 * Locates the font's `gvar` table.
 *
 * @param reader - The whole file.
 * @param tables - The table directory.
 * @returns The table, or `null` when the font has none or its version is unknown.
 */
export function readGvar(reader: Reader, tables: Map<string, TableRecord>): GvarTable | null {
	let record = tables.get("gvar");
	if (record === undefined || record.length < 20 || reader.u16(record.offset) !== 1) return null;
	let at = record.offset;
	return {
		reader,
		axisCount: reader.u16(at + 4),
		sharedTupleCount: reader.u16(at + 6),
		sharedTuplesOffset: at + reader.u32(at + 8),
		glyphCount: reader.u16(at + 12),
		longOffsets: (reader.u16(at + 14) & 1) !== 0,
		offsetsOffset: at + 20,
		dataOffset: at + reader.u32(at + 16),
		end: at + record.length,
	};
}

/**
 * The deltas `gvar` gives one glyph's points at `coords`. `positions` lists the points in
 * the order `gvar` numbers them, phantom points included, and `contourEnds` the last index
 * of each run IUP interpolates within (a phantom or component point is a run of one).
 *
 * @param gvar - The font's `gvar`.
 * @param glyph - Glyph index.
 * @param positions - Default positions of every point.
 * @param contourEnds - Last point index of each contour, ascending.
 * @param coords - Normalized coordinates.
 * @returns The deltas, or `null` when the glyph has no variation data.
 */
export function glyphDeltas(
	gvar: GvarTable,
	glyph: number,
	positions: readonly PointPosition[],
	contourEnds: readonly number[],
	coords: readonly number[],
): GlyphDeltas | null {
	if (glyph < 0 || glyph >= gvar.glyphCount) return null;
	let { reader, axisCount } = gvar;
	let start = gvar.dataOffset + glyphOffset(gvar, glyph);
	let end = Math.min(gvar.dataOffset + glyphOffset(gvar, glyph + 1), gvar.end);
	if (end - start < 4) return null;

	let tupleCount = reader.u16(start);
	let data = start + reader.u16(start + 2);
	let shared: number[] | null = null;
	if (tupleCount & SHARED_POINT_NUMBERS) {
		let decoded = decodePoints(reader, data, end);
		shared = decoded.points;
		data = decoded.next;
	}

	let count = positions.length;
	let result: GlyphDeltas = { x: new Float64Array(count), y: new Float64Array(count) };
	let header = start + 4;
	for (let tuple = 0; tuple < (tupleCount & TUPLE_COUNT_MASK); tuple++) {
		if (header + 4 > end) break;
		let size = reader.u16(header);
		let index = reader.u16(header + 2);
		header += 4;
		let peakOffset = gvar.sharedTuplesOffset + (index & TUPLE_INDEX_MASK) * axisCount * 2;
		if (index & EMBEDDED_PEAK_TUPLE) {
			peakOffset = header;
			header += axisCount * 2;
		} else if ((index & TUPLE_INDEX_MASK) >= gvar.sharedTupleCount) {
			peakOffset = -1;
		}
		let intermediate = -1;
		if (index & INTERMEDIATE_REGION) {
			intermediate = header;
			header += axisCount * 4;
		}
		let scalar = peakOffset < 0 ? 0 : tupleScalar(gvar, peakOffset, intermediate, coords);
		let tupleEnd = Math.min(data + size, end);
		if (scalar !== 0) {
			let at = data;
			let points = shared;
			if (index & PRIVATE_POINT_NUMBERS) {
				let decoded = decodePoints(reader, at, tupleEnd);
				points = decoded.points;
				at = decoded.next;
			}
			applyTuple(reader, at, tupleEnd, points, scalar, positions, contourEnds, result);
		}
		data += size;
	}
	return result;
}

/**
 * The start of a glyph's variation data relative to the data array.
 *
 * @param gvar - The table.
 * @param glyph - Glyph index, up to `glyphCount` for the end of the last glyph.
 */
function glyphOffset(gvar: GvarTable, glyph: number): number {
	if (gvar.longOffsets) return gvar.reader.u32(gvar.offsetsOffset + glyph * 4);
	return gvar.reader.u16(gvar.offsetsOffset + glyph * 2) * 2;
}

/**
 * How strongly a tuple applies at `coords`: the product of its per-axis scalars. A tuple
 * without an intermediate region spans from `0` to its peak on every axis.
 *
 * @param gvar - The table.
 * @param peakOffset - Absolute offset of the peak tuple.
 * @param intermediate - Absolute offset of the start and end tuples, `-1` for none.
 * @param coords - Normalized coordinates.
 */
function tupleScalar(
	gvar: GvarTable,
	peakOffset: number,
	intermediate: number,
	coords: readonly number[],
): number {
	let { reader, axisCount } = gvar;
	let scalar = 1;
	for (let axis = 0; axis < axisCount && scalar !== 0; axis++) {
		let peak = reader.f2dot14(peakOffset + axis * 2);
		let start = Math.min(peak, 0);
		let end = Math.max(peak, 0);
		if (intermediate >= 0) {
			start = reader.f2dot14(intermediate + axis * 2);
			end = reader.f2dot14(intermediate + axisCount * 2 + axis * 2);
		}
		scalar *= axisScalar(start, peak, end, coords[axis] ?? 0);
	}
	return scalar;
}

/**
 * Adds one tuple's scaled deltas to `result`. A tuple naming every point applies directly;
 * one naming some points infers the rest of each touched contour by IUP first.
 *
 * @param reader - The whole file.
 * @param at - Absolute offset of the tuple's x deltas.
 * @param end - Absolute offset one past the tuple's data.
 * @param points - Point numbers the deltas belong to, `null` for every point.
 * @param scalar - The tuple's scalar at the instance.
 * @param positions - Default point positions.
 * @param contourEnds - Last point index of each contour.
 * @param result - Accumulated deltas.
 */
function applyTuple(
	reader: Reader,
	at: number,
	end: number,
	points: readonly number[] | null,
	scalar: number,
	positions: readonly PointPosition[],
	contourEnds: readonly number[],
	result: GlyphDeltas,
): void {
	let count = points === null ? positions.length : points.length;
	let xs = decodeDeltas(reader, at, end, count);
	let ys = decodeDeltas(reader, xs.next, end, count);
	if (points === null) {
		for (let index = 0; index < count; index++) {
			result.x[index] = (result.x[index] ?? 0) + (xs.deltas[index] ?? 0) * scalar;
			result.y[index] = (result.y[index] ?? 0) + (ys.deltas[index] ?? 0) * scalar;
		}
		return;
	}
	let total = positions.length;
	let dx = new Float64Array(total);
	let dy = new Float64Array(total);
	let touched = new Uint8Array(total);
	for (let [index, point] of points.entries()) {
		if (point >= total) continue;
		dx[point] = xs.deltas[index] ?? 0;
		dy[point] = ys.deltas[index] ?? 0;
		touched[point] = 1;
	}
	let first = 0;
	for (let last of contourEnds) {
		if (last >= total) break;
		interpolateUntouched(positions, first, last, touched, dx, dy);
		first = last + 1;
	}
	for (let index = 0; index < total; index++) {
		result.x[index] = (result.x[index] ?? 0) + (dx[index] ?? 0) * scalar;
		result.y[index] = (result.y[index] ?? 0) + (dy[index] ?? 0) * scalar;
	}
}

/**
 * IUP for one contour: a contour with one touched point moves whole with it, and every
 * untouched run between two touched points gets, per axis, the delta of the nearer
 * reference when outside their span and a linear blend of both when inside.
 *
 * @param positions - Default point positions.
 * @param first - First point index of the contour.
 * @param last - Last point index of the contour.
 * @param touched - `1` for each point the tuple gave a delta.
 * @param dx - The tuple's x deltas, filled in for untouched points.
 * @param dy - The tuple's y deltas, filled in for untouched points.
 */
function interpolateUntouched(
	positions: readonly PointPosition[],
	first: number,
	last: number,
	touched: Uint8Array,
	dx: Float64Array,
	dy: Float64Array,
): void {
	let references: number[] = [];
	for (let index = first; index <= last; index++) if (touched[index]) references.push(index);
	let only = references[0];
	if (only === undefined || references.length === last - first + 1) return;
	if (references.length === 1) {
		for (let index = first; index <= last; index++) {
			dx[index] = dx[only] ?? 0;
			dy[index] = dy[only] ?? 0;
		}
		return;
	}
	let size = last - first + 1;
	for (let [position, from] of references.entries()) {
		let to = references[(position + 1) % references.length] ?? from;
		for (let step = ((from - first + 1) % size) + first; step !== to;) {
			let point = positions[step];
			let a = positions[from];
			let b = positions[to];
			if (point === undefined || a === undefined || b === undefined) break;
			dx[step] = inferDelta(point.x, a.x, b.x, dx[from] ?? 0, dx[to] ?? 0);
			dy[step] = inferDelta(point.y, a.y, b.y, dy[from] ?? 0, dy[to] ?? 0);
			step = ((step - first + 1) % size) + first;
		}
	}
}

/**
 * The delta IUP infers for one coordinate from two reference points. References at the
 * same coordinate share their delta when it agrees and give `0` when it does not.
 *
 * @param value - The untouched point's coordinate.
 * @param a - First reference's coordinate.
 * @param b - Second reference's coordinate.
 * @param deltaA - First reference's delta.
 * @param deltaB - Second reference's delta.
 */
function inferDelta(value: number, a: number, b: number, deltaA: number, deltaB: number): number {
	if (a === b) return deltaA === deltaB ? deltaA : 0;
	let low = a < b ? a : b;
	let high = a < b ? b : a;
	let lowDelta = a < b ? deltaA : deltaB;
	let highDelta = a < b ? deltaB : deltaA;
	if (value <= low) return lowDelta;
	if (value >= high) return highDelta;
	return lowDelta + ((value - low) * (highDelta - lowDelta)) / (high - low);
}

/**
 * Packed point numbers: a count, then runs of byte or word increments. A count of `0`
 * means every point, answered as `null`.
 *
 * @param reader - The whole file.
 * @param at - Absolute offset of the count.
 * @param end - Absolute offset reading stops at.
 */
function decodePoints(
	reader: Reader,
	at: number,
	end: number,
): { points: number[] | null; next: number } {
	let cursor = at;
	let count = reader.u8(cursor++);
	if (count & POINTS_ARE_WORDS) count = ((count & POINT_RUN_COUNT_MASK) << 8) | reader.u8(cursor++);
	if (count === 0) return { points: null, next: cursor };
	let points: number[] = [];
	let point = 0;
	while (points.length < count && cursor < end) {
		let control = reader.u8(cursor++);
		let run = (control & POINT_RUN_COUNT_MASK) + 1;
		let words = (control & POINTS_ARE_WORDS) !== 0;
		for (let step = 0; step < run && points.length < count; step++) {
			point += words ? reader.u16(cursor) : reader.u8(cursor);
			cursor += words ? 2 : 1;
			points.push(point);
		}
	}
	return { points, next: cursor };
}

/**
 * Packed deltas: runs of zeros, signed bytes, signed words or (both flags set) signed
 * 32-bit values. Data that ends early leaves the remaining deltas `0`.
 *
 * @param reader - The whole file.
 * @param at - Absolute offset of the first control byte.
 * @param end - Absolute offset reading stops at.
 * @param count - How many deltas to read.
 */
function decodeDeltas(
	reader: Reader,
	at: number,
	end: number,
	count: number,
): { deltas: Int32Array; next: number } {
	let cursor = at;
	let deltas = new Int32Array(count);
	let index = 0;
	while (index < count && cursor < end) {
		let control = reader.u8(cursor++);
		let run = (control & DELTA_RUN_COUNT_MASK) + 1;
		let zero = (control & DELTAS_ARE_ZERO) !== 0;
		let words = (control & DELTAS_ARE_WORDS) !== 0;
		if (zero && !words) {
			index += run;
			continue;
		}
		let size = 1;
		if (words) size = zero ? 4 : 2;
		for (let step = 0; step < run && index < count; step++) {
			deltas[index++] = readDelta(reader, cursor, size);
			cursor += size;
		}
	}
	return { deltas, next: cursor };
}

/**
 * One signed delta of `size` bytes.
 *
 * @param reader - The whole file.
 * @param at - Absolute offset.
 * @param size - `1`, `2` or `4`.
 */
function readDelta(reader: Reader, at: number, size: number): number {
	if (size === 4) return reader.u32(at) | 0;
	if (size === 2) return reader.i16(at);
	return reader.i8(at);
}
