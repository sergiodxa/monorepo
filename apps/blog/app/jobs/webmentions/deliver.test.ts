/**
 * Tests delivering one Webmention against a migrated in-memory database, with every
 * target page and endpoint served by MSW: what gets recorded for a delivered, an
 * endpoint-less and a removed target, and when a failing endpoint is retried.
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
import { WebmentionSend } from "~/app/repositories/webmention-send";
import { testDatabase } from "~/app/test/database";
import { seedAuthor } from "~/app/test/fixtures";

import handler from "./deliver";

const TARGET = "https://example.com/post";
const ENDPOINT = "https://example.com/webmention";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let db: DataTable;
let postId: string;
let received: Array<URLSearchParams> = [];

beforeEach(async () => {
	received = [];
	db = await testDatabase();
	let created = await ArticlePost.create(db, {
		author_id: await seedAuthor(db),
		published_at: null,
		meta: { slug: "sender", title: "Sender", locale: "en", content: "" },
	});
	postId = created!.id;
});

/** Serves the target advertising an endpoint that answers with `status`. */
function serveEndpoint(status = 202) {
	server.use(
		http.get(TARGET, () =>
			HttpResponse.html("<p>Target</p>", { headers: { link: `<${ENDPOINT}>; rel="webmention"` } }),
		),
		http.post(ENDPOINT, async ({ request }) => {
			received.push(new URLSearchParams(await request.text()));
			return new HttpResponse(null, { status });
		}),
	);
}

/** Runs the job the way the dispatcher would after its middleware. */
async function run(removed = false, attempts = 1) {
	let ctx = createJobContext(jobs.webmentions.deliver, {
		id: "m",
		attempts,
		input: { postId, target: TARGET, removed },
	});
	ctx.set(Database, db, { property: "db" });
	await handler(ctx);
}

/** The delay a failing delivery on its `attempts`-th try asks the queue for. */
async function retryDelay(attempts: number) {
	let error = await run(false, attempts).catch((caught: unknown) => caught);
	expect(error).toBeInstanceOf(Job.Retry);
	return error instanceof Job.Retry ? Number(error.delay) : Number.NaN;
}

describe("the deliver job", () => {
	test("sends from the post's permalink and records the endpoint's answer", async () => {
		serveEndpoint();

		await run();

		expect(received[0]?.get("source")).toBe("https://sergiodxa.com/articles/sender");
		expect(received[0]?.get("target")).toBe(TARGET);
		expect(await WebmentionSend.targetsFor(db, postId)).toEqual([new URL(TARGET)]);
	});

	test("records a target without an endpoint, so a later change leaves it alone", async () => {
		server.use(http.get(TARGET, () => HttpResponse.html("<p>No endpoint</p>")));

		await run();

		expect(await WebmentionSend.targetsFor(db, postId)).toEqual([new URL(TARGET)]);
	});

	test("forgets a removed link once its target has been told", async () => {
		serveEndpoint();
		await run();

		await run(true);

		expect(received).toHaveLength(2);
		expect(await WebmentionSend.targetsFor(db, postId)).toEqual([]);
	});

	test("retries while the endpoint is failing", async () => {
		serveEndpoint(503);

		await expect(run()).rejects.toBeInstanceOf(Job.Retry);
		expect(await WebmentionSend.targetsFor(db, postId)).toEqual([]);
	});

	test("waits longer before each retry of a failing endpoint", async () => {
		serveEndpoint(503);

		let first = await retryDelay(1);
		let fourth = await retryDelay(4);

		expect(first).toBeGreaterThanOrEqual(4 * 60_000);
		expect(first).toBeLessThanOrEqual(6 * 60_000);
		expect(fourth).toBeGreaterThanOrEqual(32 * 60_000);
		expect(fourth).toBeLessThanOrEqual(48 * 60_000);
	});
});
