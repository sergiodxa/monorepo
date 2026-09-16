/**
 * Tests the `POST /items/:itemId/save` action: the guard on it, the value it hands the
 * store, the page it returns the reader to — including the destinations it refuses to
 * follow off this origin — the answer a row that moved its own mark gets, and what a
 * reader is told when the shelf is full.
 *
 * Every assertion about copy is against rendered English rather than a translation key,
 * since a key-name assertion passes for a page whose copy was never written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Router } from "remix/router";

import { beforeEach, describe, expect, test, vi } from "vitest";

import type { UserStoreDouble } from "~/app/lib/test/store";

import { createTestRouter, fetchRoute, ORIGIN, VIEWER } from "~/app/lib/test/controller";
import { createUserStoreDouble } from "~/app/lib/test/store";
import { SAVE_IN_PLACE_HEADER } from "~/resources/components/save-toggle";
import routes from "~/routes/web";

/** The post every request below acts on. */
const ITEM_ID = "01J0ITEM000000000000000000";

let store: UserStoreDouble = createUserStoreDouble();

vi.doMock("~/database/user-do", () => ({ userStore: () => store }));

let { default: save } = await import("./save");

/** A router with the save action mapped, signed in as `viewer` or as nobody. */
function createRouter(viewer: typeof VIEWER | null): Router {
	let router = createTestRouter(viewer);
	router.map(routes.items.save, save);
	return router;
}

/** Posts the save form for {@link ITEM_ID}. */
function postSave(router: Router, body: Record<string, string>) {
	return fetchRoute(router, routes.items.save.href({ itemId: ITEM_ID }), body);
}

/** Posts it the way the row's own mark does, having already moved itself. */
function postInPlace(router: Router, saved: string) {
	let url = new URL(routes.items.save.href({ itemId: ITEM_ID }), ORIGIN);

	return router.fetch(
		new Request(url, {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				[SAVE_IN_PLACE_HEADER]: "1",
			},
			body: new URLSearchParams({ saved }),
		}),
	);
}

beforeEach(() => {
	store = createUserStoreDouble();
});

describe("POST /items/:itemId/save", () => {
	test("sends an anonymous visitor home", async () => {
		let response = await postSave(createRouter(null), { saved: "true", returnTo: "/reading" });

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.home.href());
		expect(store.saveItem).not.toHaveBeenCalled();
	});

	test("keeps the post and returns to the page it was submitted from", async () => {
		let response = await postSave(createRouter(VIEWER), { saved: "true", returnTo: "/reading" });

		expect(store.saveItem).toHaveBeenCalledWith(ITEM_ID, true);
		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.reading.index.href());
	});

	test("stops keeping a post", async () => {
		store.saveItem.mockResolvedValue({ ok: true, saved: false });

		let response = await postSave(createRouter(VIEWER), {
			saved: "false",
			returnTo: routes.saved.href(),
		});

		expect(store.saveItem).toHaveBeenCalledWith(ITEM_ID, false);
		expect(response.headers.get("location")).toBe(routes.saved.href());
	});

	test("keeps the post when the form carries no value", async () => {
		await postSave(createRouter(VIEWER), {});

		expect(store.saveItem).toHaveBeenCalledWith(ITEM_ID, true);
	});

	test("keeps the query a paged timeline returns with", async () => {
		let response = await postSave(createRouter(VIEWER), {
			saved: "true",
			returnTo: "/reading?cursor=abc",
		});

		expect(response.headers.get("location")).toBe("/reading?cursor=abc");
	});

	test("refuses a destination that leads off this origin", async () => {
		for (let returnTo of ["https://evil.example/", "//evil.example/", "/\\evil.example/"]) {
			let response = await postSave(createRouter(VIEWER), { saved: "true", returnTo });

			expect(response.headers.get("location")).toBe(routes.reading.index.href());
		}
	});

	/**
	 * A full shelf refuses rather than making room, so the reader is told they are full and
	 * which way out they have — and everything already kept is still kept.
	 */
	test("tells a reader with no room left what to do about it, and keeps nothing less", async () => {
		store.saveItem.mockResolvedValue({ ok: false, reason: "full" });

		let response = await postSave(createRouter(VIEWER), { saved: "true", returnTo: "/reading" });
		let body = await response.text();

		expect(response.status).toBe(409);
		expect(body.replace(/<[^>]*>/g, "")).toContain(
			"You have saved as many posts as this keeps. Remove one from Saved to make room for another.",
		);
	});

	test("answers a post the store has nothing for with 404", async () => {
		store.saveItem.mockResolvedValue({ ok: false, reason: "not-found" });

		let response = await postSave(createRouter(VIEWER), { saved: "true", returnTo: "/reading" });

		expect(response.status).toBe(404);
		expect((await response.text()).replace(/<[^>]*>/g, "")).toContain(
			"That post is not in your reading queue.",
		);
	});
});

describe("a row that moved its own mark", () => {
	/**
	 * The row is asking what became of the move and nothing else: it is looking at the page
	 * a redirect would send, further down it than the server has any way of knowing.
	 */
	test("answers the outcome alone", async () => {
		let response = await postInPlace(createRouter(VIEWER), "true");

		expect(store.saveItem).toHaveBeenCalledWith(ITEM_ID, true);
		expect(response.status).toBe(204);
		expect(await response.text()).toBe("");
	});

	/** Told apart from a post that is not there, since the row says a different thing for each. */
	test("answers a full shelf with a status of its own", async () => {
		store.saveItem.mockResolvedValue({ ok: false, reason: "full" });

		let response = await postInPlace(createRouter(VIEWER), "true");

		expect(response.status).toBe(409);
	});

	test("answers a post the store has nothing for with 404", async () => {
		store.saveItem.mockResolvedValue({ ok: false, reason: "not-found" });

		let response = await postInPlace(createRouter(VIEWER), "true");

		expect(response.status).toBe(404);
	});
});
