/**
 * Tests for `encode`: what reaches the file (color type, `tEXt`, filter choices) and that
 * every image survives a round trip through `decode` byte for byte.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import { decode } from "./decode.js";
import { encode } from "./encode.js";
import { inflate } from "./zlib.js";

/** An image whose pixel bytes follow `pixel(x, y)`, which returns `[r, g, b, a]`. */
function image(width: number, height: number, pixel: (x: number, y: number) => number[]) {
	let data = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
	}
	return { width, height, data };
}

/** Every chunk of a file, by type, in file order. */
function chunks(bytes: Uint8Array): { type: string; data: Uint8Array }[] {
	let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let found = [];
	for (let offset = 8; offset < bytes.length;) {
		let length = view.getUint32(offset);
		let type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
		found.push({ type, data: bytes.subarray(offset + 8, offset + 8 + length) });
		offset += 12 + length;
	}
	return found;
}

/** The decoded image, failing the test on a decode error. */
async function roundTrip(bytes: Uint8Array) {
	return unwrap(await decode(bytes), (error) => {
		throw error;
	});
}

describe("encode", () => {
	test("an image with transparency round-trips as RGBA", async () => {
		let source = image(7, 5, (x, y) => [x * 30, y * 50, (x * y) % 256, (x + y) * 20]);
		let bytes = await encode(source);
		expect(bytes[25]).toBe(6);
		let decoded = await roundTrip(bytes);
		expect(decoded).toEqual(source);
	});

	test("an opaque image is written as RGB and reads back opaque", async () => {
		let source = image(4, 3, (x, y) => [x * 60, y * 80, 200, 255]);
		let bytes = await encode(source);
		expect(bytes[24]).toBe(8);
		expect(bytes[25]).toBe(2);
		expect(await roundTrip(bytes)).toEqual(source);
	});

	test("alpha: keep writes RGBA for an opaque image", async () => {
		let source = image(2, 2, () => [1, 2, 3, 255]);
		let bytes = await encode(source, { alpha: "keep" });
		expect(bytes[25]).toBe(6);
		expect(await roundTrip(bytes)).toEqual(source);
	});

	test("writes the file's chunks in order, ending with IEND", async () => {
		let bytes = await encode(
			image(1, 1, () => [0, 0, 0, 255]),
			{ text: { Software: "sdxc" } },
		);
		expect(chunks(bytes).map((chunk) => chunk.type)).toEqual(["IHDR", "tEXt", "IDAT", "IEND"]);
		let text = chunks(bytes).find((chunk) => chunk.type === "tEXt");
		expect(new TextDecoder("latin1").decode(text?.data)).toBe("Software\0sdxc");
	});

	test("picks a filter per scanline that the decoder reverses", async () => {
		let source = image(64, 32, (x, y) => [x * 4, y * 8, (x * y) & 0xff, 255]);
		let bytes = await encode(source);
		let idat = chunks(bytes).filter((chunk) => chunk.type === "IDAT");
		let raw = await inflate(Uint8Array.from(idat.flatMap((chunk) => [...chunk.data])));
		let filters = Array.from({ length: 32 }, (_, y) => raw[y * (64 * 3 + 1)]);
		expect(filters.every((type) => type !== undefined && type < 5)).toBe(true);
		expect(filters.some((type) => type !== 0)).toBe(true);
		expect(await roundTrip(bytes)).toEqual(source);
	});

	test("splits large compressed data across several IDAT chunks", async () => {
		let seed = 1;
		let noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) >>> 16) & 0xff;
		let source = image(256, 256, () => [noise(), noise(), noise(), noise()]);
		let bytes = await encode(source);
		expect(chunks(bytes).filter((chunk) => chunk.type === "IDAT").length).toBeGreaterThan(1);
		expect(await roundTrip(bytes)).toEqual(source);
	});

	test("rejects data whose length does not match the dimensions", async () => {
		let data = new Uint8ClampedArray(15);
		await expect(encode({ width: 2, height: 2, data })).rejects.toThrow(RangeError);
	});

	test("rejects dimensions that are not positive integers", async () => {
		await expect(encode({ width: 0, height: 1, data: new Uint8ClampedArray(0) })).rejects.toThrow(
			RangeError,
		);
		await expect(
			encode({ width: 1.5, height: 2, data: new Uint8ClampedArray(12) }),
		).rejects.toThrow(RangeError);
	});

	test("rejects a tEXt keyword or value PNG cannot record", async () => {
		let source = image(1, 1, () => [0, 0, 0, 255]);
		await expect(encode(source, { text: { " Lead": "x" } })).rejects.toThrow(RangeError);
		await expect(encode(source, { text: { "": "x" } })).rejects.toThrow(RangeError);
		await expect(encode(source, { text: { ["k".repeat(80)]: "x" } })).rejects.toThrow(RangeError);
		await expect(encode(source, { text: { Title: "snow ☃" } })).rejects.toThrow(RangeError);
	});
});
