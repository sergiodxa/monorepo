/**
 * Tests for the npm stats read: what one package's three npm answers become, how a refresh
 * keeps a package npm failed for, and the growth arithmetic the page shows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MemoryCache } from "@sdxc/cache/memory";
import { isFailure, isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { NpmStatsSnapshot, PackageStats } from "~/app/services/npm-stats";

import {
	appendUpgrade,
	collectionDaily,
	collectionJsdelivr,
	cumulative,
	currentPackages,
	daysBetween,
	fetchPackageStats,
	growth,
	historyWindow,
	median,
	needsRefresh,
	NPM_STATS_CACHE_KEY,
	readNpmStats,
	refreshNpmStats,
	rollingAverage,
	sizeGrowth,
	sizeHistory,
	summarizePackage,
	windowSum,
} from "~/app/services/npm-stats";
import { listPackages } from "~/app/services/packages";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The three npm endpoints and jsDelivr, answering for every package with `downloads` per day. */
function npmHandlers(perDay: (directory: string, day: string) => number, hitsPerDay = 0) {
	return [
		http.get("https://data.jsdelivr.com/v1/stats/packages/npm/@sdxc/:directory", () =>
			HttpResponse.json({
				hits: {
					rank: null,
					total: hitsPerDay * 365,
					dates: Object.fromEntries(
						daysBetween("2025-10-30", "2026-10-29").map((day) => [day, hitsPerDay]),
					),
				},
			}),
		),
		http.get("https://api.npmjs.org/downloads/range/:range/@sdxc/:directory", ({ params }) => {
			let [start, end] = String(params.range).split(":");
			let directory = String(params.directory);
			return HttpResponse.json({
				downloads: daysBetween(start ?? "", end ?? "").map((day) => ({
					day,
					downloads: perDay(directory, day),
				})),
			});
		}),
		http.get("https://registry.npmjs.org/:name", () =>
			HttpResponse.json({
				time: {
					created: "2026-09-04T04:47:18.960Z",
					"2026.9.4": "2026-09-04T04:47:18.960Z",
					"2026.10.13": "2026-10-13T04:54:42.255Z",
				},
				"dist-tags": { latest: "2026.10.13" },
				versions: {
					"2026.9.4": { dist: { unpackedSize: 40000 } },
					"2026.10.13": { dist: { unpackedSize: 42108 } },
				},
			}),
		),
		http.get("https://api.npmjs.org/versions/:name/last-week", () =>
			HttpResponse.json({ downloads: { "2026.10.13": 75, "2026.9.4": 25 } }),
		),
	];
}

/** The moment every refresh in these tests is taken, which makes yesterday 2026-10-30. */
const NOW = new Date("2026-10-31T04:00:00Z");

/** A package's stored history, with every other field filled in plainly. */
function stats(directory: string, daily: number[], through = "2026-10-29"): PackageStats {
	return {
		name: `@sdxc/${directory}`,
		directory,
		daily,
		createdAt: null,
		latest: "2026.10.13",
		latestPublishedAt: null,
		versions: 1,
		unpackedSize: null,
		versionDownloads: { "2026.10.13": 3, "2026.9.4": 1 },
		through,
	};
}

describe("daysBetween", () => {
	test("lists every day inclusively, across a month boundary", () => {
		expect(daysBetween("2026-09-29", "2026-10-02")).toEqual([
			"2026-09-29",
			"2026-09-30",
			"2026-10-01",
			"2026-10-02",
		]);
	});

	test("is empty when the end comes first", () => {
		expect(daysBetween("2026-10-02", "2026-10-01")).toEqual([]);
	});
});

describe("historyWindow", () => {
	test("ends yesterday, the last day npm has published", () => {
		expect(historyWindow(new Date("2026-10-31T12:00:00Z"))).toEqual({
			start: "2026-09-01",
			end: "2026-10-30",
		});
	});

	test("starts no earlier than npm's longest range", () => {
		let window = historyWindow(new Date("2028-10-31T12:00:00Z"));
		expect(daysBetween(window.start, window.end).length).toBeLessThanOrEqual(541);
	});
});

