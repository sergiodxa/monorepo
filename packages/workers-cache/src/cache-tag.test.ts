/**
 * Covers the `Cache-Tag` serializer: that it keeps the caller's order, collapses
 * repeats, refuses an empty list since an empty header would purge nothing, and
 * refuses a value that would exceed the header size limit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { CacheTag } from "./types.js";

import { CacheTagError } from "./cache-tag-error.js";
import { cacheTag } from "./cache-tag.js";
import { createTags } from "./create-tags.js";
import { MAX_CACHE_TAG_HEADER_LENGTH } from "./platform.js";

const TAGS = createTags({
	post: (id: string) => `post:${id}`,
	postList: () => "posts",
	filler: (index: number) => `filler:${index}:${"a".repeat(1000)}`,
});

describe("cacheTag", () => {
	test("serializes tags in the order they were written", () => {
		expect(cacheTag([TAGS.post("1"), TAGS.postList()])).toBe("post:1,posts");
	});

	test("collapses repeated tags so one declaration cannot inflate the header", () => {
		expect(cacheTag([TAGS.post("1"), TAGS.postList(), TAGS.post("1")])).toBe("post:1,posts");
	});

	test("serializes a single tag without a separator", () => {
		expect(cacheTag([TAGS.postList()])).toBe("posts");
	});

	test("rejects an empty list", () => {
		expect(() => cacheTag([])).toThrow(CacheTagError);
		expect(() => cacheTag([])).toThrow("empty tag list");
	});

	test("rejects a tag that was cast rather than built by a vocabulary", () => {
		expect(() => cacheTag(["post 1" as CacheTag])).toThrow(CacheTagError);
	});

	test("rejects a header value beyond the platform's size limit", () => {
		let tags = Array.from({ length: 20 }, (_, index) => TAGS.filler(index));

		expect(() => cacheTag(tags)).toThrow(`cannot exceed ${MAX_CACHE_TAG_HEADER_LENGTH}`);
	});
});
