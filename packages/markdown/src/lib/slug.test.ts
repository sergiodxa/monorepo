/**
 * Checks heading slugs against the spelling GitHub gives the same headings, and the
 * numbering that keeps a repeated heading addressable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { Slugger, slug } from "./slug.js";

describe("slug", () => {
	test("lower-cases, drops punctuation and hyphenates spaces", () => {
		expect(slug("Hello, World!")).toBe("hello-world");
		expect(slug("What's `new` in v2.0?")).toBe("whats-new-in-v20");
	});

	test("keeps hyphens, underscores and letters beyond ASCII", () => {
		expect(slug("snake_case and kebab-case")).toBe("snake_case-and-kebab-case");
		expect(slug("Über Café")).toBe("über-café");
	});

	test("keeps one hyphen per space, as GitHub does", () => {
		expect(slug("a  b")).toBe("a--b");
	});
});

describe("Slugger", () => {
	test("numbers a repeated heading", () => {
		let slugger = new Slugger();

		expect([slugger.next("Props"), slugger.next("Props"), slugger.next("Props")]).toEqual([
			"props",
			"props-1",
			"props-2",
		]);
	});

	test("claims an id in its own spelling, numbering it the same way", () => {
		let slugger = new Slugger();

		expect([slugger.claim("API.v2"), slugger.claim("API.v2")]).toEqual(["API.v2", "API.v2-1"]);
	});

	test("steps around a reserved id", () => {
		let slugger = new Slugger();
		slugger.reserve("install");

		expect(slugger.next("Install")).toBe("install-1");
	});
});
