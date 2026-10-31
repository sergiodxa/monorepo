/**
 * Tests for the GitHub stats read: stars counted per day across pages, bots and the
 * maintainer left out of open work, the traffic history merged by day past GitHub's window,
 * and a token without traffic access or a failed run leaving the stored snapshot intact.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MemoryCache } from "@sdxc/cache/memory";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { GitHubStatsSnapshot, TrafficDay } from "~/app/services/github-stats";

import {
	GITHUB_STATS_CACHE_KEY,
	mergeTrafficDays,
	needsGitHubStatsRefresh,
	readGitHubStats,
	refreshGitHubStats,
	repositoryPath,
} from "~/app/services/github-stats";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The repository's API root every handler answers under. */
const REPO = "https://api.github.com/repos/sergiodxa/monorepo";

/** The moment every refresh in these tests is taken. */
const NOW = new Date("2026-10-31T04:00:00Z");

/** A day of traffic stamped the way GitHub stamps it. */
function point(day: string, count: number, uniques = 1) {
	return { timestamp: `${day}T00:00:00Z`, count, uniques };
}

/** One week in seconds, the step between star-history weeks. */
const WEEK_SECONDS = 7 * 24 * 60 * 60;

/**
 * A star-history week's start in Unix seconds.
 *
 * @param sunday The week's first day, as `YYYY-MM-DD`.
 */
function weekStart(sunday: string): number {
	return Date.parse(`${sunday}T00:00:00Z`) / 1000;
}

/** Star history, search and traffic handlers answering one plausible repository. */
function githubHandlers(options: { traffic?: number } = {}) {
	let trafficStatus = options.traffic ?? 200;
	let refuse = () =>
		HttpResponse.json({ message: "Must have push access" }, { status: trafficStatus });
	return [
		http.get(`${REPO}/stargazers/history`, ({ request }) => {
			let page = new URL(request.url).searchParams.get("page");
			if (page === "1") {
				return HttpResponse.json(
					Array.from({ length: 30 }, (_, index) => ({
						week: weekStart("2026-10-25") - index * WEEK_SECONDS,
						total: index === 0 ? 1 : 0,
						days: index === 0 ? [0, 0, 0, 0, 0, 1, 0] : [0, 0, 0, 0, 0, 0, 0],
					})),
				);
			}
			return HttpResponse.json([
				{ week: weekStart("2026-03-29"), total: 2, days: [0, 0, 0, 0, 2, 0, 0] },
			]);
		}),
		http.get(`${REPO}/traffic/views`, () =>
			trafficStatus === 200
				? HttpResponse.json({
						count: 30,
						uniques: 9,
						views: [point("2026-10-29", 10, 3), point("2026-10-30", 20, 6)],
					})
				: refuse(),
		),
		http.get(`${REPO}/traffic/clones`, () =>
			trafficStatus === 200
				? HttpResponse.json({ count: 4, uniques: 2, clones: [point("2026-10-30", 4, 2)] })
				: refuse(),
		),
		http.get(`${REPO}/traffic/popular/referrers`, () =>
			trafficStatus === 200
				? HttpResponse.json([{ referrer: "github.com", count: 9, uniques: 7 }])
				: refuse(),
		),
		http.get(`${REPO}/traffic/popular/paths`, () =>
			trafficStatus === 200
				? HttpResponse.json([
						{ path: "/sergiodxa/monorepo", title: "Overview", count: 42, uniques: 19 },
					])
				: refuse(),
		),
	];
}

/** A snapshot stored by an earlier run, holding traffic GitHub no longer reports. */
function storedSnapshot(): GitHubStatsSnapshot {
	return {
		fetchedAt: "2026-10-20T04:00:00Z",
		stars: [{ day: "2026-07-23", count: 1 }],
		trafficReadable: true,
		traffic: {
			views: [
				{ day: "2026-10-01", count: 7, uniques: 2 },
				{ day: "2026-10-29", count: 1, uniques: 1 },
			],
			clones: [{ day: "2026-10-01", count: 2, uniques: 1 }],
			views14: { count: 8, uniques: 3 },
			clones14: { count: 2, uniques: 1 },
			referrers: [{ name: "old.example", title: null, count: 1, uniques: 1 }],
			paths: [],
		},
	};
}

describe("mergeTrafficDays", () => {
	test("keeps every day either side holds, with the fresh read winning overlaps", () => {
		let stored: TrafficDay[] = [
			{ day: "2026-10-01", count: 7, uniques: 2 },
			{ day: "2026-10-02", count: 1, uniques: 1 },
		];
		let fresh: TrafficDay[] = [
			{ day: "2026-10-03", count: 4, uniques: 2 },
			{ day: "2026-10-02", count: 5, uniques: 3 },
		];

		expect(mergeTrafficDays(stored, fresh)).toEqual([
			{ day: "2026-10-01", count: 7, uniques: 2 },
			{ day: "2026-10-02", count: 5, uniques: 3 },
			{ day: "2026-10-03", count: 4, uniques: 2 },
		]);
	});
});

