/**
 * Tests for the changelog's two moving parts: the lifetime a cached copy is written
 * with, and what a reader gets when GitHub will not answer. Both are what keep this
 * page — the only one whose content is fetched — from being as available as the API
 * behind it, so both are asserted rather than reasoned about.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MemoryCache } from "@sdxc/cache/memory";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import {
	cacheTtlSeconds,
	MINIMUM_TTL_SECONDS,
	parseNotes,
	readChangelog,
} from "~/app/services/changelog";

/** What the page reads, as GitHub sends it. */
const ENDPOINT = "https://api.github.com/repos/sergiodxa/monorepo/releases";

/** A day in seconds, which is the longest a copy is ever written for. */
const DAY_SECONDS = 24 * 60 * 60;

/** One release, filled in with whatever a test cares about. */
function release(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		tag_name: "v2026.9.17",
		body: "## @sdxc/result\n- feat: something shipped\n",
		published_at: "2026-09-17T02:46:27Z",
		html_url: "https://github.com/sergiodxa/monorepo/releases/tag/v2026.9.17",
		draft: false,
		prerelease: false,
		...overrides,
	};
}

/** Answers the releases call with whatever a test hands it. */
function serving(payload: Record<string, unknown> | Record<string, unknown>[]) {
	return http.get(ENDPOINT, () => HttpResponse.json(payload));
}

const server = setupServer(serving([release()]));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("cacheTtlSeconds", () => {
	test("lives until the next midnight UTC", () => {
		expect(cacheTtlSeconds(new Date("2026-09-21T23:50:00Z"))).toBe(600);
		expect(cacheTtlSeconds(new Date("2026-09-21T00:05:00Z"))).toBe(DAY_SECONDS - 300);
		expect(cacheTtlSeconds(new Date("2026-09-21T12:00:00Z"))).toBe(DAY_SECONDS / 2);
	});

	test("takes the floor at exactly midnight, where the span is zero", () => {
		expect(cacheTtlSeconds(new Date("2026-09-21T00:00:00Z"))).toBe(MINIMUM_TTL_SECONDS);
	});

	test("takes the floor in the last minute, where the span is shorter than KV accepts", () => {
		expect(cacheTtlSeconds(new Date("2026-09-21T23:59:30Z"))).toBe(MINIMUM_TTL_SECONDS);
	});

	test("reads the boundary in UTC rather than wherever it runs", () => {
		/* 22:00 in Buenos Aires is 01:00 the next day in UTC, which is 23 hours out. */
		expect(cacheTtlSeconds(new Date("2026-09-22T01:00:00Z"))).toBe(23 * 60 * 60);
	});

	test("never asks KV for a lifetime it refuses", () => {
		for (let minute = 0; minute < 24 * 60; minute++) {
			let now = new Date(Date.UTC(2026, 8, 21) + minute * 60_000);
			expect(cacheTtlSeconds(now)).toBeGreaterThanOrEqual(MINIMUM_TTL_SECONDS);
			expect(cacheTtlSeconds(now)).toBeLessThanOrEqual(DAY_SECONDS);
		}
	});
});

describe("readChangelog", () => {
	test("lists the dated releases, newest first", async () => {
		server.use(
			serving([
				release({ tag_name: "v2026.9.11", published_at: "2026-09-11T02:00:00Z" }),
				release({ tag_name: "v2026.9.17", published_at: "2026-09-17T02:46:27Z" }),
			]),
		);

		let releases = await readChangelog(new MemoryCache());

		expect(releases.map((entry) => entry.version)).toEqual(["2026.9.17", "2026.9.11"]);
	});

	test("leaves out a draft, a prerelease and a tag that is not a date", async () => {
		server.use(
			serving([
				release({ tag_name: "v2026.9.16", draft: true }),
				release({ tag_name: "v2026.9.15", prerelease: true }),
				release({ tag_name: "v1.2.3-beta" }),
				release({ tag_name: "v2026.9.17" }),
			]),
		);

		let releases = await readChangelog(new MemoryCache());

		expect(releases.map((entry) => entry.version)).toEqual(["2026.9.17"]);
	});

	test("answers from the store while the copy is current", async () => {
		let calls = 0;
		server.use(
			http.get(ENDPOINT, () => {
				calls += 1;
				return HttpResponse.json([release()]);
			}),
		);

		let cache = new MemoryCache();
		await readChangelog(cache);
		await readChangelog(cache);

		expect(calls).toBe(1);
	});

	test("serves the stale copy when GitHub refuses the call", async () => {
		let clock = Date.parse("2026-09-21T12:00:00Z");
		let cache = new MemoryCache({ now: () => clock });

		let current = await readChangelog(cache);
		expect(current.map((entry) => entry.version)).toEqual(["2026.9.17"]);

		/* Past the next midnight, so the current copy is gone and a refresh is due. */
		clock += DAY_SECONDS * 1000;
		server.use(http.get(ENDPOINT, () => new HttpResponse(null, { status: 403 })));

		expect(await readChangelog(cache)).toEqual(current);
	});

	test("serves the stale copy when GitHub answers with something else entirely", async () => {
		let clock = Date.parse("2026-09-21T12:00:00Z");
		let cache = new MemoryCache({ now: () => clock });

		let current = await readChangelog(cache);

		clock += DAY_SECONDS * 1000;
		server.use(serving({ message: "Not Found" }));

		expect(await readChangelog(cache)).toEqual(current);
	});

	test("reports nothing rather than failing when there is no copy to fall back on", async () => {
		server.use(http.get(ENDPOINT, () => new HttpResponse(null, { status: 403 })));

		expect(await readChangelog(new MemoryCache())).toEqual([]);
	});
});

describe("parseNotes", () => {
	test("reads the notes as the markdown they are written in", () => {
		let document = parseNotes("## @sdxc/result\n- feat: something shipped\n");

		expect(document?.children.at(0)).toMatchObject({ type: "heading", level: 2 });
	});

	test("reports nothing for a release that carries no notes", () => {
		expect(parseNotes("")).toBeNull();
		expect(parseNotes("   \n")).toBeNull();
	});
});
