/**
 * Unit tests for `CheckHttpJob.perform()`, the whole HTTP check pipeline: input
 * validation, classification of up/degraded/down against the expected status, degraded
 * threshold and content checks, and the at-least-once guarantees — a redelivered job id
 * must not produce a second `monitor_results` row, a second analytics data point, or a
 * second alert. An unavailable Durable Object must ask for a redelivery; an unreachable
 * monitored endpoint must not.
 *
 * `env.GEO_FETCH`'s Durable Object stub is faked to control the region-hinted fetch per
 * test, and the database is a real in-memory SQLite one so the primary-key collision
 * that backs idempotency is genuinely exercised rather than simulated.
 *
 * Neither `~/app/services/analytics` nor `~/app/services/alerts` is mocked: analytics is
 * observed through the `PING_RESULTS` binding it writes to, and alert dispatch runs for
 * real against the test database and is observed through the `alert_events` rows it
 * leaves behind — which is what makes the "no duplicate alert" assertions meaningful.
 * `globalThis.fetch` stands in for the Analytics Engine SQL API and webhook delivery.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { BatchedLogger } from "@pkg/logger";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { Resend } from "resend";

import { createTestDatabase } from "~/app/lib/test/db";
import {
	alertEvents,
	alerts,
	monitorContentChecks,
	monitorResults,
	monitors,
} from "~/database/schema";

/** The `GeoFetchDO` stub the job calls through `env.GEO_FETCH.get(id).fetch(...)`. */
let doFetchMock = mock(
	async (_url?: string, _init?: { method?: string }) =>
		new Response("OK", { status: 200, headers: { "X-Response-Time": "12" } }),
);
let doStub = { fetch: doFetchMock };
let fakeGeoFetchNamespace = {
	idFromName: (name: string) => ({ name }),
	jurisdiction: () => fakeGeoFetchNamespace,
	get: () => doStub,
};

/** Records the data points `writeHttpPingResult` sends to Analytics Engine. */
let writeDataPointMock = mock((_point: { blobs: string[] }) => {});

mock.module("cloudflare:workers", () => ({
	env: {
		GEO_FETCH: fakeGeoFetchNamespace,
		QUEUE: { send: async () => {} },
		PING_RESULTS: { writeDataPoint: writeDataPointMock },
		CLOUDFLARE_ACCOUNT_ID: "test-account",
		CLOUDFLARE_ANALYTICS_TOKEN: "test-token",
	},
	waitUntil: (promise: Promise<unknown>) => promise,
	/** Never instantiated here; `~/app/do/geo-fetch` extends it at module load. */
	DurableObject: class {},
}));

let { Job } = await import("@pkg/jobs");
let { CheckHttpJob } = await import("./check-http");

/** Builds a container with the database and a fake `Resend`. */
function makeContainer(db: Database) {
	let container = new ServiceContainer();
	container.singleton(Database, () => db);
	container.singleton(Resend, () => new Resend("re_test_key"));
	return container;
}

/** Runs the job against `db`, returning its logger so callers can assert on events. */
async function runJob(db: Database, monitorId: string, options: { jobId?: string } = {}) {
	let logger = new BatchedLogger("test");
	let job = new CheckHttpJob(
		{ logger },
		{
			id: options.jobId ?? `${monitorId}:1700000000000`,
			monitorId,
			scheduledAt: 1_700_000_000_000,
		},
	);

	await makeContainer(db).scope(() => job.perform());
	return logger;
}

async function seedMonitor(db: Database, overrides: Record<string, unknown> = {}) {
	return await db.create(
		monitors,
		{
			id: crypto.randomUUID(),
			team_id: "team-1",
			author_id: "author-1",
			name: "Example site",
			url: "https://example.com",
			method: "GET",
			expected_status: 200,
			degraded_after_ms: 3000,
			timeout_seconds: 10,
			location_hint: "wnam",
			enabled_at: Date.now(),
			...overrides,
		} as never,
		{ touch: true, returnRow: true },
	);
}

/** Seeds a webhook alert for a monitor, so real dispatch leaves an `alert_events` row. */
async function seedAlert(db: Database, monitorId: string) {
	return await db.create(
		alerts,
		{
			id: crypto.randomUUID(),
			team_id: "team-1",
			monitor_id: monitorId,
			name: "On call",
			notify_on_recovery: true,
			cooldown_minutes: 0,
			config: { strategy: "webhook", config: { url: "https://hooks.test/alert", secret: "" } },
		} as never,
		{ touch: true, returnRow: true },
	);
}

