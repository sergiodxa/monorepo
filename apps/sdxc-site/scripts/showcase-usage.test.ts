/**
 * Tests the WebP header reader the showcase extractor sizes every screenshot with, across the
 * lossy, lossless and extended layouts, so each image's box is reserved before it loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { readWebpSize } from "~/scripts/showcase-usage";

/**
 * A WebP header: `RIFF`, a size, `WEBP`, then a chunk's name and size followed by its payload,
 * padded to the 30 bytes the reader needs.
 */
function webp(chunk: string, payload: number[]): Uint8Array {
	let bytes = new Uint8Array(30);
	bytes.set(new TextEncoder().encode("RIFF"), 0);
	bytes.set(new TextEncoder().encode("WEBP"), 8);
	bytes.set(new TextEncoder().encode(chunk), 12);
	bytes.set(payload, 20);
	return bytes;
}

describe("readWebpSize", () => {
	test("reads a lossy capture's size", () => {
		let bytes = readFileSync(
			join(import.meta.dirname, "..", "public", "showcase", "keel", "hero.webp"),
		);

		expect(readWebpSize(bytes)).toEqual({ width: 2160, height: 1350 });
	});

	test("reads a lossless file's 14-bit sizes, each stored minus one", () => {
		let bits = (640 - 1) | ((480 - 1) << 14);
		let payload = [0x2f, bits & 0xff, (bits >>> 8) & 0xff, (bits >>> 16) & 0xff, bits >>> 24];

		expect(readWebpSize(webp("VP8L", payload))).toEqual({ width: 640, height: 480 });
	});

	test("reads an extended file's 24-bit canvas size, each stored minus one", () => {
		let width = 4000 - 1;
		let height = 3000 - 1;
		let payload = [0, 0, 0, 0, width & 0xff, (width >> 8) & 0xff, width >> 16];
		payload.push(height & 0xff, (height >> 8) & 0xff, height >> 16);

		expect(readWebpSize(webp("VP8X", payload))).toEqual({ width: 4000, height: 3000 });
	});

	test("answers null for bytes that are not WebP", () => {
		expect(readWebpSize(new TextEncoder().encode("GIF89a".padEnd(40, "\0")))).toBeNull();
	});
});
