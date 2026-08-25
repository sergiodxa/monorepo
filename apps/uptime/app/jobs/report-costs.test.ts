/**
 * Unit tests for `ReportCostsJob.perform`, run against Polar intercepted with MSW.
 * `_cost.amount` must serialise as a decimal **string** — a small `number` would
 * print as `1e-7` and be unparseable. The Analytics Engine SQL API is stubbed the
 * same way, while `COSTS` is an in-memory dataset enforcing the platform's
 * per-point limits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnalyticsEngineMock } from "@pkg/cloudflare-mocks";

import { createAnalyticsEngine, createEnv } from "@pkg/cloudflare-mocks";
import { BatchedLogger } from "@pkg/logger";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Database } from "remix/data-table";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import Subscription from "~/app/data/subscription";
import { RATE_CARD_VERSION } from "~/app/lib/cost-rates";
import { createTestDatabase } from "~/app/lib/test/db";
import { polarSubscription } from "~/app/lib/test/polar";
import { monitorResults, monitors, teams } from "~/database/schema";

const ANALYTICS_URL =
	"https://api.cloudflare.com/client/v4/accounts/test-account/analytics_engine/sql";
const INGEST_URL = "https://api.polar.sh/v1/events/ingest";

/**
 * The dataset the job's own run would be costed to. It lives at module scope because the
 * module under test captures `env` on import, so `beforeEach` empties it rather than
 * re-creating it.
 */
let costs: AnalyticsEngineMock = createAnalyticsEngine();

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({
		CLOUDFLARE_ACCOUNT_ID: "test-account",
		CLOUDFLARE_ANALYTICS_TOKEN: "test-token",
		COSTS: costs,
	}),
}));

let { Job } = await import("@pkg/jobs");
let { ReportCostsJob } = await import("./report-costs");

/** One ingested event as Polar receives it over the wire, in its snake_case form. */
interface IngestedEvent {
	name: string;
	external_customer_id?: string;
	customer_id?: string;
	external_id?: string;
	timestamp?: string;
	metadata?: Record<string, unknown>;
}

let server = setupServer();
/** Every batch of events Polar was sent, in order. */
let ingested: IngestedEvent[][] = [];
/** The SQL the job asked Analytics Engine for, in order. */
let queries: string[] = [];

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

vi.spyOn(console, "info").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

type Db = ReturnType<typeof createTestDatabase>["db"];

let db: Db;

beforeEach(() => {
	({ db } = createTestDatabase());
	costs.reset();
	ingested = [];
	queries = [];
});

/**
 * Serves the cost dataset and Polar's ingest endpoint.
 * @param rows Rows the daily cost query answers with.
 * @param options `ingestStatus` makes Polar reject the batch.
 */
function serve(rows: Record<string, unknown>[], options: { ingestStatus?: number } = {}) {
	server.use(
		http.post(ANALYTICS_URL, async ({ request }) => {
			queries.push(await request.text());
			return HttpResponse.json({ data: rows });
		}),
		http.post(INGEST_URL, async ({ request }) => {
			let body = (await request.json()) as { events: IngestedEvent[] };
			ingested.push(body.events);
			if (options.ingestStatus) {
				return HttpResponse.json({ detail: "rejected" }, { status: options.ingestStatus });
			}
			return HttpResponse.json({ inserted: body.events.length });
		}),
	);
}

/** A dataset row for one team, with every quantity defaulting to zero. */
function costRow(teamId: string, overrides: Record<string, unknown> = {}) {
	return {
		teamId,
		rateCard: RATE_CARD_VERSION,
		d1RowRead: 20_180,
		d1RowWritten: 10,
		emailSent: 0,
		reportedCents: 0.0034767,
		...overrides,
	};
}

/** A team whose owner Polar knows about, plus one monitor so it has stored rows. */
async function createBilledTeam(ownerId: string) {
	let team = await db.create(
		teams,
		{ id: crypto.randomUUID(), owner_id: ownerId, name: "Acme", slug: `acme-${ownerId}` } as never,
		{ touch: true, returnRow: true },
	);
	await Subscription.upsert(db, ownerId, polarSubscription({ externalId: ownerId }));
	return team;
}

async function run() {
	let logger = new BatchedLogger("test");
	let container = new ServiceContainer();
	container.singleton(Database, () => db);
	container.singleton(PolarClient, () => new PolarClient({ accessToken: "polar_at_test" }));

	await container.scope(async () => {
		await new ReportCostsJob({ logger }, {}).perform();
	});

	return logger;
}

