/**
 * Tests the `POST /items/:itemId/read` action: the guard on it, the value it hands the
 * store, the page it returns the reader to — including the destinations it refuses to
 * follow off this origin — and the answer for a post the store has nothing for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Router } from "remix/router";

import { beforeEach, describe, expect, test, vi } from "vitest";

import type { UserStoreDouble } from "~/app/lib/test/store";

import { createTestRouter, fetchRoute, VIEWER } from "~/app/lib/test/controller";
import { createUserStoreDouble } from "~/app/lib/test/store";
import routes from "~/routes/web";

/** The post every request below acts on. */
const ITEM_ID = "01J0ITEM000000000000000000";

let store: UserStoreDouble = createUserStoreDouble();

vi.doMock("~/database/user-do", () => ({ userStore: () => store }));

let { default: read } = await import("./read");

/** A router with the mark-read action mapped, signed in as `viewer` or as nobody. */
function createRouter(viewer: typeof VIEWER | null): Router {
	let router = createTestRouter(viewer);
	router.map(routes.items.read, read);
	return router;
}

/** Posts the mark-read form for {@link ITEM_ID}. */
function markRead(router: Router, body: Record<string, string>) {
	return fetchRoute(router, routes.items.read.href({ itemId: ITEM_ID }), body);
}

beforeEach(() => {
	store = createUserStoreDouble();
});

describe("POST /items/:itemId/read", () => {
	test("sends an anonymous visitor home", async () => {
		let response = await markRead(createRouter(null), { read: "true", returnTo: "/reading" });

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.home.href());
		expect(store.markRead).not.toHaveBeenCalled();
	});

	test("marks the post read and returns to the page it was submitted from", async () => {
		let response = await markRead(createRouter(VIEWER), { read: "true", returnTo: "/reading" });

		expect(store.markRead).toHaveBeenCalledWith(ITEM_ID, true);
		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.reading.index.href());
	});

	test("marks the post unread", async () => {
		let feedPath = routes.feed.href({ feed: "01J0FEED00000000000000000" });

		let response = await markRead(createRouter(VIEWER), { read: "false", returnTo: feedPath });

		expect(store.markRead).toHaveBeenCalledWith(ITEM_ID, false);
		expect(response.headers.get("location")).toBe(feedPath);
	});

	test("keeps the query a paged timeline returns with", async () => {
		let response = await markRead(createRouter(VIEWER), {
			read: "true",
			returnTo: "/reading?cursor=abc",
		});

		expect(response.headers.get("location")).toBe("/reading?cursor=abc");
	});

	test("marks the post read when the form carries no value", async () => {
		let response = await markRead(createRouter(VIEWER), { returnTo: "/reading" });

		expect(store.markRead).toHaveBeenCalledWith(ITEM_ID, true);
		expect(response.status).toBe(303);
	});

	test.each([
		["an absolute address", "https://evil.example/"],
		["a protocol-relative address", "//evil.example/"],
		["a backslash-escaped address", "/\\evil.example/"],
		["a scheme with no host", "javascript:alert(1)"],
		["an empty field", ""],
	])("returns to the queue rather than following %s", async (_label, returnTo) => {
		let response = await markRead(createRouter(VIEWER), { read: "true", returnTo });

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.reading.index.href());
	});

	test("answers a post the store has nothing for", async () => {
		store.markRead.mockResolvedValue(false);

		let response = await markRead(createRouter(VIEWER), { read: "true", returnTo: "/reading" });
		let html = await response.text();

		expect(response.status).toBe(404);
		expect(html).toContain("That post is not in your reading queue.");
		expect(html).toContain("Reading");
	});
});
