/**
 * Tests for `decode` over files written sample by sample here, so every color type, bit
 * depth, filter and Adam7 pass is pinned to the expected RGBA, plus files from an independent
 * encoder under `fixtures/` and every failure code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readFile } from "node:fs/promises";

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import { SIGNATURE, writeChunk } from "./chunks.js";
import { decode } from "./decode.js";
import { filterRow } from "./filters.js";
import { deflate } from "./zlib.js";

/** The Adam7 passes as `[x0, y0, dx, dy]`. */
const PASSES = [
	[0, 0, 8, 8],
	[4, 0, 8, 8],
	[0, 4, 4, 8],
	[2, 0, 4, 4],
	[0, 2, 2, 4],
	[1, 0, 2, 2],
	[0, 1, 1, 2],
];

/** A file to build: raw samples, row-major, `channels` per pixel. */
interface Fixture {
	width: number;
	height: number;
	colorType: number;
	bitDepth: number;
	samples: number[];
	interlaced?: boolean;
	palette?: number[];
	transparency?: number[];
	/** The filter every scanline is written with. */
	filter?: number;
}

/** Samples per pixel by color type. */
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Packs one row of samples at `bitDepth`, most significant bits first. */
function pack(samples: number[], bitDepth: number): Uint8Array {
	let bytes = new Uint8Array(Math.ceil((samples.length * bitDepth) / 8));
	samples.forEach((value, index) => {
		if (bitDepth === 16) {
			bytes[index * 2] = value >> 8;
			bytes[index * 2 + 1] = value & 0xff;
		} else if (bitDepth === 8) {
			bytes[index] = value;
		} else {
			let bit = index * bitDepth;
			bytes[bit >> 3] = (bytes[bit >> 3] ?? 0) | (value << (8 - bitDepth - (bit & 7)));
		}
	});
	return bytes;
}

/** Writes a PNG from `fixture`, filtering and interlacing exactly as the fixture says. */
async function build(fixture: Fixture, extra: Uint8Array[] = []): Promise<Uint8Array> {
	let channels = CHANNELS[fixture.colorType] ?? 1;
	let bpp = Math.max(1, (channels * fixture.bitDepth) >> 3);
	let passes = fixture.interlaced ? PASSES : [[0, 0, 1, 1]];
	let rows: number[] = [];
	for (let [x0 = 0, y0 = 0, dx = 1, dy = 1] of passes) {
		let previous: Uint8Array | undefined;
		for (let y = y0; y < fixture.height; y += dy) {
			let samples: number[] = [];
			for (let x = x0; x < fixture.width; x += dx) {
				let start = (y * fixture.width + x) * channels;
				samples.push(...fixture.samples.slice(start, start + channels));
			}
			if (samples.length === 0) continue;
			let row = pack(samples, fixture.bitDepth);
			let filtered = new Uint8Array(row.length);
			filterRow(fixture.filter ?? 0, row, previous, bpp, filtered);
			rows.push(fixture.filter ?? 0, ...filtered);
			previous = row;
		}
	}
	let header = new Uint8Array(13);
	new DataView(header.buffer).setUint32(0, fixture.width);
	new DataView(header.buffer).setUint32(4, fixture.height);
	header.set([fixture.bitDepth, fixture.colorType, 0, 0, fixture.interlaced ? 1 : 0], 8);
	let parts = [SIGNATURE, writeChunk("IHDR", header), ...extra];
	if (fixture.palette) parts.push(writeChunk("PLTE", Uint8Array.from(fixture.palette)));
	if (fixture.transparency) parts.push(writeChunk("tRNS", Uint8Array.from(fixture.transparency)));
	parts.push(writeChunk("IDAT", await deflate(Uint8Array.from(rows))));
	parts.push(writeChunk("IEND", new Uint8Array(0)));
	return Uint8Array.from(parts.flatMap((part) => [...part]));
}

/** The decoded pixels as `[r, g, b, a]` tuples, failing the test on a decode error. */
async function pixels(bytes: Uint8Array): Promise<number[][]> {
	let image = unwrap(await decode(bytes), (error) => {
		throw error;
	});
	return Array.from({ length: image.width * image.height }, (_, index) => [
		...image.data.subarray(index * 4, index * 4 + 4),
	]);
}

/** The failure code `decode` reports for `bytes`. */
async function code(bytes: Uint8Array): Promise<string | undefined> {
	let result = await decode(bytes);
	return isFailure(result) ? result.error.code : undefined;
}