describe("fetchPackageStats", () => {
	test("aligns downloads with the days and reads the registry facts", async () => {
		server.use(...npmHandlers((_, day) => (day === "2026-10-02" ? 7 : 0), 2));

		let result = await fetchPackageStats("result", ["2026-10-01", "2026-10-02"]);

		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;
		expect(result.data).toEqual({
			name: "@sdxc/result",
			directory: "result",
			daily: [0, 7],
			createdAt: "2026-09-04T04:47:18.960Z",
			latest: "2026.10.13",
			latestPublishedAt: "2026-10-13T04:54:42.255Z",
			versions: 2,
			unpackedSize: 42108,
			versionDownloads: { "2026.10.13": 75, "2026.9.4": 25 },
			through: "2026-10-02",
			jsdelivr: [2, 2],
			sizes: [
				{ version: "2026.9.4", publishedAt: "2026-09-04", unpackedSize: 40000 },
				{ version: "2026.10.13", publishedAt: "2026-10-13", unpackedSize: 42108 },
			],
			upgrades: [{ day: "2026-10-02", latest: "2026.10.13", share: 0.75 }],
		});
	});

	test("reads the package when jsDelivr fails, keeping the hits it stored before", async () => {
		server.use(
			http.get("https://data.jsdelivr.com/*", () => new HttpResponse(null, { status: 500 })),
			...npmHandlers(() => 1),
		);
		let previous = { ...stats("result", [0, 0]), jsdelivr: [4, 6] };

		let result = await fetchPackageStats("result", ["2026-10-01", "2026-10-02"], 1, previous);

		expect(isSuccess(result) && result.data.daily).toEqual([1, 1]);
		expect(isSuccess(result) && result.data.jsdelivr).toEqual([4, 6]);
	});

	test("carries the upgrade history forward and replaces a same-day point", async () => {
		server.use(...npmHandlers(() => 1));
		let previous = {
			...stats("result", [0]),
			upgrades: [
				{ day: "2026-09-30", latest: "2026.9.4", share: 0.2 },
				{ day: "2026-10-01", latest: "2026.9.4", share: 0.3 },
			],
		};

		let result = await fetchPackageStats("result", ["2026-10-01"], 1, previous);

		expect(isSuccess(result) && result.data.upgrades).toEqual([
			{ day: "2026-09-30", latest: "2026.9.4", share: 0.2 },
			{ day: "2026-10-01", latest: "2026.10.13", share: 0.75 },
		]);
	});

	test("reads an unpublished package as zeros rather than a failure", async () => {
		server.use(http.get("*", () => HttpResponse.json({ error: "not found" }, { status: 404 })));

		let result = await fetchPackageStats("fresh", ["2026-10-01"]);

		expect(isSuccess(result) && result.data).toMatchObject({
			daily: [0],
			latest: null,
			versions: 0,
			jsdelivr: [0],
			sizes: [],
			upgrades: [],
		});
	});

	test("fails when npm answers with an error", async () => {
		server.use(http.get("*", () => new HttpResponse(null, { status: 503 })));

		expect(isFailure(await fetchPackageStats("result", ["2026-10-01"]))).toBe(true);
	});
});

