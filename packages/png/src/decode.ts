/**
 * Reads any valid PNG into a `PNG.Image`: every color type at every bit depth the
 * specification allows, palettes with `tRNS` transparency, 16-bit samples and Adam7
 * interlacing, all expanded to 8-bit straight RGBA. Ancillary chunks are read past.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import type { Chunk } from "./chunks.js";
import type { PNG } from "./png.js";

import { readChunks } from "./chunks.js";
import { unfilterRow } from "./filters.js";
import { PNGError } from "./png.js";
import { inflate } from "./zlib.js";

/** The bit depths each color type allows, keyed by color type. */
const BIT_DEPTHS: Record<number, number[]> = {
	0: [1, 2, 4, 8, 16],
	2: [8, 16],
	3: [1, 2, 4, 8],
	4: [8, 16],
	6: [8, 16],
};

/** Samples per pixel, keyed by color type. */
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/**
 * The seven Adam7 passes as `[x0, y0, dx, dy]`: pass pixels sit at `(x0 + i * dx, y0 + j * dy)`.
 * A non-interlaced image is the single pass `[0, 0, 1, 1]`.
 */
const ADAM7_PASSES = [
	[0, 0, 8, 8],
	[4, 0, 8, 8],
	[0, 4, 4, 8],
	[2, 0, 4, 4],
	[0, 2, 2, 4],
	[1, 0, 2, 2],
	[0, 1, 1, 2],
] as const;

/** The largest RGBA buffer `decode` allocates, so a forged header cannot exhaust memory. */
const MAX_PIXELS = 2 ** 28;

/** The `IHDR` fields decoding depends on. */
interface Header {
	width: number;
	height: number;
	bitDepth: number;
	colorType: number;
	interlaced: boolean;
}

/** What `PLTE` and `tRNS` contribute to turning samples into colours. */
interface Palette {
	/** `PLTE` entries as packed RGB triples. */
	colors: Uint8Array | undefined;
	/** `tRNS` as stored: alpha per palette entry, or the transparent gray or RGB sample values. */
	transparency: Uint8Array | undefined;
}

/**
 * Decodes PNG bytes into straight 8-bit RGBA. Never rejects: every way a file can be wrong
 * comes back as a `PNGError` whose `code` names it. A 16-bit sample is rounded to 8 bits, and
 * pixels outside a palette's range read as opaque black.
 *
 * @param bytes - A complete PNG file
 * @returns The image, or the reason it could not be read
 * @example let result = await decode(bytes); if (isSuccess(result)) result.data.width
 */
export async function decode(bytes: Uint8Array): Promise<Result<PNG.Image, PNGError>> {
	let chunks = readChunks(bytes);
	if (isFailure(chunks)) return chunks;

	let header = readHeader(chunks.data[0]);
	if (isFailure(header)) return header;
	let { width, height } = header.data;

	let palette = readPalette(header.data, chunks.data);
	if (isFailure(palette)) return palette;

	let compressed = joinData(chunks.data);
	if (isFailure(compressed)) return compressed;

	let inflated = await wrap(() => inflate(compressed.data));
	if (isFailure(inflated)) {
		let cause = inflated.error;
		return failure(new PNGError("inflate", "The IDAT data is not a valid zlib stream", { cause }));
	}

	let data = new Uint8ClampedArray(width * height * 4);
	let offset = 0;
	let passes = header.data.interlaced ? ADAM7_PASSES : ([[0, 0, 1, 1]] as const);
	for (let [x0, y0, dx, dy] of passes) {
		let pass = {
			x0,
			y0,
			dx,
			dy,
			width: Math.ceil(Math.max(0, width - x0) / dx),
			height: Math.ceil(Math.max(0, height - y0) / dy),
		};
		if (pass.width === 0 || pass.height === 0) continue;
		let read = readPass(header.data, palette.data, inflated.data, offset, pass, data);
		if (isFailure(read)) return read;
		offset = read.data;
	}
	return success({ width, height, data });
}

