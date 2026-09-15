/**
 * Tests `POST /feeds/:feedId/refresh`: the guard on it, the feed it asks the reader's own
 * store to check, and the value each outcome travels back to the feed page under. The
 * controller renders nothing, so every assertion here is about the redirect.
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

let { default: refresh } = await import("./refresh");

/** The subscription every test below asks to check. */
const FEED_ID = "01J0FEED0000000000000000A1";

/** Where a check returns the reader to, before the outcome is appended to it. */
const FEED_PATH = routes.feed.href({ feed: FEED_ID });

/**
 * Posts the check-now form for {@link FEED_ID} as `viewer`.
 *
 * @param viewer - Who the request is signed in as, or `null` for an anonymous one.
 */
function postRefresh(viewer: typeof VIEWER | null) {
	let router = createTestRouter(viewer);
	router.map(routes.feeds.refresh, refresh);
	return fetchRoute(router, routes.feeds.refresh.href({ feedId: FEED_ID }), {});
}

beforeEach(() => {
	store = createUserStoreDouble();
	userStore.mockClear();
});

describe("POST /feeds/:feedId/refresh", () => {
	test("redirects an anonymous visitor home", async () => {
		let response = await postRefresh(null);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.home.href());
		expect(store.checkFeedNow).not.toHaveBeenCalled();
	});

	test("checks the feed the URL names, in the signed-in reader's own store", async () => {
		await postRefresh(VIEWER);

		expect(userStore).toHaveBeenCalledWith(VIEWER.id);
		expect(store.checkFeedNow).toHaveBeenCalledWith(FEED_ID);
	});

	test("reports posts the reader had not seen", async () => {
		store.checkFeedNow.mockResolvedValue({ ok: true, inserted: 3, updated: 0 });

		let response = await postRefresh(VIEWER);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${FEED_PATH}?checked=new`);
	});

	test("reports a check that brought nothing new", async () => {
		store.checkFeedNow.mockResolvedValue({ ok: true, inserted: 0, updated: 0 });

		let response = await postRefresh(VIEWER);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${FEED_PATH}?checked=none`);
	});

	test("counts a revised post as nothing new, since the reader may have read it", async () => {
		store.checkFeedNow.mockResolvedValue({ ok: true, inserted: 0, updated: 2 });

		let response = await postRefresh(VIEWER);

		expect(response.headers.get("location")).toBe(`${FEED_PATH}?checked=none`);
	});

	test("reports a check the origin did not answer", async () => {
		store.checkFeedNow.mockResolvedValue({ ok: false, reason: "check-failed" });

		let response = await postRefresh(VIEWER);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${FEED_PATH}?checked=failed`);
	});

	test("tells a feed this reader does not follow apart from a check that failed", async () => {
		store.checkFeedNow.mockResolvedValue({ ok: false, reason: "not-following" });

		let response = await postRefresh(VIEWER);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${FEED_PATH}?checked=missing`);
	});
});
