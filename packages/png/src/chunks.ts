/**
 * The PNG container: the eight-byte signature and the length–type–data–CRC chunks that follow
 * it. Writing and reading live together so both sides agree on the byte layout and on what
 * the CRC covers (the type and the data, never the length).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";
import { crc32 } from "@sdxc/zip";

import { PNGError } from "./png.js";

/** The bytes every PNG file starts with. */
export const SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

/** One chunk as read from a file, its CRC already verified. */
export interface Chunk {
	/** The four-letter name, e.g. `IHDR`. */
	type: string;
	/** A view into the file's bytes, valid while they are. */
	data: Uint8Array;
}

/**
 * Serializes one chunk: big-endian length, the four type bytes, the data, and the CRC-32 of
 * type and data.
 */
export function writeChunk(type: string, data: Uint8Array): Uint8Array {
	let chunk = new Uint8Array(12 + data.length);
	let view = new DataView(chunk.buffer);
	view.setUint32(0, data.length);
	for (let index = 0; index < 4; index++) chunk[4 + index] = type.charCodeAt(index);
	chunk.set(data, 8);
	view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
	return chunk;
}

/**
 * Splits a file into chunks after checking its signature and every CRC, stopping after
 * `IEND`. Bytes after `IEND` are ignored; a file that ends before `IEND` is `truncated`.
 */
export function readChunks(bytes: Uint8Array): Result<Chunk[], PNGError> {
	let prefix = Math.min(bytes.length, SIGNATURE.length);
	for (let index = 0; index < prefix; index++) {
		if (bytes[index] !== SIGNATURE[index]) {
			return failure(new PNGError("signature", "The bytes do not start with a PNG signature"));
		}
	}
	if (bytes.length < SIGNATURE.length) {
		return failure(new PNGError("truncated", "The file ends inside the PNG signature"));
	}

	let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let chunks: Chunk[] = [];
	let offset = SIGNATURE.length;
	while (offset + 12 <= bytes.length) {
		let length = view.getUint32(offset);
		let end = offset + 12 + length;
		if (end > bytes.length) break;
		let type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
		let expected = view.getUint32(end - 4);
		if (crc32(bytes.subarray(offset + 4, end - 4)) !== expected) {
			return failure(new PNGError("crc", `The ${type} chunk's CRC does not match its data`));
		}
		chunks.push({ type, data: bytes.subarray(offset + 8, end - 4) });
		if (type === "IEND") return success(chunks);
		offset = end;
	}
	return failure(new PNGError("truncated", "The file ends before its IEND chunk"));
}
