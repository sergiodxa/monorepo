/**
 * Unit tests for `CheckHttpJob.perform()`, the whole HTTP check pipeline: input
 * validation, classification of up/degraded/down against the expected status, degraded
 * threshold and content checks, and the at-least-once guarantees — a redelivered job id
 * must not produce a second `monitor_results` row, a second analytics data point, or a
 * second alert. An unavailable Durable Object must ask for a redelivery; an unreachable
 * monitored endpoint must not.
 *
 * `env.GEO_FETCH` is a binding mock whose objects answer with a stub, so the region-hinted
 * fetch is controlled per test and every object the job resolved is recorded, which is how
 * the shard a check lands on and the jurisdiction it is pinned to are asserted. The
 * database is a real in-memory SQLite one so the primary-key collision that backs
 * idempotency is genuinely exercised rather than simulated.
 *
 * Neither `~/app/services/analytics` nor `~/app/services/alerts` is mocked: analytics is
 * observed through the in-memory `PING_RESULTS` dataset it writes to, which records each
 * point and enforces the platform's cardinality and size limits, and alert dispatch runs for
 * real against the test database and is observed through the `alert_events` rows it
 * leaves behind — which is what makes the "no duplicate alert" assertions meaningful.
 * MSW serves the two endpoints the pipeline reaches for — webhook delivery, and the
 * Analytics Engine SQL API the check no longer needs to ask anything of — on separate
 * handlers, so a delivery is observed as the request it is.
 *
 * Polar is the one dependency held as a double: the container is handed a client whose
 * `ingestEventsSafe` is spied on, so the ping the job bills can be asserted — its
 * deduplication id, its customer, its metadata — without a request leaving the process.
 *
 * Two of the suites are about cost rather than correctness (ADR-019): that the job
 * logs the Durable Object's billed wall time next to the probe's response time instead
 * of conflating them, and that one healthy check still costs the six indexed D1
 * statements it is supposed to cost.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Database as SqliteDatabase } from "bun:sqlite";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";

import type { AnalyticsEngineMock, QueueMock } from "@pkg/cloudflare-mocks";
import type { IngestEvent } from "@pkg/polar";
import type { DataManipulationRequest, DatabaseDriver } from "remix/data-table";

import {
	createAnalyticsEngine,
	createDurableObjectNamespace,
	createEnv,
	createQueue,
} from "@pkg/cloudflare-mocks";
import { BatchedLogger } from "@pkg/logger";
import { Mailer } from "@pkg/mail";
import { MemoryTransport } from "@pkg/mail/memory";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Database } from "remix/data-table";

import type { GeoFetchDO } from "~/app/do/geo-fetch";

import { MAIL_FROM } from "~/app/emails/sender";
import {
	applyMigrations,
	compileSqliteStatement,
	createBunSqliteDatabaseAdapter,
	createTestDatabase,
} from "~/app/lib/test/db";
import {
	alertEvents,
	alerts,
	monitorContentChecks,
	monitorResults,
	monitors,
	teams,
} from "~/database/schema";

import type { SQLQueryBindings } from "bun:sqlite";

/** The `GeoFetchDO` stub the job calls through `env.GEO_FETCH.get(id).fetch(...)`. */
let doFetchMock = mock(
	async (_url?: string, _init?: { method?: string }) =>
		new Response("OK", { status: 200, headers: { "X-Response-Time": "12" } }),
);

/**
 * The `GEO_FETCH` binding, routing every object it hands out to {@link doFetchMock}.
 *
 * Its `resolutions` are the probes the job issued, in order, one per `get`, each carrying
 * the object's name, the region it was placed in, and the jurisdiction it was reached
 * through. It enforces the platform's rule that a jurisdiction is a property of the *id*,
 * stamped on by whichever (sub)namespace minted it, so `get` errors when the id's
 * jurisdiction differs from the namespace's — see
 * https://developers.cloudflare.com/durable-objects/reference/data-location/. That rule is
 * the whole reason the EU branch has to mint its id from the subnamespace instead of from
 * `env.GEO_FETCH` (ADR-013).
 */
let geoFetch = createDurableObjectNamespace<GeoFetchDO>(() => ({ fetch: doFetchMock }));

