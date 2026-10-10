/**
 * Runs the digest and the weekly sweep against a migrated database, a recording mail
 * transport and a stand-in queue, so an open flag is mailed exactly once, a reviewed one
 * never, and the sweep queues every inspection and each archive that is due.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database as DataTable } from "remix/data-table";

import { createJobContext, Job } from "@sdxc/jobs";
import { MemoryTransport } from "@sdxc/mail/memory";
import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { Database } from "~/app/http/middleware/database";
import jobs from "~/app/jobs";
import { Mail } from "~/app/jobs/middleware/mail";
import { bookmarkAddress } from "~/app/models/post-values";
import { testDatabase } from "~/app/test/database";
import { seedAuthor } from "~/app/test/fixtures";
import { bindModels, publishModels } from "~/app/test/models";

/** Every `enqueueMany` call, standing in for the queue the dispatcher writes to. */
let enqueued = vi.fn<(job: unknown, inputs: unknown[]) => Promise<void>>(async () => {});

vi.doMock("~/app/jobs/dispatcher", () => ({ dispatcher: { enqueueMany: enqueued } }));

let digest = (await import("./digest")).default;
let sweep = (await import("./sweep")).default;

let db: DataTable;
let author: string;
let transport: MemoryTransport;

beforeEach(async () => {
	enqueued.mockClear();
	db = await testDatabase();
	author = await seedAuthor(db);
	transport = new MemoryTransport();
});

/** Saves a bookmark with its record, flagged `gone` when asked. */
async function bookmark(url: string, flagged = false): Promise<string> {
	let created = unwrap(
		await bindModels(db).likes.create({
			author_id: author,
			meta: { url, title: `Saved ${url}`, description: "" },
		}),
	);
	if (!created) throw new Error("Seeding the bookmark failed");
	await bindModels(db).bookmarks.claim(created.id, bookmarkAddress(url), null);
	if (flagged) {
		await bindModels(db).bookmarks.record(created.id, {
			status: "gone",
			httpStatus: 404,
			finalUrl: url,
		});
	}
	return created.id;
}

/** Runs the digest with the recording transport, or with none (`null`) as a worker without a binding. */
async function runDigest(mail: MemoryTransport | null = transport): Promise<void> {
	let ctx = createJobContext(jobs.bookmarks.digest, { id: "m", attempts: 1 });
	ctx.set(Database, db, { property: "db" });
	publishModels(ctx, db);
	ctx.set(Mail, mail ?? undefined, { property: "mail" });
	try {
		await digest(ctx);
	} catch (error) {
		if (!(error instanceof Job.Ack)) throw error;
	}
}

describe("the digest job", () => {
	test("mails every open flag once, with a link to review it", async () => {
		let id = await bookmark("https://example.com/dead", true);
		await bookmark("https://example.com/fine");

		await runDigest();
		await runDigest();

		expect(transport.messages).toHaveLength(1);
		expect(transport.last?.subject).toBe("[Bookmarks] 1 to review");
		expect(transport.last?.text).toContain("https://example.com/dead");
		expect(transport.last?.text).toContain(`https://sergiodxa.com/cms/bookmarks/${id}/edit`);
		expect(transport.last?.text).toContain("Gone (404)");
	});

	test("leaves out a flag reviewed after it was raised", async () => {
		let id = await bookmark("https://example.com/dead", true);
		await bindModels(db).bookmarks.review(id);

		await runDigest();

		expect(transport.messages).toHaveLength(0);
	});

	test("keeps a flag unreported when the worker cannot send mail", async () => {
		await bookmark("https://example.com/dead", true);

		await expect(runDigest(null)).rejects.toBeInstanceOf(Job.NonRetriable);
		await runDigest();

		expect(transport.messages).toHaveLength(1);
	});
});

describe("the sweep job", () => {
	test("queues an inspection for every bookmark on another site, and an archive for each unarchived one", async () => {
		let external = await bookmark("https://example.com/post");
		let created = unwrap(
			await bindModels(db).likes.create({
				author_id: author,
				meta: { url: "/articles/local", title: "Local" },
			}),
		);

		let ctx = createJobContext(jobs.bookmarks.sweep, { id: "m", attempts: 1 });
		ctx.set(Database, db, { property: "db" });
		publishModels(ctx, db);
		await sweep(ctx);

		expect(enqueued).toHaveBeenCalledWith(jobs.bookmarks.inspect, [{ postId: external }]);
		expect(enqueued).toHaveBeenCalledWith(jobs.bookmarks.archive, [{ postId: external }]);
		expect(created).not.toBeNull();
	});

	test("leaves out an archived bookmark and one whose archive was attempted this month", async () => {
		let archived = await bookmark("https://example.com/archived");
		await bindModels(db).likes.update(archived, {
			meta: { archived_at: "2026-10-01T00:00:00.000Z" },
		});
		let attempted = await bookmark("https://example.com/attempted");
		await bindModels(db).bookmarks.archived(attempted);

		let ctx = createJobContext(jobs.bookmarks.sweep, { id: "m", attempts: 1 });
		ctx.set(Database, db, { property: "db" });
		publishModels(ctx, db);
		await sweep(ctx);

		expect(enqueued).toHaveBeenCalledWith(jobs.bookmarks.archive, []);
	});
});
