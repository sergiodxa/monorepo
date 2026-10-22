/**
 * Tests for reading releases from GitHub and the weekly summary built on them, against a
 * GitHub answered by MSW in the REST API's shape: which releases fall in the window, how
 * pages are followed, and that a repository GitHub refuses fails the whole run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vite-plus/test";

import type { ApiRelease } from "~/app/test/github-releases";

import { listReleases } from "~/app/services/releases/github";
import { weeklyReleases } from "~/app/services/releases/weekly";
import {
	apiRelease,
	MONOREPO_MIXED_BODY,
	MONOREPO_SINGLE_BODY,
	PACKAGE_BODY,
} from "~/app/test/github-releases";

/** The credential the tests read with; the handlers check it arrives as a bearer token. */
const TOKEN = "token-for-tests";

/** The week the tests read, `2026-w42`, which a run on its closing Friday covers. */
const WINDOW = { from: new Date("2026-10-09T17:00:00Z"), to: new Date("2026-10-16T17:00:00Z") };

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * Answers `repository`'s release list with `pages`, one array per page, refusing any request
 * without the token. Each request records the page it asked for in `asked`.
 */
function releases(repository: string, pages: ApiRelease[][], asked: number[] = []) {
	return http.get(`https://api.github.com/repos/${repository}/releases`, ({ request }) => {
		if (request.headers.get("authorization") !== `Bearer ${TOKEN}`) {
			return new HttpResponse(null, { status: 401 });
		}

		let page = Number(new URL(request.url).searchParams.get("page") ?? "1");
		asked.push(page);
		return HttpResponse.json(pages[page - 1] ?? []);
	});
}

/** `count` releases published an hour apart, newest first, ending at `newest`. */
function hourly(repository: string, newest: Date, count: number): ApiRelease[] {
	return Array.from({ length: count }, (_, index) => {
		let publishedAt = new Date(newest.getTime() - index * 3_600_000);
		return apiRelease(repository, `v${index}`, publishedAt.toISOString());
	});
}

describe("listReleases", () => {
	test("keeps the published, stable releases inside the window", async () => {
		let repository = "sergiodxa/monorepo";
		server.use(
			releases(repository, [
				[
					apiRelease(repository, "v2026.10.16", "2026-10-16T17:00:00Z"),
					apiRelease(repository, "draft", "2026-10-15T03:00:00Z", { draft: true }),
					apiRelease(repository, "unpublished", "", { draft: true, published_at: null }),
					apiRelease(repository, "v2026.10.15-rc", "2026-10-15T03:00:00Z", { prerelease: true }),
					apiRelease(repository, "v2026.10.14", "2026-10-14T03:40:33Z", {
						body: MONOREPO_MIXED_BODY,
					}),
					apiRelease(repository, "v2026.10.9", "2026-10-09T17:00:00Z", { body: null }),
					apiRelease(repository, "v2026.10.8", "2026-10-08T03:51:33Z"),
				],
			]),
		);

		let listed = unwrap(await listReleases(repository, WINDOW, TOKEN));

		expect(listed.map((release) => release.tag)).toEqual(["v2026.10.14", "v2026.10.9"]);
		expect(listed[0]).toEqual({
			repository,
			tag: "v2026.10.14",
			url: "https://github.com/sergiodxa/monorepo/releases/tag/v2026.10.14",
			publishedAt: new Date("2026-10-14T03:40:33Z"),
			body: MONOREPO_MIXED_BODY,
		});
		expect(listed[1]?.body).toBe("");
	});

	test("follows pages until one reaches past the window's start", async () => {
		let repository = "sergiodxa/monorepo";
		let asked: number[] = [];
		let all = hourly(repository, new Date("2026-10-16T16:00:00Z"), 250);
		server.use(
			releases(repository, [all.slice(0, 100), all.slice(100, 200), all.slice(200)], asked),
		);

		let listed = unwrap(await listReleases(repository, WINDOW, TOKEN));

		expect(listed).toHaveLength(168);
		expect(asked).toEqual([1, 2]);
	});

	test("stops at a short page", async () => {
		let repository = "sergiodxa/remix-auth";
		let asked: number[] = [];
		server.use(
			releases(repository, [[apiRelease(repository, "v4.2.1", "2026-10-12T00:00:00Z")]], asked),
		);

		expect(unwrap(await listReleases(repository, WINDOW, TOKEN))).toHaveLength(1);
		expect(asked).toEqual([1]);
	});

	test("fails when GitHub refuses the request", async () => {
		server.use(
			http.get("https://api.github.com/repos/sergiodxa/monorepo/releases", () => {
				return new HttpResponse(null, { status: 403 });
			}),
		);

		let listed = await listReleases("sergiodxa/monorepo", WINDOW, TOKEN);

		expect(isFailure(listed) && listed.error.message).toBe(
			"GitHub answered 403 listing sergiodxa/monorepo releases",
		);
	});

	test("fails when GitHub answers in an unexpected shape", async () => {
		server.use(
			http.get("https://api.github.com/repos/sergiodxa/monorepo/releases", () => {
				return HttpResponse.json({ message: "Not Found" });
			}),
		);

		expect(isFailure(await listReleases("sergiodxa/monorepo", WINDOW, TOKEN))).toBe(true);
	});
});