/**
 * The dataset `writePingResult` reports to. It lives at module scope because the module
 * under test captures `env` on import, so `beforeEach` empties it rather than re-creating
 * it, and it enforces the platform's per-point cardinality and size limits.
 */
let pingResults: AnalyticsEngineMock = createAnalyticsEngine();

/**
 * The billing client the container hands the job, with the one call `ingestPings` makes
 * spied on. The client is real — only the request is intercepted — so the event shape
 * asserted below is the one `ingestPings` actually built.
 */
let polar = new PolarClient({ accessToken: "polar_at_test" });
let ingestEventsSafeMock = spyOn(polar, "ingestEventsSafe");

/** The queue the check's own path never sends to, kept so a stray send would be recorded. */
let queue: QueueMock = createQueue();

await mock.module("cloudflare:workers", () => ({
	env: createEnv<Env>({
		GEO_FETCH: geoFetch,
		QUEUE: queue,
		PING_RESULTS: pingResults,
		CLOUDFLARE_ACCOUNT_ID: "test-account",
		CLOUDFLARE_ANALYTICS_TOKEN: "test-token",
	}),
	waitUntil: (promise: Promise<unknown>) => promise,
	/** Never instantiated here; `~/app/do/geo-fetch` extends it at module load. */
	DurableObject: class {},
}));

let { Job } = await import("@pkg/jobs");
let { CheckHttpJob } = await import("./check-http");

/**
 * Builds a container with the database, a mailer that records instead of sending, and the
 * spied-on billing client.
 */
function makeContainer(db: Database) {
	let container = new ServiceContainer();
	container.singleton(Database, () => db);
	container.singleton(
		Mailer,
		() => new Mailer({ transport: new MemoryTransport(), from: MAIL_FROM }),
	);
	container.singleton(PolarClient, () => polar);
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

/**
 * Seeds the team a monitor belongs to, which is what names the Polar customer the check
 * is billed to. Most suites here leave it out — the check itself doesn't depend on it —
 * so the metering and cost suites seed it explicitly.
 */
async function seedTeam(db: Database, overrides: Record<string, unknown> = {}) {
	return await db.create(
		teams,
		{
			id: "team-1",
			owner_id: "owner-1",
			name: "Acme",
			slug: "acme",
			logo: null,
			...overrides,
		} as never,
		{ touch: true, returnRow: true },
	);
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
			config: { strategy: "webhook", config: { url: WEBHOOK_URL, secret: "" } },
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
function lastRecordedStatus(): unknown {
	return pingResults.dataPoints.at(-1)?.blobs?.[2];
}

/** The `GeoFetchDO` object names the job resolved, one per probe it issued. */
function derivedObjectNames(): string[] {
	return geoFetch.resolutions.map((resolution) => resolution.name);
}

/** The Analytics Engine SQL API endpoint, which the check reads nothing from any more. */
let SQL_URL = "https://api.cloudflare.com/client/v4/accounts/test-account/analytics_engine/sql";

/** The endpoint {@link seedAlert}'s webhook alert delivers to. */
let WEBHOOK_URL = "https://hooks.test/alert";

/** The endpoint each webhook delivery the alert dispatch made went to, in order. */
let deliveries: string[] = [];

/**
 * MSW serving the two endpoints the pipeline reaches for. They are default handlers rather
 * than per-test ones because every check may touch either, and `onUnhandledRequest: "error"`
 * turns any third destination into a failure instead of a silent request.
 */
let server = setupServer(
	http.post(SQL_URL, () => HttpResponse.json({ data: [] })),
	http.post(WEBHOOK_URL, ({ request }) => {
		deliveries.push(request.url);
		return HttpResponse.text("ok");
	}),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
	doFetchMock.mockReset();
	doFetchMock.mockImplementation(
		async () => new Response("OK", { status: 200, headers: { "X-Response-Time": "12" } }),
	);
	pingResults.reset();
	geoFetch.reset();
	ingestEventsSafeMock.mockClear();
	ingestEventsSafeMock.mockImplementation(async () => true);
	deliveries.length = 0;
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

/**
 * Which `GeoFetchDO` instance a check probes through (ADR-009). The region still comes
 * from the monitor's location hint, but the object id is sharded within that region so a
 * region's probing isn't serialized through a single object — while staying stable per
 * monitor, because a monitor that moved shards would show a step change in its response
 * times that nothing the user did explains.
 */
describe("CheckHttpJob Durable Object sharding", () => {
	test("probes through a shard of the monitor's region", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { location_hint: "weur" });

		await runJob(db, monitor.id);

		// The region is still the location hint; eight shards per region, hence 0-7.
		expect(derivedObjectNames()).toEqual([expect.stringMatching(/^weur:[0-7]$/)]);
	});

	test("sends a monitor to the same shard on every check", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);

		await runJob(db, monitor.id, { jobId: `${monitor.id}:1700000000000` });
		await runJob(db, monitor.id, { jobId: `${monitor.id}:1700000060000` });

		let [first, second] = derivedObjectNames();
		expect(second).toBe(first);
	});

	test("spreads monitors across the shards instead of collapsing onto one", async () => {
		let { db } = createTestDatabase();

		// Fixed ids so this asserts the hash's spread rather than which uuids came up.
		for (let index = 0; index < 8; index++) {
			let monitor = await seedMonitor(db, { id: `monitor-${index}` });
			await runJob(db, monitor.id);
		}

		let shards = new Set(derivedObjectNames().map((name) => name.split(":")[1]));
		expect(shards.size).toBeGreaterThanOrEqual(4);
	});
});