async function seedContentCheck(db: Database, monitorId: string, value: string) {
	return await db.create(
		monitorContentChecks,
		{
			id: crypto.randomUUID(),
			monitor_id: monitorId,
			type: "contains",
			value,
			case_sensitive: false,
			is_enabled: true,
		} as never,
		{ touch: true, returnRow: true },
	);
}

/** The status handed to Analytics Engine for the most recently recorded check (`blob3`). */
function lastRecordedStatus(): string | undefined {
	let calls = writeDataPointMock.mock.calls;
	return calls[calls.length - 1]?.[0]?.blobs[2];
}

/**
 * Rows the stubbed Analytics Engine SQL API returns, which is how `getLatestHttpResult`
 * reads the status this check is transitioning from. Set per test; empty means "this
 * monitor has never been checked".
 */
let analyticsRows: unknown[] = [];
/** Set to make the Analytics Engine read fail instead of answering. */
let analyticsUnavailable = false;
let realFetch = globalThis.fetch;

beforeEach(() => {
	doFetchMock.mockReset();
	doFetchMock.mockImplementation(
		async () => new Response("OK", { status: 200, headers: { "X-Response-Time": "12" } }),
	);
	writeDataPointMock.mockClear();
	analyticsRows = [];
	analyticsUnavailable = false;
	realFetch = globalThis.fetch;
	globalThis.fetch = (async (input: unknown) => {
		// Webhook alert deliveries go through the same global; only the SQL API is canned.
		if (!String(input).includes("analytics_engine")) return new Response("ok", { status: 200 });
		if (analyticsUnavailable) throw new Error("analytics unavailable");
		return new Response(JSON.stringify({ data: analyticsRows }), { status: 200 });
	}) as never;
});

afterEach(() => {
	globalThis.fetch = realFetch;
});

describe("CheckHttpJob input", () => {
	test("throws Job.NonRetriableError on invalid input", async () => {
		let job = new CheckHttpJob({ logger: new BatchedLogger("test") }, { monitorId: "monitor-1" });

		await expect(job.perform()).rejects.toThrow(Job.NonRetriableError);
		expect(doFetchMock).not.toHaveBeenCalled();
	});
});

describe("CheckHttpJob classification", () => {
	test("records an 'up' result when the response matches the expected status", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);

		await runJob(db, monitor.id);

		let result = await db.findOne(monitorResults, { where: { monitor_id: monitor.id } });
		expect(result?.response_status).toBe(200);
		expect(result?.response_time_ms).toBe(12);
		expect(lastRecordedStatus()).toBe("up");
	});

	test("records a 'down' result when the response status doesn't match the expected one", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { expected_status: 200 });
		doFetchMock.mockImplementation(
			async () => new Response("Error", { status: 500, headers: { "X-Response-Time": "5" } }),
		);

		await runJob(db, monitor.id);

		let result = await db.findOne(monitorResults, { where: { monitor_id: monitor.id } });
		expect(result?.response_status).toBe(500);
		expect(lastRecordedStatus()).toBe("down");
	});

	test("records a 'degraded' result once the response time reaches the threshold", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { degraded_after_ms: 100 });
		doFetchMock.mockImplementation(
			async () => new Response("OK", { status: 200, headers: { "X-Response-Time": "150" } }),
		);

		await runJob(db, monitor.id);

		expect(lastRecordedStatus()).toBe("degraded");
	});

	test("records a 'down' result with null timings when the endpoint is unreachable", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		// How `GeoFetchDO` reports a request it couldn't complete.
		doFetchMock.mockImplementation(
			async () =>
				new Response(null, { status: 204, headers: { "X-Probe-Outcome": "unreachable" } }),
		);

		await runJob(db, monitor.id);

		let result = await db.findOne(monitorResults, { where: { monitor_id: monitor.id } });
		expect(result).not.toBeNull();
		expect(result?.response_status).toBeNull();
		expect(result?.response_time_ms).toBeNull();
		expect(lastRecordedStatus()).toBe("down");
	});

	test("ignores an 'unreachable' outcome the monitored endpoint set on itself", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		/**
		 * `GeoFetchDO` overwrites the header on every response it proxies, so a target
		 * echoing it back arrives tagged `responded` and is classified on its status.
		 */
		doFetchMock.mockImplementation(
			async () =>
				new Response("OK", {
					status: 200,
					headers: { "X-Response-Time": "12", "X-Probe-Outcome": "responded" },
				}),
		);

		await runJob(db, monitor.id);

		expect(lastRecordedStatus()).toBe("up");
	});

	test("returns early without recording a result when the monitor doesn't exist", async () => {
		let { db } = createTestDatabase();

		let logger = await runJob(db, "does-not-exist");

		expect(doFetchMock).not.toHaveBeenCalled();
		expect(
			await db.findOne(monitorResults, { where: { monitor_id: "does-not-exist" } }),
		).toBeNull();
		expect(
			logger.events.find((entry) => entry.event === "job.check_http.monitor_not_found"),
		).toBeDefined();
	});
});

