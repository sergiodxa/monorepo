/**
 * Tests for slug generation, covering diacritics folded through NFKD, non-Latin
 * input that keeps its letters instead of an empty slug, and the separator
 * handling that keeps a slug free of leading, trailing, or repeated
 * separators.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { slugify } from "./slugify";

describe("slugify", () => {
	test("lowercases and joins words with a dash", () => {
		expect(slugify("Hello World")).toBe("hello-world");
		expect(slugify("The State of JavaScript")).toBe("the-state-of-javascript");
	});

	test("folds diacritics onto their base letter", () => {
		expect(slugify("Cómo usar Remix v3")).toBe("como-usar-remix-v3");
		expect(slugify("Sergio Xalambrí")).toBe("sergio-xalambri");
		expect(slugify("Crème brûlée")).toBe("creme-brulee");
	});

	test("folds a precomposed letter and a decomposed one to the same slug", () => {
		expect(slugify("caf\u00e9")).toBe("cafe");
		expect(slugify("cafe\u0301")).toBe("cafe");
	});

	test("folds a compatibility form through NFKD", () => {
		expect(slugify("ﬁre")).toBe("fire");
	});

	test("collapses punctuation into the separator", () => {
		expect(slugify("Hello, World!")).toBe("hello-world");
		expect(slugify("What's new in CSS?")).toBe("what-s-new-in-css");
	});

	test("accepts a custom separator", () => {
		expect(slugify("Hello, World!", { separator: "_" })).toBe("hello_world");
		expect(slugify("Hello, World!", { separator: "" })).toBe("helloworld");
	});

	test("never leaves a leading, trailing, or repeated separator", () => {
		expect(slugify("--Hello---World--")).toBe("hello-world");
		expect(slugify("  spaced  out  ")).toBe("spaced-out");
		expect(slugify("!!!", { separator: "-" })).toBe("");
	});

	test("keeps digits", () => {
		expect(slugify("Remix v3 in 2026")).toBe("remix-v3-in-2026");
	});

	test("keeps non-Latin letters instead of dropping them", () => {
		expect(slugify("日本語のタイトル")).toBe("日本語のタイトル");
		expect(slugify("Привет мир")).toBe("привет-мир");
		expect(slugify("Ελληνικά κείμενα")).toBe("ελληνικα-κειμενα");
	});

	test("drops emoji, which carry no slug text", () => {
		expect(slugify("Hello 👋 World")).toBe("hello-world");
	});

	test("returns an empty string for input with no letters or digits", () => {
		expect(slugify("")).toBe("");
		expect(slugify("   ")).toBe("");
	});
});
