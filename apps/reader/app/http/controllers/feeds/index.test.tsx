/**
 * Tests `GET /feeds`: the guard that keeps it to signed-in readers, the chrome it renders
 * inside, and the labels it resolves for each followed feed — the unread count in both its
 * singular and plural forms, the last check, and what a struggling feed has to report. Then
 * the links that walk the list a page at a time, the sweep of every feed, and the sentence
 * the sweep returns here to report.
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

let { default: feeds } = await import("./index");

/** Noon UTC, so every timezone a test runs in formats it as the same calendar day. */
const CHECKED_AT = Date.UTC(2026, 0, 15, 12);

/** How the page prints {@link CHECKED_AT}, resolved the same way the controller resolves it. */
const CHECKED_ON = new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
	new Date(CHECKED_AT),
);

/**
 * A healthy followed feed, which a test bends to the one thing it is about.
 *
 * @param overrides - The fields this test cares about.
 */
function feed(overrides: Partial<UserStore.FeedSummary> = {}): UserStore.FeedSummary {
	return {
		id: "01J0FEED0000000000000000A1",
		feedUrl: "https://example.com/feed.xml",
		siteUrl: "https://example.com",
		title: "Example Blog",
		description: "Posts from the example blog.",
		imageUrl: null,
		lastFetchedAt: CHECKED_AT,
		lastStatus: "ok",
		failureCount: 0,
		unreadCount: 0,
		...overrides,
	};
}

/**
 * Requests the feed list as `viewer`.
 *
 * @param viewer - Who the request is signed in as, or `null` for an anonymous one.
 * @param url - The page of the list being asked for; defaults to the newest one.
 */
function getFeeds(viewer: typeof VIEWER | null, url = routes.feeds.index.href()) {
	let router = createTestRouter(viewer);
	router.map(routes.feeds.index, feeds);
	return fetchRoute(router, url);
}

beforeEach(() => {
	store = createUserStoreDouble();
	userStore.mockClear();
});