describe("weeklyReleases", () => {
	test("summarizes the packages every source released during the week", async () => {
		server.use(
			releases("sergiodxa/monorepo", [
				[
					apiRelease("sergiodxa/monorepo", "v2026.10.14", "2026-10-14T03:40:33Z", {
						body: MONOREPO_MIXED_BODY,
					}),
					apiRelease("sergiodxa/monorepo", "v2026.10.10", "2026-10-10T03:47:48Z", {
						body: MONOREPO_SINGLE_BODY,
					}),
					apiRelease("sergiodxa/monorepo", "v2026.10.8", "2026-10-08T03:51:33Z", {
						body: "## @sdxc/old\n- feat: last week\n",
					}),
				],
			]),
			releases("sergiodxa/remix-utils", [
				[
					apiRelease("sergiodxa/remix-utils", "v10.1.0", "2026-10-12T05:53:10Z", {
						body: PACKAGE_BODY,
					}),
				],
			]),
			releases("sergiodxa/remix-i18next", [[]]),
			releases("sergiodxa/remix-auth", [
				[apiRelease("sergiodxa/remix-auth", "v4.2.0", "2025-04-13T05:54:59Z")],
			]),
		);

		let summary = unwrap(await weeklyReleases(new Date("2026-10-16T17:02:00Z"), TOKEN));

		expect(summary).toEqual({
			slug: "2026-w42",
			packages: [
				{ name: "@sdxc/activitypub", url: "https://www.npmjs.com/package/@sdxc/activitypub" },
				{
					name: "@sdxc/cloudflare-mocks",
					url: "https://www.npmjs.com/package/@sdxc/cloudflare-mocks",
				},
				{ name: "@sdxc/spec", url: "https://www.npmjs.com/package/@sdxc/spec" },
				{ name: "remix-utils", url: "https://www.npmjs.com/package/remix-utils" },
			],
		});
	});

	test("answers null for a week whose releases only republished", async () => {
		server.use(
			releases("sergiodxa/monorepo", [
				[
					apiRelease("sergiodxa/monorepo", "v2026.10.14", "2026-10-14T03:40:33Z", {
						body: "## @sdxc/xml\nRepublished because `@sdxc/result` changed.\n\nCompare: https://github.com/sergiodxa/monorepo/compare/v2026.10.13...v2026.10.14\n",
					}),
				],
			]),
			releases("sergiodxa/remix-utils", [[]]),
			releases("sergiodxa/remix-i18next", [[]]),
			releases("sergiodxa/remix-auth", [[]]),
		);

		let summary = await weeklyReleases(new Date("2026-10-16T17:00:00Z"), TOKEN);

		expect(isSuccess(summary) && summary.data).toBeNull();
	});

	test("fails when any source cannot be read", async () => {
		server.use(
			releases("sergiodxa/monorepo", [[]]),
			releases("sergiodxa/remix-utils", [[]]),
			releases("sergiodxa/remix-i18next", [[]]),
			http.get("https://api.github.com/repos/sergiodxa/remix-auth/releases", () => {
				return new HttpResponse(null, { status: 502 });
			}),
		);

		let summary = await weeklyReleases(new Date("2026-10-16T17:00:00Z"), TOKEN);

		expect(isFailure(summary) && summary.error.message).toBe(
			"GitHub answered 502 listing sergiodxa/remix-auth releases",
		);
	});
});
