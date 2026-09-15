/**
 * Tests `POST /feeds`: the guard, the redirect a subscription answers with, each way the
 * store refuses an address — every refusal coming back as the reading queue it was
 * submitted from, reporting why above the list with the address still in the field — and
 * the narrowing that queue was being read under, which the form carries either way.
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

/** A followed feed, which the sidebar beside the refusal lists. */
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
 * Submits the follow form as `viewer`.
 *
 * @param viewer - Who the request is signed in as, or `null` for an anonymous one.
 * @param fields - What the form carries: the address, and the queue's own narrowing.
 */
function postFollow(viewer: typeof VIEWER | null, fields: Record<string, string> = {}) {
	let router = createTestRouter(viewer);
	router.map(routes.feeds.follow, follow);
	return fetchRoute(router, routes.feeds.follow.href(), { url: SUBMITTED_URL, ...fields });
}

/**
 * Submits an address the store refuses, and answers with the rendered page.
 *
 * @param reason - Why the store refuses it.
 */
async function refusedBody(reason: UserStore.FollowFailure) {
	store.followFeed.mockResolvedValue({ ok: false, reason, feedId: null });
	store.listFeeds.mockResolvedValue([FOLLOWED]);

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

	test("redirects to the queue so a refresh does not follow it twice", async () => {
		store.followFeed.mockResolvedValue({ ok: true, feed: FOLLOWED, items: 12 });

		let response = await postFollow(VIEWER);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.reading.href());
	});

	test("returns the reader to the queue as they had narrowed it", async () => {
		store.followFeed.mockResolvedValue({ ok: true, feed: FOLLOWED, items: 12 });

		let response = await postFollow(VIEWER, { q: "remix", show: "unread" });

		expect(response.headers.get("location")).toBe(`${routes.reading.href()}?q=remix&show=unread`);
	});

	test("builds that queue from the two fields alone, never from an address submitted", async () => {
		store.followFeed.mockResolvedValue({ ok: true, feed: FOLLOWED, items: 12 });

		let response = await postFollow(VIEWER, { show: "https://elsewhere.example.com" });

		expect(response.headers.get("location")).toBe(routes.reading.href());
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

	test("ties the field to the refusal, which has no room to sit beneath it", async () => {
		let body = await refusedBody("not-found");

		/** The note reports above the list, where the queue reports every other outcome. */
		expect(body).toContain('id="follow-feed-error"');
		expect(body).toContain('aria-invalid="true"');
		expect(body).toContain('aria-describedby="follow-feed-error"');
		expect(body).toContain('data-color="danger"');
	});

	test("answers a refusal with the whole queue it was submitted from", async () => {
		store.followFeed.mockResolvedValue({ ok: false, reason: "unreachable", feedId: null });
		store.listFeeds.mockResolvedValue([FOLLOWED]);
		store.countFeeds.mockResolvedValue(1);

		let response = await postFollow(VIEWER, { q: "remix", show: "unread" });
		let body = await response.text();

		expect(response.status).toBe(422);
		/** The queue is read back as it was narrowed, so the posts under the field are theirs. */
		expect(store.readingQueue).toHaveBeenCalledWith({
			cursor: null,
			readState: "unread",
			query: "remix",
			limit: 25,
		});
		expect(body).toContain("That address could not be reached.");
		/** And the sidebar, the heading and the filters are the queue's own. */
		expect(body).toContain("Already Followed");
		expect(body).toContain("Reading about “remix”");
		expect(body).toContain('href="/reading?q=remix&amp;show=read"');
	});

	test("reports the refusal and nothing a redirect would have carried", async () => {
		let body = await refusedBody("unreachable");

		expect(body).not.toContain("marked read.");
		expect(body).not.toContain("Checked");
		expect(body).not.toContain("no longer there");
	});
});