/**
 * Which regions get an EU-pinned Durable Object, and that the id it probes through was
 * minted by the namespace it is handed to (ADR-013). A jurisdiction is a hard constraint
 * on where the object runs while a location hint is only a preference, so a hint pinned to
 * the wrong jurisdiction probes from the wrong continent and records a `response_time_ms`
 * for it — which is what `enam` in the set did, uncaught, because none of this was covered.
 */
describe("CheckHttpJob EU jurisdiction", () => {
	/** Every value `monitors.location_hint` accepts. */
	const LOCATION_HINTS = ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"];

	test("pins Europe's two hints to the EU jurisdiction and no others", async () => {
		let { db } = createTestDatabase();
		let pinned: string[] = [];

		for (let hint of LOCATION_HINTS) {
			let monitor = await seedMonitor(db, { location_hint: hint });
			geoFetch.reset();

			await runJob(db, monitor.id);

			if (geoFetch.resolutions[0]?.jurisdiction === "eu") pinned.push(hint);
		}

		expect(pinned).toEqual(["weur", "eeur"]);
	});

	test("probes an 'enam' monitor from North America rather than the EU", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { location_hint: "enam" });

		await runJob(db, monitor.id);

		// Eastern *North America*: the region it asked for, and no jurisdiction to
		// override it. Pinning it to the EU moved the probe to another continent, and
		// every response time it recorded with it.
		expect(geoFetch.resolutions[0]?.locationHint).toBe("enam");
		expect(geoFetch.resolutions[0]?.jurisdiction).toBeUndefined();
	});

	test("mints an EU-pinned monitor's id from the EU subnamespace", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { location_hint: "eeur" });

		await runJob(db, monitor.id);

		// An id minted off the base namespace carries no jurisdiction, and handing that to
		// the EU subnamespace's `get` is the mismatch the real binding rejects — which
		// turned every check in a European region into a retry that could only spin.
		expect(geoFetch.resolutions[0]?.jurisdiction).toBe("eu");
		expect(geoFetch.resolutions[0]?.name).toMatch(/^eeur:[0-7]$/);
		expect(await db.findOne(monitorResults, { where: { monitor_id: monitor.id } })).not.toBeNull();
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
		expect(pingResults.dataPoints).toHaveLength(1);
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
		expect(pingResults.dataPoints).toHaveLength(0);
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

/**
 * One statement the job asked the database for, with the plan SQLite chose for it.
 */
interface ObservedStatement {
	kind: string;
	sql: string;
	/** Rows the statement returned, or rows it reported changing for a write. */
	rows: number;
	/** `EXPLAIN QUERY PLAN` detail lines, which name the index (or scan) chosen. */
	plan: string[];
}