describe("GET /feeds", () => {
	test("redirects an anonymous visitor home", async () => {
		let response = await getFeeds(null);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.home.href());
	});

	test("reads the signed-in reader's own store", async () => {
		await getFeeds(VIEWER);

		expect(userStore).toHaveBeenCalledWith(VIEWER.id);
		expect(store.listFeeds).toHaveBeenCalled();
	});

	test("renders the page inside the signed-in chrome", async () => {
		let response = await getFeeds(VIEWER);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain(">Feeds</title>");
		expect(body).toContain("Reading");
		expect(body).toContain("Settings");
		expect(body).toContain("Sign out");
	});

	test("lists a followed feed with its title, description and last check", async () => {
		store.listFeeds.mockResolvedValue({
			ok: true,
			feeds: [feed()],
			cursors: { next: null, prev: null },
		});

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).toContain("Example Blog");
		expect(body).toContain("Posts from the example blog.");
		expect(body).toContain(`Checked ${CHECKED_ON}`);
		/** Spelled out, so the check reads the way a post's publication date does. */
		expect(body).toContain("Checked Jan 15, 2026");
		expect(body).toContain(routes.feeds.show.href({ feedId: feed().id }));
	});

	test("says a feed has never been checked when nothing has fetched it", async () => {
		store.listFeeds.mockResolvedValue({
			ok: true,
			feeds: [feed({ lastFetchedAt: null, lastStatus: null })],
			cursors: { next: null, prev: null },
		});

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).toContain("Not checked yet");
		expect(body).not.toContain("Checked ");
	});

	test("counts a single unread post in the singular", async () => {
		store.listFeeds.mockResolvedValue({
			ok: true,
			feeds: [feed({ unreadCount: 1 })],
			cursors: { next: null, prev: null },
		});

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).toContain("1 unread");
	});

	test("counts several unread posts in the plural", async () => {
		store.listFeeds.mockResolvedValue({
			ok: true,
			feeds: [feed({ unreadCount: 3 })],
			cursors: { next: null, prev: null },
		});

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).toContain("3 unread");
	});

	test("says a feed is all read when nothing in it is unread", async () => {
		store.listFeeds.mockResolvedValue({
			ok: true,
			feeds: [feed({ unreadCount: 0 })],
			cursors: { next: null, prev: null },
		});

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).toContain("All read");
		expect(body).not.toContain("unread");
	});

	test("says how many checks failed and what the last one recorded", async () => {
		store.listFeeds.mockResolvedValue({
			ok: true,
			feeds: [feed({ failureCount: 2, lastStatus: "http_error" })],
			cursors: { next: null, prev: null },
		});

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).toContain("The last 2 checks failed");
		expect(body).toContain("The site answered with an error");
	});

	test("reports a single failed check in the singular, naming the reason", async () => {
		store.listFeeds.mockResolvedValue({
			ok: true,
			feeds: [feed({ failureCount: 1, lastStatus: "network_error" })],
			cursors: { next: null, prev: null },
		});

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).toContain("The last check failed");
		expect(body).toContain("The site could not be reached");
	});

	test("reports nothing against a feed whose last check succeeded", async () => {
		store.listFeeds.mockResolvedValue({
			ok: true,
			feeds: [feed({ failureCount: 0, lastStatus: "not_modified" })],
			cursors: { next: null, prev: null },
		});

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).not.toContain("failed");
	});

	test("invites a reader who follows nothing, and still offers the form", async () => {
		store.listFeeds.mockResolvedValue({ ok: true, feeds: [], cursors: { next: null, prev: null } });

		let response = await getFeeds(VIEWER);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("You follow nothing yet");
		expect(body).toContain("Paste a feed address above");
		expect(body).toContain("Feed or site address");
		expect(body).toContain('name="url"');
		expect(body).toContain("Follow");
		/** Nothing was refused, so the empty list is the whole of what the page has to say. */
		expect(body).not.toContain("no longer there");
	});

	test("renders the follow form with no error and nothing filled in", async () => {
		store.listFeeds.mockResolvedValue({
			ok: true,
			feeds: [feed()],
			cursors: { next: null, prev: null },
		});

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).toContain(`action="${routes.feeds.follow.href()}"`);
		expect(body).not.toContain("You already follow that feed.");
		expect(body).not.toContain('value="https://');
	});
	/**
	 * The submit sits outside the form it submits, so that association is what makes
	 * following work at all — and nothing on screen would show it had stopped.
	 */
	test("binds the follow submit to the form it sits outside of", async () => {
		let body = await getFeeds(VIEWER).then((response) => response.text());

		let formId = body.match(/<form[^>]*id="([^"]+)"[^>]*action="\/feeds"/)?.[1];
		expect(formId, "the follow form carries an id").toBeTruthy();

		let submit = body.match(new RegExp(`<button[^>]*form="${formId}"[^>]*>`));
		expect(submit?.[0], "a submit names that form").toBeTruthy();
		expect(submit?.[0]).toContain('type="submit"');
	});

	test("asks the store for the page the cursor names", async () => {
		await getFeeds(VIEWER, `${routes.feeds.index.href()}?cursor=older-cursor`);

		expect(store.listFeeds).toHaveBeenCalledWith({ cursor: "older-cursor" });
	});

	test("walks to the pages either side of this one", async () => {
		store.listFeeds.mockResolvedValue({
			ok: true,
			feeds: [feed()],
			cursors: { next: "older-cursor", prev: "newer-cursor" },
		});

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).toContain(`href="${routes.feeds.index.href()}?cursor=newer-cursor"`);
		expect(body).toContain("Newer subscriptions");
		expect(body).toContain(`href="${routes.feeds.index.href()}?cursor=older-cursor"`);
		expect(body).toContain("Older subscriptions");
	});

	test("offers no way back from the newest subscriptions", async () => {
		store.listFeeds.mockResolvedValue({
			ok: true,
			feeds: [feed()],
			cursors: { next: "older-cursor", prev: null },
		});

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).not.toContain("Newer subscriptions");
		expect(body).toContain("Older subscriptions");
	});

	test("offers no way on from the oldest subscriptions", async () => {
		store.listFeeds.mockResolvedValue({
			ok: true,
			feeds: [feed()],
			cursors: { next: null, prev: "newer-cursor" },
		});

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).toContain("Newer subscriptions");
		expect(body).not.toContain("Older subscriptions");
	});

	test("answers a cursor the store refuses with the newest subscriptions and a note", async () => {
		store.listFeeds.mockImplementation(
			async (options: UserStore.TimelineOptions = {}): Promise<UserStore.FeedPage> => {
				if (options.cursor) return { ok: false, reason: "bad-cursor" };
				return { ok: true, feeds: [feed()], cursors: { next: null, prev: null } };
			},
		);

		let response = await getFeeds(VIEWER, `${routes.feeds.index.href()}?cursor=rotten`);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("That page is no longer there.");
		expect(body).toContain("Back to the newest");
		expect(body).toContain(`href="${routes.feeds.index.href()}"`);

		/** The feeds the reader follows, rather than the invitation somebody following none reads. */
		expect(body).toContain("Example Blog");
		expect(body).not.toContain("You follow nothing yet");

		expect(store.listFeeds).toHaveBeenCalledWith({ cursor: "rotten" });
		expect(store.listFeeds).toHaveBeenCalledWith({ cursor: null });
	});

	test("says nothing about a stale cursor on a page the store answered", async () => {
		store.listFeeds.mockResolvedValue({
			ok: true,
			feeds: [feed()],
			cursors: { next: "older-cursor", prev: "newer-cursor" },
		});

		let body = await getFeeds(VIEWER, `${routes.feeds.index.href()}?cursor=older-cursor`).then(
			(response) => response.text(),
		);

		expect(body).not.toContain("no longer there");
		expect(body).not.toContain("Back to the newest");
	});

	test("pages nowhere when the whole list fits on one page", async () => {
		store.listFeeds.mockResolvedValue({
			ok: true,
			feeds: [feed()],
			cursors: { next: null, prev: null },
		});

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).not.toContain("Newer subscriptions");
		expect(body).not.toContain("Older subscriptions");
		expect(body).not.toContain("cursor=");
	});

	test("submits a sweep of every feed rather than linking to one", async () => {
		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).toContain(`<form method="post" action="${routes.feeds.refreshAll.href()}">`);
		expect(body).toContain("Check every feed");
		/** A link is what a prefetcher follows, and this one reaches out to every origin. */
		expect(body).not.toContain(`href="${routes.feeds.refreshAll.href()}"`);
	});

	test("leaves carrying subscriptions in and out to the settings page", async () => {
		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).not.toContain(`href="${routes.feeds.export.href()}"`);
		expect(body).not.toContain("Download as OPML");
		expect(body).not.toContain(`action="${routes.feeds.import.href()}"`);
		expect(body).not.toContain("multipart/form-data");
		expect(body).not.toContain('type="file"');
		expect(body).not.toContain("OPML file");
	});

	test("offers the sweep above the feeds it acts on", async () => {
		store.listFeeds.mockResolvedValue({
			ok: true,
			feeds: [feed()],
			cursors: { next: null, prev: null },
		});

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body.indexOf("Check every feed")).toBeLessThan(body.indexOf("Example Blog"));
	});
});

