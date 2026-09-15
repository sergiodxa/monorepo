/**
 * Tests `POST /feeds`: the guard, the redirect a subscription answers with, and each way
 * the store refuses an address — every refusal coming back as the feed page it was
 * submitted from, carrying its own message and the address still in the field.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test, vi } from "vitest";

import type { UserStore } from "~/database/user-do";

import { createTestRouter, fetchRoute, VIEWER } from "~/app/lib/test/controller";
import { createUserStoreDouble } from "~/app/lib/test/store";
import routes from "~/routes/web";

let store = createUserStoreDouble();

/** Answers with whatever the current test set up, so `beforeEach` can hand out a fresh one. */
let userStore = vi.fn(() => store);

vi.doMock("~/database/user-do", () => ({ userStore }));

let { default: follow } = await import("./follow");

/** The address every test submits, and the one a refusal is expected to put back. */
const SUBMITTED_URL = "https://example.com/blog";

/** A followed feed, so a refusal is shown against the list it was submitted from. */
const FOLLOWED: UserStore.FeedSummary = {
	id: "01J0FEED0000000000000000A1",
	feedUrl: "https://already.example.com/feed.xml",
	siteUrl: "https://already.example.com",
	title: "Already Followed",
	description: null,
	imageUrl: null,
	lastFetchedAt: null,
	lastStatus: null,
	failureCount: 0,
	unreadCount: 0,
};

/**
 * Submits `url` to the follow action as `viewer`.
 *
 * @param viewer - Who the request is signed in as, or `null` for an anonymous one.
 * @param url - The address typed into the follow form.
 * @param path - Where the form was posted to; defaults to the route's own path.
 */
function postFollow(
	viewer: typeof VIEWER | null,
	url = SUBMITTED_URL,
	path = routes.feeds.follow.href(),
) {
	let router = createTestRouter(viewer);
	router.map(routes.feeds.follow, follow);
	return fetchRoute(router, path, { url });
}

/**
 * Submits an address the store refuses, and answers with the rendered page.
 *
 * @param reason - Why the store refuses it.
 */
async function refusedBody(reason: UserStore.FollowFailure) {
	store.followFeed.mockResolvedValue({ ok: false, reason, feedId: null });
	store.listFeeds.mockResolvedValue({
		ok: true,
		feeds: [FOLLOWED],
		cursors: { next: null, prev: null },
	});

	let response = await postFollow(VIEWER);

	expect(response.status).toBe(422);
	return response.text();
}

beforeEach(() => {
	store = createUserStoreDouble();
	userStore.mockClear();
});

describe("POST /feeds", () => {
	test("redirects an anonymous visitor home", async () => {
		let response = await postFollow(null);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.home.href());
		expect(store.followFeed).not.toHaveBeenCalled();
	});

	test("follows the submitted address on the signed-in reader's own store", async () => {
		store.followFeed.mockResolvedValue({ ok: true, feed: FOLLOWED, items: 12 });

		await postFollow(VIEWER);

		expect(userStore).toHaveBeenCalledWith(VIEWER.id);
		expect(store.followFeed).toHaveBeenCalledWith(SUBMITTED_URL);
	});

	test("redirects to the feed list so a refresh does not follow it twice", async () => {
		store.followFeed.mockResolvedValue({ ok: true, feed: FOLLOWED, items: 12 });

		let response = await postFollow(VIEWER);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.feeds.index.href());
	});

	test("explains an address that is not one this app can fetch", async () => {
		let body = await refusedBody("invalid-url");

		expect(body).toContain("That is not an address this app can fetch.");
	});

	test("explains an address that publishes no feed", async () => {
		let body = await refusedBody("not-found");

		expect(body).toContain("Nothing at that address publishes an RSS or Atom feed.");
	});

	test("explains an address that could not be reached", async () => {
		let body = await refusedBody("unreachable");

		expect(body).toContain("That address could not be reached.");
	});

	test("explains an address that is already followed", async () => {
		let body = await refusedBody("already-following");

		expect(body).toContain("You already follow that feed.");
	});

	test("puts the submitted address back in the field", async () => {
		let body = await refusedBody("not-found");

		expect(body).toContain(`value="${SUBMITTED_URL}"`);
	});

	test("answers a refusal with the whole feed page it was submitted from", async () => {
		let body = await refusedBody("unreachable");

		expect(body).toContain(">Feeds</title>");
		expect(body).toContain("Already Followed");
		expect(body).toContain("Feed or site address");
		expect(store.listFeeds).toHaveBeenCalled();
	});

	test("answers a refusal from the newest subscriptions, whatever the URL carried", async () => {
		store.followFeed.mockResolvedValue({ ok: false, reason: "unreachable", feedId: null });
		store.listFeeds.mockImplementation(
			async (options: UserStore.TimelineOptions = {}): Promise<UserStore.FeedPage> => {
				if (options.cursor) return { ok: false, reason: "bad-cursor" };
				return { ok: true, feeds: [FOLLOWED], cursors: { next: null, prev: null } };
			},
		);

		let response = await postFollow(
			VIEWER,
			SUBMITTED_URL,
			`${routes.feeds.follow.href()}?cursor=rotten`,
		);

		expect(response.status).toBe(422);

		/**
		 * The form names the route without a query, so the page a refusal comes back on is
		 * the end of the list a new subscription would appear at, with no place to go stale.
		 */
		expect(store.listFeeds).toHaveBeenCalledWith();

		let body = await response.text();
		expect(body).toContain("That address could not be reached.");
		expect(body).toContain("Already Followed");
		expect(body).not.toContain("no longer there");
	});
});