/** Validates the `IHDR` chunk, which must come first, against the combinations PNG allows. */
function readHeader(chunk: Chunk | undefined): Result<Header, PNGError> {
	if (chunk?.type !== "IHDR" || chunk.data.length !== 13) {
		return failure(new PNGError("header", "The first chunk is not a 13-byte IHDR"));
	}
	let view = new DataView(chunk.data.buffer, chunk.data.byteOffset, 13);
	let [bitDepth = 0, colorType = 0, compression, filter, interlace] = chunk.data.subarray(8);
	let header: Header = {
		width: view.getUint32(0),
		height: view.getUint32(4),
		bitDepth,
		colorType,
		interlaced: interlace === 1,
	};
	if (
		header.width === 0 ||
		header.height === 0 ||
		header.width > 2 ** 31 - 1 ||
		header.height > 2 ** 31 - 1
	) {
		return failure(
			new PNGError("header", `IHDR declares a ${header.width}×${header.height} image`),
		);
	}
	if (!BIT_DEPTHS[colorType]?.includes(bitDepth)) {
		return failure(
			new PNGError("header", `IHDR pairs color type ${colorType} with bit depth ${bitDepth}`),
		);
	}
	if (compression !== 0 || filter !== 0 || (interlace !== 0 && interlace !== 1)) {
		return failure(
			new PNGError("unsupported", "IHDR names an unknown compression, filter or interlace method"),
		);
	}
	if (header.width * header.height > MAX_PIXELS) {
		return failure(
			new PNGError(
				"unsupported",
				`A ${header.width}×${header.height} image is too large to decode`,
			),
		);
	}
	return success(header);
}

/**
 * Reads `PLTE` and `tRNS`, refusing an unknown critical chunk on the way. A palette image
 * needs a `PLTE` of 1–256 entries; other color types may carry one as a hint, which is ignored.
 */
function readPalette(header: Header, chunks: Chunk[]): Result<Palette, PNGError> {
	let palette: Palette = { colors: undefined, transparency: undefined };
	for (let chunk of chunks.slice(1)) {
		if (chunk.type === "IHDR")
			return failure(new PNGError("header", "The file holds a second IHDR"));
		if (chunk.type === "PLTE") {
			if (chunk.data.length === 0 || chunk.data.length > 768 || chunk.data.length % 3 !== 0) {
				return failure(new PNGError("header", `PLTE holds ${chunk.data.length} bytes`));
			}
			palette.colors = chunk.data;
		} else if (chunk.type === "tRNS") {
			palette.transparency = chunk.data;
		} else if (isCritical(chunk.type) && chunk.type !== "IDAT" && chunk.type !== "IEND") {
			return failure(new PNGError("unsupported", `The critical chunk ${chunk.type} is unknown`));
		}
	}
	if (header.colorType === 3 && !palette.colors) {
		return failure(new PNGError("header", "A palette image has no PLTE chunk"));
	}
	return success(palette);
}

/** Whether a decoder must understand a chunk to read the image: its first letter is uppercase. */
function isCritical(type: string): boolean {
	return (type.charCodeAt(0) & 0x20) === 0;
}

/** Concatenates every `IDAT` payload, the one zlib stream they split between them. */
function joinData(chunks: Chunk[]): Result<Uint8Array, PNGError> {
	let parts = chunks.filter((chunk) => chunk.type === "IDAT");
	if (parts.length === 0) return failure(new PNGError("truncated", "The file has no IDAT chunk"));
	let bytes = new Uint8Array(parts.reduce((total, part) => total + part.data.length, 0));
	let offset = 0;
	for (let part of parts) {
		bytes.set(part.data, offset);
		offset += part.data.length;
	}
	return success(bytes);
}

/** One reduced image: its size and where its pixels land in the full image. */
interface Pass {
	x0: number;
	y0: number;
	dx: number;
	dy: number;
	width: number;
	height: number;
}

/**
 * Unfilters one pass starting at `offset` in the inflated data and writes its pixels into
 * `out`. Returns the offset where the next pass begins.
 */
