/**
 * Tests the SVG path builder: one rectangle per horizontal dark run, offset by the quiet
 * zone, with a viewBox that includes it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import type { QrSymbol } from "./encode.js";

import { QR } from "./encode.js";

/** A 3×3 symbol from `#`/`.` rows, so expected paths can be written by hand. */
function grid(...rows: string[]): QrSymbol {
	return {
		version: 1,
		level: "M",
		mask: 0,
		size: rows.length,
		isDark: (x, y) => rows[y]?.[x] === "#",
	};
}

test("merges each row's dark runs into rectangles, offset by the margin", () => {
	let path = QR.toSVGPath(grid("##.", ".#.", "#.#"), { margin: 1 });
	expect(path).toEqual({
		d: "M1 1h2v1h-2zM2 2h1v1h-1zM1 3h1v1h-1zM3 3h1v1h-1z",
		viewBox: "0 0 5 5",
		size: 5,
	});
});

test("defaults to the standard's four-module quiet zone", () => {
	let symbol = unwrap(QR.encode("HELLO"));
	let path = QR.toSVGPath(symbol);
	expect(path.size).toBe(symbol.size + 8);
	expect(path.viewBox).toBe(`0 0 ${symbol.size + 8} ${symbol.size + 8}`);
	expect(path.d.startsWith("M4 4h7v1h-7z")).toBe(true);
});

test("draws a symbol with no margin from the origin", () => {
	expect(QR.toSVGPath(grid("#.", ".#"), { margin: 0 }).d).toBe("M0 0h1v1h-1zM1 1h1v1h-1z");
});
