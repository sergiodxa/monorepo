/**
 * Tests for the adoption read: how deps.dev's counts become outside estimates, how a refresh
 * keeps what a failed read had, and how code search results collapse into repositories.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MemoryCache } from "@sdxc/cache/memory";
import { isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { AdoptionSnapshot } from "~/app/services/adoption";

import {
	ADOPTION_CACHE_KEY,
	collectionDependents,
	fetchRepositories,
	needsAdoptionRefresh,
	readAdoption,
	refreshAdoption,
} from "~/app/services/adoption";
import { listPackages } from "~/app/services/packages";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The moment every refresh in these tests is taken. */
const NOW = new Date("2026-10-31T04:00:00Z");

/** The package every in-repo dependent count below is checked against. */
const RESULT = "result";

/** deps.dev answering every package with `direct` dependents, or a 500 where it returns null. */
function depsDevHandlers(direct: (directory: string) => number | null) {
	return [
		http.get("https://api.deps.dev/v3alpha/systems/npm/packages/:name", ({ params }) => {
			let directory = String(params.name).replace("@sdxc/", "");
			if (direct(directory) === null) return new HttpResponse(null, { status: 500 });
			return HttpResponse.json({
				versions: [
					{ versionKey: { version: "2026.10.1" }, isDefault: false },
					{ versionKey: { version: "2026.10.30" }, isDefault: true },
				],
			});
		}),
		http.get(
			"https://api.deps.dev/v3alpha/systems/npm/packages/:name/versions/:version",
			({ params }) => {
				let directory = String(params.name).replace("@sdxc/", "");
				expect(params.version).toBe("2026.10.30:dependents");
				return HttpResponse.json({
					dependentCount: 0,
					directDependentCount: direct(directory) ?? 0,
					indirectDependentCount: 0,
				});
			},
		),
	];
}

/** One code search page with the given items. */
function searchHandler(items: unknown[]) {
	return http.get("https://api.github.com/search/code", ({ request }) => {
		expect(request.headers.get("authorization")).toBe("Bearer token");
		return HttpResponse.json({ total_count: items.length, items });
	});
}

/** A code search item for `path` in `repository`, quoting `fragment`. */
function item(repository: string, path: string, fragment: string) {
	return {
		path,
		repository: { full_name: repository, html_url: `https://github.com/${repository}` },
		text_matches: [{ fragment }],
	};
}

describe("collectionDependents", () => {
	test("counts the packages whose manifests depend on each one", () => {
		let counts = collectionDependents();
		let expected = listPackages().filter((entry) =>
			entry.internalDependencies.includes(RESULT),
		).length;
		expect(expected).toBeGreaterThan(0);
		expect(counts.get(RESULT)).toBe(expected);
	});
});

describe("needsAdoptionRefresh", () => {
	test("is due without a snapshot and after twenty hours", () => {
		let snapshot = (fetchedAt: string): AdoptionSnapshot => ({
			fetchedAt,
			packages: [],
			missing: [],
			repositories: [],
			repositoriesNote: null,
		});
		expect(needsAdoptionRefresh(null, NOW)).toBe(true);
		expect(needsAdoptionRefresh(snapshot("2026-10-30T12:00:00Z"), NOW)).toBe(false);
		expect(needsAdoptionRefresh(snapshot("2026-10-30T04:00:00Z"), NOW)).toBe(true);
	});
});

describe("fetchRepositories", () => {
	test("drops this repository, groups manifests by repository and names the packages", async () => {
		server.use(
			searchHandler([
				item("sergiodxa/monorepo", "package.json", '"@sdxc/result": "1"'),
				item("someone/app", "package.json", '"@sdxc/result": "1",\n"@sdxc/jwt": "1"'),
				item("someone/app", "apps/web/package.json", '"@sdxc/cache": "1"'),
				item("other/lib", "package.json", '"@sdxc/uuid": "1"'),
			]),
		);

		let result = await fetchRepositories("token");

		expect(isSuccess(result) && result.data).toEqual([
			{
				fullName: "someone/app",
				url: "https://github.com/someone/app",
				paths: ["apps/web/package.json", "package.json"],
				packages: ["@sdxc/cache", "@sdxc/jwt", "@sdxc/result"],
			},
			{
				fullName: "other/lib",
				url: "https://github.com/other/lib",
				paths: ["package.json"],
				packages: ["@sdxc/uuid"],
			},
		]);
	});
});

