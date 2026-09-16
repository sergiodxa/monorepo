/**
 * Tests `GET /saved`: the guard on it, the list it renders from what the store answered,
 * the mark each row carries for stopping keeping it, what an empty list says, a cursor the
 * store no longer decodes, and the paging it shares with every other list here.
 *
 * Every assertion is against rendered English copy rather than a translation key, since a
 * key-name assertion passes for a page whose copy was never written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Router } from "remix/router";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { UserStore } from "~/database/user-do";

import { createTestRouter, fetchRoute, VIEWER } from "~/app/lib/test/controller";
import { restoreFlags, serveFlags } from "~/app/lib/test/flags";
import { createUserStoreDouble } from "~/app/lib/test/store";
import routes from "~/routes/web";

/** The feeds the fixture posts come from, as the store carries them beside the items. */
const FEEDS: UserStore.FeedRef[] = [
	{ id: "feed-df", title: "Daring Fireball", siteUrl: "https://daringfireball.net" , keepLinkParameters: false },
];

let store = createUserStoreDouble();
vi.doMock("~/database/user-do", () => ({ userStore: () => store }));

let { default: saved } = await import("./saved");

/** Builds a kept post, defaulting every field a test is not about. */
function item(overrides: Partial<UserStore.Item> & Pick<UserStore.Item, "id">): UserStore.Item {
	return {
		feedId: "feed-df",
		title: "A post",
		url: "https://example.com/post",
		summary: null,
		author: null,
		/** Midday, so the date reads the same whatever timezone the test host runs in. */
		publishedAt: Date.UTC(2026, 0, 2, 12),
		readAt: null,
		/** Kept, because this page holds the posts a reader asked to keep and nothing else. */
		savedAt: Date.UTC(2026, 0, 3, 9),
		/** No labels, which is what every list but the two that draw chips answers with. */
		/** Unflagged, which is what a post no rule marked on arrival carries. */
		flaggedAt: null,
		tags: [],
		...overrides,
	};
}

/** Dispatches a real `GET` to `path` as `viewer`, through the saved controller alone. */
function get(path: string, viewer: Viewer | null = VIEWER): Promise<Response> {
	let router: Router = createTestRouter(viewer);
	router.map(routes.saved, saved);
	return fetchRoute(router, path);
}

/** The copy a reader sees, with the markup carrying it stripped out. */
function readsAs(html: string): string {
	return html.replace(/<[^>]*>/g, "");
}

/** One page of kept posts, with an older page behind it or nothing. */
function kept(next: string | null = null) {
	store.savedQueue.mockResolvedValue({
		ok: true,
		items: [item({ id: "item-1", title: "Markdown and the web" })],
		feeds: FEEDS,
		cursors: { next, prev: null },
	});
}

beforeEach(() => {
	store = createUserStoreDouble();
});

describe("with keeping turned off", () => {
	afterEach(() => restoreFlags());

	/**
	 * This page is the whole of what keeping is for, so with it off there is nothing to
	 * show and no way to put anything here. A reader following a bookmark is sent to the
	 * queue rather than shown a shelf nothing can reach.
	 */
	test("sends a reader following a bookmark back to the queue", async () => {
		await serveFlags({ "saved-posts": false });

		let response = await get(routes.saved.href());

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.reading.index.href());
		expect(store.savedQueue).not.toHaveBeenCalled();
	});
});

describe("GET /saved", () => {
	test("sends an anonymous visitor home", async () => {
		let response = await get(routes.saved.href(), null);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.home.href());
		expect(store.savedQueue).not.toHaveBeenCalled();
	});

	test("renders the kept posts, newest first, with the feed each came from", async () => {
		kept();

		let response = await get(routes.saved.href());
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(store.savedQueue).toHaveBeenCalledWith({ cursor: null, limit: 25 });
		expect(readsAs(body)).toContain("Markdown and the web");
		expect(body).toContain("Daring Fireball");
		expect(body).toContain(">Saved</title>");
	});

	/**
	 * Everything on this surface is kept, so its rows say so and their marks are the ones
	 * that stop keeping them.
	 */
	test("gives every row the mark that stops keeping it, returning to this page", async () => {
		kept();

		let body = await (await get(routes.saved.href())).text();

		expect(body).toContain(`action="${routes.items.save.href({ itemId: "item-1" })}"`);
		expect(body).toContain('name="saved" value="false"');
		expect(body).toContain(`name="returnTo" value="${routes.saved.href()}"`);
		expect(body).toContain("Remove from saved");
	});

	test("says what this list is for when nothing has been kept yet", async () => {
		let body = await (await get(routes.saved.href())).text();

		expect(readsAs(body)).toContain("Nothing saved yet");
		expect(readsAs(body)).toContain("Keep a post from any list and it stays here");
	});

	test("walks the list with the same paging every other list here uses", async () => {
		kept("older-cursor");

		let body = await (await get(routes.saved.href())).text();

		expect(body).toContain(`${routes.saved.href()}?cursor=older-cursor`);
		expect(readsAs(body)).toContain("Older posts");
	});

	test("answers a cursor the store cannot decode with the newest page and a note", async () => {
		store.savedQueue.mockImplementation(
			async ({ cursor }: UserStore.TimelineOptions = {}): Promise<UserStore.TimelineResult> => {
				if (cursor) return { ok: false, reason: "bad-cursor" };

				return {
					ok: true,
					items: [item({ id: "item-1" })],
					feeds: FEEDS,
					cursors: { next: null, prev: null },
					search: null,
				};
			},
		);

		let body = await (await get(`${routes.saved.href()}?cursor=rotten`)).text();

		expect(readsAs(body)).toContain("That page is no longer there.");
		expect(readsAs(body)).toContain("A post");
	});

	test("reads the newest page for a paging parameter that is not one", async () => {
		kept();

		await get(`${routes.saved.href()}?cursor=`);

		expect(store.savedQueue).toHaveBeenCalledWith({ cursor: null, limit: 25 });
	});
});
