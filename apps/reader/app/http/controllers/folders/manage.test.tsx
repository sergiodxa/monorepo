/**
 * Tests the three routes a folder itself is acted on through — `POST /folders`,
 * `POST /folders/:folderId` and `DELETE /folders/:folderId`. None of them renders, so
 * every assertion here is about what the store was asked and where the reader lands.
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

let { default: create } = await import("./create");
let { default: rename } = await import("./rename");
let { default: remove } = await import("./delete");

/** The folder every test below acts on, as the store answers it. */
const FOLDER = { id: "01J0FOLDER00000000000000A1", title: "Tech" };

/** Where a folder's own page is, which is where these submissions report back. */
const FOLDER_PATH = routes.folder.href({ folder: FOLDER.id });

/**
 * Posts the create form as `viewer`.
 *
 * @param viewer - Who the request is signed in as, or `null` for an anonymous one.
 * @param body - The fields the form carries.
 */
function postCreate(viewer: typeof VIEWER | null, body: Record<string, string> = {}) {
	let router = createTestRouter(viewer);
	router.map(routes.folders.create, create);
	return fetchRoute(router, routes.folders.create.href(), body);
}

/**
 * Posts the rename form as `viewer`.
 *
 * @param viewer - Who the request is signed in as, or `null` for an anonymous one.
 * @param body - The fields the form carries.
 */
function postRename(viewer: typeof VIEWER | null, body: Record<string, string> = {}) {
	let router = createTestRouter(viewer);
	router.map(routes.folders.rename, rename);
	return fetchRoute(router, routes.folders.rename.href({ folderId: FOLDER.id }), body);
}

/**
 * Posts the delete prompt as `viewer`, which carries the method the route declares.
 *
 * @param viewer - Who the request is signed in as, or `null` for an anonymous one.
 */
function postDelete(viewer: typeof VIEWER | null) {
	let router = createTestRouter(viewer);
	router.map(routes.folders.delete, remove);
	return fetchRoute(router, routes.folders.delete.href({ folderId: FOLDER.id }), {
		_method: "DELETE",
	});
}

beforeEach(() => {
	store = createUserStoreDouble();
	userStore.mockClear();
});

describe("POST /folders", () => {
	test("redirects an anonymous visitor home", async () => {
		let response = await postCreate(null, { title: "Tech" });

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.home.href());
		expect(store.createFolder).not.toHaveBeenCalled();
	});

	test("makes the folder in the signed-in reader's own store and stands them in it", async () => {
		store.createFolder.mockResolvedValue({ ok: true, folder: FOLDER });

		let response = await postCreate(VIEWER, { title: "Tech" });

		expect(userStore).toHaveBeenCalledWith(VIEWER.id);
		expect(store.createFolder).toHaveBeenCalledWith("Tech");
		expect(response.headers.get("location")).toBe(`${FOLDER_PATH}?folder=created`);
	});

	/** Asking for a folder by a name already in use is asking for the folder they have. */
	test("stands the reader in the folder they already had by that name", async () => {
		store.createFolder.mockResolvedValue({ ok: false, reason: "duplicate-title" });
		store.listFolders.mockResolvedValue([FOLDER]);

		let response = await postCreate(VIEWER, { title: "Tech" });

		expect(response.headers.get("location")).toBe(`${FOLDER_PATH}?folder=duplicate`);
	});

	test("leaves a reader who named nothing where they were reading", async () => {
		store.createFolder.mockResolvedValue({ ok: false, reason: "invalid-title" });

		let response = await postCreate(VIEWER, { title: "  " });

		expect(response.headers.get("location")).toBe(routes.reading.index.href());
	});
});

describe("POST /folders/:folderId", () => {
	test("renames the folder the URL names and reports it on that folder's page", async () => {
		store.renameFolder.mockResolvedValue({ ok: true, folder: FOLDER });

		let response = await postRename(VIEWER, { title: "Programming" });

		expect(store.renameFolder).toHaveBeenCalledWith(FOLDER.id, "Programming");
		expect(response.headers.get("location")).toBe(`${FOLDER_PATH}?folder=renamed`);
	});

	test("tells a name already in use apart from a name that is nothing but space", async () => {
		store.renameFolder.mockResolvedValue({ ok: false, reason: "duplicate-title" });
		expect((await postRename(VIEWER, { title: "News" })).headers.get("location")).toBe(
			`${FOLDER_PATH}?folder=duplicate`,
		);

		store.renameFolder.mockResolvedValue({ ok: false, reason: "invalid-title" });
		expect((await postRename(VIEWER, { title: " " })).headers.get("location")).toBe(
			`${FOLDER_PATH}?folder=invalid`,
		);
	});
});

describe("DELETE /folders/:folderId", () => {
	test("redirects an anonymous visitor home", async () => {
		let response = await postDelete(null);

		expect(response.headers.get("location")).toBe(routes.home.href());
		expect(store.deleteFolder).not.toHaveBeenCalled();
	});

	/** A folder holds no posts, so this is the one action here with nothing to report after. */
	test("takes the folder away and returns the reader to their queue", async () => {
		store.deleteFolder.mockResolvedValue({ ok: true, title: "Tech", feeds: 4 });

		let response = await postDelete(VIEWER);

		expect(store.deleteFolder).toHaveBeenCalledWith(FOLDER.id);
		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.reading.index.href());
	});
});