function readPass(
	header: Header,
	palette: Palette,
	inflated: Uint8Array,
	offset: number,
	pass: Pass,
	out: Uint8ClampedArray,
): Result<number, PNGError> {
	let channels = CHANNELS[header.colorType] ?? 1;
	let bpp = Math.max(1, (channels * header.bitDepth) >> 3);
	let stride = Math.ceil((pass.width * channels * header.bitDepth) / 8);
	if (offset + (stride + 1) * pass.height > inflated.length) {
		return failure(new PNGError("truncated", "The image data ends before its last scanline"));
	}
	let previous: Uint8Array | undefined;
	for (let j = 0; j < pass.height; j++) {
		let start = offset + j * (stride + 1);
		let type = inflated[start] ?? 0;
		let row = inflated.subarray(start + 1, start + 1 + stride);
		if (!unfilterRow(type, row, previous, bpp)) {
			return failure(new PNGError("unsupported", `Scanline ${j} uses unknown filter type ${type}`));
		}
		let y = pass.y0 + j * pass.dy;
		for (let i = 0; i < pass.width; i++) {
			let x = pass.x0 + i * pass.dx;
			writePixel(header, palette, row, i * channels, out, (y * header.width + x) * 4);
		}
		previous = row;
	}
	return success(offset + (stride + 1) * pass.height);
}

/**
 * Reads sample number `index` of a row at the header's bit depth: packed most-significant
 * bits first below 8 bits, big-endian at 16.
 */
function sample(row: Uint8Array, index: number, bitDepth: number): number {
	if (bitDepth === 8) return row[index] ?? 0;
	if (bitDepth === 16) return ((row[index * 2] ?? 0) << 8) | (row[index * 2 + 1] ?? 0);
	let bit = index * bitDepth;
	let shift = 8 - bitDepth - (bit & 7);
	return ((row[bit >> 3] ?? 0) >> shift) & ((1 << bitDepth) - 1);
}

/** Reads two-byte big-endian field `index` of a `tRNS` chunk, the form gray and RGB keys take. */
function key(transparency: Uint8Array, index: number): number {
	return ((transparency[index * 2] ?? 0) << 8) | (transparency[index * 2 + 1] ?? 0);
}

/** Scales a sample at `bitDepth` to 8 bits, rounding to the nearest level. */
function scale(value: number, bitDepth: number): number {
	return bitDepth === 8 ? value : Math.round((value * 255) / ((1 << bitDepth) - 1));
}

/**
 * Converts the pixel whose first sample is `index` into RGBA at `target`. Gray and RGB pixels
 * equal to the `tRNS` key become fully transparent; the comparison uses the raw samples, as
 * the specification requires.
 */
function writePixel(
	header: Header,
	palette: Palette,
	row: Uint8Array,
	index: number,
	out: Uint8ClampedArray,
	target: number,
): void {
	let { bitDepth, colorType } = header;
	let { colors, transparency } = palette;

	if (colorType === 3) {
		let entry = sample(row, index, bitDepth);
		out[target] = colors?.[entry * 3] ?? 0;
		out[target + 1] = colors?.[entry * 3 + 1] ?? 0;
		out[target + 2] = colors?.[entry * 3 + 2] ?? 0;
		out[target + 3] = entry * 3 < (colors?.length ?? 0) ? (transparency?.[entry] ?? 255) : 255;
		return;
	}

	if (colorType === 0 || colorType === 4) {
		let gray = sample(row, index, bitDepth);
		let level = scale(gray, bitDepth);
		out[target] = level;
		out[target + 1] = level;
		out[target + 2] = level;
		if (colorType === 4) out[target + 3] = scale(sample(row, index + 1, bitDepth), bitDepth);
		else
			out[target + 3] =
				transparency && transparency.length >= 2 && gray === key(transparency, 0) ? 0 : 255;
		return;
	}

	let red = sample(row, index, bitDepth);
	let green = sample(row, index + 1, bitDepth);
	let blue = sample(row, index + 2, bitDepth);
	out[target] = scale(red, bitDepth);
	out[target + 1] = scale(green, bitDepth);
	out[target + 2] = scale(blue, bitDepth);
	if (colorType === 6) {
		out[target + 3] = scale(sample(row, index + 3, bitDepth), bitDepth);
		return;
	}
	let keyed =
		transparency !== undefined &&
		transparency.length >= 6 &&
		red === key(transparency, 0) &&
		green === key(transparency, 1) &&
		blue === key(transparency, 2);
	out[target + 3] = keyed ? 0 : 255;
}