describe("decode color types", () => {
	test.each([
		[1, [0, 1, 1, 0], [0, 255, 255, 0]],
		[2, [0, 1, 2, 3], [0, 85, 170, 255]],
		[4, [0, 5, 10, 15], [0, 85, 170, 255]],
		[8, [0, 7, 128, 255], [0, 7, 128, 255]],
		[16, [0, 257, 32896, 65535], [0, 1, 128, 255]],
	])("grayscale at %i bits", async (bitDepth, samples, levels) => {
		let bytes = await build({ width: 4, height: 1, colorType: 0, bitDepth, samples });
		expect(await pixels(bytes)).toEqual(levels.map((level) => [level, level, level, 255]));
	});

	test("grayscale tRNS keys out the matching raw sample", async () => {
		let fixture = {
			width: 3,
			height: 1,
			colorType: 0,
			bitDepth: 4,
			samples: [3, 4, 5],
			transparency: [0, 4],
		};
		expect(await pixels(await build(fixture))).toEqual([
			[51, 51, 51, 255],
			[68, 68, 68, 0],
			[85, 85, 85, 255],
		]);
	});

	test("RGB at 8 and 16 bits, with a tRNS key", async () => {
		let eight = { width: 2, height: 1, colorType: 2, bitDepth: 8, samples: [1, 2, 3, 4, 5, 6] };
		expect(await pixels(await build({ ...eight, transparency: [0, 4, 0, 5, 0, 6] }))).toEqual([
			[1, 2, 3, 255],
			[4, 5, 6, 0],
		]);
		let sixteen = { width: 1, height: 1, colorType: 2, bitDepth: 16, samples: [65535, 0, 32896] };
		expect(await pixels(await build(sixteen))).toEqual([[255, 0, 128, 255]]);
	});

	test.each([1, 2, 4, 8])("palette at %i bits with tRNS alpha", async (bitDepth) => {
		let palette = [10, 20, 30, 40, 50, 60];
		let fixture = {
			width: 3,
			height: 1,
			colorType: 3,
			bitDepth,
			samples: [0, 1, 0],
			palette,
			transparency: [128],
		};
		expect(await pixels(await build(fixture))).toEqual([
			[10, 20, 30, 128],
			[40, 50, 60, 255],
			[10, 20, 30, 128],
		]);
	});

	test("a palette index past the PLTE reads as opaque black", async () => {
		let fixture = {
			width: 1,
			height: 1,
			colorType: 3,
			bitDepth: 8,
			samples: [5],
			palette: [1, 2, 3],
		};
		expect(await pixels(await build(fixture))).toEqual([[0, 0, 0, 255]]);
	});

	test("gray with alpha at 8 and 16 bits", async () => {
		let eight = { width: 1, height: 1, colorType: 4, bitDepth: 8, samples: [200, 100] };
		expect(await pixels(await build(eight))).toEqual([[200, 200, 200, 100]]);
		let sixteen = { width: 1, height: 1, colorType: 4, bitDepth: 16, samples: [65535, 0] };
		expect(await pixels(await build(sixteen))).toEqual([[255, 255, 255, 0]]);
	});

	test("RGBA at 16 bits", async () => {
		let fixture = {
			width: 1,
			height: 1,
			colorType: 6,
			bitDepth: 16,
			samples: [65535, 32896, 0, 257],
		};
		expect(await pixels(await build(fixture))).toEqual([[255, 128, 0, 1]]);
	});
});

describe("decode filters and interlacing", () => {
	/** A 13×11 RGBA gradient: odd sizes leave partial blocks in every Adam7 pass. */
	let samples = Array.from({ length: 13 * 11 }, (_, index) => {
		let x = index % 13;
		let y = Math.floor(index / 13);
		return [x * 19, y * 23, (x * y * 7) & 0xff, 255 - x * 3];
	});
	let expected = samples.map((pixel) => [...pixel]);

	test.each([0, 1, 2, 3, 4])("filter type %i", async (filter) => {
		let fixture = {
			width: 13,
			height: 11,
			colorType: 6,
			bitDepth: 8,
			samples: samples.flat(),
			filter,
		};
		expect(await pixels(await build(fixture))).toEqual(expected);
	});

	test.each([0, 4])("Adam7 RGBA with filter type %i", async (filter) => {
		let fixture = {
			width: 13,
			height: 11,
			colorType: 6,
			bitDepth: 8,
			samples: samples.flat(),
			filter,
			interlaced: true,
		};
		expect(await pixels(await build(fixture))).toEqual(expected);
	});

	test("Adam7 at a sub-byte depth", async () => {
		let gray = Array.from({ length: 10 * 9 }, (_, index) => (index * 7) % 4);
		let fixture = {
			width: 10,
			height: 9,
			colorType: 0,
			bitDepth: 2,
			samples: gray,
			interlaced: true,
			filter: 1,
		};
		expect(await pixels(await build(fixture))).toEqual(
			gray.map((value) => [value * 85, value * 85, value * 85, 255]),
		);
	});

	test("Adam7 for a 1×1 image, where six passes are empty", async () => {
		let fixture = {
			width: 1,
			height: 1,
			colorType: 2,
			bitDepth: 8,
			samples: [9, 8, 7],
			interlaced: true,
		};
		expect(await pixels(await build(fixture))).toEqual([[9, 8, 7, 255]]);
	});

	test("skips ancillary chunks it does not know", async () => {
		let extra = [writeChunk("gAMA", Uint8Array.of(0, 0, 0xb1, 0x8f))];
		let bytes = await build(
			{ width: 1, height: 1, colorType: 0, bitDepth: 8, samples: [42] },
			extra,
		);
		expect(await pixels(bytes)).toEqual([[42, 42, 42, 255]]);
	});
});