describe("refreshNpmStats", () => {
	test("reads every package and stores the snapshot where the page reads it", async () => {
		server.use(...npmHandlers(() => 2));
		let cache = new MemoryCache();

		let outcome = await refreshNpmStats(cache, { now: NOW });
		let stored = await readNpmStats(cache);

		expect(outcome).toMatchObject({ failed: 0, remaining: 0, rateLimited: false });
		expect(outcome.read).toBe(listPackages().length);
		expect(stored?.packages).toHaveLength(listPackages().length);
		expect(stored?.days.at(-1)).toBe("2026-10-30");
		expect(stored && needsRefresh(stored, NOW)).toBe(false);
		expect(await cache.read(NPM_STATS_CACHE_KEY)).toMatchObject({ status: "success" });
	});

	test("keeps a package's stored history when npm fails for it", async () => {
		server.use(
			http.get("https://api.npmjs.org/downloads/range/:range/@sdxc/result", () =>
				HttpResponse.json({ error: "broken" }, { status: 503 }),
			),
			...npmHandlers(() => 1),
		);
		let cache = new MemoryCache();
		let days = daysBetween("2026-09-01", "2026-10-29");
		await cache.write(NPM_STATS_CACHE_KEY, {
			fetchedAt: "2026-10-30T04:00:00.000Z",
			days,
			packages: [
				stats(
					"result",
					days.map(() => 5),
				),
			],
		});

		let outcome = await refreshNpmStats(cache, { now: NOW });
		let kept = outcome.snapshot.packages.find((entry) => entry.directory === "result");

		expect(outcome).toMatchObject({ failed: 1, remaining: 1 });
		expect(kept?.daily.at(-2)).toBe(5);
		expect(kept?.daily.at(-1)).toBe(0);
		expect(kept?.through).toBe("2026-10-29");
	});

	test("upgrades a snapshot stored before jsDelivr, sizes and upgrades were read", async () => {
		server.use(...npmHandlers(() => 1, 3));
		let cache = new MemoryCache();
		let days = daysBetween("2026-09-01", "2026-10-29");
		await cache.write(NPM_STATS_CACHE_KEY, {
			fetchedAt: "2026-10-30T04:00:00.000Z",
			days,
			packages: [
				stats(
					"result",
					days.map(() => 5),
				),
			],
		});

		let outcome = await refreshNpmStats(cache, { now: NOW });
		let result = outcome.snapshot.packages.find((entry) => entry.directory === "result");

		expect(result?.jsdelivr?.at(-2)).toBe(3);
		expect(result?.sizes).toHaveLength(2);
		expect(result?.upgrades).toEqual([{ day: "2026-10-30", latest: "2026.10.13", share: 0.75 }]);
	});

	test("stops when npm rate-limits it and resumes where it stopped", async () => {
		let limited = true;
		server.use(
			http.get("https://api.npmjs.org/*", ({ request }) =>
				limited && !request.url.includes("activitypub")
					? HttpResponse.json({ error: "slow down" }, { status: 429 })
					: undefined,
			),
			...npmHandlers(() => 3),
		);
		let cache = new MemoryCache();

		let first = await refreshNpmStats(cache, { now: NOW, retryDelay: 1 });
		limited = false;
		let second = await refreshNpmStats(cache, { now: NOW, retryDelay: 1 });

		expect(first).toMatchObject({ read: 1, rateLimited: true });
		expect(first.remaining).toBe(listPackages().length - 1);
		expect(second).toMatchObject({ rateLimited: false, remaining: 0 });
		expect(second.read).toBe(listPackages().length - 1);
	});

	test("starts no package once its budget is spent", async () => {
		server.use(...npmHandlers(() => 1));
		let cache = new MemoryCache();

		let outcome = await refreshNpmStats(cache, { now: NOW, budget: -1 });

		expect(outcome.read).toBe(0);
		expect(outcome.remaining).toBe(listPackages().length);
	});
});

describe("currentPackages", () => {
	test("counts the packages read through yesterday", () => {
		let snapshot: NpmStatsSnapshot = {
			fetchedAt: "",
			days: [],
			packages: [stats("a", [], "2026-10-30"), stats("b", [], "2026-10-29")],
		};
		expect(currentPackages(snapshot, NOW)).toBe(1);
		expect(needsRefresh(snapshot, NOW)).toBe(true);
	});
});

