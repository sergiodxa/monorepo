/**
 * Tests for the generated Unicode property lookups: one known character per property and
 * value, and the defaults outside the tables.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	combiningClass,
	generalCategory,
	indicPositionalCategory,
	indicSyllabicCategory,
	isDefaultIgnorable,
	isDigit,
	isMark,
	joiningType,
	mirror,
	script,
} from "./properties.js";

describe("Unicode properties", () => {
	test("general category", () => {
		expect(generalCategory(0x41)).toBe("Lu");
		expect(generalCategory(0x301)).toBe("Mn");
		expect(generalCategory(0x93f)).toBe("Mc");
		expect(generalCategory(0x10ffff)).toBe("Cn");
		expect(generalCategory(-1)).toBe("Cn");
		expect(isMark(0x301)).toBe(true);
		expect(isMark(0x41)).toBe(false);
		expect(isDigit(0x664)).toBe(true);
	});

	test("script", () => {
		expect(script(0x41)).toBe("Latn");
		expect(script(0x628)).toBe("Arab");
		expect(script(0x20)).toBe("Zyyy");
		expect(script(0x301)).toBe("Zinh");
		expect(script(0x1f600)).toBe("Zyyy");
		expect(script(0xe0080)).toBe("Zzzz");
	});

	test("combining class", () => {
		expect(combiningClass(0x41)).toBe(0);
		expect(combiningClass(0x301)).toBe(230);
		expect(combiningClass(0x323)).toBe(220);
		expect(combiningClass(0x651)).toBe(33);
	});

	test("joining type, with the Syriac groups", () => {
		expect(joiningType(0x628)).toBe("D");
		expect(joiningType(0x627)).toBe("R");
		expect(joiningType(0x64e)).toBe("T");
		expect(joiningType(0x200d)).toBe("C");
		expect(joiningType(0x41)).toBe("U");
		expect(joiningType(0x710)).toBe("ALAPH");
		expect(joiningType(0x72a)).toBe("DALATH_RISH");
	});

	test("Indic syllabic and positional categories", () => {
		expect(indicSyllabicCategory(0x915)).toBe("Consonant");
		expect(indicSyllabicCategory(0x94d)).toBe("Virama");
		expect(indicSyllabicCategory(0x41)).toBe("Other");
		expect(indicPositionalCategory(0x93f)).toBe("Left");
		expect(indicPositionalCategory(0x941)).toBe("Bottom");
		expect(indicPositionalCategory(0x41)).toBe("NA");
	});

	test("mirroring and default ignorables", () => {
		expect(mirror(0x28)).toBe(0x29);
		expect(mirror(0x29)).toBe(0x28);
		expect(mirror(0x41)).toBeNull();
		expect(isDefaultIgnorable(0xad)).toBe(true);
		expect(isDefaultIgnorable(0x200d)).toBe(true);
		expect(isDefaultIgnorable(0xe01ef)).toBe(true);
		expect(isDefaultIgnorable(0x3164)).toBe(false);
		expect(isDefaultIgnorable(0x41)).toBe(false);
	});
});
