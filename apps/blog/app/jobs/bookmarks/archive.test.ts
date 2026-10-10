/**
 * Runs the archive job against a migrated database and a mocked Wayback Machine, so a new
 * bookmark is captured through Save Page Now across two runs, an old one takes the closest
 * existing capture, and a rate limit or a refused capture ends as the job promises.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database as DataTable } from "remix/data-table";

import { createJobContext, Job } from "@sdxc/jobs";
import { unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { Database } from "~/app/http/middleware/database";
import jobs from "~/app/jobs";
import { bookmarkAddress } from "~/app/models/post-values";
import { testDatabase } from "~/app/test/database";
import { seedAuthor } from "~/app/test/fixtures";
import { bindModels, publishModels } from "~/app/test/models";

vi.doMock("~/app/services/wayback-keys", () => ({
	waybackKeys: async () => ({ access: "access-key", secret: "secret-key" }),
}));

let archive = (await import("./archive")).default;

/** The bookmarked page every test archives. */
const PAGE_URL = "https://example.com/post";

const server = setupServer();

let db: DataTable;
let author: string;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	db = await testDatabase();
	author = await seedAuthor(db);
});

/** Saves a bookmark of the page with its record, created at `created_at` when given. */
async function bookmark(created_at?: string): Promise<string> {
	let created = unwrap(
		await bindModels(db).likes.create({
			author_id: author,
			...(created_at ? { created_at } : {}),
			meta: { url: PAGE_URL, title: "Saved" },
		}),
	);
	if (!created) throw new Error("Seeding the bookmark failed");
	await bindModels(db).bookmarks.claim(created.id, bookmarkAddress(PAGE_URL), null);
	return created.id;
}

/** Runs the archive job the way the dispatcher would after its middleware. */
async function run(postId: string): Promise<void> {
	let ctx = createJobContext(jobs.bookmarks.archive, { id: "m", attempts: 1, input: { postId } });
	ctx.set(Database, db, { property: "db" });
	publishModels(ctx, db);
	await archive(ctx);
}

describe("the archive job", () => {
	test("asks for a capture, then records its instant once it lands", async () => {
		let authorization: string | null = null;
		let saved: string | null = null;
		server.use(
			http.post("https://web.archive.org/save", async ({ request }) => {
				authorization = request.headers.get("authorization");
				saved = new URLSearchParams(await request.text()).get("url");
				return HttpResponse.json({ url: PAGE_URL, job_id: "spn2-1" });
			}),
		);
		let id = await bookmark();

		await expect(run(id)).rejects.toBeInstanceOf(Job.Retry);
		expect((await bindModels(db).bookmarks.find(id))?.archive_job).toBe("spn2-1");
		expect(saved).toBe(PAGE_URL);
		expect(authorization).toBe("LOW access-key:secret-key");

		server.use(
			http.get("https://web.archive.org/save/status/spn2-1", () =>
				HttpResponse.json({ status: "success", timestamp: "20261007153045" }),
			),
		);
		await run(id);

		expect((await bindModels(db).likes.find(id))?.meta.archived_at).toBe(
			"2026-10-07T15:30:45.000Z",
		);
		let record = await bindModels(db).bookmarks.find(id);
		expect(record?.archive_job).toBeNull();
		expect(record?.archive_attempted_at).not.toBeNull();
	});

	test("keeps polling a capture that is still pending", async () => {
		server.use(
			http.post("https://web.archive.org/save", () => HttpResponse.json({ job_id: "spn2-2" })),
			http.get("https://web.archive.org/save/status/spn2-2", () =>
				HttpResponse.json({ status: "pending" }),
			),
		);
		let id = await bookmark();
		await expect(run(id)).rejects.toBeInstanceOf(Job.Retry);

		await expect(run(id)).rejects.toBeInstanceOf(Job.Retry);

		expect((await bindModels(db).bookmarks.find(id))?.archive_job).toBe("spn2-2");
	});

	test("takes the closest existing capture of an old bookmark without asking for one", async () => {
		let asked: string | null = null;
		server.use(
			http.get("https://archive.org/wayback/available", ({ request }) => {
				asked = new URL(request.url).searchParams.get("timestamp");
				return HttpResponse.json({
					archived_snapshots: {
						closest: { available: true, timestamp: "20200824101112", status: "200" },
					},
				});
			}),
		);
		let id = await bookmark("2020-08-23T05:18:46.000Z");

		await run(id);

		expect(asked).toBe("20200823051846");
		expect((await bindModels(db).likes.find(id))?.meta.archived_at).toBe(
			"2020-08-24T10:11:12.000Z",
		);
	});

	test("asks for a capture of an old bookmark the archive never captured", async () => {
		server.use(
			http.get("https://archive.org/wayback/available", () =>
				HttpResponse.json({ archived_snapshots: {} }),
			),
			http.post("https://web.archive.org/save", () => HttpResponse.json({ job_id: "spn2-3" })),
		);
		let id = await bookmark("2020-08-23T05:18:46.000Z");

		await expect(run(id)).rejects.toBeInstanceOf(Job.Retry);

		expect((await bindModels(db).bookmarks.find(id))?.archive_job).toBe("spn2-3");
	});

	test("retries later when the archive is rate limiting", async () => {
		server.use(
			http.post("https://web.archive.org/save", () => new HttpResponse(null, { status: 429 })),
		);
		let id = await bookmark();

		let ending = await Promise.resolve(run(id)).catch((error: unknown) => error);

		expect(ending).toBeInstanceOf(Job.Retry);
		expect(ending instanceof Job.Retry && ending.delay).toBe("5 minutes");
		expect((await bindModels(db).bookmarks.find(id))?.archive_attempted_at).toBeNull();
	});

	test("records the attempt when the archive refuses the capture", async () => {
		server.use(
			http.post("https://web.archive.org/save", () =>
				HttpResponse.json({ status: "error", status_ext: "error:blocked-url" }),
			),
		);
		let id = await bookmark();

		await expect(run(id)).rejects.toBeInstanceOf(Job.NonRetriable);

		let record = await bindModels(db).bookmarks.find(id);
		expect(record?.archive_attempted_at).not.toBeNull();
		expect((await bindModels(db).likes.find(id))?.meta.archived_at).toBe("");
	});
});
