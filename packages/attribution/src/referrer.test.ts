/**
 * Tests for `classifyReferrer`: the hostname it keeps, the kind it assigns, and the headers it
 * reads as no referrer at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { classifyReferrer } from "./referrer.js";

describe(classifyReferrer, () => {
	test.each([
		["https://www.google.com/", "google.com", "search"],
		["https://www.google.co.uk/search?q=x", "google.co.uk", "search"],
		["https://duckduckgo.com/", "duckduckgo.com", "search"],
		["https://l.facebook.com/l.php?u=x", "l.facebook.com", "social"],
		["https://t.co/abc", "t.co", "social"],
		["https://news.ycombinator.com/item?id=1", "news.ycombinator.com", "social"],
		["https://mail.google.com/mail/u/0/", "mail.google.com", "email"],
		["https://outlook.live.com/", "outlook.live.com", "email"],
		["https://blog.example.org/post", "blog.example.org", "other"],
	])("%s is %s, %s", (header, host, kind) => {
		expect(classifyReferrer(header)).toEqual({ host, kind });
	});

	test("keeps only the hostname", () => {
		expect(classifyReferrer("https://other.com/private/path?token=secret")).toEqual({
			host: "other.com",
			kind: "other",
		});
	});

	test("reads a same-host referrer as internal navigation", () => {
		expect(classifyReferrer("https://www.example.com/", { host: "example.com" })).toBeNull();
	});

	test.each([null, "", "not a url", "android-app://com.google.android.gm/"])(
		"%j is no referrer",
		(header) => {
			expect(classifyReferrer(header)).toBeNull();
		},
	);

	test("lets a caller add or override a host's kind", () => {
		expect(
			classifyReferrer("https://buttondown.com/", { referrers: { "buttondown.com": "email" } }),
		).toEqual({ host: "buttondown.com", kind: "email" });
		expect(classifyReferrer("https://x.com/", { referrers: { "x.com": "other" } })?.kind).toBe(
			"other",
		);
	});
});
