/**
 * Regression tests for the day-and-page-stable sidebar ad picker: same inputs
 * always yield the same tile, and a different day or path moves the draw.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { SIDEBAR_ADS } from "~/resources/content/ads";

import { adsDayTag, pickSidebarAd } from "./ads";

describe("adsDayTag", () => {
	test("names the UTC calendar day", () => {
		expect(adsDayTag(new Date("2026-10-21T23:30:00Z"))).toBe("2026-10-21");
		expect(adsDayTag(new Date("2026-10-22T00:00:00Z"))).toBe("2026-10-22");
	});
});

describe("pickSidebarAd", () => {
	test("is stable for the same day and path", () => {
		let now = new Date("2026-10-21T12:00:00Z");
		let first = pickSidebarAd("/docs/getting-started/build-an-app", now);
		let second = pickSidebarAd("/docs/getting-started/build-an-app", now);

		expect(second).toEqual(first);
		expect(SIDEBAR_ADS).toContainEqual(first.ad);
		expect(["above", "below"]).toContain(first.placement);
	});

	test("can differ across pages on the same day", () => {
		let now = new Date("2026-10-21T12:00:00Z");
		let a = pickSidebarAd("/docs/a", now);
		let b = pickSidebarAd("/docs/b", now);
		let c = pickSidebarAd("/api/result", now);

		let keys = new Set([
			`${a.ad.id}:${a.placement}`,
			`${b.ad.id}:${b.placement}`,
			`${c.ad.id}:${c.placement}`,
		]);
		expect(keys.size).toBeGreaterThan(1);
	});

	test("rotates when the UTC day changes on the same path", () => {
		let path = "/docs/getting-started/build-an-app";
		let monday = pickSidebarAd(path, new Date("2026-10-21T12:00:00Z"));
		let tuesday = pickSidebarAd(path, new Date("2026-10-22T12:00:00Z"));

		expect(`${tuesday.ad.id}:${tuesday.placement}`).not.toBe(`${monday.ad.id}:${monday.placement}`);
	});

	test("prices the indie-hackers landing at the live base fee", () => {
		let indie = SIDEBAR_ADS.find((ad) => ad.id === "ld-indie-hackers");
		expect(indie?.title).toBe("$5/mo");
	});

	test("includes every comparison landing", () => {
		let comparisons = SIDEBAR_ADS.filter((ad) => ad.id.startsWith("ld-vs-"));
		expect(comparisons.map((ad) => ad.id).sort()).toEqual(
			[
				"ld-vs-better-uptime",
				"ld-vs-checkly",
				"ld-vs-cronitor",
				"ld-vs-datadog",
				"ld-vs-healthchecks",
				"ld-vs-ohdear",
				"ld-vs-pingdom",
				"ld-vs-site24x7",
				"ld-vs-statuscake",
				"ld-vs-uptimerobot",
			].sort(),
		);
	});
});
