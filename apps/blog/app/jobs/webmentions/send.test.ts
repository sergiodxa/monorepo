/**
 * Tests the send planning and the scheduled-post sweep against a migrated in-memory
 * database: which targets a created, updated or deleted post notifies, that a preview
 * waits for its date, and which scheduled posts the cron picks up.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database as DataTable } from "remix/data-table";

import { createJobContext, Job } from "@sdxc/jobs";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { Database } from "~/app/http/middleware/database";
import jobs from "~/app/jobs";
import { Post } from "~/app/repositories/post";
import { ArticlePost } from "~/app/repositories/posts/article";
import { WebmentionSend } from "~/app/repositories/webmention-send";
import { testDatabase } from "~/app/test/database";
import { seedAuthor } from "~/app/test/fixtures";

/** Every `enqueueMany` call, standing in for the queue the dispatcher writes to. */
let enqueued = vi.fn<(job: unknown, inputs: unknown[]) => Promise<void>>(async () => {});

vi.doMock("~/app/jobs/dispatcher", () => ({ dispatcher: { enqueueMany: enqueued } }));

let send = (await import("./send")).default;
let scheduled = (await import("./scheduled")).default;

let db: DataTable;
let author: string;

beforeEach(async () => {
	enqueued.mockClear();
	db = await testDatabase();
	author = await seedAuthor(db);
});

/** Creates an article whose body links to the given URLs. */
async function article(slug: string, links: string[], published_at: string | null = null) {
	let content = links.map((href, index) => `[link ${index}](${href})`).join(" and ");
	let created = await ArticlePost.create(db, {
		author_id: author,
		published_at,
		meta: { slug, title: slug, locale: "en", content },
	});
	return created!.id;
}

/** Runs a job handler the way the dispatcher would after its middleware. */
async function run(handler: typeof send, input: { postId: string }): Promise<void> {
	let ctx = createJobContext(jobs.webmentions.send, { id: "m", attempts: 1, input });
	ctx.set(Database, db, { property: "db" });
	await handler(ctx);
}

/** The deliveries the last `enqueueMany` call queued. */
function deliveries() {
	return enqueued.mock.lastCall?.[1] ?? [];
}

describe("the send job", () => {
	test("queues one delivery per page the post links to on other sites", async () => {
		let id = await article("links", [
			"https://example.com/a",
			"https://sergiodxa.com/articles/own",
			"https://example.org/b",
		]);

		await run(send, { postId: id });

		expect(deliveries()).toEqual([
			{ postId: id, target: "https://example.com/a", removed: false },
			{ postId: id, target: "https://example.org/b", removed: false },
		]);
		expect((await Post.findDueForMentions(db)).includes(id)).toBe(false);
	});

	test("also notifies a page the post stopped linking to", async () => {
		let id = await article("edited", ["https://example.com/kept"]);
		await WebmentionSend.record(db, id, "https://example.com/dropped", {
			status: "sent",
			endpoint: "https://example.com/webmention",
			code: 202,
			location: null,
		});

		await run(send, { postId: id });

		expect(deliveries()).toEqual([
			{ postId: id, target: "https://example.com/kept", removed: false },
			{ postId: id, target: "https://example.com/dropped", removed: true },
		]);
	});

	test("notifies every past target once the post is deleted", async () => {
		let id = await article("deleted", ["https://example.com/a"]);
		await WebmentionSend.record(db, id, "https://example.com/a", {
			status: "sent",
			endpoint: null,
			code: 202,
			location: null,
		});
		await ArticlePost.destroy(db, id);

		await run(send, { postId: id });

		expect(deliveries()).toEqual([{ postId: id, target: "https://example.com/a", removed: true }]);
	});

	test("waits for a preview's publish date", async () => {
		let future = new Date(Date.now() + 86_400_000).toISOString();
		let id = await article("preview", ["https://example.com/a"], future);

		await expect(run(send, { postId: id })).rejects.toBeInstanceOf(Job.Ack);
		expect(enqueued).not.toHaveBeenCalled();
	});
});

describe("the scheduled job", () => {
	test("queues the send of a scheduled post once its date has arrived, and only once", async () => {
		let past = new Date(Date.now() - 60_000).toISOString();
		let future = new Date(Date.now() + 86_400_000).toISOString();
		let arrived = await article("arrived", [], past);
		await article("waiting", [], future);
		await article("immediate", [], null);

		let ctx = createJobContext(jobs.webmentions.scheduled, { id: "m", attempts: 1 });
		ctx.set(Database, db, { property: "db" });
		await scheduled(ctx);

		expect(deliveries()).toEqual([{ postId: arrived }]);

		await Post.markMentionsSent(db, arrived);
		expect(await Post.findDueForMentions(db)).toEqual([]);
	});
});
