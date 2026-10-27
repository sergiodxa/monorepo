/**
 * Reverses the WOFF2 table transforms (WOFF 2.0 §5): rebuilds `glyf` and `loca` from the
 * split streams of the transformed `glyf`, and `hmtx` from advances alone when its side
 * bearings equal each glyph's `xMin`. The rebuilt tables read like the ones the font shipped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { FontError } from "../font-error.js";

import { Cursor } from "./cursor.js";

/** Composite flag: the arguments are 16-bit. */
const ARGS_ARE_WORDS = 0x0001;

/** Composite flag: one 2.14 scale follows the arguments. */
const HAS_SCALE = 0x0008;

/** Composite flag: another component follows. */
const MORE_COMPONENTS = 0x0020;

/** Composite flag: separate x and y scales follow. */
const HAS_XY_SCALE = 0x0040;

/** Composite flag: a 2×2 matrix follows. */
const HAS_MATRIX = 0x0080;

/** Composite flag: instructions follow the last component. */
const HAS_INSTRUCTIONS = 0x0100;

/** The `glyf` and `loca` tables rebuilt from a transformed `glyf`. */
export interface GlyfTables {
	glyf: Uint8Array;
	loca: Uint8Array;
	/** `head.indexToLocFormat` the rebuilt `loca` uses. */
	indexFormat: number;
	/** Each glyph's `xMin`, `0` for an empty glyph, which a transformed `hmtx` needs. */
	xMins: Int16Array;
}

/** The seven streams of a transformed `glyf`, each read front to back. */
interface GlyfStreams {
	contours: Cursor;
	points: Cursor;
	flags: Cursor;
	glyphs: Cursor;
	composites: Cursor;
	bboxes: Cursor;
	instructions: Cursor;
	bboxBitmap: Uint8Array;
	overlapBitmap: Uint8Array | null;
}

/** A simple glyph's points as deltas from the previous point, with on-curve flags. */
interface Points {
	dx: Int32Array;
	dy: Int32Array;
	on: Uint8Array;
}

/**
 * Rebuilds `glyf` and `loca` from a transformed `glyf` table.
 *
 * @param data - The transformed table.
 * @returns The tables, or a `malformed` `FontError` naming `glyf`.
 */
export function reconstructGlyf(data: Uint8Array): Result<GlyfTables, FontError> {
	let header = new Cursor(data);
	header.u16();
	let options = header.u16();
	let numGlyphs = header.u16();
	let indexFormat = header.u16();
	let sizes = Array.from({ length: 7 }, () => header.u32());
	if (header.overrun || indexFormat > 1)
		return malformed("The transformed glyf header is invalid.");
	let offset = header.position;
	let views: Uint8Array[] = [];
	for (let size of sizes) {
		if (offset + size > data.length) return malformed("A glyf stream runs past the table.");
		views.push(data.subarray(offset, offset + size));
		offset += size;
	}
	let [contours, points, flags, glyphs, composites, bboxes, instructions] = views.map(
		(view) => new Cursor(view),
	);
	if (!contours || !points || !flags || !glyphs || !composites || !bboxes || !instructions) {
		return malformed("The transformed glyf header is invalid.");
	}
	let overlapLength = options & 1 ? Math.ceil(numGlyphs / 8) : 0;
	if (offset + overlapLength > data.length) return malformed("The overlap bitmap is truncated.");
	let streams: GlyfStreams = {
		contours,
		points,
		flags,
		glyphs,
		composites,
		bboxes,
		instructions,
		bboxBitmap: bboxes.bytes(Math.ceil(numGlyphs / 32) * 4),
		overlapBitmap: options & 1 ? data.subarray(offset, offset + overlapLength) : null,
	};

	let writer = new Writer(data.length * 2);
	let offsets = new Uint32Array(numGlyphs + 1);
	let xMins = new Int16Array(numGlyphs);
	for (let glyph = 0; glyph < numGlyphs; glyph++) {
		offsets[glyph] = writer.length;
		let written = writeGlyph(streams, glyph, writer);
		if (written === null) return malformed(`Glyph ${glyph} of the transformed glyf is invalid.`);
		xMins[glyph] = written;
		writer.pad(4);
	}
	offsets[numGlyphs] = writer.length;
	let streamOverrun = [contours, points, flags, glyphs, composites, bboxes, instructions].some(
		(stream) => stream.overrun,
	);
	if (streamOverrun) return malformed("A glyf stream ends before its glyphs do.");
	if (indexFormat === 0 && writer.length > 0x1fffe) {
		return malformed("The glyf table is too large for a short loca.");
	}

	let loca = new Writer((numGlyphs + 1) * 4);
	for (let value of offsets) {
		if (indexFormat === 0) loca.u16(value / 2);
		else loca.u32(value);
	}
	return success({ glyf: writer.bytes(), loca: loca.bytes(), indexFormat, xMins });
}