describe("refreshAdoption", () => {
	test("estimates outside dependents and stores the repositories", async () => {
		let cache = new MemoryCache();
		let inCollection = collectionDependents().get(RESULT) ?? 0;
		server.use(
			...depsDevHandlers((directory) => (directory === RESULT ? inCollection + 5 : 1)),
			searchHandler([item("someone/app", "package.json", '"@sdxc/result": "1"')]),
		);

		let snapshot = await refreshAdoption(cache, "token", NOW);

		expect(snapshot?.packages).toHaveLength(listPackages().length);
		expect(snapshot?.missing).toEqual([]);
		let result = snapshot?.packages.find((entry) => entry.directory === RESULT);
		expect(result).toMatchObject({
			version: "2026.10.30",
			directDependents: inCollection + 5,
			collectionDependents: inCollection,
			outsideDependents: 5,
		});
		expect(snapshot?.repositories.map((repository) => repository.fullName)).toEqual([
			"someone/app",
		]);
		expect(snapshot?.repositoriesNote).toBeNull();
		expect(await readAdoption(cache)).toEqual(snapshot);
	});

	test("floors the estimate at zero", async () => {
		server.use(...depsDevHandlers(() => 0));

		let snapshot = await refreshAdoption(new MemoryCache(), undefined, NOW);

		expect(snapshot?.packages.every((entry) => entry.outsideDependents === 0)).toBe(true);
	});

	test("keeps a failed package's previous counts and skips the search without a token", async () => {
		let cache = new MemoryCache();
		let previous: AdoptionSnapshot = {
			fetchedAt: "2026-10-29T04:00:00Z",
			packages: [
				{
					directory: RESULT,
					name: "@sdxc/result",
					version: "2026.10.1",
					directDependents: 40,
					collectionDependents: 30,
					outsideDependents: 10,
				},
			],
			missing: [],
			repositories: [],
			repositoriesNote: null,
		};
		await cache.write(ADOPTION_CACHE_KEY, previous, { ttl: "1 day" });
		server.use(...depsDevHandlers((directory) => (directory === RESULT ? null : 1)));

		let snapshot = await refreshAdoption(cache, undefined, NOW);

		expect(snapshot?.packages.find((entry) => entry.directory === RESULT)).toEqual(
			previous.packages[0],
		);
		expect(snapshot?.missing).toEqual([]);
		expect(snapshot?.repositories).toEqual([]);
		expect(snapshot?.repositoriesNote).toBe("no-token");
	});

	test("lists a package deps.dev never answered for as missing", async () => {
		server.use(...depsDevHandlers((directory) => (directory === RESULT ? null : 1)));

		let snapshot = await refreshAdoption(new MemoryCache(), undefined, NOW);

		expect(snapshot?.missing).toEqual([RESULT]);
	});

	test("keeps the previous repositories when the search fails", async () => {
		let cache = new MemoryCache();
		let repository = {
			fullName: "someone/app",
			url: "https://github.com/someone/app",
			paths: ["package.json"],
			packages: [],
		};
		await cache.write(
			ADOPTION_CACHE_KEY,
			{
				fetchedAt: "2026-10-29T04:00:00Z",
				packages: [],
				missing: [],
				repositories: [repository],
				repositoriesNote: null,
			} satisfies AdoptionSnapshot,
			{ ttl: "1 day" },
		);
		server.use(
			...depsDevHandlers(() => 1),
			http.get("https://api.github.com/search/code", () => new HttpResponse(null, { status: 403 })),
		);

		let snapshot = await refreshAdoption(cache, "token", NOW);

		expect(snapshot?.repositories).toEqual([repository]);
		expect(snapshot?.repositoriesNote).toBe("failed");
	});

	test("stores nothing when no source answers", async () => {
		let cache = new MemoryCache();
		server.use(...depsDevHandlers(() => null));

		expect(await refreshAdoption(cache, undefined, NOW)).toBeNull();
		expect(await readAdoption(cache)).toBeNull();
	});
});
