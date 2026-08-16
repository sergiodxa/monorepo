import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * Unit tests for the usage-reporting cron `reportUsage`, focused on the metered-usage
 * idempotency fix: each blog-day is ingested into Polar with a deterministic
 * `(blog_id, date)` external id, and a run that ingests an event but fails to stamp
 * `reported_at` re-sends the *same* external id on the next run (so Polar deduplicates
 * instead of double-billing). Uses the real in-memory database harness with a recording
 * fake `PolarClient` and a stubbed analytics `fetch`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { PolarClient as PolarClientType } from "@pkg/polar";

import { createEnv } from "@pkg/cloudflare-mocks";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import type { TestDatabase } from "~/app/test/db";

// The analytics helper and job read `env` at import time; supply only the Analytics
// Engine SQL API credentials, which is all the reporting path reads.
mock.module("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({ CF_ACCOUNT_ID: "acct-1", CF_API_TOKEN: "token-1" }),
	DurableObject: class {},
}));

let { createTestDatabase } = await import("~/app/test/db");
let Account = (await import("~/app/models/account")).default;
let Blog = (await import("~/app/models/blog")).default;
let UsageDaily = (await import("~/app/models/usage")).default;
let { PolarClient } = await import("@pkg/polar");
let { ServiceContainer } = await import("@pkg/service-container");
let { Database } = await import("remix/data-table");
let { reportUsage } = await import("./report-usage");

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

/** A fresh container scoping a fake PolarClient over the real test database. */
function makeContainer() {
	let container = new ServiceContainer();
	container.singleton(Database, () => harness.db);
	container.singleton(PolarClient, () => {
		let client = new PolarClient({ accessToken: "t" });
		// Override just the method the cron calls, recording args and returning `ingestOk`.
		let fake: PolarClientType["ingestPageViews"] = async (customerId, views, day, externalId) => {
			ingestCalls.push({ customerId, views, day, externalId });
			return ingestOk;
		};
		(client as unknown as { ingestPageViews: PolarClientType["ingestPageViews"] }).ingestPageViews =
			fake;
		return client;
	});
	return container;
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
	test("ingests each blog-day with a deterministic (blog_id, date) external id", async () => {
		let { blogId } = await seedBillableBlog();
		// A pre-existing unreported row so the outcome does not depend on `yesterday()`.
		await UsageDaily.record(harness.db, blogId, "2026-07-01", 120);
		stubAnalytics([]);

		await makeContainer().scope(() => reportUsage());

		let call = ingestCalls.find((c) => c.day === "2026-07-01");
		expect(call).toBeDefined();
		expect(call!.customerId).toBe("cus-my-blog");
		expect(call!.views).toBe(120);
		expect(call!.externalId).toBe(`page_views:${blogId}:2026-07-01`);
	});

	test("re-sends the same external id after a markReported failure (dedupe on retry)", async () => {
		let { blogId } = await seedBillableBlog();
		await UsageDaily.record(harness.db, blogId, "2026-07-01", 120);
		stubAnalytics([]);

		// First run: Polar accepts the event but we simulate the local stamp not landing
		// by making the row look unreported again afterwards.
		ingestOk = true;
		await makeContainer().scope(() => reportUsage());
		let firstKeys = ingestCalls.filter((c) => c.day === "2026-07-01").map((c) => c.externalId);
		expect(firstKeys).toEqual([`page_views:${blogId}:2026-07-01`]);

		// Force the row back to unreported to model the partial failure (stamp lost).
		let rows = await harness.db.findMany(UsageDaily.table, { where: { blog_id: blogId } });
		await harness.db.update(UsageDaily.table, { id: rows[0]!.id }, { reported_at: null });

		// Second run re-sends the identical external id, so Polar can deduplicate.
		ingestCalls = [];
		await makeContainer().scope(() => reportUsage());
		let secondKeys = ingestCalls.filter((c) => c.day === "2026-07-01").map((c) => c.externalId);
		expect(secondKeys).toEqual([`page_views:${blogId}:2026-07-01`]);
	});

	test("does not re-ingest a blog-day once it is marked reported", async () => {
		let { blogId } = await seedBillableBlog();
		await UsageDaily.record(harness.db, blogId, "2026-07-01", 120);
		stubAnalytics([]);

		// First run stamps reported_at (ingestOk = true, no forced reset).
		await makeContainer().scope(() => reportUsage());
		expect(ingestCalls.filter((c) => c.day === "2026-07-01")).toHaveLength(1);

		// Second run must skip the already-reported row entirely.
		ingestCalls = [];
		await makeContainer().scope(() => reportUsage());
		expect(ingestCalls.filter((c) => c.day === "2026-07-01")).toHaveLength(0);
	});

	test("leaves the row unreported when Polar rejects the event, retrying next run", async () => {
		let { blogId } = await seedBillableBlog();
		await UsageDaily.record(harness.db, blogId, "2026-07-01", 120);
		stubAnalytics([]);

		ingestOk = false;
		await makeContainer().scope(() => reportUsage());

		// The row is still unreported, and a later successful run re-sends the same key.
		expect(await UsageDaily.findUnreported(harness.db)).toHaveLength(1);
		ingestOk = true;
		ingestCalls = [];
		await makeContainer().scope(() => reportUsage());
		expect(ingestCalls.map((c) => c.externalId)).toContain(`page_views:${blogId}:2026-07-01`);
		expect(await UsageDaily.findUnreported(harness.db)).toHaveLength(0);
	});
});
