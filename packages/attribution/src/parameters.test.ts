/**
 * Tests for the tracking-parameter list: which names count, and that stripping them leaves every
 * other parameter exactly as the publisher wrote it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { CAMPAIGN_PARAMETERS, isTrackingParameter, withoutTracking } from "./parameters.js";

/** The stripped URL as text. */
function strip(url: string): string {
	return withoutTracking(new URL(url)).toString();
}

describe(isTrackingParameter, () => {
	test.each(["utm_source", "UTM_Campaign", "utm_referral", "gclid", "FBCLID", "sccid", "_hsenc"])(
		"%s is a tracking parameter",
		(name) => {
			expect(isTrackingParameter(name)).toBe(true);
		},
	);

	test.each(["p", "q", "page", "ref", "utm", "source"])("%s is not", (name) => {
		expect(isTrackingParameter(name)).toBe(false);
	});

	test("lists the nine campaign parameters", () => {
		expect(Object.values(CAMPAIGN_PARAMETERS)).toHaveLength(9);
	});
});

describe(withoutTracking, () => {
	test("removes campaign parameters and click identifiers", () => {
		expect(
			strip("https://example.com/post?utm_source=feed&utm_medium=rss&fbclid=abc&gclid=def&p=123"),
		).toBe("https://example.com/post?p=123");
	});

	test("leaves an address without a query string untouched", () => {
		expect(strip("https://example.com/post")).toBe("https://example.com/post");
	});

	test("drops the question mark when nothing remains", () => {
		expect(strip("https://example.com/post?utm_source=x")).toBe("https://example.com/post");
	});

	test("keeps the order and encoding of every other parameter", () => {
		expect(strip("https://example.com/s?b=2&utm_id=1&a=%20x+y&c")).toBe(
			"https://example.com/s?b=2&a=%20x+y&c",
		);
	});

	test("folds names before matching", () => {
		expect(strip("https://example.com/?UTM_SOURCE=x&MsClkId=y&keep=1")).toBe(
			"https://example.com/?keep=1",
		);
	});

	test("matches a percent-encoded name", () => {
		expect(strip("https://example.com/?utm%5Fsource=x&keep=1")).toBe("https://example.com/?keep=1");
	});

	test("keeps the fragment", () => {
		expect(strip("https://example.com/a?fbclid=1#top")).toBe("https://example.com/a#top");
	});

	test("answers a new URL and leaves the argument alone", () => {
		let url = new URL("https://example.com/?gclid=1");
		withoutTracking(url);
		expect(url.search).toBe("?gclid=1");
	});
});
