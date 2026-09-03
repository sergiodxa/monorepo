/**
 * Unit tests for the usage-reporting job's metered-usage idempotency fix: each blog-day
 * is ingested into Polar with a deterministic `(blog_id, date)` external id, so a run
 * that ingests an event but fails to stamp `reported_at` re-sends the same id and Polar
 * deduplicates it on the next run. The handler is called with a context the test builds,
 * over the in-memory database harness and with a stubbed analytics `fetch`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { PolarClient as PolarClientType } from "@pkg/polar";

import { createEnv } from "@pkg/cloudflare-mocks";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { TestDatabase } from "~/app/test/db";

/**
 * Installed above the dynamic imports below so the mock is in place before
 * `env` is read at import time. Only the Analytics Engine SQL API credentials
 * are supplied, matching what the reporting path reads.
 */
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({ CF_ACCOUNT_ID: "acct-1", CF_API_TOKEN: "token-1" }),
	DurableObject: class {},
}));

let { createTestDatabase } = await import("~/app/test/db");
let Account = (await import("~/app/models/account")).default;
let Blog = (await import("~/app/models/blog")).default;
let UsageDaily = (await import("~/app/models/usage")).default;
let { PolarClient } = await import("@pkg/polar");
let { createJobContext } = await import("@pkg/jobs-next");
let jobs = (await import("~/app/jobs")).default;
let { Database } = await import("~/app/jobs/middleware/database");
let { Polar } = await import("~/app/jobs/middleware/polar");
let handler = (await import("./report-usage")).default;

/** The Analytics Engine SQL API endpoint `queryDailyPageViews` POSTs to. */
let SQL_URL = "https://api.cloudflare.com/client/v4/accounts/acct-1/analytics_engine/sql";

/** MSW server intercepting the analytics SQL API. */
let server = setupServer();

let harness: TestDatabase;

/** One recorded `ingestPageViews` call. */
interface IngestCall {
	customerId: string;
	views: number;
	day: string;
	externalId: string | undefined;
}

/** Recorded ingest calls, plus a switch to simulate Polar accepting the event. */
let ingestCalls: IngestCall[];
let ingestOk: boolean;

/**
 * A `PolarClient` with only `ingestPageViews` overridden, recording each call and
 * returning `ingestOk`.
 */
function fakePolar(): PolarClientType {
	let client = new PolarClient({ accessToken: "t" });
	let fake: PolarClientType["ingestPageViews"] = async (customerId, views, day, externalId) => {
		ingestCalls.push({ customerId, views, day, externalId });
		return ingestOk;
	};
	(client as unknown as { ingestPageViews: PolarClientType["ingestPageViews"] }).ingestPageViews =
		fake;
	return client;
}

/**
 * Builds one delivery's context over the test database and the recording Polar client:
 * the two services this handler reads, standing in for the dispatcher's chain.
 *
 * @returns The context to run the handler with.
 */
function createContext() {
	let ctx = createJobContext(jobs.reportUsage, { id: "message-1", attempts: 1 });
	ctx.set(Database, harness.db, { property: "database" });
	ctx.set(Polar, fakePolar(), { property: "polar" });
	return ctx;
}

/** Registers an MSW handler making the analytics SQL API return the given rows. */
function stubAnalytics(rows: Array<{ blogId: string; views: number }>): void {
	server.use(http.post(SQL_URL, () => HttpResponse.json({ data: rows }, { status: 200 })));
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

beforeEach(() => {
	harness = createTestDatabase();
	ingestCalls = [];
	ingestOk = true;
});

afterEach(() => {
	harness.sqliteDb.close();
	server.resetHandlers();
});

/** Seeds an account (with a Polar customer id) and a blog, returning both ids. */
async function seedBillableBlog(slug = "my-blog"): Promise<{ accountId: string; blogId: string }> {
	let account = await Account.findOrCreateFromProfile(harness.db, {
		subject: `sub-${slug}`,
		email: `${slug}@example.com`,
	});
	await Account.setPolarCustomerId(harness.db, account.id, `cus-${slug}`);
	let blog = await Blog.create(harness.db, {
		accountId: account.id,
		name: slug,
		slug,
		region: "wnam",
	});
	return { accountId: account.id, blogId: blog.id };
}

describe("reportUsage — metered usage idempotency", () => {
	/**
	 * Seeds a fixed-date usage row so the assertions hold regardless of the
	 * actual UTC date `yesterday()` resolves to when the suite runs.
	 */
	test("ingests each blog-day with a deterministic (blog_id, date) external id", async () => {
		let { blogId } = await seedBillableBlog();
		await UsageDaily.record(harness.db, blogId, "2026-07-01", 120);
		stubAnalytics([]);

		await handler(createContext());

		let call = ingestCalls.find((c) => c.day === "2026-07-01");
		expect(call).toBeDefined();
		expect(call!.customerId).toBe("cus-my-blog");
		expect(call!.views).toBe(120);
		expect(call!.externalId).toBe(`page_views:${blogId}:2026-07-01`);
	});

	/**
	 * Models a run that ingests the event but never persists `reported_at`, by
	 * nulling it back out after the first run, then verifies the retry re-sends
	 * the identical external id.
	 */
	test("re-sends the same external id after a markReported failure (dedupe on retry)", async () => {
		let { blogId } = await seedBillableBlog();
		await UsageDaily.record(harness.db, blogId, "2026-07-01", 120);
		stubAnalytics([]);

		ingestOk = true;
		await handler(createContext());
		let firstKeys = ingestCalls.filter((c) => c.day === "2026-07-01").map((c) => c.externalId);
		expect(firstKeys).toEqual([`page_views:${blogId}:2026-07-01`]);

		let rows = await harness.db.findMany(UsageDaily.table, { where: { blog_id: blogId } });
		await harness.db.update(UsageDaily.table, { id: rows[0]!.id }, { reported_at: null });

		ingestCalls = [];
		await handler(createContext());
		let secondKeys = ingestCalls.filter((c) => c.day === "2026-07-01").map((c) => c.externalId);
		expect(secondKeys).toEqual([`page_views:${blogId}:2026-07-01`]);
	});

	test("does not re-ingest a blog-day once it is marked reported", async () => {
		let { blogId } = await seedBillableBlog();
		await UsageDaily.record(harness.db, blogId, "2026-07-01", 120);
		stubAnalytics([]);

		await handler(createContext());
		expect(ingestCalls.filter((c) => c.day === "2026-07-01")).toHaveLength(1);

		ingestCalls = [];
		await handler(createContext());
		expect(ingestCalls.filter((c) => c.day === "2026-07-01")).toHaveLength(0);
	});

	test("leaves the row unreported when Polar rejects the event, retrying next run", async () => {
		let { blogId } = await seedBillableBlog();
		await UsageDaily.record(harness.db, blogId, "2026-07-01", 120);
		stubAnalytics([]);

		ingestOk = false;
		await handler(createContext());

		expect(await UsageDaily.findUnreported(harness.db)).toHaveLength(1);
		ingestOk = true;
		ingestCalls = [];
		await handler(createContext());
		expect(ingestCalls.map((c) => c.externalId)).toContain(`page_views:${blogId}:2026-07-01`);
		expect(await UsageDaily.findUnreported(harness.db)).toHaveLength(0);
	});
});
