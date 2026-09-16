/**
 * Tests `DELETE /feeds/:feedId`, reached from a form posting `_method=DELETE`: the guard,
 * the redirect back to the list a dropped subscription answers with, and the not-found
 * page a feed this reader does not follow gets instead.
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

let { default: unfollow } = await import("./unfollow");

/** The subscription every test asks to drop. */
const FEED_ID = "01J0FEED0000000000000000A1";

/**
 * Posts the unfollow form for {@link FEED_ID} as `viewer`, overriding the method the way a
 * browser form reaches a `DELETE` route.
 *
 * @param viewer - Who the request is signed in as, or `null` for an anonymous one.
 */
function postUnfollow(viewer: typeof VIEWER | null) {
	let router = createTestRouter(viewer);
	router.map(routes.feeds.unfollow, unfollow);
	return fetchRoute(router, routes.feeds.unfollow.href({ feedId: FEED_ID }), {
		_method: "DELETE",
	});
}

beforeEach(() => {
	store = createUserStoreDouble();
	userStore.mockClear();
});

describe("DELETE /feeds/:feedId", () => {
	test("redirects an anonymous visitor home", async () => {
		let response = await postUnfollow(null);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.home.href());
		expect(store.unfollowFeed).not.toHaveBeenCalled();
	});

	test("drops the subscription from the signed-in reader's own store", async () => {
		store.unfollowFeed.mockResolvedValue(true);

		await postUnfollow(VIEWER);

		expect(userStore).toHaveBeenCalledWith(VIEWER.id);
		expect(store.unfollowFeed).toHaveBeenCalledWith(FEED_ID);
	});

	test("redirects to the feed list, which is where the feed is now absent", async () => {
		store.unfollowFeed.mockResolvedValue(true);

		let response = await postUnfollow(VIEWER);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.reading.index.href());
	});

	test("answers a feed this reader does not follow with the not-found page", async () => {
		store.unfollowFeed.mockResolvedValue(false);

		let response = await postUnfollow(VIEWER);

		expect(response.status).toBe(404);
		let body = await response.text();
		expect(body).toContain("Feed not found");
		expect(body).toContain("You do not follow a feed with that address.");
		expect(body).toContain("Back to your reading");
		expect(body).toContain(`href="${routes.reading.index.href()}"`);
	});
});
