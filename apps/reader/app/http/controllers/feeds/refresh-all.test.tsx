/**
 * Tests `POST /feeds/refresh`: the guard on it, the sweep it asks the reader's own store
 * for, the counts each outcome travels back to the reading queue under, and the narrowing
 * the queue it was pressed from is handed back. The controller renders nothing, so every
 * assertion here is about the redirect.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test, vi } from "vitest";

import { createTestRouter, fetchRoute, ORIGIN, VIEWER } from "~/app/lib/test/controller";
import { createUserStoreDouble } from "~/app/lib/test/store";
import routes from "~/routes/web";

let store = createUserStoreDouble();

/** Answers with whatever the current test set up, so `beforeEach` can hand out a fresh one. */
let userStore = vi.fn(() => store);

vi.doMock("~/database/user-do", () => ({ userStore }));

let { default: refreshAll } = await import("./refresh-all");

/** Where a sweep returns the reader to, before the counts are appended to it. */
const QUEUE_PATH = routes.reading.href();

/**
 * Posts the check-every-feed form as `viewer`.
 *
 * @param viewer - Who the request is signed in as, or `null` for an anonymous one.
 * @param fields - The narrowing the queue was reading under, which the form carries.
 */
function postRefreshAll(viewer: typeof VIEWER | null, fields: Record<string, string> = {}) {
	let router = createTestRouter(viewer);
	router.map(routes.feeds.refreshAll, refreshAll);
	return fetchRoute(router, routes.feeds.refreshAll.href(), fields);
}

beforeEach(() => {
	store = createUserStoreDouble();
	userStore.mockClear();
});

describe("POST /feeds/refresh", () => {
	test("sends an anonymous visitor home", async () => {
		let response = await postRefreshAll(null);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.home.href());
		expect(store.checkAllFeedsNow).not.toHaveBeenCalled();
	});

	test("sweeps the signed-in reader's own store", async () => {
		await postRefreshAll(VIEWER);

		expect(userStore).toHaveBeenCalledWith(VIEWER.id);
		expect(store.checkAllFeedsNow).toHaveBeenCalledWith();
	});

	test("reports the feeds it reached and the ones that had new posts", async () => {
		store.checkAllFeedsNow.mockResolvedValue({
			checked: 12,
			withNewPosts: 3,
			inserted: 47,
			failed: 0,
		});

		let response = await postRefreshAll(VIEWER);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${QUEUE_PATH}?swept=12&fresh=3&failed=0`);
	});

	test("reports a sweep that brought nothing new", async () => {
		store.checkAllFeedsNow.mockResolvedValue({
			checked: 12,
			withNewPosts: 0,
			inserted: 0,
			failed: 0,
		});

		let response = await postRefreshAll(VIEWER);

		expect(response.headers.get("location")).toBe(`${QUEUE_PATH}?swept=12&fresh=0&failed=0`);
	});

	test("reports the feeds it could not reach alongside the ones it did", async () => {
		store.checkAllFeedsNow.mockResolvedValue({
			checked: 9,
			withNewPosts: 2,
			inserted: 5,
			failed: 3,
		});

		let response = await postRefreshAll(VIEWER);

		expect(response.headers.get("location")).toBe(`${QUEUE_PATH}?swept=9&fresh=2&failed=3`);
	});

	test("reports a reader who follows nothing yet", async () => {
		let response = await postRefreshAll(VIEWER);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${QUEUE_PATH}?swept=0&fresh=0&failed=0`);
	});

	test("returns the reader to the queue as they had narrowed it", async () => {
		store.checkAllFeedsNow.mockResolvedValue({
			checked: 2,
			withNewPosts: 1,
			inserted: 4,
			failed: 0,
		});

		let response = await postRefreshAll(VIEWER, { q: "remix", show: "unread" });

		expect(response.headers.get("location")).toBe(
			`${QUEUE_PATH}?q=remix&show=unread&swept=2&fresh=1&failed=0`,
		);
	});

	test("reads a narrowing nobody wrote as the whole queue", async () => {
		let response = await postRefreshAll(VIEWER, { show: "everything" });

		expect(response.headers.get("location")).toBe(`${QUEUE_PATH}?swept=0&fresh=0&failed=0`);
	});

	test("leaves the posts it brought in out of the queue's URL", async () => {
		store.checkAllFeedsNow.mockResolvedValue({
			checked: 4,
			withNewPosts: 1,
			inserted: 31,
			failed: 0,
		});

		let response = await postRefreshAll(VIEWER);
		let query = new URL(response.headers.get("location") ?? "", ORIGIN).searchParams;

		expect([...query.keys()]).toEqual(["swept", "fresh", "failed"]);
	});
});