describe("needsGitHubStatsRefresh", () => {
	test("is due with nothing stored, or a snapshot older than twenty hours", () => {
		let snapshot = { ...storedSnapshot(), fetchedAt: "2026-10-30T10:00:00Z" };
		expect(needsGitHubStatsRefresh(null, NOW)).toBe(true);
		expect(needsGitHubStatsRefresh(snapshot, NOW)).toBe(false);
		expect(needsGitHubStatsRefresh(snapshot, new Date("2026-10-31T07:00:00Z"))).toBe(true);
	});
});

describe("repositoryPath", () => {
	test("reads a popular path from inside the repository", () => {
		expect(repositoryPath("/sergiodxa/monorepo")).toBe("/");
		expect(repositoryPath("/sergiodxa/monorepo/tree/main/apps")).toBe("/tree/main/apps");
		expect(repositoryPath("/sergiodxa/monorepo-other")).toBe("/sergiodxa/monorepo-other");
	});
});

describe("refreshGitHubStats", () => {
	test("counts stars per day across pages and reads traffic", async () => {
		server.use(...githubHandlers());
		let cache = new MemoryCache();

		let snapshot = await refreshGitHubStats(cache, "token", NOW);

		expect(snapshot?.stars).toEqual([
			{ day: "2026-04-02", count: 2 },
			{ day: "2026-10-30", count: 1 },
		]);
		expect(snapshot?.trafficReadable).toBe(true);
		expect(snapshot?.traffic?.views14).toEqual({ count: 30, uniques: 9 });
		expect(await readGitHubStats(cache)).toEqual(snapshot);
	});

	test("grows the traffic history past GitHub's window and keeps only the latest sources", async () => {
		server.use(...githubHandlers());
		let cache = new MemoryCache();
		await cache.write(GITHUB_STATS_CACHE_KEY, storedSnapshot());

		let snapshot = await refreshGitHubStats(cache, "token", NOW);

		expect(snapshot?.traffic?.views).toEqual([
			{ day: "2026-10-01", count: 7, uniques: 2 },
			{ day: "2026-10-29", count: 10, uniques: 3 },
			{ day: "2026-10-30", count: 20, uniques: 6 },
		]);
		expect(snapshot?.traffic?.clones.map((entry) => entry.day)).toEqual([
			"2026-10-01",
			"2026-10-30",
		]);
		expect(snapshot?.traffic?.referrers).toEqual([
			{ name: "github.com", title: null, count: 9, uniques: 7 },
		]);
	});

	test.each([403, 404])(
		"marks traffic unreadable on a %i and keeps the stored history",
		async (status) => {
			server.use(...githubHandlers({ traffic: status }));
			let cache = new MemoryCache();
			await cache.write(GITHUB_STATS_CACHE_KEY, storedSnapshot());

			let snapshot = await refreshGitHubStats(cache, "token", NOW);

			expect(snapshot?.trafficReadable).toBe(false);
			expect(snapshot?.traffic).toEqual(storedSnapshot().traffic);
			expect(snapshot?.stars).toHaveLength(2);
		},
	);

	test("treats a missing token as no traffic access", async () => {
		server.use(...githubHandlers().filter((_, index) => index < 1));
		let snapshot = await refreshGitHubStats(new MemoryCache(), undefined, NOW);

		expect(snapshot?.trafficReadable).toBe(false);
		expect(snapshot?.traffic).toBeNull();
	});

	test("keeps a failed part's previous value", async () => {
		server.use(
			http.get(`${REPO}/stargazers/history`, () => new HttpResponse(null, { status: 502 })),
			...githubHandlers().slice(1),
		);
		let cache = new MemoryCache();
		await cache.write(GITHUB_STATS_CACHE_KEY, storedSnapshot());

		let snapshot = await refreshGitHubStats(cache, "token", NOW);

		expect(snapshot?.stars).toEqual(storedSnapshot().stars);
		expect(snapshot?.fetchedAt).toBe(NOW.toISOString());
	});

	test("writes nothing when every part fails", async () => {
		server.use(http.get("https://api.github.com/*", () => new HttpResponse(null, { status: 500 })));
		let cache = new MemoryCache();
		await cache.write(GITHUB_STATS_CACHE_KEY, storedSnapshot());

		expect(await refreshGitHubStats(cache, "token", NOW)).toBeNull();
		expect(await readGitHubStats(cache)).toEqual(storedSnapshot());
	});
});
