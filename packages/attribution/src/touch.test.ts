/**
 * Tests for `readTouch`: the normalization every stored value goes through, the values it refuses
 * to keep, and the channel each combination of campaign, click and referrer is credited to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { ReadTouchOptions } from "./touch.js";

import { normalizeValue, readTouch } from "./touch.js";

const NOW = Date.parse("2026-10-01T09:12:44Z");

/** The touch for a URL, at a fixed instant, with no referrer unless one is given. */
function read(url: string, options: Partial<ReadTouchOptions> = {}) {
	return readTouch(new URL(url), { referrer: null, now: NOW, ...options });
}

describe(normalizeValue, () => {
	test("lowercases and joins words with a dash", () => {
		expect(normalizeValue("  Launch   Week ")).toBe("launch-week");
	});

	test("strips anything that is not a slug character", () => {
		expect(normalizeValue("<script>")).toBe("script");
		expect(normalizeValue("a'b\"c;d")).toBe("abcd");
		expect(normalizeValue("my.campaign_1-x+y")).toBe("my.campaign_1-x+y");
	});

	test("cuts a long value at 64 characters", () => {
		expect(normalizeValue("a".repeat(500))).toHaveLength(64);
	});

	test("drops an address or a URL whole", () => {
		expect(normalizeValue("jane@example.com")).toBeUndefined();
		expect(normalizeValue("https://someone.example/private")).toBeUndefined();
	});

	test("reads a value that normalizes to nothing as absent", () => {
		expect(normalizeValue("")).toBeUndefined();
		expect(normalizeValue("   ")).toBeUndefined();
		expect(normalizeValue("!!!")).toBeUndefined();
	});
});

describe(readTouch, () => {
	test("reads a campaign link", () => {
		expect(
			read(
				"https://example.com/pricing?utm_source=Newsletter&utm_medium=email&utm_campaign=Launch%20Week",
			),
		).toEqual({
			at: NOW,
			landingPath: "/pricing",
			utm: { source: "newsletter", medium: "email", campaign: "launch-week" },
			click: null,
			referrer: null,
			channel: "email",
		});
	});

	test("reads all nine campaign fields under camelCase names", () => {
		let touch = read(
			"https://example.com/?utm_source=a&utm_medium=b&utm_campaign=c&utm_term=d&utm_content=e&utm_id=f&utm_source_platform=g&utm_creative_format=h&utm_marketing_tactic=i",
		);
		expect(touch.utm).toEqual({
			source: "a",
			medium: "b",
			campaign: "c",
			term: "d",
			content: "e",
			id: "f",
			sourcePlatform: "g",
			creativeFormat: "h",
			marketingTactic: "i",
		});
	});

	test("keeps the path and drops the query string", () => {
		let touch = read("https://example.com/try?url=https://someones-private-staging.example");
		expect(touch.landingPath).toBe("/try");
		expect(JSON.stringify(touch)).not.toContain("private-staging");
	});

	test("caps the landing path", () => {
		expect(read(`https://example.com/${"a".repeat(1000)}`).landingPath).toHaveLength(256);
	});

	test("drops a merge tag that put an address in a campaign field", () => {
		let touch = read("https://example.com/?utm_source=newsletter&utm_campaign=jane%40example.com");
		expect(touch.utm).toEqual({ source: "newsletter" });
	});

	test("reads ref as the source by default, after utm_source", () => {
		expect(read("https://example.com/?ref=outreach").utm).toEqual({ source: "outreach" });
		expect(read("https://example.com/?ref=b&utm_source=a").utm).toEqual({ source: "a" });
	});

	test("reads the aliases a caller names, in order", () => {
		let aliases = { source: ["ref", "source"], campaign: ["campaign"] };
		expect(read("https://example.com/?source=x&campaign=Agencies", { aliases }).utm).toEqual({
			source: "x",
			campaign: "agencies",
		});
	});

	test("matches parameter names case-insensitively", () => {
		expect(read("https://example.com/?UTM_Source=x").utm).toEqual({ source: "x" });
	});

	test("records the network a click identifier names, without its value", () => {
		let touch = read("https://example.com/?gclid=Cj0KCQ", { referrer: "https://www.google.com/" });
		expect(touch.click).toEqual({ param: "gclid", network: "google-ads", paid: true });
		expect(touch.referrer).toEqual({ host: "google.com", kind: "search" });
		expect(touch.channel).toBe("paid-search");
	});

	test("keeps the click identifier's value on request, capped", () => {
		let touch = read(`https://example.com/?gclid=${"x".repeat(300)}`, { clickIds: "keep" });
		expect(touch.click?.value).toHaveLength(256);
	});

	test("never reads an email platform's subscriber identifier", () => {
		let touch = read("https://example.com/?mc_eid=abc123&_hsenc=p2ANqtz", { clickIds: "keep" });
		expect(touch.click).toBeNull();
		expect(JSON.stringify(touch)).not.toContain("abc123");
		expect(touch.channel).toBe("email");
	});

	test("reads a same-host referrer as internal navigation", () => {
		let touch = read("https://example.com/docs", { referrer: "https://example.com/" });
		expect(touch).toMatchObject({ utm: null, click: null, referrer: null, channel: "direct" });
	});

	test("defaults the stamp to the clock", () => {
		let before = Date.now();
		let touch = readTouch(new URL("https://example.com/"), { referrer: null });
		expect(touch.at).toBeGreaterThanOrEqual(before);
	});
});

describe("channels", () => {
	test.each([
		["?utm_medium=cpc", null, "paid-search"],
		["?msclkid=1", null, "paid-search"],
		["?utm_medium=paid-social&fbclid=1", null, "paid-social"],
		["?ttclid=1", null, "paid-social"],
		["?utm_medium=display", null, "display"],
		["?dclid=1", null, "display"],
		["?utm_medium=Newsletter", null, "email"],
		["?mc_cid=1", null, "email"],
		["", "https://mail.google.com/", "email"],
		["?utm_medium=affiliate", null, "affiliate"],
		["?utm_medium=social", null, "organic-social"],
		["?fbclid=1", null, "organic-social"],
		["", "https://t.co/x", "organic-social"],
		["?utm_medium=organic", null, "organic-search"],
		["", "https://www.bing.com/", "organic-search"],
		["?utm_medium=referral", null, "referral"],
		["", "https://blog.example.org/", "referral"],
		["?utm_source=partner", null, "other"],
		["", null, "direct"],
	])("%s from %s is %s", (search, referrer, channel) => {
		expect(read(`https://example.com/${search}`, { referrer }).channel).toBe(channel);
	});

	test("credits the first matching rule", () => {
		expect(read("https://example.com/?utm_medium=email&gclid=1").channel).toBe("paid-search");
	});
});
