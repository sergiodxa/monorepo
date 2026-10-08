/**
 * Decodes every encoded symbol with an independent reader, jsQR, from rendered RGBA pixels:
 * the bytes and version must survive. A seeded corpus spans modes, lengths and levels, and
 * the suite name carries the seed that replays a failure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Random } from "@sdxc/random";

import { createRandom, systemSeed } from "@sdxc/random";
import { unwrap } from "@sdxc/result";
import jsQR from "jsqr";
import { describe, expect, test } from "vitest";

import type { QrLevel, QrSymbol } from "./encode.js";

import { encodeQr } from "./encode.js";

const SEED = Number(process.env.FUZZ_SEED) || systemSeed();

/** Pixels per module and quiet zone modules in the rendered image. */
const SCALE = 3;
const MARGIN = 4;

/** Character pools mixed into each input, one per mode plus multi-byte text. */
const POOLS = [
	"0123456789",
	"ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:",
	"abcdefghijklmnopqrstuvwxyz?&=_@",
	"éü世界",
];

/** The symbol as an RGBA image with its quiet zone, as a camera frame would hold it. */
function decode(symbol: QrSymbol) {
	let side = (symbol.size + MARGIN * 2) * SCALE;
	let pixels = new Uint8ClampedArray(side * side * 4);
	for (let py = 0; py < side; py++) {
		for (let px = 0; px < side; px++) {
			let dark = symbol.isDark(Math.floor(px / SCALE) - MARGIN, Math.floor(py / SCALE) - MARGIN);
			let offset = (py * side + px) * 4;
			pixels.fill(dark ? 0 : 255, offset, offset + 3);
			pixels[offset + 3] = 255;
		}
	}
	return jsQR(pixels, side, side, { inversionAttempts: "dontInvert" });
}

/** Text of 0–`maxRuns` runs, each drawn from one pool. */
function mixedText(random: Random, maxRuns: number): string {
	let text = "";
	let runs = random.int(0, maxRuns);
	for (let run = 0; run < runs; run++) {
		let pool = Array.from(random.pick(POOLS));
		let length = random.int(1, 30);
		for (let index = 0; index < length; index++) text += random.pick(pool);
	}
	return text;
}

test.each([
	"otpauth://totp/Acme:ada%40example.com?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Acme",
	"https://auth.example.com/device?user_code=WDJB-MJHT",
	"01234567",
	"HELLO WORLD",
	"",
])("reads back %j", (text) => {
	let symbol = unwrap(encodeQr(text));
	let read = decode(symbol);
	expect(read?.data).toBe(text);
	expect(read?.version).toBe(symbol.version);
});

test("reads back bytes that are not text", () => {
	let bytes = new Uint8Array(256).map((_, index) => index);
	let symbol = unwrap(encodeQr(bytes, { level: "L" }));
	expect(decode(symbol)?.binaryData).toEqual(Array.from(bytes));
});

test("reads back every forced mask", () => {
	for (let mask = 0; mask < 8; mask++) {
		let symbol = unwrap(encodeQr("https://example.com/abc", { mask }));
		expect(symbol.mask).toBe(mask);
		expect(decode(symbol)?.data).toBe("https://example.com/abc");
	}
});

describe(`round trip through jsQR (FUZZ_SEED=${SEED})`, () => {
	test("decodes to the same bytes and version", () => {
		let random = createRandom(SEED);
		for (let iteration = 0; iteration < 60; iteration++) {
			let text = mixedText(random, iteration < 50 ? 6 : 40);
			let level = random.pick<QrLevel>(["L", "M", "Q", "H"]);
			let symbol = unwrap(encodeQr(text, { level }));
			let read = decode(symbol);
			expect(read?.binaryData, `"${text}" at ${level}`).toEqual(
				Array.from(new TextEncoder().encode(text)),
			);
			expect(read?.version).toBe(symbol.version);
		}
	});
});
