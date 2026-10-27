/**
 * Tests for the syllable machines: longest-match splitting and rule priority in the generic
 * machine, the Indic and USE grammars, and the category derivations they read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { CATEGORIES, POSITIONS, indicCategory, indicPosition } from "./indic-data.js";
import { indicSyllables } from "./indic-machine.js";
import { SyllableMachine, many, optional, sequence, symbol } from "./syllable-machine.js";
import { useCategory } from "./use-data.js";
import { useSymbol, useSyllables } from "./use-machine.js";

/**
 * The bit index of an Indic category, the symbol the Indic machine reads.
 *
 * @param codePoint - A code point.
 */
function indicSymbol(codePoint: number): number {
	return 31 - Math.clz32(indicCategory(codePoint));
}

describe("SyllableMachine", () => {
	test("takes the longest match and names it by the first rule that matches it", () => {
		let machine = new SyllableMachine([
			["short", sequence(symbol(0), optional(symbol(1)))],
			["long", sequence(symbol(0), symbol(1), many(symbol(2)))],
		]);
		expect(machine.match([0, 1, 0, 1, 2, 2])).toEqual([
			{ start: 0, end: 2, type: "short" },
			{ start: 2, end: 6, type: "long" },
		]);
	});

	test("groups glyphs no rule matches into one syllable per run", () => {
		let machine = new SyllableMachine([["one", symbol(0)]]);
		expect(machine.match([5, 5, 0, -1, 7])).toEqual([
			{ start: 0, end: 2, type: null },
			{ start: 2, end: 3, type: "one" },
			{ start: 3, end: 5, type: null },
		]);
	});

	test("splits an unbounded syllable after 256 glyphs", () => {
		let machine = new SyllableMachine([["run", many(symbol(0))]]);
		let syllables = machine.match(Array.from({ length: 600 }, () => 0));
		expect(syllables.map((syllable) => syllable.end - syllable.start)).toEqual([256, 256, 88]);
	});
});

describe("Indic categories", () => {
	test("classifies consonants, Ra, viramas, matras and joiners", () => {
		expect(indicCategory(0x0915)).toBe(CATEGORIES.C);
		expect(indicCategory(0x0930)).toBe(CATEGORIES.Ra);
		expect(indicCategory(0x094d)).toBe(CATEGORIES.H);
		expect(indicCategory(0x093f)).toBe(CATEGORIES.M);
		expect(indicCategory(0x200d)).toBe(CATEGORIES.ZWJ);
		expect(indicCategory(0x17d2)).toBe(CATEGORIES.Coeng);
		expect(indicCategory(0x0041)).toBe(CATEGORIES.X);
	});

	test("places matras by script and consonants as bases", () => {
		expect(indicPosition(0x093f, CATEGORIES.M)).toBe(POSITIONS.Pre_M);
		expect(indicPosition(0x0940, CATEGORIES.M)).toBe(POSITIONS.After_Sub);
		expect(indicPosition(0x09be, CATEGORIES.M)).toBe(POSITIONS.After_Post);
		expect(indicPosition(0x0cbf, CATEGORIES.M)).toBe(POSITIONS.Before_Sub);
		expect(indicPosition(0x0915, CATEGORIES.C)).toBe(POSITIONS.Base_C);
		expect(indicPosition(0x0902, CATEGORIES.SM)).toBe(POSITIONS.SMVD);
	});

	test("splits Devanagari into consonant, broken and non-Indic syllables", () => {
		let text = [0x0915, 0x094d, 0x0937, 0x093f, 0x0020, 0x093f];
		expect(indicSyllables(text.map(indicSymbol))).toEqual([
			{ start: 0, end: 4, type: "consonant_syllable" },
			{ start: 4, end: 5, type: null },
			{ start: 5, end: 6, type: "broken_cluster" },
		]);
	});
});

describe("USE categories", () => {
	test("classifies bases, viramas, positioned vowels and others", () => {
		expect(useCategory(0x1b13)).toBe("B");
		expect(useCategory(0x1b44)).toBe("H");
		expect(useCategory(0x1b3e)).toBe("VPre");
		expect(useCategory(0x1b36)).toBe("VAbv");
		expect(useCategory(0x1b38)).toBe("VBlw");
		expect(useCategory(0x25cc)).toBe("GB");
		expect(useCategory(0x0020)).toBe("O");
		expect(useCategory(0x200d)).toBe("ZWJ");
	});

	test("ends a standard cluster at a virama and starts a broken one at a lone vowel", () => {
		let text = [0x1b13, 0x1b44, 0x1b13, 0x1b3e, 0x1b36];
		let syllables = useSyllables(text.map((codePoint) => useSymbol(useCategory(codePoint))));
		expect(syllables).toEqual([{ start: 0, end: 5, type: "standard_cluster" }]);
		let broken = useSyllables(
			[0x1b36, 0x1b13].map((codePoint) => useSymbol(useCategory(codePoint))),
		);
		expect(broken).toEqual([
			{ start: 0, end: 1, type: "broken_cluster" },
			{ start: 1, end: 2, type: "standard_cluster" },
		]);
	});
});
