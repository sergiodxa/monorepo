/**
 * Probe the known failing payload against jsQR under several render options.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";

import { QR } from "../src/encode.js";
import jsQR from "../src/jsqr.js";

const text = (await Bun.file("/opt/cursor/artifacts/qr-isolate.json").json()).fails[0]
	.text as string;

function decode(
	symbol: QR,
	scale: number,
	margin: number,
	inversionAttempts: "dontInvert" | "attemptBoth" | "onlyInvert",
) {
	let side = (symbol.size + margin * 2) * scale;
	let pixels = new Uint8ClampedArray(side * side * 4);
	for (let py = 0; py < side; py++) {
		for (let px = 0; px < side; px++) {
			let dark = symbol.isDark(Math.floor(px / scale) - margin, Math.floor(py / scale) - margin);
			let offset = (py * side + px) * 4;
			pixels.fill(dark ? 0 : 255, offset, offset + 3);
			pixels[offset + 3] = 255;
		}
	}
	return jsQR(pixels, side, side, { inversionAttempts });
}

let symbol = unwrap(QR.encode(text, { level: "L" }));
console.log({ version: symbol.version, mask: symbol.mask, size: symbol.size });

for (let scale of [1, 2, 3, 4, 6, 8, 10]) {
	for (let inv of ["dontInvert", "attemptBoth", "onlyInvert"] as const) {
		let read = decode(symbol, scale, 4, inv);
		console.log({
			scale,
			inv,
			ok: Boolean(read),
			version: read?.version ?? null,
			dataLen: read?.binaryData?.length ?? null,
		});
	}
}

for (let mask = 0; mask < 8; mask++) {
	let encoded = unwrap(QR.encode(text, { level: "L", mask }));
	let read = decode(encoded, 4, 4, "attemptBoth");
	console.log({
		forcedMask: mask,
		ok: Boolean(read),
		version: read?.version ?? null,
	});
}