/**
 * Rebuilds `hmtx` from its transformed form, taking each omitted side bearing from the
 * glyph's `xMin`.
 *
 * @param data - The transformed table.
 * @param numGlyphs - From `maxp`.
 * @param numberOfHMetrics - From `hhea`.
 * @param xMins - Each glyph's `xMin`.
 * @returns The table, or a `malformed` `FontError` naming `hmtx`.
 */
export function reconstructHmtx(
	data: Uint8Array,
	numGlyphs: number,
	numberOfHMetrics: number,
	xMins: ArrayLike<number>,
): Result<Uint8Array, FontError> {
	let cursor = new Cursor(data);
	let flags = cursor.u8();
	if (flags & 0xfc || numberOfHMetrics < 1 || numberOfHMetrics > numGlyphs) {
		return failure(new FontError("malformed", "The transformed hmtx table is invalid.", "hmtx"));
	}
	let advances = Array.from({ length: numberOfHMetrics }, () => cursor.u16());
	let bearings = Array.from({ length: numberOfHMetrics }, (_, glyph) =>
		flags & 1 ? (xMins[glyph] ?? 0) : cursor.i16(),
	);
	let extra = Array.from({ length: numGlyphs - numberOfHMetrics }, (_, index) =>
		flags & 2 ? (xMins[numberOfHMetrics + index] ?? 0) : cursor.i16(),
	);
	if (cursor.overrun) {
		return failure(new FontError("malformed", "The transformed hmtx table is truncated.", "hmtx"));
	}
	let writer = new Writer(numberOfHMetrics * 4 + extra.length * 2);
	for (let [glyph, advance] of advances.entries()) {
		writer.u16(advance);
		writer.u16(bearings[glyph] ?? 0);
	}
	for (let bearing of extra) writer.u16(bearing);
	return success(writer.bytes());
}

/**
 * Each glyph's `xMin` read from plain `glyf` and `loca` tables, for a transformed `hmtx`
 * in a font whose `glyf` was stored as is.
 *
 * @param glyf - The `glyf` table.
 * @param loca - The `loca` table.
 * @param indexFormat - `head.indexToLocFormat`.
 * @param numGlyphs - From `maxp`.
 */
export function glyphXMins(
	glyf: Uint8Array,
	loca: Uint8Array,
	indexFormat: number,
	numGlyphs: number,
): Int16Array {
	let view = new DataView(loca.buffer, loca.byteOffset, loca.byteLength);
	let glyfView = new DataView(glyf.buffer, glyf.byteOffset, glyf.byteLength);
	let xMins = new Int16Array(numGlyphs);
	let entry = indexFormat === 0 ? 2 : 4;
	for (let glyph = 0; glyph < numGlyphs && (glyph + 2) * entry <= loca.length; glyph++) {
		let start = indexFormat === 0 ? view.getUint16(glyph * 2) * 2 : view.getUint32(glyph * 4);
		let end = indexFormat === 0 ? view.getUint16(glyph * 2 + 2) * 2 : view.getUint32(glyph * 4 + 4);
		if (end - start >= 10 && start + 4 <= glyf.length) xMins[glyph] = glyfView.getInt16(start + 2);
	}
	return xMins;
}

/**
 * Writes one glyph in `glyf` format.
 *
 * @param streams - The transformed table's streams, positioned at this glyph.
 * @param glyph - The glyph index, which selects its bounding-box and overlap bits.
 * @param writer - The `glyf` being built.
 * @returns The glyph's `xMin`, or `null` when its data is invalid.
 */
function writeGlyph(streams: GlyfStreams, glyph: number, writer: Writer): number | null {
	let contours = streams.contours.i16();
	let hasBox = ((streams.bboxBitmap[glyph >> 3] ?? 0) & (0x80 >> (glyph & 7))) !== 0;
	if (contours === 0) return hasBox ? null : 0;
	if (contours < -1) return null;
	let box = hasBox
		? [streams.bboxes.i16(), streams.bboxes.i16(), streams.bboxes.i16(), streams.bboxes.i16()]
		: null;
	if (contours === -1) {
		if (box === null) return null;
		return writeComposite(streams, box, writer);
	}

	let ends: number[] = [];
	let total = 0;
	for (let contour = 0; contour < contours; contour++) {
		total += streams.points.u255();
		ends.push(total - 1);
	}
	if (streams.points.overrun || total > streams.flags.remaining) return null;
	let points = decodeTriplets(streams.flags, streams.glyphs, total);
	let instructionLength = streams.glyphs.u255();
	let instructions = streams.instructions.bytes(instructionLength);
	box ??= boundingBox(points);
	let overlap = ((streams.overlapBitmap?.[glyph >> 3] ?? 0) & (0x80 >> (glyph & 7))) !== 0;

	writer.u16(contours);
	for (let value of box) writer.u16(value);
	for (let end of ends) writer.u16(end);
	writer.u16(instructionLength);
	writer.write(instructions);
	writeSimplePoints(writer, points, overlap);
	return box[0] ?? 0;
}

