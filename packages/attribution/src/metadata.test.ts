/**
 * Tests for the flatteners: the metadata keys a checkout carries and the `utm_*` fields a
 * provider stores, including the bounds billing providers put on a metadata bag.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { Touch } from "./types.js";

import { toCampaign, toMetadata, toUtmParams } from "./metadata.js";
import { readTouch } from "./touch.js";

const FIRST = readTouch(
	new URL(
		"https://example.com/pricing?utm_source=Newsletter&utm_medium=email&utm_campaign=Launch%20Week",
	),
	{ referrer: null, now: Date.parse("2026-10-01T09:12:44Z") },
);

const LAST = readTouch(new URL("https://example.com/?gclid=abc"), {
	referrer: "https://www.google.com/",
	now: Date.parse("2026-10-05T18:02:10Z"),
});

/** A touch with every field present at its longest. */
function fullTouch(): Touch {
	let long = "x".repeat(64);
	return {
		at: 0,
		landingPath: `/${"p".repeat(255)}`,
		utm: {
			source: long,
			medium: long,
			campaign: long,
			term: long,
			content: long,
			id: long,
			sourcePlatform: long,
			creativeFormat: long,
			marketingTactic: long,
		},
		click: { param: "li_fat_id", network: "linkedin-ads", paid: true, value: "v".repeat(256) },
		referrer: { host: "example.org", kind: "other" },
		channel: "paid-social",
	};
}

describe(toMetadata, () => {
	test("flattens the first and last touch under prefixed snake_case keys", () => {
		expect(toMetadata({ first: FIRST, last: LAST })).toEqual({
			first_channel: "email",
			first_source: "newsletter",
			first_medium: "email",
			first_campaign: "launch-week",
			first_landing: "/pricing",
			first_at: "2026-10-01T09:12:44.000Z",
			last_channel: "paid-search",
			last_click: "google-ads",
			last_referrer: "google.com",
			last_landing: "/",
			last_at: "2026-10-05T18:02:10.000Z",
		});
	});

	test("answers no keys for a visitor with no touches", () => {
		expect(toMetadata({ first: null, last: null })).toEqual({});
	});

	test("stays inside a billing provider's 50 keys of 500 characters", () => {
		let metadata = toMetadata({ first: fullTouch(), last: fullTouch() });
		expect(Object.keys(metadata)).toHaveLength(28);
		for (let value of Object.values(metadata)) expect(value.length).toBeLessThanOrEqual(500);
		for (let key of Object.keys(metadata)) expect(key.length).toBeLessThanOrEqual(40);
	});

	test("writes a kept click identifier as param=value", () => {
		let touch = readTouch(new URL("https://example.com/?gclid=abc"), {
			referrer: null,
			clickIds: "keep",
		});
		expect(toMetadata({ first: touch, last: null }).first_click).toBe("gclid=abc");
	});
});

describe(toUtmParams, () => {
	test("answers the utm_* wire names", () => {
		expect(toUtmParams(FIRST)).toEqual({
			utm_source: "newsletter",
			utm_medium: "email",
			utm_campaign: "launch-week",
		});
	});

	test("writes camelCase fields back under their wire names", () => {
		expect(toUtmParams(fullTouch())).toHaveProperty("utm_source_platform");
	});

	test("answers {} for no touch or a touch without a campaign", () => {
		expect(toUtmParams(null)).toEqual({});
		expect(toUtmParams(LAST)).toEqual({});
	});
});

describe(toCampaign, () => {
	test("answers undefined for no touch", () => {
		expect(toCampaign(null, "https://example.com")).toBeUndefined();
	});

	test("answers only the landing page for a touch with no campaign or referrer", () => {
		let touch = readTouch(new URL("https://example.com/docs"), { referrer: null });
		expect(toCampaign(touch, "https://example.com")).toEqual({
			landingPage: "https://example.com/docs",
		});
	});

	test("flattens a full touch and leaves out the newer utm fields", () => {
		let campaign = toCampaign(fullTouch(), new URL("https://example.com/somewhere?x=1"));
		let long = "x".repeat(64);
		expect(campaign).toEqual({
			source: long,
			medium: long,
			campaign: long,
			term: long,
			content: long,
			referrer: "example.org",
			landingPage: `https://example.com/${"p".repeat(255)}`,
		});
		expect(Object.keys(campaign ?? {})).not.toContain("id");
	});

	test("resolves the landing path against a URL or a string, without the query string", () => {
		expect(toCampaign(FIRST, new URL("https://example.com/other?a=1"))?.landingPage).toBe(
			"https://example.com/pricing",
		);
		expect(toCampaign(FIRST, "https://shop.example.com")?.landingPage).toBe(
			"https://shop.example.com/pricing",
		);
	});

	test("leaves absent fields out of the object", () => {
		let campaign = toCampaign(FIRST, "https://example.com");
		expect(campaign).toEqual({
			source: "newsletter",
			medium: "email",
			campaign: "launch-week",
			landingPage: "https://example.com/pricing",
		});
		expect("referrer" in (campaign ?? {})).toBe(false);
	});
});