describe("CheckHttpJob content checks", () => {
	test("classifies a matching status with failing content checks as 'down'", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		await seedContentCheck(db, monitor.id, "expected-token");
		doFetchMock.mockImplementation(
			async () =>
				new Response("nothing here", { status: 200, headers: { "X-Response-Time": "10" } }),
		);

		await runJob(db, monitor.id);

		expect(lastRecordedStatus()).toBe("down");
	});

	test("classifies a matching status with passing content checks as 'up'", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		await seedContentCheck(db, monitor.id, "expected-token");
		doFetchMock.mockImplementation(
			async () =>
				new Response("has expected-token inside", {
					status: 200,
					headers: { "X-Response-Time": "10" },
				}),
		);

		await runJob(db, monitor.id);

		expect(lastRecordedStatus()).toBe("up");
	});

	test("upgrades a HEAD monitor to GET so content checks have a body to read", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { method: "HEAD" });
		await seedContentCheck(db, monitor.id, "expected-token");

		await runJob(db, monitor.id);

		expect(doFetchMock.mock.calls[0]?.[1]?.method).toBe("GET");
	});

	test("leaves the method alone when the monitor has no content checks", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { method: "HEAD" });

		await runJob(db, monitor.id);

		expect(doFetchMock.mock.calls[0]?.[1]?.method).toBe("HEAD");
	});
});

describe("CheckHttpJob idempotency", () => {
	test("a redelivered job records one result, one data point, and one alert", async () => {
		let { db } = createTestDatabase();
		// A `down` result so alert dispatch is reached at all.
		let monitor = await seedMonitor(db, { expected_status: 500 });
		await seedAlert(db, monitor.id);
		let jobId = `${monitor.id}:1700000000000`;

		await runJob(db, monitor.id, { jobId });
		await runJob(db, monitor.id, { jobId });

		let rows = await db.findMany(monitorResults, { where: { monitor_id: monitor.id } });
		expect(rows).toHaveLength(1);
		expect(writeDataPointMock).toHaveBeenCalledTimes(1);
		expect(await db.findMany(alertEvents, { where: { monitor_id: monitor.id } })).toHaveLength(1);
	});

	test("a redelivered job doesn't hit the monitored endpoint again", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		let jobId = `${monitor.id}:1700000000000`;

		await runJob(db, monitor.id, { jobId });
		let logger = await runJob(db, monitor.id, { jobId });

		expect(doFetchMock).toHaveBeenCalledTimes(1);
		expect(logger.events.find((entry) => entry.event === "job.check_http.duplicate")).toBeDefined();
	});

	test("a distinct job id for the same monitor records a second result", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);

		await runJob(db, monitor.id, { jobId: `${monitor.id}:1700000000000` });
		await runJob(db, monitor.id, { jobId: `${monitor.id}:1700000060000` });

		let rows = await db.findMany(monitorResults, { where: { monitor_id: monitor.id } });
		expect(rows).toHaveLength(2);
	});

	test("the result row is keyed by the job id", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		let jobId = `${monitor.id}:1700000000000`;

		await runJob(db, monitor.id, { jobId });

		expect(await db.findOne(monitorResults, { where: { id: jobId } })).not.toBeNull();
	});
});

