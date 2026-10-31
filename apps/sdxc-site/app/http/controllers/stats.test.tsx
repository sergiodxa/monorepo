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

		expect(body).toContain("Usage stats");
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

		expect(body).toContain("@sdxc/result stats — sdxc");
		expect(body).toContain("Downloads by version, last week");
		expect(body).toContain("75%");
		expect(body).toContain('href="/stats?range=30"');
	});

	test("falls back to the defaults for values it does not know", async () => {
		await store([stats("result", 3)]);

		let response = await fetchApp("/stats?range=forever&sort=nope&package=missing");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("Usage stats — sdxc");
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

describe("GET /stats.json", () => {
	test("reports every snapshot and each package's figures, out of search engines", async () => {
		await store([stats("result", 2)]);

		let response = await fetchApp("/stats.json");
		let body: unknown = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain("application/json");
		expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
		expect(body).toMatchObject({
			npm: {
				collection: { last7: 14 },
				packages: [{ last7: 14, latestShare: 0.75, stats: { directory: "result" } }],
			},
		});
		expect(body).toHaveProperty("adoption");
		expect(body).toHaveProperty("github");
		expect(body).toHaveProperty("events");
	});
});

describe("GET /stats.md", () => {
	test("reports the collection and each package as markdown", async () => {
		await store([stats("result", 2)]);

		let response = await fetchApp("/stats.md");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain("text/markdown");
		expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
		expect(body).toContain("# sdxc stats");
		expect(body).toContain("- Last 7 days: 14");
		expect(body).toContain("| @sdxc/result | 14 |");
	});
});

describe("GET /stats with another extension", () => {
	test("answers 404 rather than the page", async () => {
		await store([stats("result", 2)]);

		expect((await fetchApp("/stats.xml")).status).toBe(404);
	});
});

describe("GET /stats.md sections", () => {
	test("reports stored adoption and marks unread sections as pending", async () => {
		let { ADOPTION_CACHE_KEY } = await import("~/app/services/adoption");
		await store([stats("result", 2)]);
		await cache.write(ADOPTION_CACHE_KEY, {
			fetchedAt: new Date().toISOString(),
			packages: [
				{
					directory: "result",
					name: "@sdxc/result",
					version: "2026.10.13",
					directDependents: 12,
					collectionDependents: 9,
					outsideDependents: 3,
				},
			],
			missing: [],
			repositories: [
				{
					fullName: "ada/app",
					url: "https://github.com/ada/app",
					paths: ["package.json"],
					packages: ["@sdxc/result"],
				},
			],
			repositoriesNote: null,
		});

		let body = await (await fetchApp("/stats.md")).text();

		expect(body).toContain("## Adoption");
		expect(body).toContain("| @sdxc/result | 3 | 12 | 9 |");
		expect(body).toContain("- [ada/app](https://github.com/ada/app): @sdxc/result");
		expect(body).toContain("## GitHub\n\nNot read yet");
		expect(body).toContain("## Searches and MCP calls\n\nNothing recorded");
	});
});

describe("GET /stats.md searches", () => {
	test("totals searches from the recorded queries, without the older per-surface counter", async () => {
		let { SITE_EVENTS_KEY_PREFIX } = await import("~/app/services/site-events");
		await store([stats("result", 2)]);
		await cache.write(`${SITE_EVENTS_KEY_PREFIX}${new Date().toISOString().slice(0, 10)}`, {
			searches: { page: 4, dialog: 3 },
			hits: { opml: { count: 1, surfaces: ["page"] } },
			misses: { "1')": { count: 2, surfaces: ["page"] } },
			tools: {},
			packages: {},
		});

		let body = await (await fetchApp("/stats.md")).text();

		expect(body).toContain("- Searches: 1\n");
		expect(body).not.toContain("page 4");
		expect(body).toContain("- Left out as injection probes or junk: 2");
	});
});
