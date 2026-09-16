/**
 * Tests `POST /feeds/import`: the guard on it, the addresses it takes out of an uploaded
 * document and hands to the reader's own store, and the value each outcome travels back to
 * the settings page under. The controller renders nothing, so every assertion here is about
 * the redirect.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test, vi } from "vitest";

import { createTestRouter, ORIGIN, VIEWER } from "~/app/lib/test/controller";
import { createUserStoreDouble } from "~/app/lib/test/store";
import routes from "~/routes/web";

let store = createUserStoreDouble();

/** Answers with whatever the current test set up, so `beforeEach` can hand out a fresh one. */
let userStore = vi.fn(() => store);

vi.doMock("~/database/user-do", () => ({ userStore }));

let { default: importFeeds, FILE_FIELD } = await import("./import");

/** Where an import returns the reader to, before the outcome is appended to it. */
const SETTINGS_PATH = routes.settings.href();

/** A subscription list as another reader would have written it, folders and all. */
const OPML_DOCUMENT = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
	<head><title>Subscriptions</title></head>
	<body>
		<outline text="Example Blog" xmlUrl="https://example.com/feed.xml" htmlUrl="https://example.com"/>
		<outline text="Writing">
			<outline text="Another Blog" xmlUrl="https://another.example/feed.xml"/>
		</outline>
	</body>
</opml>`;

/** The addresses {@link OPML_DOCUMENT} lists, in the order it lists them. */
const FEED_URLS = ["https://example.com/feed.xml", "https://another.example/feed.xml"];

/** A document that is OPML and lists no subscription at all. */
const EMPTY_DOCUMENT = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0"><head><title>Subscriptions</title></head><body></body></opml>`;

/**
 * An upload carrying `source`, named the way a browser names a chosen file.
 *
 * @param source - The bytes the file holds.
 */
function opmlFile(source: string) {
	return new File([source], "subscriptions.opml", { type: "text/x-opml" });
}

/**
 * Posts the import form as `viewer`, with `file` chosen in the upload field.
 *
 * The request is built here rather than through `fetchRoute`, which posts a URL-encoded
 * body: a file field reaches the parser only as multipart, which a `FormData` body is
 * what produces.
 *
 * @param viewer - Who the request is signed in as, or `null` for an anonymous one.
 * @param file - The chosen file, or omitted for a form submitted without one.
 */
function postImport(viewer: typeof VIEWER | null, file?: File) {
	let router = createTestRouter(viewer);
	router.map(routes.feeds.import, importFeeds);

	let body = new FormData();
	if (file) body.set(FILE_FIELD, file);

	return router.fetch(
		new Request(new URL(routes.feeds.import.href(), ORIGIN), { method: "POST", body }),
	);
}

beforeEach(() => {
	store = createUserStoreDouble();
	userStore.mockClear();
});

describe("POST /feeds/import", () => {
	test("redirects an anonymous visitor home", async () => {
		let response = await postImport(null, opmlFile(OPML_DOCUMENT));

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.home.href());
		expect(store.importFeeds).not.toHaveBeenCalled();
	});

	test("asks a form submitted without a file for one", async () => {
		let response = await postImport(VIEWER);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${SETTINGS_PATH}?imported=missing`);
		expect(store.importFeeds).not.toHaveBeenCalled();
	});

	test("reports a file that is not a subscription list", async () => {
		let response = await postImport(VIEWER, opmlFile("a plain sentence, not markup at all"));

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${SETTINGS_PATH}?imported=unreadable`);
		expect(store.importFeeds).not.toHaveBeenCalled();
	});

	test("refuses an upload far larger than a subscription list, before reading it", async () => {
		let response = await postImport(VIEWER, opmlFile("x".repeat(1024 * 1024 + 1)));

		expect(response.headers.get("location")).toBe(`${SETTINGS_PATH}?imported=too-large`);
		expect(store.importFeeds).not.toHaveBeenCalled();
	});

	test("tells a document listing no feeds apart from one that could not be read", async () => {
		let response = await postImport(VIEWER, opmlFile(EMPTY_DOCUMENT));

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${SETTINGS_PATH}?imported=empty`);
		expect(store.importFeeds).not.toHaveBeenCalled();
	});

	test("hands every address the document lists to the signed-in reader's own store", async () => {
		await postImport(VIEWER, opmlFile(OPML_DOCUMENT));

		expect(userStore).toHaveBeenCalledWith(VIEWER.id);
		expect(store.importFeeds).toHaveBeenCalledWith(FEED_URLS);
	});

	test("reports what an import followed and what it already followed", async () => {
		store.importFeeds.mockResolvedValue({ added: 2, alreadyFollowing: 1, failed: [] });

		let response = await postImport(VIEWER, opmlFile(OPML_DOCUMENT));

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			`${SETTINGS_PATH}?imported=done&added=2&following=1&failed=0`,
		);
	});

	test("counts the feeds it could not retrieve, and reports the import as done", async () => {
		store.importFeeds.mockResolvedValue({
			added: 47,
			alreadyFollowing: 0,
			failed: [
				"https://gone.example/feed.xml",
				"https://slow.example/feed.xml",
				"https://moved.example/feed.xml",
			],
		});

		let response = await postImport(VIEWER, opmlFile(OPML_DOCUMENT));

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			`${SETTINGS_PATH}?imported=done&added=47&following=0&failed=3`,
		);
	});
});
