/**
 * Tests the daily MAU job's ingest call: only tenants that are billing customers are
 * reported, the whole day goes out as one batch, and every event carries the
 * per-tenant, per-day key that makes a re-run of the same day count once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createD1Database, createEnv } from "@pkg/cloudflare-mocks";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest";

/** The tenant that has subscribed, and the one that has not. */
const BILLABLE = "6d2a7f6c-4a4e-4f2b-9f2a-1c0b5d3e7a91";
const UNBILLED = "8f1b3c2d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

let database = createD1Database();

/** Precedes the dynamic import below, since the job's modules read `env` on load. */
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({
		CF_ACCOUNT_ID: "account-1",
		CF_API_TOKEN: "token",
		PLATFORM_DB: database,
		POLAR_ACCESS_TOKEN: "polar-token",
		POLAR_PRODUCT_ID: "product-1",
	}),
	DurableObject: class {},
}));

let { reportMAU } = await import("./report-mau");

/** Every event body the job posted to the platform, in the order it sent them. */
let ingested: {
	events: { name: string; external_customer_id?: string; external_id?: string }[];
}[] = [];

let server = setupServer(
	http.post("https://api.cloudflare.com/client/v4/accounts/:accountId/analytics_engine/sql", () =>
		HttpResponse.json({
			data: [
				{ tenant_id: BILLABLE, mau: 1200 },
				{ tenant_id: UNBILLED, mau: 7 },
			],
		}),
	),

	http.post("https://api.polar.sh/v1/events/ingest", async ({ request }) => {
		ingested.push((await request.json()) as (typeof ingested)[number]);
		return HttpResponse.json({ inserted: 1 });
	}),
);

beforeAll(async () => {
	server.listen({ onUnhandledRequest: "error" });

	await database.exec(
		"CREATE TABLE billing_customers (tenant_id TEXT NOT NULL, connection TEXT NOT NULL, provider_customer_id TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (tenant_id, connection))",
	);
	await database
		.prepare(
			"INSERT INTO billing_customers VALUES (?1, 'polar', 'cus-1', 1, '2026-01-01', '2026-01-01')",
		)
		.bind(BILLABLE)
		.run();
});

afterEach(() => {
	ingested.length = 0;
	server.resetHandlers();
});

afterAll(() => server.close());

test("reports one event per billing customer, keyed by tenant and day", async () => {
	await reportMAU({ cron: "0 1 * * *", scheduledTime: Date.now(), noRetry() {} });

	expect(ingested).toHaveLength(1);
	expect(ingested[0]?.events).toHaveLength(1);

	let day = new Date().toISOString().slice(0, 10);

	expect(ingested[0]?.events[0]).toMatchObject({
		name: "mau",
		external_customer_id: BILLABLE,
		external_id: `mau_${BILLABLE}_${day}`,
		metadata: { count: 1200 },
	});
});

test("sends nothing when no tenant with usage is a billing customer", async () => {
	server.use(
		http.post("https://api.cloudflare.com/client/v4/accounts/:accountId/analytics_engine/sql", () =>
			HttpResponse.json({ data: [{ tenant_id: UNBILLED, mau: 7 }] }),
		),
	);

	await reportMAU({ cron: "0 1 * * *", scheduledTime: Date.now(), noRetry() {} });

	expect(ingested).toHaveLength(0);
});

test("fails the run when the platform refuses the batch", async () => {
	server.use(
		http.post("https://api.polar.sh/v1/events/ingest", () =>
			HttpResponse.json({ error: "Unauthorized" }, { status: 401 }),
		),
	);

	await expect(
		reportMAU({ cron: "0 1 * * *", scheduledTime: Date.now(), noRetry() {} }),
	).rejects.toThrow();
});
