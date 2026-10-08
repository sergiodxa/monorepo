/**
 * Tests `GET /settings/export.zip`: the guard on it, the headers that make the answer a saved
 * file, and the three documents inside — the subscriptions as OPML, the kept posts as CSV, and
 * both as JSON — read back through the readers each format targets.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parse as parseCsv } from "@sdxc/csv";
import { parse as parseOpml } from "@sdxc/opml";
import { unwrap } from "@sdxc/result";
import { unzipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { UserStore } from "~/database/user-do";

import { createTestRouter, fetchRoute, VIEWER } from "~/app/lib/test/controller";
import { createUserStoreDouble } from "~/app/lib/test/store";
import routes from "~/routes/web";

let store = createUserStoreDouble();

/** Answers with whatever the current test set up, so `beforeEach` can hand out a fresh one. */
let userStore = vi.fn(() => store);

vi.doMock("~/database/user-do", () => ({ userStore }));

let { default: dataExport } = await import("./data-export");

/** The moment every export below is taken at, so names and dates are the same each run. */
const EXPORTED_AT = new Date(Date.UTC(2026, 0, 15, 12));

/** One subscription, filed in a folder. */
const FEEDS: UserStore.FeedExport[] = [
	{
		title: "Example Blog",
		feedUrl: "https://example.com/feed.xml",
		siteUrl: "https://example.com",
		folder: "Writing",
	},
];

/** Two kept posts: one labelled and from a feed, one bare with a formula-like title. */
const SAVED: UserStore.SavedExport[] = [
	{
		title: "Async Rust, Explained",
		url: "https://example.com/async-rust",
		author: "Ana",
		feed: { title: "Example Blog", feedUrl: "https://example.com/feed.xml" },
		publishedAt: Date.UTC(2026, 0, 2),
		savedAt: Date.UTC(2026, 0, 10),
		tags: ["async", "rust"],
	},
	{
		title: "=HYPERLINK(1)",
		url: null,
		author: null,
		feed: null,
		publishedAt: Date.UTC(2026, 0, 1),
		savedAt: Date.UTC(2026, 0, 3),
		tags: [],
	},
];

/**
 * Requests the export as `viewer`.
 *
 * @param viewer - Who the request is signed in as, or `null` for an anonymous one.
 */
function getExport(viewer: typeof VIEWER | null) {
	let router = createTestRouter(viewer);
	router.map(routes.dataExport, dataExport);
	return fetchRoute(router, routes.dataExport.href());
}

/** The archive's files by name, as text. */
async function files(response: Response): Promise<Record<string, string>> {
	let decoder = new TextDecoder();
	let entries = unzipSync(new Uint8Array(await response.arrayBuffer()));
	return Object.fromEntries(
		Object.entries(entries).map(([name, bytes]) => [name, decoder.decode(bytes)]),
	);
}

beforeEach(() => {
	store = createUserStoreDouble();
	store.exportFeeds.mockResolvedValue(FEEDS);
	store.exportSaved.mockResolvedValue(SAVED);
	userStore.mockClear();
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(EXPORTED_AT);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("GET /settings/export.zip", () => {
	test("redirects an anonymous visitor home", async () => {
		let response = await getExport(null);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.home.href());
		expect(store.exportSaved).not.toHaveBeenCalled();
	});

	test("answers the signed-in reader's own library as a dated ZIP no cache keeps", async () => {
		let response = await getExport(VIEWER);

		expect(userStore).toHaveBeenCalledWith(VIEWER.id);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/zip");
		expect(response.headers.get("content-disposition")).toBe(
			'attachment; filename="reader-export-2026-01-15.zip"',
		);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(Object.keys(await files(response))).toEqual([
			"subscriptions.opml",
			"saved-posts.csv",
			"reader-data.json",
		]);
	});

	test("carries the subscriptions as the same filed OPML the OPML download writes", async () => {
		let { "subscriptions.opml": opml = "" } = await files(await getExport(VIEWER));

		expect(unwrap(parseOpml(opml))).toEqual([
			{
				title: "Example Blog",
				feedUrl: "https://example.com/feed.xml",
				siteUrl: "https://example.com",
				folder: "Writing",
			},
		]);
		expect(opml).toContain("<title>Reader subscriptions</title>");
	});

	test("writes the kept posts as CSV, labels in one cell and formulas as text", async () => {
		let { "saved-posts.csv": csv = "" } = await files(await getExport(VIEWER));

		expect(unwrap(parseCsv(csv)).rows).toEqual([
			{
				url: "https://example.com/async-rust",
				title: "Async Rust, Explained",
				feed: "Example Blog",
				author: "Ana",
				published_at: "2026-01-02T00:00:00.000Z",
				saved_at: "2026-01-10T00:00:00.000Z",
				tags: "async,rust",
			},
			{
				url: "",
				title: "'=HYPERLINK(1)",
				feed: "",
				author: "",
				published_at: "2026-01-01T00:00:00.000Z",
				saved_at: "2026-01-03T00:00:00.000Z",
				tags: "",
			},
		]);
	});

	test("writes everything as versioned JSON with ISO dates", async () => {
		let { "reader-data.json": json = "{}" } = await files(await getExport(VIEWER));

		expect(JSON.parse(json)).toEqual({
			version: 1,
			exportedAt: "2026-01-15T12:00:00.000Z",
			subscriptions: FEEDS,
			saved: [
				{
					...SAVED[0],
					publishedAt: "2026-01-02T00:00:00.000Z",
					savedAt: "2026-01-10T00:00:00.000Z",
				},
				{
					...SAVED[1],
					publishedAt: "2026-01-01T00:00:00.000Z",
					savedAt: "2026-01-03T00:00:00.000Z",
				},
			],
		});
	});

	test("gives a reader with nothing the same three files with nothing in them", async () => {
		store.exportFeeds.mockResolvedValue([]);
		store.exportSaved.mockResolvedValue([]);

		let contents = await files(await getExport(VIEWER));

		expect(unwrap(parseOpml(contents["subscriptions.opml"] ?? ""))).toEqual([]);
		expect(contents["saved-posts.csv"]).toBe(
			"url,title,feed,author,published_at,saved_at,tags\r\n",
		);
		expect(JSON.parse(contents["reader-data.json"] ?? "{}")).toMatchObject({ saved: [] });
	});
});
