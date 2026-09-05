/**
 * Unit tests for the `checkHttp` job: classification, degraded thresholds and
 * content checks, at-least-once idempotency, Durable Object sharding and EU
 * jurisdiction pinning (ADR-013), the D1 cost model (ADR-019), and usage metering.
 * The database is a real in-memory SQLite instance, MSW serves the webhook and Analytics
 * Engine endpoints, and billing runs against a real in-memory platform.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UsageEvent } from "@sdxc/billing";
import type { AnalyticsEngineMock, QueueMock } from "@sdxc/cloudflare-mocks";
import type { SqliteDatabase } from "@sdxc/cloudflare-mocks/sqlite";
import type { DataManipulationRequest, DatabaseDriver } from "remix/data-table";

import { BillingError } from "@sdxc/billing";
import {
	createAnalyticsEngine,
	createDurableObjectNamespace,
	createEnv,
	createQueue,
} from "@sdxc/cloudflare-mocks";
import { openDatabase } from "@sdxc/cloudflare-mocks/sqlite";
import { Log } from "@sdxc/logger";
import { Mailer } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";
import { failure } from "@sdxc/result";
import { ServiceContainer } from "@sdxc/service-container";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Database } from "remix/data-table";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { GeoFetchDO } from "~/app/do/geo-fetch";

import { MAIL_FROM } from "~/app/emails/sender";
import { createTestBilling } from "~/app/lib/test/billing";
import {
	applyMigrations,
	compileSqliteStatement,
	createSqliteDatabaseAdapter,
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

/** The `GeoFetchDO` stub the job calls through `env.GEO_FETCH.get(id).fetch(...)`. */
let doFetchMock = vi.fn(
	async (_url?: string, _init?: { method?: string }) =>
		new Response("OK", { status: 200, headers: { "X-Response-Time": "12" } }),
);

/**
 * The `GEO_FETCH` binding, routing every object it hands out to {@link doFetchMock}.
 * Its `resolutions` record each probe's object name, region, and jurisdiction, in
 * order, since a jurisdiction is a property of the id that minted it (ADR-013).
 */
let geoFetch = createDurableObjectNamespace<GeoFetchDO>(() => ({ fetch: doFetchMock }));

/**
 * The dataset `writePingResult` reports to, at module scope since the module under
 * test captures `env` on import; `beforeEach` empties it in place to keep that
 * reference live, and it enforces the platform's per-point cardinality and size limits.
 */
let pingResults: AnalyticsEngineMock = createAnalyticsEngine();

/** The queue, watched so a stray send from the check would be caught here. */
let queue: QueueMock = createQueue();

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({
		GEO_FETCH: geoFetch,
		QUEUE: queue,
		PING_RESULTS: pingResults,
		CLOUDFLARE_ACCOUNT_ID: "test-account",
		CLOUDFLARE_ANALYTICS_TOKEN: "test-token",
	}),
	waitUntil: (promise: Promise<unknown>) => promise,
	/** Present so `~/app/do/geo-fetch` can extend it at module load. */
	DurableObject: class {},
}));

/**
 * The platform the job bills against, with the one call `ingestPings` makes spied on. The
 * platform is real — only the observation is added — so the event shape asserted below is
 * the one `ingestPings` actually built.
 */
let billing = createTestBilling();
let realIngest = billing.usage.ingest.bind(billing.usage);
let ingestMock = vi.spyOn(billing.usage, "ingest");

/** The job has no request behind it, so it reads the configured platform from this module. */
let realBillingModule = await import("~/app/lib/billing");

vi.doMock("~/app/lib/billing", () => ({ ...realBillingModule, polar: billing }));

let { Job, createJobContext } = await import("@sdxc/jobs");
let jobs = (await import("~/app/jobs")).default;
let { Database: JobDatabase } = await import("~/app/jobs/middleware/database");
let checkHttp = (await import("./check-http")).default;

/** Builds a container with a mailer that records instead of sending. */
function makeContainer() {
	let container = new ServiceContainer();
	container.singleton(
		Mailer,
		() => new Mailer({ transport: new MemoryTransport(), from: MAIL_FROM }),
	);
	return container;
}

/**
 * Builds the context the handler receives, carrying the database its chain would publish,
 * paired with the closer that ends its log and hands back the record. Both are returned
 * because a delivery that asks for a retry still leaves a record worth reading.
 */