/**
 * Builds a test database that records every statement executed through it, together
 * with the query plan SQLite chose, so a test can assert what one job costs.
 *
 * The adapter is wrapped rather than replaced, so the SQL, the bindings, and the plan
 * are the real ones the production adapter would send to D1 — `@pkg/data-table-d1`
 * and this test adapter compile identical SQLite statements from the same operations.
 * @returns The `db` handle and the array statements are appended to.
 */
function createObservedDatabase() {
	let statements: ObservedStatement[] = [];
	let sqliteDb = new SqliteDatabase(":memory:");
	applyMigrations(sqliteDb);

	let adapter = createBunSqliteDatabaseAdapter(sqliteDb);
	let observed: DatabaseDriver = {
		...adapter,
		async execute(request: DataManipulationRequest) {
			let result = await adapter.execute(request);
			let compiled = compileSqliteStatement(request.operation);

			statements.push({
				kind: request.operation.kind,
				sql: compiled?.text ?? "",
				rows: result.rows?.length ?? result.affectedRows ?? 0,
				plan: explain(sqliteDb, compiled?.text ?? "", compiled?.values ?? []),
			});

			return result;
		},
	};

	return { db: new Database(observed, { now: () => Date.now() }), statements };
}

/**
 * Asks SQLite how it intends to run a statement.
 *
 * Returns an empty plan for anything SQLite won't explain (an `INSERT` of literal
 * values has no interesting plan) rather than failing the test that asked.
 * @param sqliteDb Open `bun:sqlite` database with the schema applied.
 * @param sql Statement text as compiled for D1.
 * @param values Bindings for the statement.
 * @returns One string per plan step, e.g. `SEARCH monitors USING INDEX ...`.
 */
function explain(sqliteDb: SqliteDatabase, sql: string, values: unknown[]): string[] {
	try {
		let rows = sqliteDb.query(`EXPLAIN QUERY PLAN ${sql}`).all(...values.map(toBinding)) as {
			detail?: string;
		}[];
		return rows.map((row) => row.detail ?? "");
	} catch {
		return [];
	}
}

/**
 * The plan steps that read a whole table instead of searching it.
 *
 * These are what make rows read scale with table size, which is the property the cost
 * model depends on and the one counting returned rows cannot see.
 * @param statements Statements recorded by {@link createObservedDatabase}.
 * @returns One entry per scanning plan step, empty when every statement uses an index.
 */
function tableScans(statements: ObservedStatement[]): string[] {
	return statements.flatMap((statement) =>
		statement.plan.filter((step) => step.startsWith("SCAN ")),
	);
}

/** Narrows a compiled binding to something `bun:sqlite` accepts. */
function toBinding(value: unknown): SQLQueryBindings {
	if (value === null || value === undefined) return null;
	if (typeof value === "string") return value;
	if (typeof value === "number") return value;
	if (typeof value === "bigint") return value;
	if (typeof value === "boolean") return value ? 1 : 0;
	if (value instanceof Uint8Array) return value;
	// Anything else is not a value the driver ever compiles into a binding, and binding
	// its default stringification would silently run the query against nonsense.
	throw new TypeError(`Unsupported SQL binding of type ${typeof value}`);
}

describe("CheckHttpJob Durable Object wall time", () => {
	test("logs the object's reported wall time alongside the probe's response time", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		doFetchMock.mockImplementation(
			async () =>
				new Response("OK", {
					status: 200,
					headers: { "X-Response-Time": "12", "X-DO-Wall-Time": "37.5" },
				}),
		);

		let logger = await runJob(db, monitor.id);

		let completed = logger.events.find((entry) => entry.event === "job.check_http.completed");
		// Two numbers, not one conflated one: 12ms is what the monitored site's users
		// experience, 37.5ms is (a lower bound on) what the Durable Object bills for.
		expect(completed?.responseTimeMs).toBe(12);
		expect(completed?.doWallTimeMs).toBe(37.5);
	});

	test("keeps the wall time of an unreachable probe, which is the expensive case", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		doFetchMock.mockImplementation(
			async () =>
				new Response(null, {
					status: 204,
					headers: { "X-Probe-Outcome": "unreachable", "X-DO-Wall-Time": "10000" },
				}),
		);

		let logger = await runJob(db, monitor.id);

		let completed = logger.events.find((entry) => entry.event === "job.check_http.completed");
		expect(completed?.responseTimeMs).toBeNull();
		expect(completed?.doWallTimeMs).toBe(10_000);
	});

	test("reports no wall time rather than zero when the object didn't measure one", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		doFetchMock.mockImplementation(
			async () => new Response("OK", { status: 200, headers: { "X-Response-Time": "12" } }),
		);

		let logger = await runJob(db, monitor.id);

		let completed = logger.events.find((entry) => entry.event === "job.check_http.completed");
		// A measurement that didn't happen is not a handler that took no time.
		expect(completed?.doWallTimeMs).toBeNull();
	});
});

