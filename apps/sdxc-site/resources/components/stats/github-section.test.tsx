/**
 * Tests for the GitHub section's server output: the note while nothing is stored, the
 * figures and tables from a snapshot, and the one line that stands in for refused traffic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import type { GitHubStatsSnapshot } from "~/app/services/github-stats";

import GitHubSection, {
	starHistory,
	trafficSeries,
} from "~/resources/components/stats/github-section";

/** A snapshot with stars, one open issue from someone else, and readable traffic. */
function snapshot(): GitHubStatsSnapshot {
	return {
		fetchedAt: "2026-10-31T04:00:00Z",
		stars: [
			{ day: "2026-07-23", count: 2 },
			{ day: "2026-10-30", count: 1 },
		],
		issues: {
			total: 1,
			items: [
				{
					number: 34,
					title: "Support for something",
					url: "https://github.com/sergiodxa/monorepo/issues/34",
					author: "someone",
					createdAt: "2026-10-25T10:00:00Z",
				},
			],
		},
		pulls: { total: 0, items: [] },
		trafficReadable: true,
		traffic: {
			views: [{ day: "2026-10-30", count: 20, uniques: 6 }],
			clones: [{ day: "2026-10-29", count: 4, uniques: 2 }],
			views14: { count: 291, uniques: 59 },
			clones14: { count: 4, uniques: 2 },
			referrers: [{ name: "sergiodxa.com", title: null, count: 4, uniques: 4 }],
			paths: [{ name: "/sergiodxa/monorepo", title: "Overview", count: 42, uniques: 19 }],
		},
	};
}

describe("GitHubSection", () => {
	test("says GitHub is being read while nothing is stored", async () => {
		let html = await renderToString(<GitHubSection snapshot={null} />);
		expect(html).toContain("Reading GitHub; this fills in after the next visit.");
	});

	test("renders the figures, referrers, paths and open work", async () => {
		let html = await renderToString(<GitHubSection snapshot={snapshot()} />);
		expect(html).toContain("291");
		expect(html).toContain("sergiodxa.com");
		expect(html).toContain("/sergiodxa/monorepo");
		expect(html).toContain("Support for something");
		expect(html).not.toContain("Administration read access");
	});

	test("replaces the traffic with one line when the token cannot read it", async () => {
		let html = await renderToString(
			<GitHubSection snapshot={{ ...snapshot(), trafficReadable: false }} />,
		);
		expect(html).toContain("Administration read access");
		expect(html).not.toContain("Referrer");
	});
});

describe("starHistory", () => {
	test("carries the running total across days nobody starred", () => {
		let { days, totals } = starHistory(
			[
				{ day: "2026-10-01", count: 2 },
				{ day: "2026-10-03", count: 1 },
			],
			"2026-10-04",
		);
		expect(days).toEqual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
		expect(totals).toEqual([2, 2, 3, 3]);
	});
});

describe("trafficSeries", () => {
	test("lines views and clones up on every day, zero where GitHub reported nothing", () => {
		let series = trafficSeries(
			[{ day: "2026-10-02", count: 5, uniques: 2 }],
			[{ day: "2026-10-01", count: 1, uniques: 1 }],
		);
		expect(series.days).toEqual(["2026-10-01", "2026-10-02"]);
		expect(series.views.map((entry) => entry.count)).toEqual([0, 5]);
		expect(series.clones.map((entry) => entry.count)).toEqual([1, 0]);
	});
});