function makeContext(db: Database, monitorId: string, options: { jobId?: string } = {}) {
	let record: Record<string, unknown> = {};
	let log = new Log({ kind: "job", sink: (emitted) => void (record = emitted) });
	let ctx = createJobContext(jobs.checkHttp, {
		id: "message-1",
		attempts: 1,
		input: {
			id: options.jobId ?? `${monitorId}:1700000000000`,
			monitorId,
			scheduledAt: 1_700_000_000_000,
		},
		log,
	});
	ctx.set(JobDatabase, db, { property: "database" });

	return {
		ctx,
		emit: () => {
			log.emit();
			return record;
		},
	};
}

/** Runs the job against `db`, returning the record its log emitted. */
async function runJob(db: Database, monitorId: string, options: { jobId?: string } = {}) {
	let { ctx, emit } = makeContext(db, monitorId, options);
	await makeContainer().scope(() => checkHttp(ctx));
	return emit();
}

/** One breadcrumb the run left, for the assertions that read a note's own fields. */
function noteOf(record: Record<string, unknown>, name: string): Log.Note | undefined {
	return (record.notes as Log.Note[] | undefined)?.find((note) => note.name === name);
}

/**
 * Seeds the team a monitor belongs to, which is what names the billing customer the check
 * is billed to. Only the metering and cost suites need it seeded, since billing is the
 * one thing here that reads it.
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

/** The Analytics Engine SQL API endpoint, served as a default handler for any query landing there. */
let SQL_URL = "https://api.cloudflare.com/client/v4/accounts/test-account/analytics_engine/sql";

/** The endpoint {@link seedAlert}'s webhook alert delivers to. */
let WEBHOOK_URL = "https://hooks.test/alert";

/** The endpoint each webhook delivery the alert dispatch made went to, in order. */
let deliveries: string[] = [];

/**
 * MSW serving the two endpoints the pipeline reaches for, as default handlers so every
 * check can touch either one; `onUnhandledRequest: "error"` turns any third destination
 * into a failure.
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
	ingestMock.mockClear();
	ingestMock.mockImplementation(realIngest);
	deliveries.length = 0;
});

describe("checkHttp classification", () => {
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

		let record = await runJob(db, "does-not-exist");

		expect(doFetchMock).not.toHaveBeenCalled();
		expect(
			await db.findOne(monitorResults, { where: { monitor_id: "does-not-exist" } }),
		).toBeNull();
		expect(noteOf(record, "monitors.not_found")).toBeDefined();
	});
});

describe("checkHttp content checks", () => {
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
 * Which `GeoFetchDO` instance a check probes through (ADR-009): the region comes from
 * the location hint, sharded eight ways to spread probing across objects, and pinned
 * per monitor so a shard move can't fake a response-time change.
 */
describe("checkHttp Durable Object sharding", () => {
	test("probes through a shard of the monitor's region", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { location_hint: "weur" });

		await runJob(db, monitor.id);

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

		for (let index = 0; index < 8; index++) {
			let monitor = await seedMonitor(db, { id: `monitor-${index}` });
			await runJob(db, monitor.id);
		}

		let shards = new Set(derivedObjectNames().map((name) => name.split(":")[1]));
		expect(shards.size).toBeGreaterThanOrEqual(4);
	});
});

/**
 * Which regions get an EU-pinned Durable Object, and that its id was minted by the
 * subnamespace handed to `get`, since a jurisdiction lives on the id and a mismatch is
 * what the real binding rejects (ADR-013) — the bug that once retried every EU check.
 */
describe("checkHttp EU jurisdiction", () => {
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

		expect(geoFetch.resolutions[0]?.locationHint).toBe("enam");
		expect(geoFetch.resolutions[0]?.jurisdiction).toBeUndefined();
	});

	test("mints an EU-pinned monitor's id from the EU subnamespace", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { location_hint: "eeur" });

		await runJob(db, monitor.id);

		expect(geoFetch.resolutions[0]?.jurisdiction).toBe("eu");
		expect(geoFetch.resolutions[0]?.name).toMatch(/^eeur:[0-7]$/);
		expect(await db.findOne(monitorResults, { where: { monitor_id: monitor.id } })).not.toBeNull();
	});
});

