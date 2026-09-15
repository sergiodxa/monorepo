/**
 * Tests `GET /feeds`: the guard that keeps it to signed-in readers, the chrome it renders
 * inside, and the labels it resolves for each followed feed — the unread count in both its
 * singular and plural forms, the last check, and what a struggling feed has to report.
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
const CHECKED_ON = new Intl.DateTimeFormat("en").format(new Date(CHECKED_AT));

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
 */
function getFeeds(viewer: typeof VIEWER | null) {
	let router = createTestRouter(viewer);
	router.map(routes.feeds.index, feeds);
	return fetchRoute(router, routes.feeds.index.href());
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
		store.listFeeds.mockResolvedValue([feed()]);

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).toContain("Example Blog");
		expect(body).toContain("Posts from the example blog.");
		expect(body).toContain(`Checked ${CHECKED_ON}`);
		expect(body).toContain(routes.feeds.show.href({ feedId: feed().id }));
	});

	test("says a feed has never been checked when nothing has fetched it", async () => {
		store.listFeeds.mockResolvedValue([feed({ lastFetchedAt: null, lastStatus: null })]);

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).toContain("Not checked yet");
		expect(body).not.toContain("Checked ");
	});

	test("counts a single unread post in the singular", async () => {
		store.listFeeds.mockResolvedValue([feed({ unreadCount: 1 })]);

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).toContain("1 unread");
	});

	test("counts several unread posts in the plural", async () => {
		store.listFeeds.mockResolvedValue([feed({ unreadCount: 3 })]);

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).toContain("3 unread");
	});

	test("says a feed is all read when nothing in it is unread", async () => {
		store.listFeeds.mockResolvedValue([feed({ unreadCount: 0 })]);

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).toContain("All read");
		expect(body).not.toContain("unread");
	});

	test("says how many checks failed and what the last one recorded", async () => {
		store.listFeeds.mockResolvedValue([feed({ failureCount: 2, lastStatus: "http_error" })]);

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).toContain("The last 2 checks failed");
		expect(body).toContain("The site answered with an error");
	});

	test("reports a single failed check in the singular, naming the reason", async () => {
		store.listFeeds.mockResolvedValue([feed({ failureCount: 1, lastStatus: "network_error" })]);

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).toContain("The last check failed");
		expect(body).toContain("The site could not be reached");
	});

	test("reports nothing against a feed whose last check succeeded", async () => {
		store.listFeeds.mockResolvedValue([feed({ failureCount: 0, lastStatus: "not_modified" })]);

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).not.toContain("failed");
	});

	test("invites a reader who follows nothing, and still offers the form", async () => {
		store.listFeeds.mockResolvedValue([]);

		let response = await getFeeds(VIEWER);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("You follow nothing yet");
		expect(body).toContain("Paste a feed address below");
		expect(body).toContain("Feed or site address");
		expect(body).toContain('name="url"');
		expect(body).toContain("Follow");
	});

	test("renders the follow form with no error and nothing filled in", async () => {
		store.listFeeds.mockResolvedValue([feed()]);

		let body = await getFeeds(VIEWER).then((response) => response.text());

		expect(body).toContain(`action="${routes.feeds.follow.href()}"`);
		expect(body).not.toContain("You already follow that feed.");
		expect(body).not.toContain('value="https://');
	});
});