describe("CheckHttpJob error handling", () => {
	test("an unreachable endpoint is a stored result, not a retry", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		doFetchMock.mockImplementation(
			async () =>
				new Response(null, { status: 204, headers: { "X-Probe-Outcome": "unreachable" } }),
		);

		// Resolving rather than rejecting is what makes `Job.run` ack the message.
		await expect(runJob(db, monitor.id)).resolves.toBeDefined();
		expect(await db.findOne(monitorResults, { where: { monitor_id: monitor.id } })).not.toBeNull();
	});

	test("an unavailable Durable Object retries instead of recording a 'down'", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		// A rejected stub call is the object itself failing, not the monitored endpoint.
		doFetchMock.mockImplementation(async () => {
			throw new Error("Durable Object reset because its code was updated");
		});

		let logger = new BatchedLogger("test");
		let job = new CheckHttpJob(
			{ logger },
			{ id: `${monitor.id}:1`, monitorId: monitor.id, scheduledAt: 1 },
		);

		await expect(makeContainer(db).scope(() => job.perform())).rejects.toThrow(Job.RetryError);
		expect(await db.findOne(monitorResults, { where: { monitor_id: monitor.id } })).toBeNull();
		expect(writeDataPointMock).not.toHaveBeenCalled();
	});

	test("a database fault asks the queue to redeliver", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		let broken = {
			findOne: async () => {
				throw new Error("D1_ERROR: network connection lost");
			},
		} as unknown as Database;

		let logger = new BatchedLogger("test");
		let job = new CheckHttpJob(
			{ logger },
			{ id: `${monitor.id}:1`, monitorId: monitor.id, scheduledAt: 1 },
		);

		await expect(makeContainer(broken).scope(() => job.perform())).rejects.toThrow(Job.RetryError);
		expect(
			logger.events.find((entry) => entry.event === "job.check_http.infrastructure_error"),
		).toBeDefined();
	});

	test("an alert-dispatch fault doesn't undo or retry a committed result", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { expected_status: 500 });
		/**
		 * Alert dispatch resolves which alerts apply through the database before it
		 * delivers anything; a fault there is the one way `notifyHttpResult` throws.
		 */
		let realFindMany = db.findMany.bind(db);
		db.findMany = (async (table: unknown, ...rest: unknown[]) => {
			if (table === alerts) throw new Error("D1_ERROR: could not resolve alerts");
			return await (realFindMany as (...args: unknown[]) => Promise<unknown>)(table, ...rest);
		}) as typeof db.findMany;

		let logger = await runJob(db, monitor.id);
		db.findMany = realFindMany;

		expect(await db.findOne(monitorResults, { where: { monitor_id: monitor.id } })).not.toBeNull();
		expect(
			logger.events.find((entry) => entry.event === "job.check_http.alert_failed"),
		).toBeDefined();
	});
});

describe("CheckHttpJob alerting", () => {
	test("alerts a recovery when the previous check was down and this one is up", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		await seedAlert(db, monitor.id);
		analyticsRows = [
			{ status: "down", responseTimeMs: 0, responseStatus: 500, timestamp: "2026-01-01" },
		];

		await runJob(db, monitor.id);

		let events = await db.findMany(alertEvents, { where: { monitor_id: monitor.id } });
		expect(events).toHaveLength(1);
		expect(events[0]?.event_type).toBe("up");
	});

	test("doesn't alert an 'up' check that isn't a recovery", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		await seedAlert(db, monitor.id);
		analyticsRows = [
			{ status: "up", responseTimeMs: 1, responseStatus: 200, timestamp: "2026-01-01" },
		];

		await runJob(db, monitor.id);

		expect(await db.findMany(alertEvents, { where: { monitor_id: monitor.id } })).toHaveLength(0);
	});

	test("treats an unavailable Analytics Engine as no previous status", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		await seedAlert(db, monitor.id);
		analyticsUnavailable = true;

		await runJob(db, monitor.id);

		// No previous status is never a recovery, so an `up` check stays silent.
		expect(await db.findMany(alertEvents, { where: { monitor_id: monitor.id } })).toHaveLength(0);
		expect(await db.findOne(monitorResults, { where: { monitor_id: monitor.id } })).not.toBeNull();
	});

	test("reads the previous status before recording this check's own data point", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		let order: string[] = [];
		writeDataPointMock.mockImplementation(() => {
			order.push("write");
		});
		let realFetch = globalThis.fetch;
		globalThis.fetch = (async (input: unknown) => {
			if (String(input).includes("analytics_engine")) order.push("read");
			return new Response(JSON.stringify({ data: [] }), { status: 200 });
		}) as never;

		await runJob(db, monitor.id);
		globalThis.fetch = realFetch;
		writeDataPointMock.mockImplementation(() => {});

		expect(order).toEqual(["read", "write"]);
	});
});
