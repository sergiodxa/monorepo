/**
 * Tests `GET /feeds.opml`: the guard on it, the headers that make the answer a saved file
 * rather than a page, and the document a reader with subscriptions and a reader with none
 * each come away with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parse } from "@sdxc/opml";
import { isSuccess } from "@sdxc/result";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { UserStore } from "~/database/user-do";

import { createTestRouter, fetchRoute, VIEWER } from "~/app/lib/test/controller";
import { createUserStoreDouble } from "~/app/lib/test/store";
import routes from "~/routes/web";

let store = createUserStoreDouble();

/** Answers with whatever the current test set up, so `beforeEach` can hand out a fresh one. */
let userStore = vi.fn(() => store);

vi.doMock("~/database/user-do", () => ({ userStore }));

let { default: exportFeeds } = await import("./export");

/** The day every export below is taken on, so the filename it suggests is the same one twice. */
const EXPORTED_AT = new Date(Date.UTC(2026, 0, 15, 12));

/** What a reader with two subscriptions exports, one of them without a site of its own. */
const FEEDS: UserStore.FeedExport[] = [
	{
		title: "Example Blog",
		feedUrl: "https://example.com/feed.xml",
		siteUrl: "https://example.com",
	},
	{ title: "Another Blog", feedUrl: "https://another.example/feed.xml", siteUrl: null },
];

/**
 * Requests the export as `viewer`.
 *
 * @param viewer - Who the request is signed in as, or `null` for an anonymous one.
 */
function getExport(viewer: typeof VIEWER | null) {
	let router = createTestRouter(viewer);
	router.map(routes.feeds.export, exportFeeds);
	return fetchRoute(router, routes.feeds.export.href());
}

/** The subscriptions a response lists, read back through the reader every export targets. */
async function subscriptions(response: Response) {
	let parsed = parse(await response.text());
	if (!isSuccess(parsed)) throw new Error("the export is not an OPML document");
	return parsed.data;
}

beforeEach(() => {
	store = createUserStoreDouble();
	userStore.mockClear();
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(EXPORTED_AT);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("GET /feeds.opml", () => {
	test("redirects an anonymous visitor home", async () => {
		let response = await getExport(null);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.home.href());
		expect(store.exportFeeds).not.toHaveBeenCalled();
	});

	test("exports the signed-in reader's own subscriptions", async () => {
		await getExport(VIEWER);

		expect(userStore).toHaveBeenCalledWith(VIEWER.id);
		expect(store.exportFeeds).toHaveBeenCalled();
	});

	test("answers as OPML the browser saves under a dated name", async () => {
		store.exportFeeds.mockResolvedValue(FEEDS);

		let response = await getExport(VIEWER);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/x-opml; charset=utf-8");
		expect(response.headers.get("content-disposition")).toBe(
			'attachment; filename="reader-subscriptions-2026-01-15.opml"',
		);
	});

	test("keeps one reader's subscription list out of every cache", async () => {
		let response = await getExport(VIEWER);

		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});

	test("lists every followed feed, with the site behind it when there is one", async () => {
		store.exportFeeds.mockResolvedValue(FEEDS);

		let response = await getExport(VIEWER);

		await expect(subscriptions(response)).resolves.toEqual([
			{
				title: "Example Blog",
				feedUrl: "https://example.com/feed.xml",
				siteUrl: "https://example.com",
			},
			{ title: "Another Blog", feedUrl: "https://another.example/feed.xml" },
		]);
	});

	test("titles the document the way the app names the subscription list", async () => {
		store.exportFeeds.mockResolvedValue(FEEDS);

		let response = await getExport(VIEWER);

		expect(await response.text()).toContain("<title>Feeds</title>");
	});

	test("gives a reader who follows nothing a document listing nothing", async () => {
		store.exportFeeds.mockResolvedValue([]);

		let response = await getExport(VIEWER);

		expect(response.status).toBe(200);
		await expect(subscriptions(response)).resolves.toEqual([]);
	});
});
