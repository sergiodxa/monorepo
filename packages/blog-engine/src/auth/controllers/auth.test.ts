/**
 * Covers the post-login `next`/`returnTo` open-redirect guard (`safeNext`): only
 * same-origin relative paths pass (normalized with query/hash preserved), while
 * protocol-relative, backslash, and absolute/external URLs are rejected so a
 * crafted `next` can never bounce a signed-in user to an attacker origin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { safeNext } from "./auth";

let request = new Request("https://blog.example.com/cms/dashboard");

describe("safeNext", () => {
	test("allows a same-site absolute path", () => {
		expect(safeNext("/cms/posts", request)).toBe("/cms/posts");
	});

	test("preserves the query string and hash of an allowed path", () => {
		expect(safeNext("/cms/posts?tab=drafts#top", request)).toBe("/cms/posts?tab=drafts#top");
	});

	test("rejects a protocol-relative URL (//host)", () => {
		expect(safeNext("//evil.com", request)).toBeUndefined();
		expect(safeNext("//evil.com/path", request)).toBeUndefined();
	});

	test("rejects a backslash-prefixed path (/\\host trick)", () => {
		expect(safeNext("/\\evil.com", request)).toBeUndefined();
	});

	test("rejects an absolute URL to an external origin", () => {
		expect(safeNext("https://evil.com/cms", request)).toBeUndefined();
		expect(safeNext("http://evil.com", request)).toBeUndefined();
	});

	test("rejects an absolute URL even when the host matches (scheme differs)", () => {
		expect(safeNext("https://blog.example.com/cms/posts", request)).toBeUndefined();
	});

	test("rejects a bare relative path that is not rooted at /", () => {
		expect(safeNext("cms/posts", request)).toBeUndefined();
	});

	test("rejects empty, null, and undefined values", () => {
		expect(safeNext("", request)).toBeUndefined();
		expect(safeNext(null, request)).toBeUndefined();
		expect(safeNext(undefined, request)).toBeUndefined();
	});
});
