/**
 * Tests for the tag lookups, including the missing-comment case a renderer hits
 * on every undocumented symbol.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { parseComment } from "./comment.js";
import { findTag, findTags } from "./tags.js";

describe("findTag", () => {
	test("returns the first tag with the name", () => {
		let comment = parseComment("/** @example one\n * @example two\n */");

		expect(findTag(comment, "example")?.text).toBe("one");
	});

	test("returns null for a symbol without a comment", () => {
		expect(findTag(null, "returns")).toBeNull();
	});
});

describe("findTags", () => {
	test("returns every match in source order", () => {
		let comment = parseComment("/** @param a - Left.\n * @param b - Right.\n */");

		expect(findTags(comment, "param").map((tag) => tag.name)).toEqual(["a", "b"]);
	});

	test("returns an empty list for a symbol without a comment", () => {
		expect(findTags(null, "param")).toEqual([]);
	});
});