/**
 * The cost model of one HTTP check, asserted (ADR-019 §4). ADR-002 derives the cost of
 * an HTTP ping mostly from its D1 rows read, and the single worst regression that
 * analysis found was a query that reads a whole table to answer a question about a few
 * rows. These tests turn that into a CI failure instead of a bill six months later.
 *
 * What is pinned, and why those numbers:
 *
 * - **N = 6 statements**, one per thing the job has to know or record: the
 *   at-least-once duplicate check on `monitor_results`, the monitor row, its enabled
 *   content checks, the insert of the result, the write-back of the status that
 *   result put the monitor in, and the team row naming the owner the ping is billed to.
 *   A healthy `up` check dispatches no alerts (`notifyHttpResult` returns early unless
 *   the check is a recovery or not `up`), so nothing in the alert pipeline runs, and
 *   neither Analytics Engine nor Polar is D1.
 *
 *   It was 4 until ADR-011 moved recovery detection off Analytics Engine and onto a
 *   `monitors.last_status` column, which has to be maintained by a statement of its own —
 *   the scheduler's claim is a different write with a different trigger, so there was
 *   nothing to ride on. That trades one D1 statement per check for one Analytics Engine
 *   query per check, roughly a wash; the saving that paid for it is on the read side,
 *   where the monitors list dropped one uncached Analytics Engine query per monitor per
 *   page view.
 *
 *   The sixth is the owner lookup metering needs. Unlike the DNS and TCP sweeps, which
 *   resolve every owner a sweep touches in one query, this job checks a single monitor,
 *   so its lookup cannot be amortised over anything — one indexed point lookup per HTTP
 *   check is the price of billing one.
 * - **M = 6 rows**, at most one per statement: every statement is a point lookup
 *   through a unique or composite index, so it either finds its row or finds nothing.
 *   A healthy check actually returns 4 (the monitor row, the inserted result, the
 *   monitor row the status write updates, and the team row).
 * - **No statement may `SCAN` a table.** This is the assertion that really bounds rows
 *   read: rows read scales with table size the moment a plan degrades to a scan, and
 *   that cannot be seen by counting rows returned. D1's own planner has the final say —
 *   ADR-019 §3 re-checks these plans against production — but a plan that scans here
 *   will scan there.
 *
 * Rows *written* are deliberately not asserted: they are driven by how many indexes
 * cover the written table, which SQLite reports nowhere useful. That number now comes
 * from production instead, through the `usage` field this ADR added to `job.completed`.
 */
