/**
 * Tests for the grapheme-safe text operations, with the emoji and combining
 * mark cases spelled out through escapes: those are exactly the inputs that
 * code-unit slicing breaks, and they are invisible in a test that pastes the
 * rendered glyph instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { capitalize, excerpt, initials, truncate, wordCount } from "./text";

/** Family emoji: four people joined by zero-width joiners, one grapheme. */
const FAMILY = "\u{1F469}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}";

/** Waving hand plus a skin tone modifier, one grapheme built from two runes. */
const WAVE = "\u{1F44B}\u{1F3FD}";

/** "n" plus a combining tilde: one grapheme written as two code units. */
const N_TILDE = "n\u0303";

/** The uppercase form of {@link N_TILDE}, still decomposed. */
const N_TILDE_UPPER = "N\u0303";

describe("truncate", () => {
	test("returns text that already fits untouched", () => {
		expect(truncate("short", { length: 10 })).toBe("short");
		expect(truncate("exactly-10", { length: 10 })).toBe("exactly-10");
	});

	test("counts the omission towards the limit", () => {
		expect(truncate("a long sentence here", { length: 10 })).toBe("a long se…");
		expect(truncate("abcdefghij", { length: 5, omission: "..." })).toBe("ab...");
	});

	test("cuts at a word boundary on request", () => {
		expect(truncate("a long sentence here", { length: 10, words: true })).toBe("a long…");
	});

	test("falls back to a grapheme cut when the first word does not fit", () => {
		expect(truncate("unsplittable", { length: 6, words: true })).toBe("unspl…");
	});

	test("never splits an emoji sequence", () => {
		let text = `${FAMILY}${FAMILY}${FAMILY}`;
		let result = truncate(text, { length: 2 });

		expect(result).toBe(`${FAMILY}…`);
		expect(result.includes("\u200D\u2026")).toBe(false);
	});

	test("never splits an emoji from its skin tone modifier", () => {
		expect(truncate(`${WAVE}${WAVE}${WAVE}`, { length: 2 })).toBe(`${WAVE}…`);
	});

	test("never splits a letter from its combining mark", () => {
		let result = truncate(`ma${N_TILDE}ana`, { length: 4 });

		expect(result).toBe(`ma${N_TILDE}…`);
		expect(result.includes("\u0303")).toBe(true);
	});

	test("measures a combining mark as one character", () => {
		expect(truncate(`ma${N_TILDE}ana`, { length: 6 })).toBe(`ma${N_TILDE}ana`);
		expect(truncate(`ma${N_TILDE}ana`, { length: 5 })).toBe(`ma${N_TILDE}a…`);
	});

	test("drops the whitespace left before the omission", () => {
		expect(truncate("hello world", { length: 7 })).toBe("hello…");
	});

	test("returns the plain text when the omission does not fit", () => {
		expect(truncate("abcdef", { length: 2, omission: "..." })).toBe("ab");
		expect(truncate("abcdef", { length: 0 })).toBe("");
	});
});

describe("excerpt", () => {
	test("collapses every run of whitespace before truncating", () => {
		expect(excerpt("Long\n\n  post   body", { length: 40 })).toBe("Long post body");
	});

	test("cuts at a word boundary by default", () => {
		expect(excerpt("Long\n\n  post   body here", { length: 12 })).toBe("Long post…");
	});

	test("can cut mid-word when asked", () => {
		expect(excerpt("Long\n\n  post   body here", { length: 12, words: false })).toBe(
			"Long post b…",
		);
	});

	test("returns short text without an omission", () => {
		expect(excerpt("  tidy  ", { length: 20 })).toBe("tidy");
	});
});

describe("wordCount", () => {
	test("counts words and ignores punctuation", () => {
		expect(wordCount("Hello, world!")).toBe(2);
		expect(wordCount("Hello, world! Two more.")).toBe(4);
	});

	test("returns zero for text without words", () => {
		expect(wordCount("")).toBe(0);
		expect(wordCount("  ...  ")).toBe(0);
	});

	test("counts words in a script written without spaces", () => {
		expect(wordCount("日本語のタイトル", { locale: "ja" })).toBeGreaterThan(1);
	});

	test("does not count an emoji as a word", () => {
		expect(wordCount(`hello ${WAVE} world`)).toBe(2);
	});
});

describe("initials", () => {
	test("takes the first letter of each word", () => {
		expect(initials("Sergio Xalambrí")).toBe("SX");
	});

	test("keeps two initials by default", () => {
		expect(initials("Ada Byron King")).toBe("AB");
	});

	test("keeps more initials when asked", () => {
		expect(initials("Ada Byron King", { limit: 3 })).toBe("ABK");
		expect(initials("Ada Byron King", { limit: 10 })).toBe("ABK");
	});

	test("uppercases the initial", () => {
		expect(initials("sergio xalambrí")).toBe("SX");
	});

	test("takes a whole grapheme, not a code unit", () => {
		expect(initials(`${N_TILDE}u ${N_TILDE}oa`)).toBe(`${N_TILDE_UPPER}${N_TILDE_UPPER}`);
	});

	test("returns an empty string when there is nothing to initial", () => {
		expect(initials("")).toBe("");
		expect(initials("Sergio", { limit: 0 })).toBe("");
	});
});

describe("capitalize", () => {
	test("uppercases the first letter", () => {
		expect(capitalize("remix")).toBe("Remix");
	});

	test("leaves the rest of the string as written", () => {
		expect(capitalize("remix v3 and JSON")).toBe("Remix v3 and JSON");
	});

	test("keeps a combining mark with its letter", () => {
		expect(capitalize(`${N_TILDE}u`)).toBe(`${N_TILDE_UPPER}u`);
	});

	test("leaves a leading grapheme without an uppercase form alone", () => {
		expect(capitalize(`${FAMILY} party`)).toBe(`${FAMILY} party`);
	});

	test("returns an empty string untouched", () => {
		expect(capitalize("")).toBe("");
	});
});
