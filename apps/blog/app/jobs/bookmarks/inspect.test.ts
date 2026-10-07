/**
 * Runs the bookmark inspection against a migrated database and mocked pages, so the flag
 * rules hold: a new moved or gone reading is confirmed before it is recorded, a confirmed
 * one raises the flag once, `ok` clears it, and a healthy page fills what is missing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database as DataTable } from "remix/data-table";

import { createJobContext, Job } from "@sdxc/jobs";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { Database } from "~/app/http/middleware/database";
import jobs from "~/app/jobs";
import { Bookmark } from "~/app/repositories/bookmark";
import { LikePost } from "~/app/repositories/posts/like";
import { testDatabase } from "~/app/test/database";
import { seedAuthor } from "~/app/test/fixtures";

import inspect from "./inspect";

/** The bookmarked page every test reads. */
const PAGE_URL = "https://example.com/post";

/** A page declaring the headline and summary a bookmark is filled from. */
const PAGE = `<!doctype html><html><head>
<meta property="og:title" content="The Headline">
<meta property="og:description" content="What the page is about.">
</head><body></body></html>`;

const server = setupServer();

let db: DataTable;
let author: string;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	db = await testDatabase();
	author = await seedAuthor(db);
	server.use(
		http.get("https://example.com/robots.txt", () => new HttpResponse(null, { status: 404 })),
	);
});

/** Answers the bookmarked page with `status`, as an HTML page when it is a success. */
function answering(status: number) {
	server.use(
		http.get(PAGE_URL, () =>
			status === 200
				? HttpResponse.text(PAGE, { headers: { "content-type": "text/html" } })
				: new HttpResponse(null, { status }),
		),
	);
}

/** Saves a bookmark of the page with its record, as the CMS leaves it. */
async function bookmark(meta: { title?: string; description?: string } = {}): Promise<string> {
	let created = await LikePost.create(db, {
		author_id: author,
		meta: {
			url: PAGE_URL,
			title: meta.title ?? "Typed",
			description: meta.description ?? "Typed.",
		},
	});
	if (!created) throw new Error("Seeding the bookmark failed");
	await Bookmark.claim(db, created.id, LikePost.address(PAGE_URL), null);
	return created.id;
}

/** Runs the inspection the way the dispatcher would after its middleware. */
async function run(postId: string, attempts = 1): Promise<void> {
	let ctx = createJobContext(jobs.bookmarks.inspect, { id: "m", attempts, input: { postId } });
	ctx.set(Database, db, { property: "db" });
	await inspect(ctx);
}

describe("the inspect job", () => {
	test("records a page that answered and fills only what the bookmark is missing", async () => {
		answering(200);
		let id = await bookmark({ title: "My Title", description: "" });

		await run(id);

		let record = await Bookmark.findByPostId(db, id);
		expect(record).toMatchObject({ status: "ok", http_status: 200, flag: null });
		expect(record?.described_at).not.toBeNull();
		expect((await LikePost.findById(db, id))?.meta).toMatchObject({
			title: "My Title",
			description: "What the page is about.",
		});
	});

	test("reads a new gone page again later before recording it", async () => {
		answering(404);
		let id = await bookmark();

		await expect(run(id)).rejects.toBeInstanceOf(Job.Retry);

		expect((await Bookmark.findByPostId(db, id))?.checked_at).toBeNull();
	});

	test("raises the flag once the second read agrees", async () => {
		answering(404);
		let id = await bookmark();

		await run(id, 2);

		let record = await Bookmark.findByPostId(db, id);
		expect(record).toMatchObject({ status: "gone", http_status: 404, flag: "gone" });
		expect(record?.flagged_at).not.toBeNull();
	});

	test("keeps a raised flag's date when the page is still gone", async () => {
		answering(404);
		let id = await bookmark();
		await run(id, 2);
		let first = await Bookmark.findByPostId(db, id);
		await Bookmark.review(db, id);

		await run(id);

		let record = await Bookmark.findByPostId(db, id);
		expect(record?.flagged_at).toBe(first?.flagged_at);
		expect(record && Bookmark.isOpen(record)).toBe(false);
	});

	test("leaves the flag through a read that could not tell, and clears it once the page is back", async () => {
		answering(404);
		let id = await bookmark();
		await run(id, 2);

		answering(503);
		await run(id);
		expect((await Bookmark.findByPostId(db, id))?.flag).toBe("gone");

		answering(200);
		await run(id);
		expect(await Bookmark.findByPostId(db, id)).toMatchObject({ status: "ok", flag: null });
	});

	test("leaves a bookmark that links within the site alone", async () => {
		let created = await LikePost.create(db, {
			author_id: author,
			meta: { url: "/articles/local", title: "Local" },
		});

		await expect(run(created?.id ?? "")).rejects.toBeInstanceOf(Job.Ack);

		expect(await Bookmark.findByPostId(db, created?.id ?? "")).toBeNull();
	});
});
