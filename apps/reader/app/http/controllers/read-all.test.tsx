/**
 * Tests `POST /reading/read`: the guard on it, the store it empties, and the count each
 * outcome travels back to the queue under. The controller renders nothing, so every
 * assertion here is about the redirect.
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

let { default: readAll } = await import("./read-all");

/** Where emptying the queue returns the reader to, before the count is appended to it. */
const READING_PATH = routes.reading.href();

/**
 * Posts the mark-everything-read form as `viewer`.
 *
 * @param viewer - Who the request is signed in as, or `null` for an anonymous one.
 */
function postReadAll(viewer: typeof VIEWER | null) {
	let router = createTestRouter(viewer);
	router.map(routes.readAll, readAll);
	return fetchRoute(router, routes.readAll.href(), {});
}

beforeEach(() => {
	store = createUserStoreDouble();
	userStore.mockClear();
});

describe("POST /reading/read", () => {
	test("sends an anonymous visitor home", async () => {
		let response = await postReadAll(null);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.home.href());
		expect(store.markAllRead).not.toHaveBeenCalled();
	});

	test("empties the signed-in reader's own store", async () => {
		await postReadAll(VIEWER);

		expect(userStore).toHaveBeenCalledWith(VIEWER.id);
		expect(store.markAllRead).toHaveBeenCalledWith();
	});

	test("reports how many posts it took out of the queue", async () => {
		store.markAllRead.mockResolvedValue(42);

		let response = await postReadAll(VIEWER);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${READING_PATH}?marked=42`);
	});

	test("reports a single post apart from several", async () => {
		store.markAllRead.mockResolvedValue(1);

		let response = await postReadAll(VIEWER);

		expect(response.headers.get("location")).toBe(`${READING_PATH}?marked=1`);
	});

	test("reports a queue that was already empty", async () => {
		store.markAllRead.mockResolvedValue(0);

		let response = await postReadAll(VIEWER);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${READING_PATH}?marked=0`);
	});
});
