/**
 * Tests the `POST /items/:itemId/open` route the browser pings when a post's title is
 * followed: the guard on it, the post it marks, the empty answer it gives a request
 * nobody reads the response to, and the answer for a post this reader has nothing for.
 *
 * The requests here are composed the way a browser composes a ping — body `PING` under
 * `text/ping`, `Ping-To` and `Ping-From` beside it — rather than as the form submission
 * every other action in this app receives.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Router } from "remix/router";

import { beforeEach, describe, expect, test, vi } from "vitest";

import type { UserStoreDouble } from "~/app/lib/test/store";

import { createTestRouter, ORIGIN, VIEWER } from "~/app/lib/test/controller";
import { createUserStoreDouble } from "~/app/lib/test/store";
import routes from "~/routes/web";

/** The post every ping below reports a click on. */
const ITEM_ID = "01J0ITEM000000000000000000";

/** Where the title the reader followed leads, which the browser names in `Ping-To`. */
const POST_URL = "https://example.com/posts/markdown-and-the-web";

let store: UserStoreDouble = createUserStoreDouble();

vi.doMock("~/database/user-do", () => ({ userStore: () => store }));

let { default: open } = await import("./open");

/** A router with the ping route mapped, signed in as `viewer` or as nobody. */
function createRouter(viewer: typeof VIEWER | null): Router {
	let router = createTestRouter(viewer);
	router.map(routes.items.open, open);
	return router;
}

/**
 * Pings the route the way a browser does when a post's title is followed.
 *
 * @param router - The router to dispatch through.
 * @param body - The body to send; browsers send `PING`, and the route reads none of it.
 */
function ping(router: Router, body = "PING"): Promise<Response> {
	let url = new URL(routes.items.open.href({ itemId: ITEM_ID }), ORIGIN);

	return router.fetch(
		new Request(url, {
			method: "POST",
			headers: {
				"content-type": "text/ping",
				"ping-to": POST_URL,
				"ping-from": new URL(routes.reading.index.href(), ORIGIN).toString(),
			},
			body,
		}),
	);
}

beforeEach(() => {
	store = createUserStoreDouble();
});

describe("POST /items/:itemId/open", () => {
	test("sends an anonymous visitor home without marking anything", async () => {
		let response = await ping(createRouter(null));

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.home.href());
		expect(store.markRead).not.toHaveBeenCalled();
	});

	test("marks the post read and answers with nothing to read", async () => {
		let response = await ping(createRouter(VIEWER));

		expect(store.markRead).toHaveBeenCalledWith(ITEM_ID);
		expect(response.status).toBe(204);
		expect(await response.text()).toBe("");
	});

	test("takes the post from the URL rather than from the body it was sent", async () => {
		await ping(createRouter(VIEWER), "read=false&itemId=01J0OTHER0000000000000000");

		expect(store.markRead).toHaveBeenCalledWith(ITEM_ID);
	});

	test("answers a ping for a post already read exactly as it answers the first", async () => {
		let router = createRouter(VIEWER);

		let first = await ping(router);
		let second = await ping(router);

		expect(store.markRead).toHaveBeenCalledTimes(2);
		expect(second.status).toBe(first.status);
		expect(second.status).toBe(204);
	});

	test("answers a post this reader has nothing stored for", async () => {
		store.markRead.mockResolvedValue(false);

		let response = await ping(createRouter(VIEWER));

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("");
	});
});
