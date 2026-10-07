/**
 * Saves bookmarks against a migrated database and mocked pages, so the promises the CMS
 * relies on hold: a page fills what the form left empty, a typed value wins, one URL is one
 * bookmark however it is spelled, and saving an edit closes the bookmark's review.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { Bookmark } from "~/app/repositories/bookmark";
import { LikePost } from "~/app/repositories/posts/like";
import { testDatabase } from "~/app/test/database";
import { seedAuthor } from "~/app/test/fixtures";

import { createBookmark, updateBookmark } from "./bookmarks";

/** A page declaring the headline and summary a bookmark is filled from. */
const PAGE = `<!doctype html><html><head>
<meta property="og:title" content="The Headline">
<meta name="description" content="What the page is about.">
</head><body></body></html>`;

const server = setupServer();

let db: Database;
let author: string;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	db = await testDatabase();
	author = await seedAuthor(db);
	server.use(
		http.get("https://example.com/post", () =>
			HttpResponse.text(PAGE, { headers: { "content-type": "text/html" } }),
		),
	);
});

/** The created bookmark's id, failing the test for any other outcome. */
async function created(fields: Parameters<typeof createBookmark>[2]): Promise<string> {
	let result = await createBookmark(db, author, fields);
	if (!isSuccess(result) || result.data.outcome !== "created") {
		throw new Error(`Expected a new bookmark for ${fields.url}`);
	}
	return result.data.id;
}

describe("createBookmark", () => {
	test("fills the title and description from the page when only a URL is given", async () => {
		let id = await created({ url: "https://example.com/post?utm_source=share" });

		let bookmark = await LikePost.findById(db, id);
		expect(bookmark?.meta).toEqual({
			url: "https://example.com/post",
			title: "The Headline",
			description: "What the page is about.",
		});

		let record = await Bookmark.findByPostId(db, id);
		expect(record).toMatchObject({
			address: "example.com/post",
			status: "ok",
			http_status: 200,
		});
		expect(record?.described_at).not.toBeNull();
	});

	test("keeps what the form typed over what the page says", async () => {
		let id = await created({
			url: "https://example.com/post",
			title: "My Title",
			description: "",
		});

		let bookmark = await LikePost.findById(db, id);
		expect(bookmark?.meta.title).toBe("My Title");
		expect(bookmark?.meta.description).toBe("What the page is about.");
	});

	test("answers the existing bookmark for another spelling of a saved URL", async () => {
		let id = await created({ url: "https://example.com/post" });

		let again = await createBookmark(db, author, { url: "http://www.example.com/post/" });

		expect(isSuccess(again) && again.data).toEqual({ outcome: "duplicate", id });
		expect(await LikePost.count(db)).toBe(1);
	});

	test("saves a bookmark whose page cannot be read, and says it was not read", async () => {
		server.use(http.get("https://example.com/gone", () => new HttpResponse(null, { status: 404 })));

		let result = await createBookmark(db, author, { url: "https://example.com/gone" });

		expect(isSuccess(result) && result.data.outcome === "created" && result.data.read).toBe(false);
		let id = isSuccess(result) ? result.data.id : "";
		expect((await LikePost.findById(db, id))?.meta.title).toBe("");
		expect((await Bookmark.findByPostId(db, id))?.status).toBe("gone");
	});
});

describe("updateBookmark", () => {
	test("refuses a URL another bookmark already holds", async () => {
		let first = await created({ url: "https://example.com/post" });
		server.use(
			http.get("https://example.com/other", () =>
				HttpResponse.text(PAGE, { headers: { "content-type": "text/html" } }),
			),
		);
		let second = await created({ url: "https://example.com/other" });

		let result = await updateBookmark(db, second, author, {
			url: "https://www.example.com/post",
			title: "Other",
			description: "",
		});

		expect(result).toEqual({ outcome: "duplicate", id: first });
		expect((await LikePost.findById(db, second))?.meta.url).toBe("https://example.com/other");
	});

	test("moves the record to a new URL and forgets what was read from the old one", async () => {
		let id = await created({ url: "https://example.com/post" });

		let result = await updateBookmark(db, id, author, {
			url: "https://example.org/new",
			title: "Moved",
			description: "Elsewhere now.",
		});

		expect(result).toEqual({ outcome: "updated", moved: true });
		let record = await Bookmark.findByPostId(db, id);
		expect(record).toMatchObject({ address: "example.org/new", status: null, checked_at: null });
		expect(record?.reviewed_at).not.toBeNull();
	});

	test("reviews the bookmark on every save, even one that changes nothing", async () => {
		let id = await created({ url: "https://example.com/post" });

		let result = await updateBookmark(db, id, author, {
			url: "https://example.com/post/",
			title: "The Headline",
			description: "What the page is about.",
		});

		expect(result).toEqual({ outcome: "updated", moved: false });
		let record = await Bookmark.findByPostId(db, id);
		expect(record?.status).toBe("ok");
		expect(record?.reviewed_at).not.toBeNull();
	});

	test("answers missing for a bookmark that does not exist", async () => {
		expect(await updateBookmark(db, "nope", author, { url: "https://example.com/post" })).toEqual({
			outcome: "missing",
		});
	});
});