describe("CheckHttpJob cost model", () => {
	/** Statement budget for one healthy HTTP check. Raising this raises the bill. */
	const MAX_STATEMENTS = 6;
	/** Row budget for one healthy HTTP check: at most one row per statement. */
	const MAX_ROWS = 6;

	test("a healthy check costs no more than 6 statements and 6 rows", async () => {
		let { db, statements } = createObservedDatabase();
		await seedTeam(db);
		let monitor = await seedMonitor(db);
		statements.length = 0;

		await runJob(db, monitor.id);

		expect(statements).toHaveLength(MAX_STATEMENTS);
		expect(statements.map((statement) => statement.kind)).toEqual([
			"select",
			"select",
			"select",
			"insert",
			"update",
			"select",
		]);

		let rows = statements.reduce((total, statement) => total + statement.rows, 0);
		expect(rows).toBeLessThanOrEqual(MAX_ROWS);
		// The monitor row read, the result row written back with RETURNING, the monitor row
		// the cached-status write updates, and the team row the ping is billed to.
		expect(rows).toBe(4);
	});

	test("every statement resolves through an index instead of scanning a table", async () => {
		let { db, statements } = createObservedDatabase();
		await seedTeam(db);
		let monitor = await seedMonitor(db);
		await seedContentCheck(db, monitor.id, "expected-token");
		statements.length = 0;

		await runJob(db, monitor.id);

		// A `findDue`-shaped query — the regression ADR-002 §16 is most afraid of —
		// shows up here as a `SCAN <table>` step and fails this assertion.
		expect(tableScans(statements)).toEqual([]);
	});

	test("the cost of a healthy check doesn't grow with the size of the tables", async () => {
		let { db, statements } = createObservedDatabase();
		await seedTeam(db);
		let monitor = await seedMonitor(db);

		// Enough unrelated rows that a plan which scanned instead of searching would
		// read hundreds of them rather than one.
		for (let index = 0; index < 50; index++) await seedMonitor(db);
		for (let index = 0; index < 200; index++) {
			await db.create(
				monitorResults,
				{
					id: `filler:${index}`,
					monitor_id: monitor.id,
					response_status: 200,
					response_time_ms: 10,
					completed_at: 1_600_000_000_000 + index,
				} as never,
				{ touch: true },
			);
		}
		statements.length = 0;

		await runJob(db, monitor.id);

		expect(statements).toHaveLength(MAX_STATEMENTS);
		let rows = statements.reduce((total, statement) => total + statement.rows, 0);
		expect(rows).toBeLessThanOrEqual(MAX_ROWS);
		expect(tableScans(statements)).toEqual([]);
	});

	test("the scan guard has teeth: a query without a usable index is reported", async () => {
		let { db, statements } = createObservedDatabase();
		statements.length = 0;

		// `monitors.name` is deliberately unindexed, so this is what a regression looks
		// like to the assertions above.
		await db.findMany(monitors, { where: { name: "Example site" } });

		expect(tableScans(statements)).toEqual(["SCAN monitors"]);
	});
});

describe("CheckHttpJob alerting", () => {
	test("alerts a recovery when the previous check was down and this one is up", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "down" });
		await seedAlert(db, monitor.id);

		await runJob(db, monitor.id);

		let events = await db.findMany(alertEvents, { where: { monitor_id: monitor.id } });
		expect(events).toHaveLength(1);
		expect(events[0]?.event_type).toBe("up");
	});

	test("doesn't alert an 'up' check that isn't a recovery", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "up" });
		await seedAlert(db, monitor.id);

		await runJob(db, monitor.id);

		expect(await db.findMany(alertEvents, { where: { monitor_id: monitor.id } })).toHaveLength(0);
	});

	test("treats a never-checked monitor as no previous status", async () => {
		let { db } = createTestDatabase();
		// A fresh monitor's `last_status` is NULL, which is why no backfill is needed.
		let monitor = await seedMonitor(db);
		await seedAlert(db, monitor.id);
		expect(monitor.last_status).toBeNull();

		await runJob(db, monitor.id);

		// No previous status is never a recovery, so an `up` check stays silent.
		expect(await db.findMany(alertEvents, { where: { monitor_id: monitor.id } })).toHaveLength(0);
		expect(await db.findOne(monitorResults, { where: { monitor_id: monitor.id } })).not.toBeNull();
	});

	test("an unavailable Analytics Engine no longer affects recovery detection", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "down" });
		await seedAlert(db, monitor.id);
		// The previous status comes from the monitor row now, so the SQL API being down
		// cannot silence a recovery the way it used to.
		server.use(http.post(SQL_URL, () => HttpResponse.error()));

		await runJob(db, monitor.id);

		let events = await db.findMany(alertEvents, { where: { monitor_id: monitor.id } });
		expect(events).toHaveLength(1);
		expect(events[0]?.event_type).toBe("up");
		// The row is written before delivery is attempted, so the wire is what proves the
		// recovery was actually announced.
		expect(deliveries).toEqual([WEBHOOK_URL]);
	});
});

