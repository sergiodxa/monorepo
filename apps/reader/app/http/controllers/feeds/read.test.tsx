/**
 * Tests `POST /feeds/:feedId/read`: the guard on it, the feed id it parses out of the
 * path and hands the reader's own store, and the count each outcome travels back to the
 * feed page under. The controller renders nothing, so every assertion is about the
 * redirect.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test, vi } from "vitest";

import { createTestRouter, fetchRoute, VIEWER } from "~/app/lib/test/controller";
import { createUserStoreDouble } from "~/app/lib/test/store";
import routes from "~/routes/web";

let store = createUserStoreDouble();

/** Answers with whatever the current test set up, so `beforeEach` can hand out a fresh one. */
let userStore = vi.fn(() => store);

vi.doMock("~/database/user-do", () => ({ userStore }));

let { default: read } = await import("./read");

/** The subscription every test below clears. */
const FEED_ID = "01J0FEED0000000000000000A1";

/** Where clearing a feed returns the reader to, before the count is appended to it. */
const FEED_PATH = routes.feed.href({ feed: FEED_ID });

/**
 * Posts the mark-feed-read form for {@link FEED_ID} as `viewer`.
 *
 * @param viewer - Who the request is signed in as, or `null` for an anonymous one.
 */
function postRead(viewer: typeof VIEWER | null) {
	let router = createTestRouter(viewer);
	router.map(routes.feeds.read, read);
	return fetchRoute(router, routes.feeds.read.href({ feedId: FEED_ID }), {});
}

beforeEach(() => {
	store = createUserStoreDouble();
	userStore.mockClear();
});

describe("POST /feeds/:feedId/read", () => {
	test("sends an anonymous visitor home", async () => {
		let response = await postRead(null);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.home.href());
		expect(store.markFeedRead).not.toHaveBeenCalled();
	});

	test("clears the feed the URL names, in the signed-in reader's own store", async () => {
		await postRead(VIEWER);

		expect(userStore).toHaveBeenCalledWith(VIEWER.id);
		expect(store.markFeedRead).toHaveBeenCalledWith(FEED_ID);
	});

	test("reports how many posts it took out of the queue", async () => {
		store.markFeedRead.mockResolvedValue(12);

		let response = await postRead(VIEWER);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${FEED_PATH}?marked=12`);
	});

	test("reports a single post apart from several", async () => {
		store.markFeedRead.mockResolvedValue(1);

		let response = await postRead(VIEWER);

		expect(response.headers.get("location")).toBe(`${FEED_PATH}?marked=1`);
	});

	test("reports a feed that had nothing unread left", async () => {
		store.markFeedRead.mockResolvedValue(0);

		let response = await postRead(VIEWER);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${FEED_PATH}?marked=0`);
	});
});
