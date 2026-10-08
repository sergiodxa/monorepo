/**
 * Known-answer tests for the encoder: the ISO/IEC 18004 annex codewords, and whole matrices
 * produced by Nayuki's reference implementations across modes, levels, versions and masks,
 * plus the option validation and `too-long` contract.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { QrLevel, QrOptions, QrSymbol } from "./encode.js";

import { dataCodewords, encodeQr, interleave, QrError } from "./encode.js";
import FIXTURES from "./fixtures/nayuki.json" with { type: "json" };
import { textSegments, totalBits } from "./segment.js";
import { dataCodewordCount } from "./tables.js";

/** A symbol as `#` (dark) and `.` (light) rows, the fixtures' notation. */
function rows(symbol: QrSymbol): string[] {
	let result: string[] = [];
	for (let y = 0; y < symbol.size; y++) {
		let row = "";
		for (let x = 0; x < symbol.size; x++) row += symbol.isDark(x, y) ? "#" : ".";
		result.push(row);
	}
	return result;
}

/** Bytes as upper-case hex pairs, so a mismatch reads like the standard's tables. */
function hex(bytes: Uint8Array): string[] {
	return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, "0"));
}

describe("ISO/IEC 18004 annex example: 01234567 at 1-M", () => {
	let segments = textSegments("01234567", 1);

	test("produces the annex data codewords", () => {
		expect(hex(dataCodewords(segments, 1, "M"))).toEqual([
			"10",
			"20",
			"0C",
			"56",
			"61",
			"80",
			"EC",
			"11",
			"EC",
			"11",
			"EC",
			"11",
			"EC",
			"11",
			"EC",
			"11",
		]);
	});

	test("appends the annex error correction codewords", () => {
		let codewords = interleave(dataCodewords(segments, 1, "M"), 1, "M");
		expect(hex(codewords.subarray(16))).toEqual([
			"A5",
			"24",
			"D4",
			"C1",
			"ED",
			"36",
			"C7",
			"87",
			"2C",
			"55",
		]);
	});

	test("keeps level M when boostLevel is off", () => {
		let symbol = unwrap(encodeQr("01234567", { level: "M", boostLevel: false }));
		expect(symbol.version).toBe(1);
		expect(symbol.level).toBe("M");
	});
});

test("interleaves short blocks before long ones at 5-Q", () => {
	let data = new Uint8Array(dataCodewordCount(5, "Q")).map((_, index) => index);
	let codewords = interleave(data, 5, "Q");
	expect(Array.from(codewords.subarray(0, 8))).toEqual([0, 15, 30, 46, 1, 16, 31, 47]);
	expect(Array.from(codewords.subarray(56, 62))).toEqual([14, 29, 44, 60, 45, 61]);
});

describe("matches Nayuki's reference matrices", () => {
	for (let fixture of FIXTURES) {
		test(`${fixture.name} (${fixture.reference})`, () => {
			let symbol = unwrap(encodeQr(fixture.input, fixture.options as QrOptions));
			expect({ version: symbol.version, level: symbol.level, mask: symbol.mask }).toEqual({
				version: fixture.version,
				level: fixture.level,
				mask: fixture.mask,
			});
			expect(rows(symbol)).toEqual(fixture.rows);
		});
	}
});

describe("version selection", () => {
	test("picks the smallest version that holds the segmented data", () => {
		for (let fixture of FIXTURES) {
			let options = fixture.options as QrOptions;
			let symbol = unwrap(encodeQr(fixture.input, { ...options, boostLevel: false }));
			let level: QrLevel = options.level ?? "M";
			let below = symbol.version - 1;
			if (below < (options.minVersion ?? 1)) continue;
			expect(totalBits(textSegments(fixture.input, below), below)).toBeGreaterThan(
				dataCodewordCount(below, level) * 8,
			);
		}
	});

	test("an empty string is a version 1 symbol", () => {
		expect(unwrap(encodeQr("")).version).toBe(1);
	});

	test("bytes encode as one byte-mode run", () => {
		let bytes = new TextEncoder().encode("01234567");
		let fromBytes = unwrap(encodeQr(bytes, { boostLevel: false }));
		let fromText = unwrap(encodeQr("01234567", { boostLevel: false }));
		expect(fromBytes.version).toBe(1);
		expect(rows(fromBytes)).not.toEqual(rows(fromText));
	});
});

describe("boostLevel", () => {
	test("raises the level while the version still fits", () => {
		let symbol = unwrap(encodeQr("01234567", { level: "L" }));
		expect(symbol.version).toBe(1);
		expect(symbol.level).toBe("H");
	});

	test("leaves the level alone when off", () => {
		expect(unwrap(encodeQr("01234567", { level: "L", boostLevel: false })).level).toBe("L");
	});
});

describe("isDark", () => {
	test("answers false outside the symbol", () => {
		let symbol = unwrap(encodeQr("HELLO"));
		expect(symbol.isDark(0, 0)).toBe(true);
		expect(symbol.isDark(-1, 0)).toBe(false);
		expect(symbol.isDark(0, -1)).toBe(false);
		expect(symbol.isDark(symbol.size, 0)).toBe(false);
		expect(symbol.isDark(0, symbol.size)).toBe(false);
	});
});

describe("errors", () => {
	test.each<[string, QrOptions]>([
		["minVersion below 1", { minVersion: 0 }],
		["maxVersion above 40", { maxVersion: 41 }],
		["a fractional version", { minVersion: 1.5 }],
		["minVersion above maxVersion", { minVersion: 5, maxVersion: 4 }],
		["mask above 7", { mask: 8 }],
		["a negative mask", { mask: -1 }],
		["an unknown level", { level: "X" as QrLevel }],
	])("rejects %s as invalid-options", (_, options) => {
		let result = encodeQr("HELLO", options);
		expect(isFailure(result) && result.error).toBeInstanceOf(QrError);
		expect(isFailure(result) && result.error.code).toBe("invalid-options");
	});

	test("reports the bits needed and available when the data outgrows maxVersion", () => {
		let result = encodeQr("a".repeat(100), { level: "H", maxVersion: 3 });
		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.code).toBe("too-long");
		expect(result.error.bits).toEqual({
			needed: 4 + 8 + 800,
			available: dataCodewordCount(3, "H") * 8,
		});
	});

	test("fits version 40-L's 2,953 bytes and refuses one more", () => {
		expect(isSuccess(encodeQr(new Uint8Array(2953), { level: "L" }))).toBe(true);
		let result = encodeQr(new Uint8Array(2954), { level: "L" });
		expect(isFailure(result) && result.error.code).toBe("too-long");
	});
});
