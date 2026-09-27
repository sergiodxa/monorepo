/**
 * Tests for the team logo rule: only an absolute http(s) URL reaches an `<img>`, so a
 * legacy row holding free text renders the initials fallback.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { isHttpUrl, teamLogoUrl } from "./team-logo";

describe("isHttpUrl", () => {
	test.each(["https://example.com/logo.png", "http://example.com/logo.png"])(
		"accepts %j",
		(value) => {
			expect(isHttpUrl(value)).toBe(true);
		},
	);

	test.each(["", "acme-logo", "/logo.png", "ftp://example.com/logo.png", "javascript:alert(1)"])(
		"rejects %j",
		(value) => {
			expect(isHttpUrl(value)).toBe(false);
		},
	);
});

describe("teamLogoUrl", () => {
	test("returns a stored http(s) URL as-is", () => {
		expect(teamLogoUrl("https://example.com/logo.png")).toBe("https://example.com/logo.png");
	});

	test("returns null for a legacy logo that is not a URL", () => {
		expect(teamLogoUrl("acme-logo")).toBeNull();
	});

	test("returns null without a logo", () => {
		expect(teamLogoUrl(null)).toBeNull();
	});
});
