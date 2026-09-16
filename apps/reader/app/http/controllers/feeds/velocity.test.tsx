/**
 * Tests `POST /feeds/:feedId/velocity`: the guard on it, the span it hands the reader's
 * own store, and the value each outcome travels back to the feed page under. The
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

let { default: velocity } = await import("./velocity");

/** The subscription every test below sets a span on. */
const FEED_ID = "01J0FEED0000000000000000A1";

/** Where a submission returns the reader to, before the outcome is appended to it. */
const FEED_PATH = routes.feed.href({ feed: FEED_ID });

/** The subscription a successful submission answers with, which the page redraws from. */
const FEED = {
	id: FEED_ID,
	feedId: "01J0CANONICAL00000000000001",
	feedUrl: "https://daringfireball.net/feeds/main",
	siteUrl: null,
	title: "Daring Fireball",
	description: null,
	imageUrl: null,
	velocity: "news",
	unreadCount: 0,
};

/**
 * Posts the velocity form for {@link FEED_ID} as `viewer`.
 *
 * @param viewer - Who the request is signed in as, or `null` for an anonymous one.
 * @param body - The fields the form carries; omit the span to post the form without one.
 */
function postVelocity(viewer: typeof VIEWER | null, body: Record<string, string> = {}) {
	let router = createTestRouter(viewer);
	router.map(routes.feeds.velocity, velocity);
	return fetchRoute(router, routes.feeds.velocity.href({ feedId: FEED_ID }), body);
}

beforeEach(() => {
	store = createUserStoreDouble();
	userStore.mockClear();
});

describe("POST /feeds/:feedId/velocity", () => {
	test("redirects an anonymous visitor home", async () => {
		let response = await postVelocity(null, { velocity: "news" });

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.home.href());
		expect(store.setVelocity).not.toHaveBeenCalled();
	});

	test("sets the span on the feed the URL names, in the signed-in reader's own store", async () => {
		store.setVelocity.mockResolvedValue({ ok: true, feed: FEED });

		let response = await postVelocity(VIEWER, { velocity: "news" });

		expect(userStore).toHaveBeenCalledWith(VIEWER.id);
		expect(store.setVelocity).toHaveBeenCalledWith(FEED_ID, "news");
		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${FEED_PATH}?velocity=saved`);
	});

	/**
	 * The store's `CHECK` is what the offered spans are written in, so the submission goes
	 * through as it arrived rather than being filtered against a second copy of the list.
	 */
	test("hands a span this app does not offer to the store, and reports the refusal", async () => {
		store.setVelocity.mockResolvedValue({ ok: false, reason: "invalid-velocity" });

		let response = await postVelocity(VIEWER, { velocity: "hourly" });

		expect(store.setVelocity).toHaveBeenCalledWith(FEED_ID, "hourly");
		expect(response.headers.get("location")).toBe(`${FEED_PATH}?velocity=invalid`);
	});

	test("reads a form that arrived without a span as one the store refuses", async () => {
		store.setVelocity.mockResolvedValue({ ok: false, reason: "invalid-velocity" });

		let response = await postVelocity(VIEWER);

		expect(store.setVelocity).toHaveBeenCalledWith(FEED_ID, "");
		expect(response.headers.get("location")).toBe(`${FEED_PATH}?velocity=invalid`);
	});

	test("tells a feed this reader does not follow apart from a span it refused", async () => {
		store.setVelocity.mockResolvedValue({ ok: false, reason: "not-following" });

		let response = await postVelocity(VIEWER, { velocity: "news" });

		expect(response.headers.get("location")).toBe(`${FEED_PATH}?velocity=missing`);
	});
});