describe("checkHttp idempotency", () => {
	test("a redelivered job records one result, one data point, and one alert", async () => {
		let { db } = createTestDatabase();
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
		let record = await runJob(db, monitor.id, { jobId });

		expect(doFetchMock).toHaveBeenCalledTimes(1);
		expect(noteOf(record, "checks.duplicate")).toBeDefined();
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

describe("checkHttp error handling", () => {
	test("an unreachable endpoint is a stored result, not a retry", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		doFetchMock.mockImplementation(
			async () =>
				new Response(null, { status: 204, headers: { "X-Probe-Outcome": "unreachable" } }),
		);

		await expect(runJob(db, monitor.id)).resolves.toBeDefined();
		expect(await db.findOne(monitorResults, { where: { monitor_id: monitor.id } })).not.toBeNull();
	});

	test("an unavailable Durable Object retries instead of recording a 'down'", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		doFetchMock.mockImplementation(async () => {
			throw new Error("Durable Object reset because its code was updated");
		});

		let { ctx } = makeContext(db, monitor.id, { jobId: `${monitor.id}:1` });

		await expect(makeContainer().scope(() => checkHttp(ctx))).rejects.toThrow(Job.Retry);
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

		let { ctx, emit } = makeContext(broken, monitor.id, { jobId: `${monitor.id}:1` });

		await expect(makeContainer().scope(() => checkHttp(ctx))).rejects.toThrow(Job.Retry);
		expect(emit()).toMatchObject({
			outcome: "error",
			"error.message": "D1_ERROR: network connection lost",
		});
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

		let record = await runJob(db, monitor.id);
		db.findMany = realFindMany;

		expect(await db.findOne(monitorResults, { where: { monitor_id: monitor.id } })).not.toBeNull();
		expect(noteOf(record, "notifications.alert_failed")).toBeDefined();
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
 * Builds a test database that records every statement executed through it, with the
 * query plan SQLite chose, so a test can assert what one job costs against the same
 * SQL and bindings production sends to D1.
 * @returns The `db` handle and the array statements are appended to.
 */
function createObservedDatabase() {
	let statements: ObservedStatement[] = [];
	let sqliteDb = openDatabase(":memory:");
	applyMigrations(sqliteDb);

	let adapter = createSqliteDatabaseAdapter(sqliteDb);
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
 * Returns an empty plan for anything SQLite won't explain — an `INSERT` of literal
 * values has no interesting plan — so the assertions above see nothing to flag.
 * @param sqliteDb Open SQLite database with the schema applied.
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
 * The plan steps where SQLite scans a whole table.
 *
 * Rows read scale with table size once a plan degrades to a scan, a property that
 * counting returned rows alone cannot reveal.
 * @param statements Statements recorded by {@link createObservedDatabase}.
 * @returns One entry per scanning plan step, empty when every statement uses an index.
 */
function tableScans(statements: ObservedStatement[]): string[] {
	return statements.flatMap((statement) =>
		statement.plan.filter((step) => step.startsWith("SCAN ")),
	);
}

/**
 * Narrows a compiled binding to something the SQLite driver accepts. Any other type
 * throws, since its default stringification would send the query a value nothing
 * meant to bind.
 */
function toBinding(value: unknown): unknown {
	if (value === null || value === undefined) return null;
	if (typeof value === "string") return value;
	if (typeof value === "number") return value;
	if (typeof value === "bigint") return value;
	if (typeof value === "boolean") return value ? 1 : 0;
	if (value instanceof Uint8Array) return value;
	throw new TypeError(`Unsupported SQL binding of type ${typeof value}`);
}

describe("checkHttp Durable Object wall time", () => {
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

		let record = await runJob(db, monitor.id);

		expect(record).toMatchObject({
			"check.response_time_ms": 12,
			"check.do_wall_time_ms": 37.5,
		});
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

		let record = await runJob(db, monitor.id);

		expect(record["check.response_time_ms"]).toBeNull();
		expect(record["check.do_wall_time_ms"]).toBe(10_000);
	});

	test("reports no wall time rather than zero when the object didn't measure one", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		doFetchMock.mockImplementation(
			async () => new Response("OK", { status: 200, headers: { "X-Response-Time": "12" } }),
		);

		let record = await runJob(db, monitor.id);

		expect(record["check.do_wall_time_ms"]).toBeNull();
	});
});

/**
 * The cost model of one HTTP check: 6 D1 statements, 6 rows, no table scan (ADR-019 §4).
 * ADR-002 traced the platform's worst cost regression to a table-scanning query, so
 * catching one here turns it into a CI failure long before it becomes a bill.
 */
describe("checkHttp cost model", () => {
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
		expect(rows).toBe(4);
	});

	test("every statement resolves through an index instead of scanning a table", async () => {
		let { db, statements } = createObservedDatabase();
		await seedTeam(db);
		let monitor = await seedMonitor(db);
		await seedContentCheck(db, monitor.id, "expected-token");
		statements.length = 0;

		await runJob(db, monitor.id);

		expect(tableScans(statements)).toEqual([]);
	});

	test("the cost of a healthy check doesn't grow with the size of the tables", async () => {
		let { db, statements } = createObservedDatabase();
		await seedTeam(db);
		let monitor = await seedMonitor(db);

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

		await db.findMany(monitors, { where: { name: "Example site" } });

		expect(tableScans(statements)).toEqual(["SCAN monitors"]);
	});
});

describe("checkHttp alerting", () => {
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
		let monitor = await seedMonitor(db);
		await seedAlert(db, monitor.id);
		expect(monitor.last_status).toBeNull();

		await runJob(db, monitor.id);

		expect(await db.findMany(alertEvents, { where: { monitor_id: monitor.id } })).toHaveLength(0);
		expect(await db.findOne(monitorResults, { where: { monitor_id: monitor.id } })).not.toBeNull();
	});

	test("an unavailable Analytics Engine no longer affects recovery detection", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "down" });
		await seedAlert(db, monitor.id);
		server.use(http.post(SQL_URL, () => HttpResponse.error()));

		await runJob(db, monitor.id);

		let events = await db.findMany(alertEvents, { where: { monitor_id: monitor.id } });
		expect(events).toHaveLength(1);
		expect(events[0]?.event_type).toBe("up");
		expect(deliveries).toEqual([WEBHOOK_URL]);
	});
});

