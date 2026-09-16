/**
 * Tests `POST /feeds/:feedId/folder`: the guard on it, what each shape of submission asks
 * the reader's own store to file, and the value every outcome travels back to the feed
 * page under. The controller renders nothing, so every assertion here is about the
 * redirect.
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

let { default: file } = await import("./file");

/** The subscription every test below files. */
const FEED_ID = "01J0FEED0000000000000000A1";

/** The folder it is filed into, as the store answers it. */
const FOLDER = { id: "01J0FOLDER00000000000000A1", title: "Tech" };

/** Where a submission returns the reader to, before the outcome is appended to it. */
const FEED_PATH = routes.feed.href({ feed: FEED_ID });

/**
 * Posts the filing form for {@link FEED_ID} as `viewer`.
 *
 * @param viewer - Who the request is signed in as, or `null` for an anonymous one.
 * @param body - The fields the form carries.
 */
function postFiling(viewer: typeof VIEWER | null, body: Record<string, string> = {}) {
	let router = createTestRouter(viewer);
	router.map(routes.folders.file, file);
	return fetchRoute(router, routes.folders.file.href({ feedId: FEED_ID }), body);
}

beforeEach(() => {
	store = createUserStoreDouble();
	userStore.mockClear();
});

describe("POST /feeds/:feedId/folder", () => {
	test("redirects an anonymous visitor home", async () => {
		let response = await postFiling(null, { folderId: FOLDER.id });

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.home.href());
		expect(store.fileFeed).not.toHaveBeenCalled();
	});

	test("files into the folder the submission picked", async () => {
		store.fileFeed.mockResolvedValue({ ok: true, folder: FOLDER, moved: 12 });

		let response = await postFiling(VIEWER, { folderId: FOLDER.id });

		expect(userStore).toHaveBeenCalledWith(VIEWER.id);
		expect(store.fileFeed).toHaveBeenCalledWith(FEED_ID, { folderId: FOLDER.id });
		expect(response.headers.get("location")).toBe(`${FEED_PATH}?folder=filed`);
	});

	/** Typing a name is the more deliberate of the two, so it wins where both arrive. */
	test("files under a name where one was typed, whatever was picked beside it", async () => {
		store.fileFeed.mockResolvedValue({ ok: true, folder: FOLDER, moved: 0 });

		await postFiling(VIEWER, { folderId: FOLDER.id, title: " Tech " });

		expect(store.fileFeed).toHaveBeenCalledWith(FEED_ID, { title: "Tech" });
	});

	test("reads an empty submission as taking the feed out of its folder", async () => {
		store.fileFeed.mockResolvedValue({ ok: true, folder: null, moved: 4 });

		let response = await postFiling(VIEWER, { folderId: "" });

		expect(store.fileFeed).toHaveBeenCalledWith(FEED_ID, null);
		expect(response.headers.get("location")).toBe(`${FEED_PATH}?folder=unfiled`);
	});

	test("tells a folder that is gone apart from a feed that is not followed", async () => {
		store.fileFeed.mockResolvedValue({ ok: false, reason: "not-found" });
		expect((await postFiling(VIEWER, { folderId: "x" })).headers.get("location")).toBe(
			`${FEED_PATH}?folder=gone`,
		);

		store.fileFeed.mockResolvedValue({ ok: false, reason: "not-following" });
		expect((await postFiling(VIEWER, { folderId: "x" })).headers.get("location")).toBe(
			`${FEED_PATH}?folder=missing`,
		);
	});
});
