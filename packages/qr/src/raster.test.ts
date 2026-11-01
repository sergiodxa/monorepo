/**
 * Tests the rasterizer: every module becomes a `scale`-pixel square, the quiet zone stays
 * white, and alpha is always opaque so a PNG encoder can drop the channel.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import type { QrImage } from "./raster.js";

import { QR } from "./encode.js";
import { raster } from "./raster.js";

/** A module grid from `#`/`.` rows, so expected pixels can be written by hand. */
function grid(...rows: string[]): Pick<QR, "size" | "isDark"> {
	return {
		size: rows.length,
		isDark: (x, y) => rows[y]?.[x] === "#",
	};
}

/** Each pixel row as `#` (black) and `.` (white), failing on any other color. */
function pixels(image: QrImage): string[] {
	let rows: string[] = [];
	for (let y = 0; y < image.height; y++) {
		let row = "";
		for (let x = 0; x < image.width; x++) {
			let [r, g, b, a] = image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4);
			expect(a).toBe(255);
			expect(r === g && g === b && (r === 0 || r === 255)).toBe(true);
			row += r === 0 ? "#" : ".";
		}
		rows.push(row);
	}
	return rows;
}

test("draws each module as a scale-sized square inside the margin", () => {
	let image = raster(grid("#.", ".#"), { margin: 1, scale: 2 });
	expect(image.width).toBe(8);
	expect(image.height).toBe(8);
	expect(pixels(image)).toEqual([
		"........",
		"........",
		"..##....",
		"..##....",
		"....##..",
		"....##..",
		"........",
		"........",
	]);
});

test("defaults to a four-module quiet zone at eight pixels a module", () => {
	let symbol = unwrap(QR.encode("HELLO"));
	let image = symbol.toImage();
	expect(image.width).toBe((symbol.size + 8) * 8);
	expect(image.data.length).toBe(image.width * image.height * 4);
	let topLeft = (32 * image.width + 32) * 4;
	expect(image.data[topLeft]).toBe(0);
	expect(image.data[topLeft - 4]).toBe(255);
});

test("clamps a negative margin and a zero scale to a drawable image", () => {
	expect(pixels(raster(grid("#"), { margin: -2, scale: 0 }))).toEqual(["#"]);
});