describe("GET /feeds after a sweep", () => {
	/**
	 * Requests the list the way a finished sweep returns the reader to it.
	 *
	 * @param counts - What the sweep reported, in the order the redirect carries them.
	 */
	function afterSweep(counts: { swept: number; fresh: number; failed: number }) {
		let query = new URLSearchParams({
			swept: String(counts.swept),
			fresh: String(counts.fresh),
			failed: String(counts.failed),
		});

		return getFeeds(VIEWER, `${routes.feeds.index.href()}?${query}`).then((response) =>
			response.text(),
		);
	}

	test("says nothing on a list nobody was returned to", async () => {
		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).not.toContain("Checked");
		expect(body).not.toContain("No feed had anything new.");
	});

	test("counts what the sweep reached and what it brought back", async () => {
		let body = await afterSweep({ swept: 12, fresh: 3, failed: 0 });

		expect(body).toContain("Checked 12 feeds.");
		expect(body).toContain("3 feeds had new posts.");
		expect(body).not.toContain("could not be reached.");
	});

	test("says so when a sweep found nothing new", async () => {
		let body = await afterSweep({ swept: 12, fresh: 0, failed: 0 });

		expect(body).toContain("Checked 12 feeds.");
		expect(body).toContain("No feed had anything new.");
	});

	test("reports the feeds it could not reach alongside the ones it did", async () => {
		let body = await afterSweep({ swept: 9, fresh: 2, failed: 3 });

		expect(body).toContain("Checked 9 feeds.");
		expect(body).toContain("2 feeds had new posts.");
		expect(body).toContain("3 feeds could not be reached.");
	});

	test("counts a single feed in the singular", async () => {
		let body = await afterSweep({ swept: 1, fresh: 1, failed: 1 });

		expect(body).toContain("Checked 1 feed.");
		expect(body).toContain("1 feed had new posts.");
		expect(body).toContain("1 feed could not be reached.");
	});

	test("reports a sweep of a list that follows nothing", async () => {
		let body = await afterSweep({ swept: 0, fresh: 0, failed: 0 });

		expect(body).toContain("Checked 0 feeds.");
		expect(body).toContain("No feed had anything new.");
	});

	test("reports nothing for counts that are not counts", async () => {
		let body = await getFeeds(VIEWER, `${routes.feeds.index.href()}?swept=lots`).then((response) =>
			response.text(),
		);

		expect(body).not.toContain("Checked");
		expect(body).not.toContain("No feed had anything new.");
	});
});
