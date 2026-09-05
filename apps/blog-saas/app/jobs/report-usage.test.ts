/**
 * Unit tests for the usage-reporting job: each blog-day reaches the meter once, under a
 * deterministic `(blog_id, date)` key so a run that reports but fails to stamp
 * `reported_at` re-sends the same key, and a rejected batch leaves every row for the
 * next run. The handler runs over the in-memory database with the platform stubbed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createEnv } from "@sdxc/cloudflare-mocks";
import { Log } from "@sdxc/logger";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { TestDatabase } from "~/app/test/db";

import { createTestDatabase } from "~/app/test/db";

/**
 * Installed above the dynamic imports below so the mock is in place before `env` is
 * read at import time: the analytics credentials the rollup reads, and the Polar
 * configuration the provider is constructed with.
 */
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({
		CF_ACCOUNT_ID: "acct-1",
		CF_API_TOKEN: "token-1",
		POLAR_ACCESS_TOKEN: "polar-token",
		POLAR_PRODUCT_ID: "prod_configured",
	}),
	DurableObject: class {},
}));

let Account = (await import("~/app/models/account")).default;
let BillingCustomer = (await import("~/app/models/billing-customer")).default;
let Blog = (await import("~/app/models/blog")).default;
let UsageDaily = (await import("~/app/models/usage")).default;
let { createJobContext } = await import("@sdxc/jobs");
let jobs = (await import("~/app/jobs")).default;
let { Database } = await import("~/app/jobs/middleware/database");
let handler = (await import("./report-usage")).default;

/** The Analytics Engine SQL API endpoint `queryDailyPageViews` POSTs to. */
let SQL_URL = "https://api.cloudflare.com/client/v4/accounts/acct-1/analytics_engine/sql";

/** The Polar endpoint the provider reports consumption to. */
let INGEST_URL = "https://api.polar.sh/v1/events/ingest";

/** MSW server intercepting the analytics SQL API and the platform's ingest endpoint. */
let server = setupServer();

let harness: TestDatabase;

/** One event as the job sent it to the platform. */
interface IngestedEvent {
	name: string;
	customer_id?: string;
	external_id?: string;
	metadata?: { views?: number; day?: string };
}

/** Events recorded from every intercepted ingest request. */
let ingested: IngestedEvent[];

/** Whether the platform accepts the batch, so a test can drive the rejected path. */
let ingestAccepts: boolean;

/** Records each ingest request and answers with the configured verdict. */
function stubIngest(): void {
	server.use(
		http.post(INGEST_URL, async ({ request }) => {
			let body = (await request.json()) as { events: IngestedEvent[] };
			ingested.push(...body.events);

			if (!ingestAccepts) return HttpResponse.json({ detail: "nope" }, { status: 500 });

			return HttpResponse.json({ inserted: body.events.length }, { status: 200 });
		}),
	);
}

/** Registers an MSW handler making the analytics SQL API return the given rows. */
function stubAnalytics(rows: Array<{ blogId: string; views: number }>): void {
	server.use(http.post(SQL_URL, () => HttpResponse.json({ data: rows }, { status: 200 })));
}

/** Builds one delivery's context over the test database, the one service this job reads. */
function createContext(log?: Log) {
	let ctx = createJobContext(jobs.reportUsage, { id: "message-1", attempts: 1, log });
	ctx.set(Database, harness.db, { property: "database" });
	return ctx;
}

/**
 * Runs the handler inside a job log that collects its record, the way a dispatcher
 * would, so a test reads back what the run recorded.
 */