describe("decode files from another encoder", () => {
	/** Reads a fixture written by Pillow. */
	async function fixture(name: string): Promise<Uint8Array> {
		return new Uint8Array(await readFile(new URL(`./fixtures/${name}`, import.meta.url)));
	}

	test("4-bit palette with tRNS", async () => {
		expect(await pixels(await fixture("palette-4bit-trns.png"))).toEqual([
			[255, 0, 0, 255],
			[0, 255, 0, 128],
			[0, 0, 255, 0],
			[255, 255, 255, 255],
			[255, 255, 255, 255],
			[0, 0, 255, 0],
			[0, 255, 0, 128],
			[255, 0, 0, 255],
		]);
	});

	test("16-bit grayscale", async () => {
		expect(await pixels(await fixture("gray-16bit.png"))).toEqual([
			[0, 0, 0, 255],
			[128, 128, 128, 255],
			[255, 255, 255, 255],
		]);
	});

	test("1-bit grayscale with a row width off the byte boundary", async () => {
		let levels = Array.from({ length: 18 }, (_, index) => (index % 2 ? 255 : 0));
		expect(await pixels(await fixture("gray-1bit.png"))).toEqual(
			levels.map((level) => [level, level, level, 255]),
		);
	});

	test("8-bit RGBA", async () => {
		expect(await pixels(await fixture("rgba-8bit.png"))).toEqual([
			[255, 0, 0, 255],
			[0, 255, 0, 128],
			[0, 0, 255, 0],
			[10, 20, 30, 40],
		]);
	});
});

describe("decode failures", () => {
	/** A valid 2×2 RGB file to corrupt. */
	let valid = () =>
		build({ width: 2, height: 2, colorType: 2, bitDepth: 8, samples: Array(12).fill(7) });

	/** The valid file's signature and IHDR followed by one IDAT holding `data`. */
	async function withData(data: Uint8Array): Promise<Uint8Array> {
		let head = (await valid()).subarray(0, SIGNATURE.length + 25);
		return Uint8Array.from([
			...head,
			...writeChunk("IDAT", data),
			...writeChunk("IEND", new Uint8Array(0)),
		]);
	}

	test("the valid file decodes", async () => {
		expect(isSuccess(await decode(await valid()))).toBe(true);
	});

	test("bytes that are not a PNG", async () => {
		expect(await code(new TextEncoder().encode("GIF89a, not a PNG"))).toBe("signature");
	});

	test("a file cut short", async () => {
		let bytes = await valid();
		expect(await code(bytes.subarray(0, 4))).toBe("truncated");
		expect(await code(bytes.subarray(0, bytes.length - 12))).toBe("truncated");
		expect(await code(bytes.subarray(0, 40))).toBe("truncated");
	});

	test("a chunk whose CRC does not match", async () => {
		let bytes = await valid();
		bytes[bytes.length - 20] = (bytes[bytes.length - 20] ?? 0) ^ 0xff;
		expect(await code(bytes)).toBe("crc");
	});

	test("an IHDR with a color type and bit depth PNG forbids", async () => {
		expect(
			await code(
				await build({ width: 1, height: 1, colorType: 2, bitDepth: 4, samples: [1, 1, 1] }),
			),
		).toBe("header");
	});

	test("a palette image without PLTE", async () => {
		expect(
			await code(await build({ width: 1, height: 1, colorType: 3, bitDepth: 8, samples: [0] })),
		).toBe("header");
	});

	test("an unknown critical chunk", async () => {
		let extra = [writeChunk("ABCD", new Uint8Array(1))];
		expect(
			await code(
				await build({ width: 1, height: 1, colorType: 0, bitDepth: 8, samples: [0] }, extra),
			),
		).toBe("unsupported");
	});

	test("a scanline with an undefined filter type", async () => {
		expect(
			await code(
				await withData(await deflate(Uint8Array.of(0, 7, 7, 7, 7, 7, 7, 9, 0, 0, 0, 0, 0, 0))),
			),
		).toBe("unsupported");
	});

	test("IDAT that is not zlib", async () => {
		expect(await code(await withData(Uint8Array.of(1, 2, 3, 4, 5, 6)))).toBe("inflate");
	});

	test("image data shorter than the header promises", async () => {
		expect(await code(await withData(await deflate(Uint8Array.of(0, 1, 2, 3))))).toBe("truncated");
	});
});
