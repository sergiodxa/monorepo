/**
 * Tests for the segmentation helpers the rest of the package is built on,
 * pinning the two guarantees callers rely on: a count in grapheme clusters and
 * a first-character transform that keeps a cluster whole.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import {
	countGraphemes,
	graphemes,
	graphemeSegmenter,
	lowerFirst,
	upperFirst,
	words,
	wordSegmenter,
} from "./segment.js";

/** Family emoji: four people joined by zero-width joiners, one grapheme. */
const FAMILY = "\u{1F469}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}";

/** "n" plus a combining tilde: one grapheme written as two code units. */
const N_TILDE = "n\u0303";

describe("graphemes", () => {
	test("keeps an emoji sequence together", () => {
		expect(graphemes(`${FAMILY}!`)).toEqual([FAMILY, "!"]);
	});

	test("keeps a letter with its combining mark together", () => {
		expect(graphemes(`${N_TILDE}u`)).toEqual([N_TILDE, "u"]);
	});

	test("returns an empty list for an empty string", () => {
		expect(graphemes("")).toEqual([]);
	});
});

describe("countGraphemes", () => {
	test("counts clusters, not code units", () => {
		expect(FAMILY.length).toBeGreaterThan(1);
		expect(countGraphemes(FAMILY)).toBe(1);
		expect(countGraphemes(`ma${N_TILDE}ana`)).toBe(6);
	});

	test("counts zero for an empty string", () => {
		expect(countGraphemes("")).toBe(0);
	});
});

describe("words", () => {
	test("drops whitespace and punctuation segments", () => {
		expect(words("Hello, world!")).toEqual(["Hello", "world"]);
	});

	test("drops an emoji, which is not word-like", () => {
		expect(words(`hi ${FAMILY} there`)).toEqual(["hi", "there"]);
	});
});

describe("upperFirst", () => {
	test("uppercases the first cluster and leaves the rest as written", () => {
		expect(upperFirst("remix")).toBe("Remix");
		expect(upperFirst("iPhone")).toBe("IPhone");
		expect(upperFirst("aBC dEF")).toBe("ABC dEF");
	});

	test("leaves a cluster without an uppercase form alone", () => {
		expect(upperFirst(`${FAMILY}x`)).toBe(`${FAMILY}x`);
	});

	test("returns an empty string untouched", () => {
		expect(upperFirst("")).toBe("");
	});
});

describe("lowerFirst", () => {
	test("lowercases the first cluster and leaves the rest as written", () => {
		expect(lowerFirst("CronJob")).toBe("cronJob");
		expect(lowerFirst("ABC")).toBe("aBC");
	});

	test("returns an empty string untouched", () => {
		expect(lowerFirst("")).toBe("");
	});
});

describe("segmenter caching", () => {
	test("reuses one instance per locale", () => {
		expect(graphemeSegmenter("en")).toBe(graphemeSegmenter("en"));
		expect(wordSegmenter("en")).toBe(wordSegmenter("en"));
	});

	test("keeps separate instances for different locales", () => {
		expect(graphemeSegmenter("en")).not.toBe(graphemeSegmenter("ja"));
		expect(graphemeSegmenter()).not.toBe(graphemeSegmenter("en"));
	});
});
