/**
 * Turns a symbol into pixels: black modules on a white quiet zone, each module a square of
 * `scale` pixels, in the straight-RGBA layout of the web's `ImageData`. Any PNG or canvas
 * encoder that takes that layout writes the code as an image.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { QR } from "./encode.js";

/** How `toImage` frames and sizes the symbol. */
export interface ImageOptions {
	/**
	 * Light modules around the symbol; the standard asks for 4.
	 *
	 * @default 4
	 */
	margin?: number;
	/**
	 * Pixels a side for one module.
	 *
	 * @default 8
	 */
	scale?: number;
}

/** Pixels as 8-bit straight RGBA, top row first, the layout of `ImageData`. */
export interface QrImage {
	width: number;
	height: number;
	data: Uint8ClampedArray;
}

/**
 * Pixels for `symbol`, square, `(size + 2 * margin) * scale` a side. Fractional or negative
 * options round down and clamp, to a zero margin and a one-pixel module, so every call answers
 * a drawable image.
 */
export function raster(symbol: Pick<QR, "size" | "isDark">, options: ImageOptions = {}): QrImage {
	let margin = Math.max(0, Math.floor(options.margin ?? 4));
	let scale = Math.max(1, Math.floor(options.scale ?? 8));
	let side = (symbol.size + margin * 2) * scale;
	let data = new Uint8ClampedArray(side * side * 4).fill(255);

	for (let y = 0; y < side; y++) {
		let moduleY = Math.floor(y / scale) - margin;
		for (let x = 0; x < side; x++) {
			if (!symbol.isDark(Math.floor(x / scale) - margin, moduleY)) continue;
			let offset = (y * side + x) * 4;
			data[offset] = 0;
			data[offset + 1] = 0;
			data[offset + 2] = 0;
		}
	}

	return { width: side, height: side, data };
}