/**
 * Writes a composite glyph: its bounding box, the component records copied as they are,
 * then its instructions when the last component says it has some.
 *
 * @param streams - The transformed table's streams.
 * @param box - The glyph's bounding box, which composites always store.
 * @param writer - The `glyf` being built.
 * @returns The glyph's `xMin`.
 */
function writeComposite(streams: GlyfStreams, box: number[], writer: Writer): number {
	let composites = streams.composites;
	let start = composites.position;
	let flags = MORE_COMPONENTS;
	let instructed = false;
	while (flags & MORE_COMPONENTS && !composites.overrun) {
		flags = composites.u16();
		composites.u16();
		let size = flags & ARGS_ARE_WORDS ? 4 : 2;
		if (flags & HAS_SCALE) size += 2;
		else if (flags & HAS_XY_SCALE) size += 4;
		else if (flags & HAS_MATRIX) size += 8;
		composites.bytes(size);
		if (flags & HAS_INSTRUCTIONS) instructed = true;
	}
	let length = composites.position - start;
	writer.u16(0xffff);
	for (let value of box) writer.u16(value);
	writer.write(composites.view(start, length));
	if (instructed) {
		let instructionLength = streams.glyphs.u255();
		writer.u16(instructionLength);
		writer.write(streams.instructions.bytes(instructionLength));
	}
	return box[0] ?? 0;
}

/**
 * Decodes the WOFF2 point triplets: a flag byte per point selecting how many bytes of the
 * glyph stream hold its x and y deltas and their signs.
 *
 * @param flags - The flag stream.
 * @param data - The glyph stream.
 * @param count - How many points.
 */
function decodeTriplets(flags: Cursor, data: Cursor, count: number): Points {
	let points: Points = {
		dx: new Int32Array(count),
		dy: new Int32Array(count),
		on: new Uint8Array(count),
	};
	for (let index = 0; index < count; index++) {
		let flag = flags.u8();
		points.on[index] = flag & 0x80 ? 0 : 1;
		flag &= 0x7f;
		let dx = 0;
		let dy = 0;
		if (flag < 10) {
			dy = signed(flag, ((flag & 14) << 7) + data.u8());
		} else if (flag < 20) {
			dx = signed(flag, (((flag - 10) & 14) << 7) + data.u8());
		} else if (flag < 84) {
			let base = flag - 20;
			let byte = data.u8();
			dx = signed(flag, 1 + (base & 0x30) + (byte >> 4));
			dy = signed(flag >> 1, 1 + ((base & 0x0c) << 2) + (byte & 0x0f));
		} else if (flag < 120) {
			let base = flag - 84;
			dx = signed(flag, 1 + (Math.floor(base / 12) << 8) + data.u8());
			dy = signed(flag >> 1, 1 + (((base % 12) >> 2) << 8) + data.u8());
		} else if (flag < 124) {
			let first = data.u8();
			let second = data.u8();
			dx = signed(flag, (first << 4) + (second >> 4));
			dy = signed(flag >> 1, ((second & 0x0f) << 8) + data.u8());
		} else {
			dx = signed(flag, data.u16());
			dy = signed(flag >> 1, data.u16());
		}
		points.dx[index] = dx;
		points.dy[index] = dy;
	}
	return points;
}

/**
 * Applies a triplet's sign bit, where a set bit means positive.
 *
 * @param flag - The flag whose bit 0 is the sign.
 * @param value - The magnitude.
 */
function signed(flag: number, value: number): number {
	return flag & 1 ? value : -value;
}

/**
 * The bounding box of a simple glyph's points, on and off the curve, which an encoder may
 * leave out because it can be computed.
 *
 * @param points - The glyph's point deltas.
 */
function boundingBox(points: Points): number[] {
	if (points.dx.length === 0) return [0, 0, 0, 0];
	let x = 0;
	let y = 0;
	let box = [Infinity, Infinity, -Infinity, -Infinity];
	for (let index = 0; index < points.dx.length; index++) {
		x += points.dx[index] ?? 0;
		y += points.dy[index] ?? 0;
		box = [
			Math.min(box[0] ?? 0, x),
			Math.min(box[1] ?? 0, y),
			Math.max(box[2] ?? 0, x),
			Math.max(box[3] ?? 0, y),
		];
	}
	return box;
}

