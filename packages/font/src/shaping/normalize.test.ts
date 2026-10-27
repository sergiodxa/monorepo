/**
 * Tests for `normalizeCluster` with a stand-in coverage, which reaches fonts that lack one
 * component of a decomposition without needing such a font on disk.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { normalizationCharacter, normalizeCluster } from "./normalize.js";

/**
 * A coverage test answering `true` for every listed code point.
 *
 * @param codePoints - What the pretend font draws.
 */
function covers(...codePoints: number[]): (codePoint: number) => boolean {
	let set = new Set(codePoints);
	return (codePoint) => set.has(codePoint);
}

describe("normalizeCluster", () => {
	test("composes a base and a mark the font draws precomposed", () => {
		expect(normalizeCluster([0x69, 0x300], covers(0x69, 0x300, 0xec))).toEqual([0xec]);
	});

	test("decomposes a character the font draws only in parts", () => {
		expect(normalizeCluster([0xec], covers(0x69, 0x300))).toEqual([0x69, 0x300]);
	});

	test("uses a supported partial decomposition when a component mark is missing", () => {
		let fira = covers(0x63, 0xe7, 0x301);
		expect(normalizeCluster([0xe7, 0x301], fira)).toEqual([0xe7, 0x301]);
		expect(normalizeCluster([0x1e09], fira)).toEqual([0xe7, 0x301]);
	});

	test("does not expand an unsupported character into missing components", () => {
		expect(normalizeCluster([0x1e09], covers(0x63, 0xe7, 0x327))).toEqual([0x1e09]);
	});

	test("keeps a character the font draws whole", () => {
		expect(normalizeCluster([0x2126], covers(0x2126, 0x3a9))).toEqual([0x2126]);
	});

	test("sorts marks by combining class and lets a shaper reorder them", () => {
		expect(normalizeCluster([0x71, 0x307, 0x323], covers(0x71, 0x307, 0x323))).toEqual([
			0x71, 0x323, 0x307,
		]);
		let swapped = normalizeCluster(
			[0x71, 0x323, 0x307],
			covers(0x71, 0x307, 0x323),
			(characters, start, end) => {
				characters.splice(start, end - start, ...characters.slice(start, end).reverse());
			},
		);
		expect(swapped).toEqual([0x71, 0x307, 0x323]);
	});

	test("orders Arabic shadda before the vowels", () => {
		expect(normalizationCharacter(0x651).combiningClass).toBeLessThan(
			normalizationCharacter(0x64b).combiningClass,
		);
	});
});