describe("ReportCostsJob", () => {
	test("reports yesterday's cost as one event per team, keyed for deduplication", async () => {
		let team = await createBilledTeam("owner-1");
		serve([costRow(team.id)]);

		await run();

		let [batch] = ingested;
		expect(batch).toHaveLength(1);
		let [event] = batch!;
		expect(event?.name).toBe("infra.cost.daily");
		expect(event?.external_customer_id).toBe("owner-1");
		expect(event?.external_id).toMatch(new RegExp(`^infra_cost:${team.id}:\\d{4}-\\d{2}-\\d{2}$`));
		expect(event?.customer_id).toBeUndefined();
	});

	test("sends the amount in cents as a decimal string", async () => {
		let team = await createBilledTeam("owner-1");
		serve([costRow(team.id)]);

		await run();

		let cost = ingested[0]?.[0]?.metadata?._cost as { amount: unknown; currency: string };
		expect(typeof cost.amount).toBe("string");
		expect(cost.amount).toMatch(/^\d+\.\d{9}$/);
		expect(Number(cost.amount)).toBeCloseTo(0.003018, 9);
		expect(cost.currency).toBe("usd");
	});

	test("carries the drivers behind the amount as metadata", async () => {
		let team = await createBilledTeam("owner-1");
		serve([costRow(team.id, { emailSent: 2 })]);

		await run();

		let metadata = ingested[0]?.[0]?.metadata;
		expect(metadata?.team_id).toBe(team.id);
		expect(metadata?.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(metadata?.rate_card).toBe(RATE_CARD_VERSION);
		expect(metadata?.d1_row_read).toBe(20_180);
		expect(metadata?.email_sent).toBe(2);
	});

	test("timestamps the event at the end of the day it is reporting", async () => {
		let team = await createBilledTeam("owner-1");
		serve([costRow(team.id)]);

		await run();

		let event = ingested[0]?.[0];
		expect(event?.timestamp?.slice(0, 10)).toBe(String(event?.metadata?.day));
		expect(event?.timestamp).toContain("23:59:59");
	});

	test("re-prices a current-rate-card day from its quantities", async () => {
		let team = await createBilledTeam("owner-1");
		serve([costRow(team.id, { reportedCents: 999 })]);

		await run();

		let cost = ingested[0]?.[0]?.metadata?._cost as { amount: string };
		expect(Number(cost.amount)).toBeCloseTo(0.003018, 9);
	});

	test("keeps the recorded total for a day priced under an older rate card", async () => {
		let team = await createBilledTeam("owner-1");
		serve([costRow(team.id, { rateCard: "2026-01-01", reportedCents: 12.5 })]);

		await run();

		let cost = ingested[0]?.[0]?.metadata?._cost as { amount: string };
		expect(Number(cost.amount)).toBeCloseTo(12.5, 9);
	});

	test("skips a team whose owner Polar has never heard of, and says how much that was", async () => {
		let team = await db.create(
			teams,
			{ id: crypto.randomUUID(), owner_id: "owner-nobody", name: "Acme", slug: "acme" } as never,
			{ touch: true, returnRow: true },
		);
		serve([costRow(team.id)]);

		let logger = await run();

		expect(ingested).toHaveLength(0);
		expect(
			logger.events.find((entry) => entry.event === "job.report_costs.unreportable_team"),
		).toBeDefined();
		let unreported = logger.events.find((entry) => entry.event === "job.report_costs.unreported");
		expect(unreported?.skippedCents).toBeCloseTo(0.003018, 9);
	});

	test("reports the platform's own unattributed cost as a number instead of an event", async () => {
		let team = await createBilledTeam("owner-1");
		serve([costRow(team.id), costRow("platform", { reportedCents: 0.5 })]);

		await run();

		expect(ingested[0]).toHaveLength(1);
		expect(ingested[0]?.[0]?.metadata?.team_id).toBe(team.id);
	});

	test("estimates each team's stored bytes from its retained rows", async () => {
		let team = await createBilledTeam("owner-1");
		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: "author-1",
				name: "Homepage",
				url: "https://example.com",
			} as never,
			{ touch: true, returnRow: true },
		);
		for (let index = 0; index < 5; index++) {
			await db.create(
				monitorResults,
				{
					id: `result-${index}`,
					monitor_id: monitor.id,
					response_status: 200,
					response_time_ms: 10,
					completed_at: Date.now(),
				} as never,
				{ touch: true },
			);
		}
		serve([costRow(team.id)]);

		let logger = await run();

		let estimated = logger.events.find(
			(entry) => entry.event === "job.report_costs.storage_estimated",
		);
		expect(estimated?.teams).toBe(1);
		expect(estimated?.d1Gb).toBeCloseTo((5 * 200) / 1_000_000_000, 12);
	});

	test("asks the queue to redeliver when the cost dataset cannot be read", async () => {
		await createBilledTeam("owner-1");
		server.use(
			http.post(ANALYTICS_URL, () => HttpResponse.text("upstream error", { status: 500 })),
		);

		await expect(run()).rejects.toThrow(Job.RetryError);
	});

	test("asks the queue to redeliver when Polar rejects the batch", async () => {
		let team = await createBilledTeam("owner-1");
		serve([costRow(team.id)], { ingestStatus: 500 });

		await expect(run()).rejects.toThrow(Job.RetryError);
	});

	test("sends nothing and completes when the day recorded no cost", async () => {
		serve([]);

		let logger = await run();

		expect(ingested).toHaveLength(0);
		expect(
			logger.events.find((entry) => entry.event === "job.report_costs.completed"),
		).toBeDefined();
	});

	test("sums every sample-weighted quantity for the reported day", async () => {
		let team = await createBilledTeam("owner-1");
		serve([costRow(team.id)]);

		await run();

		expect(queries[0]).toContain("SUM(_sample_interval * double1)");
		expect(queries[0]).toContain("FROM uptime_costs");
	});
});