describe("sizeHistory", () => {
	test("collapses unchanged sizes but keeps the first and the latest release", () => {
		let time = {
			created: "2026-09-01T00:00:00Z",
			"1.0.0": "2026-09-01T00:00:00Z",
			"1.0.1": "2026-09-02T00:00:00Z",
			"1.1.0": "2026-09-03T00:00:00Z",
			"1.1.1": "2026-09-04T00:00:00Z",
		};
		let versions = {
			"1.1.1": { dist: { unpackedSize: 200 } },
			"1.0.0": { dist: { unpackedSize: 100 } },
			"1.0.1": { dist: { unpackedSize: 100 } },
			"1.1.0": { dist: { unpackedSize: 200 } },
			"0.0.0-unpublished": {},
		};

		let sizes = sizeHistory(time, versions);

		expect(sizes.map((point) => point.version)).toEqual(["1.0.0", "1.1.0", "1.1.1"]);
		expect(sizes[0]?.publishedAt).toBe("2026-09-01");
		expect(sizeGrowth(sizes)).toBe(1);
		expect(sizeGrowth(sizes.slice(0, 1))).toBeNull();
	});
});

describe("appendUpgrade", () => {
	test("keeps half a year of points", () => {
		let history = daysBetween("2026-01-01", "2026-06-30").map((day) => ({
			day,
			latest: "1",
			share: 0.5,
		}));

		let next = appendUpgrade(history, { day: "2026-07-01", latest: "2", share: 0.1 });

		expect(next).toHaveLength(180);
		expect(next.at(-1)).toEqual({ day: "2026-07-01", latest: "2", share: 0.1 });
		expect(appendUpgrade(history, null)).toBe(history);
	});
});

describe("summaries", () => {
	test("compares the last week with the one before", () => {
		let daily = [...Array.from({ length: 7 }, () => 2), ...Array.from({ length: 7 }, () => 3)];
		let summary = summarizePackage(stats("result", daily));

		expect(summary).toMatchObject({ last7: 21, previous7: 14, total: 35, growth7: 0.5 });
		expect(summary.latestShare).toBe(0.75);
		expect(summary).toMatchObject({ jsdelivr30: 0, jsdelivrTotal: 0 });
	});

	test("totals jsDelivr hits for a package and the collection", () => {
		let snapshot: NpmStatsSnapshot = {
			fetchedAt: "",
			days: ["2026-10-01", "2026-10-02"],
			packages: [{ ...stats("a", [1, 2]), jsdelivr: [5, 1] }, stats("b", [3, 4])],
		};
		expect(collectionJsdelivr(snapshot)).toEqual([5, 1]);
		expect(summarizePackage(snapshot.packages[0] ?? stats("a", []))).toMatchObject({
			jsdelivr30: 6,
			jsdelivrTotal: 6,
		});
	});

	test("takes the median of an odd and an even count", () => {
		expect(median([0.9, 0.1, 0.5])).toBe(0.5);
		expect(median([1, 0, 0.5, 0.25])).toBe(0.375);
		expect(median([])).toBeNull();
	});

	test("reports no growth figure for a package new this week", () => {
		expect(growth(10, 0)).toBeNull();
		expect(summarizePackage(stats("fresh", [0, 0, 4])).growth7).toBeNull();
	});

	test("sums a window that reaches past the start", () => {
		expect(windowSum([1, 2, 3], 7)).toBe(6);
		expect(windowSum([1, 2, 3, 4], 2, 1)).toBe(5);
	});

	test("adds every package up per day", () => {
		let snapshot: NpmStatsSnapshot = {
			fetchedAt: "",
			days: ["2026-10-01", "2026-10-02"],
			packages: [stats("a", [1, 2]), stats("b", [3, 4])],
		};
		expect(collectionDaily(snapshot)).toEqual([4, 6]);
	});

	test("averages over the trailing week and totals as it goes", () => {
		expect(rollingAverage([7, 0, 0, 0, 0, 0, 0, 7], 7)).toEqual([
			7,
			3.5,
			7 / 3,
			1.75,
			1.4,
			7 / 6,
			1,
			1,
		]);
		expect(cumulative([1, 2, 3])).toEqual([1, 3, 6]);
	});
});
