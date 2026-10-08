/**
 * Tests the BCH-coded format and version information against the standard's tables
 * (ISO/IEC 18004 Annex C and D), and the penalty rules on hand-built lines.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import { formatBits, penaltyScore, versionBits } from "./matrix.js";

test.each([
	["L", 0, 0b111011111000100],
	["L", 7, 0b110100101110110],
	["M", 0, 0b101010000010010],
	["M", 5, 0b100000011001110],
	["Q", 0, 0b011010101011111],
	["Q", 3, 0b011101000000110],
	["H", 0, 0b001011010001001],
	["H", 7, 0b000100000111011],
] as const)("format information for %s with mask %i", (level, mask, expected) => {
	expect(formatBits(level, mask)).toBe(expected);
});

test.each([
	[7, 0x07c94],
	[8, 0x085bc],
	[10, 0x0a4d3],
	[21, 0x15683],
	[40, 0x28c69],
])("version information for version %i", (version, expected) => {
	expect(versionBits(version)).toBe(expected);
});

test("scores an all-light grid on runs, blocks and balance", () => {
	let size = 21;
	let matrix = { size, dark: new Uint8Array(size * size), reserved: new Uint8Array(size * size) };
	let runs = 2 * size * (3 + (size - 5));
	let blocks = (size - 1) * (size - 1) * 3;
	let balance = 9 * 10;
	expect(penaltyScore(matrix)).toBe(runs + blocks + balance);
});
