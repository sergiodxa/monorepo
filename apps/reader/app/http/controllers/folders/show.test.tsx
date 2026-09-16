/**
 * Tests `GET /reading/folders/:folder`: the guard, a folder the reader does not have, the
 * posts of one they do read as one stream, the empty folder, and the controls on the
 * folder's own line — renaming it, making another, and the prompt that says deleting one
 * keeps every post.
 *
 * Every assertion is against rendered English copy rather than a translation key, since a
 * key-name assertion passes for a page whose copy was never written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Router } from "remix/router";

import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { UserStore } from "~/database/user-do";

import { createTestRouter, fetchRoute, VIEWER } from "~/app/lib/test/controller";
import { createUserStoreDouble } from "~/app/lib/test/store";
import routes from "~/routes/web";

let store = createUserStoreDouble();
vi.doMock("~/database/user-do", () => ({ userStore: () => store }));

let { default: show } = await import("./show");

/** The folder under test, as `getFolder()` answers it. */
const FOLDER: UserStore.Folder = { id: "01J0FOLDER00000000000000A1", title: "Tech" };

/** The feed one of its posts came from, carried beside the posts rather than joined in. */
const FEED_REF: UserStore.FeedRef = {
	id: "feed-rust",
	title: "Rust Blog",
	siteUrl: "https://rust.example",
};

/** Builds one post of the folder, defaulting every field a test is not about. */
function item(overrides: Partial<UserStore.Item> & Pick<UserStore.Item, "id">): UserStore.Item {
	return {
		feedId: FEED_REF.id,
		title: "A post",
		url: "https://rust.example/post",
		summary: null,
		author: null,
		/** Midday, so the date reads the same whatever timezone the test host runs in. */
		publishedAt: Date.UTC(2026, 0, 2, 12),
		readAt: null,
		savedAt: null,
		/** No labels, which is what every list but the two that draw chips answers with. */
		/** Unflagged, which is what a post no rule marked on arrival carries. */
		flaggedAt: null,
		tags: [],
		...overrides,
	};
}

/** One page of the folder, as the store answers it. */
function page(items: UserStore.Item[]): UserStore.TimelineResult {
	return { ok: true, items, feeds: [FEED_REF], cursors: { next: null, prev: null }, search: null };
}

/** Dispatches a real `GET` to `path` as `viewer`, through the folder controller alone. */
function get(path: string, viewer: Viewer | null = VIEWER): Promise<Response> {
	let router: Router = createTestRouter(viewer);
	router.map(routes.folder, show);
	return fetchRoute(router, path);
}

/** The copy a reader sees, with the markup carrying it stripped out. */
function readsAs(html: string): string {
	return html.replace(/<[^>]*>/g, "");
}

beforeEach(() => {
	store = createUserStoreDouble();
});

describe("GET /reading/folders/:folder", () => {
	test("sends an anonymous visitor home", async () => {
		let response = await get(routes.folder.href({ folder: FOLDER.id }), null);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.home.href());
		expect(store.folderTimeline).not.toHaveBeenCalled();
	});

	test("answers a folder this reader does not have with 404", async () => {
		let response = await get(routes.folder.href({ folder: "nobody-has-this" }));

		expect(response.status).toBe(404);
		expect(readsAs(await response.text())).toContain("Folder not found");
	});

	test("reads every feed in the folder as one stream, each row naming its publisher", async () => {
		store.getFolder.mockResolvedValue(FOLDER);
		store.folderTimeline.mockResolvedValue(
			page([item({ id: "one", title: "Ownership" }), item({ id: "two", title: "Lifetimes" })]),
		);

		let body = await (await get(routes.folder.href({ folder: FOLDER.id }))).text();

		expect(store.folderTimeline).toHaveBeenCalledWith(FOLDER.id, expect.anything());
		expect(readsAs(body)).toContain("Tech");
		expect(readsAs(body)).toContain("Ownership");
		expect(readsAs(body)).toContain("Lifetimes");
		expect(readsAs(body)).toContain("Rust Blog");
	});

	test("says what an empty folder is waiting for", async () => {
		store.getFolder.mockResolvedValue(FOLDER);

		let body = await (await get(routes.folder.href({ folder: FOLDER.id }))).text();

		expect(readsAs(body)).toContain("Nothing here yet");
	});

	/** Deleting takes no post, so the prompt says so rather than asking for a loss. */
	test("carries the folder's own controls, and a prompt that keeps every post", async () => {
		store.getFolder.mockResolvedValue(FOLDER);

		let body = await (await get(routes.folder.href({ folder: FOLDER.id }))).text();

		expect(body).toContain(routes.folders.rename.href({ folderId: FOLDER.id }));
		expect(body).toContain(routes.folders.create.href());
		expect(body).toContain(routes.folders.delete.href({ folderId: FOLDER.id }));
		expect(body).toContain('name="_method" value="DELETE"');
		expect(readsAs(body)).toContain("keep every post");
	});

	test("says what a folder action just did, in the folder's own page", async () => {
		store.getFolder.mockResolvedValue(FOLDER);

		let body = await (
			await get(`${routes.folder.href({ folder: FOLDER.id })}?folder=renamed`)
		).text();

		expect(readsAs(body)).toContain("Folder renamed.");
	});
});