describe("CheckHttpJob cached status", () => {
	test("caches the check's status and time on the monitor row", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { degraded_after_ms: 10 });

		await runJob(db, monitor.id);

		let updated = await db.findOne(monitors, { where: { id: monitor.id } });
		expect(updated?.last_status).toBe("degraded");
		expect(updated?.last_checked_at).not.toBeNull();
		expect(updated?.last_response_time_ms).not.toBeNull();
	});

	test("doesn't cache a status for a check that never committed a result", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		// An unavailable Durable Object taught us nothing about the endpoint, so the row
		// must not come away claiming a check happened.
		doFetchMock.mockImplementation(async () => {
			throw new Error("Durable Object reset because its code was updated");
		});

		await expect(runJob(db, monitor.id)).rejects.toThrow(Job.RetryError);

		let updated = await db.findOne(monitors, { where: { id: monitor.id } });
		expect(updated?.last_status).toBeNull();
		expect(updated?.last_checked_at).toBeNull();
		expect(updated?.last_response_time_ms).toBeNull();
	});
});

/**
 * The check as a billable ping. One check is one event against the `ping` meter, keyed on
 * the job id so a redelivery Polar does see is deduplicated on its side as well as
 * short-circuited on ours, and reported after the commit so it can never bill a check that
 * produced no result.
 */
describe("CheckHttpJob metering", () => {
	/** Every event the job handed Polar, flattened across the calls it made. */
	function ingestedEvents(): IngestEvent[] {
		return ingestEventsSafeMock.mock.calls.flatMap(([events]) => events);
	}

	test("bills one ping, keyed on the job id and charged to the team's owner", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db);
		let monitor = await seedMonitor(db);
		let jobId = `${monitor.id}:1700000000000`;

		await runJob(db, monitor.id, { jobId });

		expect(ingestEventsSafeMock).toHaveBeenCalledTimes(1);
		expect(ingestedEvents()).toEqual([
			{
				name: "ping",
				externalCustomerId: "owner-1",
				externalId: `ping:${jobId}`,
				metadata: { teamId: "team-1", type: "http", monitorId: monitor.id },
			},
		]);
	});

	test("bills a down check the same as a healthy one", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db);
		let monitor = await seedMonitor(db, { expected_status: 200 });
		doFetchMock.mockImplementation(
			async () => new Response("Error", { status: 500, headers: { "X-Response-Time": "5" } }),
		);

		await runJob(db, monitor.id);

		// The allowance counts checks performed, not endpoints that answered correctly.
		expect(ingestedEvents()).toHaveLength(1);
	});

	test("a redelivered job bills the check once", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db);
		let monitor = await seedMonitor(db);
		let jobId = `${monitor.id}:1700000000000`;

		await runJob(db, monitor.id, { jobId });
		await runJob(db, monitor.id, { jobId });

		expect(ingestedEvents()).toHaveLength(1);
	});

	test("records an unbillable team and bills nothing when the team row is gone", async () => {
		let { db } = createTestDatabase();
		// No team row: a delete that raced this delivery, so there is no Polar customer.
		let monitor = await seedMonitor(db);

		let logger = await runJob(db, monitor.id);

		expect(ingestEventsSafeMock).not.toHaveBeenCalled();
		let unbillable = logger.events.find(
			(entry) => entry.event === "job.check_http.unbillable_team",
		);
		expect(unbillable?.teamId).toBe("team-1");
		// The check still happened and is still recorded — only the billing is lost.
		expect(await db.findOne(monitorResults, { where: { monitor_id: monitor.id } })).not.toBeNull();
	});

	test("a rejected ingestion doesn't fail a check that already committed a result", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db);
		let monitor = await seedMonitor(db);
		ingestEventsSafeMock.mockImplementation(async () => false);

		let logger = await runJob(db, monitor.id);

		// Past the commit point a redelivery short-circuits on the job id, so throwing here
		// would ask the queue for a retry that can only spin.
		expect(await db.findOne(monitorResults, { where: { monitor_id: monitor.id } })).not.toBeNull();
		expect(logger.events.find((entry) => entry.event === "job.check_http.completed")).toBeDefined();
	});

	test("bills nothing for a check that never committed a result", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db);
		let monitor = await seedMonitor(db);
		doFetchMock.mockImplementation(async () => {
			throw new Error("Durable Object reset because its code was updated");
		});

		await expect(runJob(db, monitor.id)).rejects.toThrow(Job.RetryError);

		expect(ingestEventsSafeMock).not.toHaveBeenCalled();
	});
});
