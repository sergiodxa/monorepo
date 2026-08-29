/**
 * Covers the tag vocabulary builder: that builders keep their names and
 * arguments, that every produced tag is validated against the platform's
 * character set and length rules, and that a violation throws at the point the
 * tag was built, ahead of a header the platform would silently drop.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { CacheTag } from "./types";

import { CacheTagError } from "./cache-tag-error";
import { createTags } from "./create-tags";
import { MAX_TAG_LENGTH } from "./platform";

/** Reads a branded tag as plain text, so assertions compare header content. */
function text(tag: CacheTag): string {
	return tag;
}

describe("createTags", () => {
	test("keeps every builder name and passes arguments through", () => {
		let tags = createTags({
			post: (id: string) => `post:${id}`,
			postsByType: (type: string) => `posts:${type}`,
			postList: () => "posts",
		});

		expect(Object.keys(tags).sort()).toEqual(["post", "postList", "postsByType"]);
		expect(text(tags.post("123"))).toBe("post:123");
		expect(text(tags.postsByType("tutorial"))).toBe("posts:tutorial");
		expect(text(tags.postList())).toBe("posts");
	});

	test("accepts printable ASCII up to the length limit", () => {
		let tags = createTags({
			long: () => "a".repeat(MAX_TAG_LENGTH),
			punctuated: () => "post:123/segment?x=1#y",
		});

		expect(text(tags.long())).toHaveLength(MAX_TAG_LENGTH);
		expect(text(tags.punctuated())).toBe("post:123/segment?x=1#y");
	});

	test("rejects an empty tag", () => {
		let tags = createTags({ blank: () => "" });
		expect(() => tags.blank()).toThrow(CacheTagError);
	});

	test("rejects a tag longer than the platform allows", () => {
		let tags = createTags({ huge: () => "a".repeat(MAX_TAG_LENGTH + 1) });
		expect(() => tags.huge()).toThrow(`cannot exceed ${MAX_TAG_LENGTH} characters`);
	});

	test("rejects the characters that would break a tag list", () => {
		let tags = createTags({
			spaced: (id: string) => `post ${id}`,
			comma: (id: string) => `post,${id}`,
			quoted: (id: string) => `post"${id}"`,
		});

		expect(() => tags.spaced("1")).toThrow(CacheTagError);
		expect(() => tags.comma("1")).toThrow(CacheTagError);
		expect(() => tags.quoted("1")).toThrow(CacheTagError);
	});

	test("rejects non-ASCII, so a tag never changes shape on the wire", () => {
		let tags = createTags({ accented: () => "póst:1" });
		expect(() => tags.accented()).toThrow("printable ASCII");
	});

	test("names the rejected tag on the error", () => {
		let tags = createTags({ comma: () => "post,1" });

		try {
			tags.comma();
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(CacheTagError);
			expect((error as CacheTagError).tag).toBe("post,1");
		}
	});

	test("validates on every call, not once at declaration", () => {
		let tags = createTags({ post: (id: string) => `post:${id}` });

		expect(text(tags.post("1"))).toBe("post:1");
		expect(() => tags.post("a b")).toThrow(CacheTagError);
		expect(text(tags.post("2"))).toBe("post:2");
	});
});
