/**
 * Isolate which fuzz iterations fail for a given FUZZ_SEED.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createRandom } from "@sdxc/random";
import { unwrap } from "@sdxc/result";

import type { QrLevel } from "../src/encode.js";

import { QR } from "../src/encode.js";
import jsQR from "../src/jsqr.js";

const SEED = Number(process.env.FUZZ_SEED) || 1206569954;
const SCALE = 3;
const MARGIN = 4;
const POOLS = [
	"0123456789",
	"ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:",
	"abcdefghijklmnopqrstuvwxyz?&=_@",
	"éü世界",
];

function decode(symbol: QR) {
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

function mixedText(random: ReturnType<typeof createRandom>, maxRuns: number): string {
	let text = "";
	let runs = random.int(0, maxRuns);
	for (let run = 0; run < runs; run++) {
		let pool = Array.from(random.pick(POOLS));
		let length = random.int(1, 30);
		for (let index = 0; index < length; index++) text += random.pick(pool);
	}
	return text;
}

let random = createRandom(SEED);
let fails: Array<Record<string, unknown>> = [];
for (let iteration = 0; iteration < 60; iteration++) {
	let text = mixedText(random, iteration < 50 ? 6 : 40);
	let level = random.pick<QrLevel>(["L", "M", "Q", "H"]);
	let symbol = unwrap(QR.encode(text, { level }));
	let read = decode(symbol);
	let expected = Array.from(new TextEncoder().encode(text));
	let ok =
		read &&
		JSON.stringify([...read.binaryData]) === JSON.stringify(expected) &&
		read.version === symbol.version;
	if (!ok) {
		fails.push({
			iteration,
			level,
			version: symbol.version,
			size: symbol.size,
			mask: symbol.mask,
			textLen: text.length,
			byteLen: expected.length,
			text,
			hasRead: Boolean(read),
			readVersion: read?.version ?? null,
			readData: read?.data ?? null,
		});
	}
}
console.log(JSON.stringify({ seed: SEED, failCount: fails.length, fails }, null, 2));
