/**
 * Covers the post-login `next`/`returnTo` open-redirect guard (`safeNext`): only
 * same-origin relative paths pass (normalized with query/hash preserved), while
 * protocol-relative, backslash, dot-segment, and absolute/external URLs are
 * refused so a crafted `next` can never bounce a signed-in user to an attacker
 * origin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { safeNext } from "./auth";

describe("safeNext", () => {
	test("allows a same-site absolute path", () => {
		expect(safeNext("/cms/posts")).toBe("/cms/posts");
	});

	test("preserves the query string of an allowed path", () => {
		expect(safeNext("/cms/posts?tab=drafts")).toBe("/cms/posts?tab=drafts");
	});

	test("preserves the hash of an allowed path", () => {
		expect(safeNext("/cms/posts#top")).toBe("/cms/posts#top");
	});

	test("preserves the query string and hash of an allowed path", () => {
		expect(safeNext("/cms/posts?tab=drafts#top")).toBe("/cms/posts?tab=drafts#top");
	});

	/**
	 * Every payload here survives a leading-slash test yet resolves to an attacker
	 * origin once a browser follows it, `/..//evil.com` by normalizing to `//evil.com`
	 * only after resolution reports our own origin.
	 */
	test.each([["//evil.com"], ["/\\/evil.com"], ["/\\evil.com"], ["/..//evil.com"]])(
		"refuses %j",
		(value) => {
			expect(safeNext(value)).toBeUndefined();
		},
	);

	test("refuses a protocol-relative URL with a path (//host/path)", () => {
		expect(safeNext("//evil.com/path")).toBeUndefined();
	});

	test("refuses an absolute URL to an external origin", () => {
		expect(safeNext("https://evil.com/cms")).toBeUndefined();
		expect(safeNext("http://evil.com")).toBeUndefined();
	});

	test("refuses an absolute URL even when the host matches", () => {
		expect(safeNext("https://blog.example.com/cms/posts")).toBeUndefined();
	});

	test("refuses a bare relative path that is not rooted at /", () => {
		expect(safeNext("cms/posts")).toBeUndefined();
	});

	test("refuses empty, null, and undefined values", () => {
		expect(safeNext("")).toBeUndefined();
		expect(safeNext(null)).toBeUndefined();
		expect(safeNext(undefined)).toBeUndefined();
	});

	test("resolves every allowed target against our own origin", () => {
		for (let value of ["/cms/posts", "/cms/posts?tab=drafts#top", "/cms/../posts"]) {
			expect(new URL(safeNext(value) ?? "", "https://blog.example.com").origin).toBe(
				"https://blog.example.com",
			);
		}
	});
});