async function runRecorded(): Promise<Record<string, unknown>> {
	let records: Record<string, unknown>[] = [];
	let log = new Log({ kind: "job", sink: (record) => void records.push(record) });
	await log.run(() => handler(createContext(log)));
	return records[0]!;
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

beforeEach(() => {
	harness = createTestDatabase();
	ingested = [];
	ingestAccepts = true;
	stubIngest();
});

afterEach(() => {
	harness.sqliteDb.close();
	server.resetHandlers();
});

/** Seeds an account with a billing customer plus a blog, returning both ids. */
async function seedBillableBlog(slug = "my-blog"): Promise<{ accountId: string; blogId: string }> {
	let account = await Account.findOrCreateFromProfile(harness.db, {
		subject: `sub-${slug}`,
		email: `${slug}@example.com`,
	});
	await BillingCustomer.link(harness.db, account.id, "polar", `cus-${slug}`);
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
	test("reports each blog-day with a deterministic (blog_id, date) external id", async () => {
		let { blogId } = await seedBillableBlog();
		await UsageDaily.record(harness.db, blogId, "2026-07-01", 120);
		stubAnalytics([]);

		await handler(createContext());

		let event = ingested.find((row) => row.metadata?.day === "2026-07-01");
		expect(event).toBeDefined();
		expect(event!.name).toBe("page_views");
		expect(event!.customer_id).toBe("cus-my-blog");
		expect(event!.metadata?.views).toBe(120);
		expect(event!.external_id).toBe(`page_views:${blogId}:2026-07-01`);
	});

	/**
	 * Models a run that reports the event but never persists `reported_at`, by
	 * nulling it back out after the first run, then verifies the retry re-sends
	 * the identical external id.
	 */
	test("re-sends the same external id after a markReported failure (dedupe on retry)", async () => {
		let { blogId } = await seedBillableBlog();
		await UsageDaily.record(harness.db, blogId, "2026-07-01", 120);
		stubAnalytics([]);

		await handler(createContext());
		expect(ingested.map((row) => row.external_id)).toEqual([`page_views:${blogId}:2026-07-01`]);

		let rows = await harness.db.findMany(UsageDaily.table, { where: { blog_id: blogId } });
		await harness.db.update(UsageDaily.table, { id: rows[0]!.id }, { reported_at: null });

		ingested = [];
		await handler(createContext());
		expect(ingested.map((row) => row.external_id)).toEqual([`page_views:${blogId}:2026-07-01`]);
	});

	test("does not re-report a blog-day once it is marked reported", async () => {
		let { blogId } = await seedBillableBlog();
		await UsageDaily.record(harness.db, blogId, "2026-07-01", 120);
		stubAnalytics([]);

		await handler(createContext());
		expect(ingested).toHaveLength(1);

		ingested = [];
		await handler(createContext());
		expect(ingested).toHaveLength(0);
	});

	test("leaves the rows unreported when the platform rejects the batch", async () => {
		let { blogId } = await seedBillableBlog();
		await UsageDaily.record(harness.db, blogId, "2026-07-01", 120);
		stubAnalytics([]);

		ingestAccepts = false;
		await handler(createContext());

		expect(await UsageDaily.findUnreported(harness.db)).toHaveLength(1);

		ingestAccepts = true;
		ingested = [];
		await handler(createContext());
		expect(ingested.map((row) => row.external_id)).toContain(`page_views:${blogId}:2026-07-01`);
		expect(await UsageDaily.findUnreported(harness.db)).toHaveLength(0);
	});

	test("records the day, the batch, and what the platform accepted", async () => {
		let { blogId } = await seedBillableBlog();
		await UsageDaily.record(harness.db, blogId, "2026-07-01", 120);
		stubAnalytics([]);

		let record = await runRecorded();

		expect(record).toMatchObject({
			outcome: "ok",
			"usage.date": expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
			"usage.pending": 1,
			"usage.reported": 1,
			"usage.accepted": 1,
		});
	});

	test("fails the run's log with the platform's error when the batch is rejected", async () => {
		let { blogId } = await seedBillableBlog();
		await UsageDaily.record(harness.db, blogId, "2026-07-01", 120);
		stubAnalytics([]);
		ingestAccepts = false;

		let record = await runRecorded();

		expect(record).toMatchObject({
			outcome: "error",
			"usage.pending": 1,
			"error.type": "BillingError",
			"error.code": expect.any(String),
		});
		expect(record).not.toHaveProperty("usage.reported");
	});

	test("skips a blog whose account has no billing customer", async () => {
		let account = await Account.findOrCreateFromProfile(harness.db, {
			subject: "sub-free",
			email: "free@example.com",
		});
		let blog = await Blog.create(harness.db, {
			accountId: account.id,
			name: "free",
			slug: "free",
			region: "wnam",
		});
		await UsageDaily.record(harness.db, blog.id, "2026-07-01", 10);
		stubAnalytics([]);

		await handler(createContext());

		expect(ingested).toHaveLength(0);
		expect(await UsageDaily.findUnreported(harness.db)).toHaveLength(1);
	});
});