describe("checkHttp cached status", () => {
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
		doFetchMock.mockImplementation(async () => {
			throw new Error("Durable Object reset because its code was updated");
		});

		await expect(runJob(db, monitor.id)).rejects.toThrow(Job.Retry);

		let updated = await db.findOne(monitors, { where: { id: monitor.id } });
		expect(updated?.last_status).toBeNull();
		expect(updated?.last_checked_at).toBeNull();
		expect(updated?.last_response_time_ms).toBeNull();
	});
});

/**
 * The check as a billable ping: one event against the `ping` meter, keyed on the job id
 * so a redelivery is deduplicated on the platform's side as well as short-circuited on ours,
 * with
 * billing happening only once a result has actually committed.
 */
describe("checkHttp metering", () => {
	/** Every event the job handed the platform, flattened across the calls it made. */
	function ingestedEvents(): UsageEvent[] {
		return ingestMock.mock.calls.flatMap(([events]) => [...events]);
	}

	test("bills one ping, keyed on the job id and charged to the team's owner", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db);
		let monitor = await seedMonitor(db);
		let jobId = `${monitor.id}:1700000000000`;

		await runJob(db, monitor.id, { jobId });

		expect(ingestMock).toHaveBeenCalledTimes(1);
		expect(ingestedEvents()).toEqual([
			{
				name: "ping",
				customer: { externalId: "owner-1" },
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
		let monitor = await seedMonitor(db);

		let record = await runJob(db, monitor.id);

		expect(ingestMock).not.toHaveBeenCalled();
		expect(noteOf(record, "checks.unbillable_team")?.["team.id"]).toBe("team-1");
		expect(await db.findOne(monitorResults, { where: { monitor_id: monitor.id } })).not.toBeNull();
	});

	test("a rejected ingestion doesn't fail a check that already committed a result", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db);
		let monitor = await seedMonitor(db);
		ingestMock.mockImplementation(async () =>
			failure(new BillingError("refused", { code: "invalid_request", connection: "memory" })),
		);

		let record = await runJob(db, monitor.id);

		expect(await db.findOne(monitorResults, { where: { monitor_id: monitor.id } })).not.toBeNull();
		expect(record).toMatchObject({ outcome: "ok", "check.status": "up" });
	});

	test("bills nothing for a check that never committed a result", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db);
		let monitor = await seedMonitor(db);
		doFetchMock.mockImplementation(async () => {
			throw new Error("Durable Object reset because its code was updated");
		});

		await expect(runJob(db, monitor.id)).rejects.toThrow(Job.Retry);

		expect(ingestMock).not.toHaveBeenCalled();
	});
});
