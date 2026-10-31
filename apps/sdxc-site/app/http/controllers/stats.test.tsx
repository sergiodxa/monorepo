/**
 * Tests the npm stats page through the real router over a stored snapshot: it stays out of
 * search engines, draws the collection or one package, orders the table by the column a
 * link names, and reads npm itself only when nothing is stored.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MemoryCache } from "@sdxc/cache/memory";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { NpmStatsSnapshot, PackageStats } from "~/app/services/npm-stats";

/** The cache the page reads the snapshot from, replaced per test. */
let cache = new MemoryCache();

vi.doMock("~/app/initializers/cache", () => ({ siteCache: () => cache }));

let { fetchApp } = await import("~/app/test/router");
let { NPM_STATS_CACHE_KEY, daysBetween, historyWindow } = await import("~/app/services/npm-stats");

/**
 * npm, answering every request as an unpublished package, for the refresh a page starts in
 * the background while the stored snapshot holds fewer packages than are published.
 */
let server = setupServer(
	http.get("*", () => HttpResponse.json({ error: "not found" }, { status: 404 })),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
	cache = new MemoryCache();
});

/** The last day npm has counts for, which every stored package has been read through. */
const YESTERDAY = historyWindow(new Date()).end;

/** The days every stored series covers. */
const DAYS = daysBetween("2026-10-01", YESTERDAY);

/** A package downloaded `perDay` times every day. */
function stats(directory: string, perDay: number): PackageStats {
	return {
		name: `@sdxc/${directory}`,
		directory,
		daily: DAYS.map(() => perDay),
		createdAt: "2026-09-04T04:47:18.960Z",
		latest: "2026.10.13",
		latestPublishedAt: "2026-10-13T04:54:42.255Z",
		versions: 4,
		unpackedSize: 42108,
		versionDownloads: { "2026.10.13": 30, "2026.9.4": 10 },
		through: YESTERDAY,
	};
}

/** Stores a snapshot taken just now, holding `packages`. */
async function store(packages: PackageStats[]) {
	let snapshot: NpmStatsSnapshot = { fetchedAt: new Date().toISOString(), days: DAYS, packages };
	await cache.write(NPM_STATS_CACHE_KEY, snapshot);
}

describe("GET /stats", () => {
	test("is kept out of search engines and shared caches", async () => {
		await store([stats("result", 3)]);

		let response = await fetchApp("/stats");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
		expect(response.headers.get("Cache-Control")).toContain("private");
		expect(body).toContain('<meta name="robots" content="noindex, nofollow"');
	});

	test("totals the collection and lists every package", async () => {
		await store([stats("result", 3), stats("cache", 1)]);

		let body = await (await fetchApp("/stats")).text();

		expect(body).toContain("npm downloads");
		expect(body).toContain("120");
		expect(body).toContain('href="/stats?package=result"');
		expect(body).toContain('href="/stats?package=cache"');
		expect(body).toContain("2 of 2");
	});

	test("orders the table by the column a link names", async () => {
		await store([stats("cache", 1), stats("zip", 9)]);

		let byWeek = await (await fetchApp("/stats")).text();
		let byName = await (await fetchApp("/stats?sort=name")).text();

		expect(byWeek.indexOf("package=zip")).toBeLessThan(byWeek.indexOf("package=cache"));
		expect(byName.indexOf("package=cache")).toBeLessThan(byName.indexOf("package=zip"));
	});

	test("draws one package with its versions when the address names it", async () => {
		await store([stats("result", 3), stats("cache", 1)]);

		let body = await (await fetchApp("/stats?package=result&range=30")).text();

		expect(body).toContain("@sdxc/result downloads — sdxc");
		expect(body).toContain("Downloads by version, last week");
		expect(body).toContain("75%");
		expect(body).toContain('href="/stats?range=30"');
	});

	test("falls back to the defaults for values it does not know", async () => {
		await store([stats("result", 3)]);

		let response = await fetchApp("/stats?range=forever&sort=nope&package=missing");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("npm downloads — sdxc");
		expect(body).toContain('aria-current="page"');
	});

	test("reads npm before answering when nothing is stored", async () => {
		let requests = 0;
		server.use(
			http.get("*", () => {
				requests++;
				return HttpResponse.json({ error: "not found" }, { status: 404 });
			}),
		);

		let response = await fetchApp("/stats");

		expect(response.status).toBe(200);
		expect(requests).toBeGreaterThan(0);
		expect(await cache.read(NPM_STATS_CACHE_KEY)).toMatchObject({ status: "success" });
	});
});