/**
 * Writes a simple glyph's flags, repeat-compressed, then its x and y deltas in the
 * shortest form each takes.
 *
 * @param writer - The `glyf` being built.
 * @param points - The glyph's points.
 * @param overlap - Whether to set `OVERLAP_SIMPLE` on the first flag.
 */
function writeSimplePoints(writer: Writer, points: Points, overlap: boolean): void {
	let count = points.dx.length;
	let flags = new Uint8Array(count);
	for (let index = 0; index < count; index++) {
		let flag = points.on[index] ?? 0;
		flag |= axisFlag(points.dx[index] ?? 0, 0x02, 0x10);
		flag |= axisFlag(points.dy[index] ?? 0, 0x04, 0x20);
		if (index === 0 && overlap) flag |= 0x40;
		flags[index] = flag;
	}
	for (let index = 0; index < count;) {
		let flag = flags[index] ?? 0;
		let run = 1;
		while (run < 256 && index + run < count && flags[index + run] === flag) run++;
		if (run > 1) {
			writer.u8(flag | 0x08);
			writer.u8(run - 1);
		} else {
			writer.u8(flag);
		}
		index += run;
	}
	writeDeltas(writer, points.dx, flags, 0x02, 0x10);
	writeDeltas(writer, points.dy, flags, 0x04, 0x20);
}

/**
 * The flag bits for one coordinate delta: `same` alone for zero, `short` plus `same` as the
 * sign for a delta that fits a byte, nothing for a 16-bit one.
 *
 * @param delta - The delta.
 * @param short - The axis's short-vector bit.
 * @param same - The axis's same-or-positive bit.
 */
function axisFlag(delta: number, short: number, same: number): number {
	if (delta === 0) return same;
	if (delta > -256 && delta < 256) return delta > 0 ? short | same : short;
	return 0;
}

/**
 * Writes one axis's deltas as the flags written for them say.
 *
 * @param writer - The `glyf` being built.
 * @param deltas - The axis's deltas.
 * @param flags - Each point's flag.
 * @param short - The axis's short-vector bit.
 * @param same - The axis's same-or-positive bit.
 */
function writeDeltas(
	writer: Writer,
	deltas: Int32Array,
	flags: Uint8Array,
	short: number,
	same: number,
): void {
	for (let index = 0; index < deltas.length; index++) {
		let flag = flags[index] ?? 0;
		let delta = deltas[index] ?? 0;
		if (flag & short) writer.u8(Math.abs(delta));
		else if (!(flag & same)) writer.u16(delta);
	}
}

/**
 * A `malformed` failure naming `glyf`.
 *
 * @param message - What is wrong.
 */
function malformed(message: string): Result<never, FontError> {
	return failure(new FontError("malformed", message, "glyf"));
}

/** A growable big-endian byte buffer. */
export class Writer {
	/** Bytes written so far. */
	length = 0;
	#buffer: Uint8Array;

	/**
	 * @param capacity - The initial size; the buffer doubles as it fills.
	 */
	constructor(capacity: number) {
		this.#buffer = new Uint8Array(Math.max(capacity, 16));
	}

	/** @param value - Written as one byte. */
	u8(value: number): void {
		this.#reserve(1);
		this.#buffer[this.length++] = value;
	}

	/** @param value - Written as two bytes, two's complement when negative. */
	u16(value: number): void {
		this.#reserve(2);
		this.#buffer[this.length++] = (value >> 8) & 0xff;
		this.#buffer[this.length++] = value & 0xff;
	}

	/** @param value - Written as four bytes. */
	u32(value: number): void {
		this.u16(Math.floor(value / 0x10000));
		this.u16(value % 0x10000);
	}

	/** @param bytes - Copied in. */
	write(bytes: Uint8Array): void {
		this.#reserve(bytes.length);
		this.#buffer.set(bytes, this.length);
		this.length += bytes.length;
	}

	/** @param boundary - Zero bytes are added until the length is a multiple of it. */
	pad(boundary: number): void {
		while (this.length % boundary !== 0) this.u8(0);
	}

	/** The bytes written, as a view of the buffer. */
	bytes(): Uint8Array {
		return this.#buffer.subarray(0, this.length);
	}

	/**
	 * Grows the buffer to fit `count` more bytes.
	 *
	 * @param count - Bytes about to be written.
	 */
	#reserve(count: number): void {
		if (this.length + count <= this.#buffer.length) return;
		let grown = new Uint8Array(Math.max(this.#buffer.length * 2, this.length + count));
		grown.set(this.#buffer.subarray(0, this.length));
		this.#buffer = grown;
	}
}
