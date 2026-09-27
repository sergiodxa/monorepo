/**
 * Tests for the team logo rule: only an absolute https URL reaches an `<img>`, so a
 * legacy row holding free text or an http URL renders the initials fallback.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { isHttpsUrl, teamLogoUrl } from "./team-logo";

describe("isHttpsUrl", () => {
	test("accepts an https URL", () => {
		expect(isHttpsUrl("https://example.com/logo.png")).toBe(true);
	});

	test.each([
		"",
		"acme-logo",
		"/logo.png",
		"http://example.com/logo.png",
		"https:example.com/logo.png",
		"ftp://example.com/logo.png",
		"javascript:alert(1)",
	])("rejects %j", (value) => {
		expect(isHttpsUrl(value)).toBe(false);
	});
});

describe("teamLogoUrl", () => {
	test("returns a stored https URL as-is", () => {
		expect(teamLogoUrl("https://example.com/logo.png")).toBe("https://example.com/logo.png");
	});

	test("returns null for a legacy logo that is not a URL", () => {
		expect(teamLogoUrl("acme-logo")).toBeNull();
	});

	test("returns null for a legacy http logo, so it renders the initials", () => {
		expect(teamLogoUrl("http://example.com/logo.png")).toBeNull();
	});

	test("returns null without a logo", () => {
		expect(teamLogoUrl(null)).toBeNull();
	});
});
