/**
 * Writes a `PNG.Image` as a non-interlaced 8-bit PNG: RGB when every pixel is opaque, RGBA
 * otherwise. Each scanline takes the filter whose output has the smallest sum of signed
 * bytes, the heuristic libpng uses, which is what makes flat colours and gradients deflate well.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { PNG } from "./png.js";

import { SIGNATURE, writeChunk } from "./chunks.js";
import { chooseFilter, filterRow } from "./filters.js";
import { deflate } from "./zlib.js";

/** The largest `IDAT` written; bigger compressed data spans several chunks. */
const IDAT_SIZE = 1 << 16;

/** The largest width or height the `IHDR` fields can record. */
const MAX_DIMENSION = 2 ** 31 - 1;

/** A `tEXt` keyword: 1–79 printable Latin-1 characters, no leading, trailing or double space. */
const KEYWORD_PATTERN = /^[\x21-\x7e\xa1-\xff](?:[\x21-\x7e\xa1-\xff]| (?! ))*(?<! )$/;

/**
 * Encodes `image` as PNG bytes. A well-formed image always encodes, so the promise resolves
 * with the file; it rejects with a `RangeError` for a programming error: dimensions that are
 * not positive integers, `data` that is not `width * height * 4` bytes, or `options.text`
 * holding a keyword or value `tEXt` cannot record.
 *
 * @param image - Straight RGBA pixels, top row first
 * @param options - Alpha handling and `tEXt` entries
 * @returns The complete file
 * @example let bytes = await encode({ width: 2, height: 1, data: new Uint8ClampedArray(8) })
 * @example await encode(image, { text: { Software: "My App" } })
 */
export async function encode(
	image: PNG.Image,
	options: PNG.EncodeOptions = {},
): Promise<Uint8Array> {
	let { width, height, data } = image;
	if (!isDimension(width) || !isDimension(height)) {
		throw new RangeError(`PNG dimensions must be integers from 1 to ${MAX_DIMENSION}`);
	}
	if (data.length !== width * height * 4) {
		throw new RangeError(`Expected ${width * height * 4} bytes of RGBA data, got ${data.length}`);
	}
	let text = Object.entries(options.text ?? {}).map(([keyword, value]) =>
		textChunk(keyword, value),
	);

	let channels = options.alpha !== "keep" && isOpaque(data) ? 3 : 4;
	let compressed = await deflate(filterScanlines(image, channels));

	let chunks = [SIGNATURE, writeChunk("IHDR", header(width, height, channels)), ...text];
	for (let offset = 0; offset < compressed.length; offset += IDAT_SIZE) {
		chunks.push(writeChunk("IDAT", compressed.subarray(offset, offset + IDAT_SIZE)));
	}
	chunks.push(writeChunk("IEND", new Uint8Array(0)));
	return concat(chunks);
}

/** Whether `value` fits an `IHDR` width or height field. */
function isDimension(value: number): boolean {
	return Number.isInteger(value) && value >= 1 && value <= MAX_DIMENSION;
}

/** Whether every alpha byte is 255, so the alpha channel can be dropped without loss. */
function isOpaque(data: Uint8ClampedArray): boolean {
	for (let index = 3; index < data.length; index += 4) if (data[index] !== 255) return false;
	return true;
}

/** The `IHDR` payload: 8 bits per channel, color type 2 or 6, deflate, filter method 0, no interlace. */
function header(width: number, height: number, channels: number): Uint8Array {
	let bytes = new Uint8Array(13);
	let view = new DataView(bytes.buffer);
	view.setUint32(0, width);
	view.setUint32(4, height);
	bytes[8] = 8;
	bytes[9] = channels === 3 ? 2 : 6;
	return bytes;
}

/**
 * A `tEXt` chunk holding `keyword`, a NUL separator and `value`, both Latin-1. Throws a
 * `RangeError` for a keyword the specification forbids or a character outside Latin-1.
 */
function textChunk(keyword: string, value: string): Uint8Array {
	if (keyword.length > 79 || !KEYWORD_PATTERN.test(keyword)) {
		throw new RangeError(`"${keyword}" is not a valid tEXt keyword`);
	}
	let content = `${keyword}\0${value}`;
	let bytes = new Uint8Array(content.length);
	for (let index = 0; index < content.length; index++) {
		let code = content.charCodeAt(index);
		if (code > 0xff) throw new RangeError(`tEXt "${keyword}" holds a character outside Latin-1`);
		bytes[index] = code;
	}
	return writeChunk("tEXt", bytes);
}

/**
 * The filtered image data `IDAT` compresses: each row of `channels`-byte pixels preceded by
 * the filter type byte that scored lowest for it.
 */
function filterScanlines(image: PNG.Image, channels: number): Uint8Array {
	let stride = image.width * channels;
	let output = new Uint8Array((stride + 1) * image.height);
	let previous: Uint8Array | undefined;
	for (let y = 0; y < image.height; y++) {
		let row = scanline(image, y, channels);
		let best = chooseFilter(row, previous, channels);
		let start = y * (stride + 1);
		output[start] = best;
		filterRow(best, row, previous, channels, output.subarray(start + 1, start + 1 + stride));
		previous = row;
	}
	return output;
}

/** Row `y` of the image as unfiltered bytes, dropping alpha when `channels` is 3. */
function scanline(image: PNG.Image, y: number, channels: number): Uint8Array {
	let start = y * image.width * 4;
	let rgba = new Uint8Array(image.data.buffer, image.data.byteOffset + start, image.width * 4);
	if (channels === 4) return rgba;
	let row = new Uint8Array(image.width * 3);
	for (let x = 0; x < image.width; x++) {
		row[x * 3] = rgba[x * 4] ?? 0;
		row[x * 3 + 1] = rgba[x * 4 + 1] ?? 0;
		row[x * 3 + 2] = rgba[x * 4 + 2] ?? 0;
	}
	return row;
}

/** Joins the file's parts into one buffer. */
function concat(parts: Uint8Array[]): Uint8Array {
	let length = parts.reduce((total, part) => total + part.length, 0);
	let bytes = new Uint8Array(length);
	let offset = 0;
	for (let part of parts) {
		bytes.set(part, offset);
		offset += part.length;
	}
	return bytes;
}
