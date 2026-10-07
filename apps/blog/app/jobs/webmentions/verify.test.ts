/**
 * Tests the Webmention verification job against a migrated in-memory database, with
 * every source page served by MSW: what a linking, gone or failing source becomes, and
 * how the per-host policy decides a new mention's arrival status.
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
import { ArticlePost } from "~/app/repositories/posts/article";
import { Webmention } from "~/app/repositories/webmention";
import { testDatabase } from "~/app/test/database";
import { seedAuthor } from "~/app/test/fixtures";

import handler from "./verify";

const TARGET = "https://blog.test/articles/verified";
const SOURCE = "https://replies.example.com/notes/1";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let db: DataTable;

beforeEach(async () => {
	db = await testDatabase();
	let author = await seedAuthor(db);
	await ArticlePost.create(db, {
		author_id: author,
		published_at: null,
		meta: { slug: "verified", title: "Verified", locale: "en", content: "Body" },
	});
});

/** Serves the source page as HTML, replying to the target with an `h-entry`. */
function serveReply(status = 200) {
	server.use(
		http.get(SOURCE, () =>
			HttpResponse.html(
				`<div class="h-entry"><a class="p-author h-card" href="https://replies.example.com">Ada</a>
				<p class="e-content">Great post!</p>
				<a class="u-in-reply-to" href="${TARGET}">in reply to</a></div>`,
				{ status },
			),
		),
	);
}

/** Runs the job for the pair, the way the dispatcher would after its middleware. */
async function run(source = SOURCE, target = TARGET) {
	let ctx = createJobContext(jobs.webmentions.verify, {
		id: "message-1",
		attempts: 1,
		input: { source, target },
	});
	ctx.set(Database, db, { property: "db" });
	await handler(ctx);
}

/** The stored mention for the default pair. */
function stored() {
	return Webmention.findByPair(db, { source: new URL(SOURCE), target: new URL(TARGET) });
}

describe("the verify job", () => {
	test("stores a linking source as a pending reply with its author and content", async () => {
		serveReply();

		await run();

		let mention = await stored();
		expect(mention?.status).toBe("pending");
		expect(mention?.kind).toBe("reply");
		expect(mention?.author_name).toBe("Ada");
		expect(mention?.content_text).toContain("Great post!");
	});

	test("approves on arrival a mention from an allowed host", async () => {
		await Webmention.setPolicy(db, "replies.example.com", "allow");
		serveReply();

		await run();

		expect((await stored())?.status).toBe("approved");
	});

	test("keeps a moderator's decision when the source is sent again", async () => {
		serveReply();
		await run();
		let first = await stored();
		await Webmention.setStatus(db, first!.id, "rejected");

		await run();

		expect((await stored())?.status).toBe("rejected");
	});

	test("marks the mention deleted once the source answers 410", async () => {
		serveReply();
		await run();

		server.use(http.get(SOURCE, () => new HttpResponse(null, { status: 410 })));
		await run();

		expect((await stored())?.status).toBe("deleted");
	});

	test("asks for a retry while the source is failing", async () => {
		server.use(http.get(SOURCE, () => new HttpResponse(null, { status: 503 })));

		await expect(run()).rejects.toBeInstanceOf(Job.Retry);
		expect(await stored()).toBeNull();
	});

	test("drops a mention from a blocked host without fetching it", async () => {
		await Webmention.setPolicy(db, "replies.example.com", "block");

		await expect(run()).rejects.toBeInstanceOf(Job.Ack);
		expect(await stored()).toBeNull();
	});

	test("acknowledges a target that no longer names a published post", async () => {
		await expect(run(SOURCE, "https://blog.test/articles/missing")).rejects.toBeInstanceOf(Job.Ack);
	});
});
