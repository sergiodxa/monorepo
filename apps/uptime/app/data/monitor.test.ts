/**
 * Unit tests for the `Monitor` data-access model: CRUD scoped to a team, the SSL
 * cross-team listing, and — most importantly — the raw-SQL `findDue` claim the
 * scheduler runs every minute. Its SQL can't be typo-checked by the type system and it
 * mutates the rows it returns, so it gets dedicated coverage of the claim semantics:
 * one claim per due monitor per minute, a due time that advances from the schedule
 * rather than from the claim, no catch-up storm after an outage, and a disabled monitor
 * that is never claimed. `getStats*` gets the same treatment for its two-store split: the D1
 * aggregates against a real database, the Analytics Engine p99 against a stubbed service
 * so the scope and the failure degradation are both observable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, mock, test } from "bun:test";

import type { Result } from "@pkg/result";
import type { DataManipulationRequest, Database, DatabaseAdapter } from "remix/data-table";

import { failure, success } from "@pkg/result";
import { createDatabase } from "remix/data-table";

import type { HttpP99Scope } from "~/app/services/analytics";

import {
	applyMigrations,
	createBunSqliteDatabaseAdapter,
	createTestDatabase,
} from "~/app/lib/test/db";
import { createActiveSubscription, createRevokedSubscription } from "~/app/lib/test/polar";
import {
	cronJobMonitors,
	cronJobPings,
	dnsMonitorResults,
	dnsMonitors,
	monitorDailyStats,
	monitorResults,
	monitors,
	tcpMonitorResults,
	tcpMonitors,
	teams,
} from "~/database/schema";

import type { SQLQueryBindings } from "bun:sqlite";

/** The message body `Monitor.ping` passes to `env.QUEUE.send(...)`. */
interface PingQueueMessage {
	type: string;
	id: string;
	monitorId: string;
	scheduledAt: number;
}

/**
 * `Monitor.ping` calls `env.QUEUE.send(...)`, a queue binding with nothing to assert on
 * besides "it was called with the right message shape" — stub it so importing the
 * module doesn't crash and so `ping` can assert on the call.
 */
let queueSend = mock(async (_message: PingQueueMessage) => {});
mock.module("cloudflare:workers", () => ({ env: { QUEUE: { send: queueSend } } }));

/**
 * `Monitor.getStats*` now reads its p99 from Analytics Engine (see the method's
 * docblock). Stub the service so the D1 half of the card can be asserted without an HTTP
 * round trip, and so the scope each entry point passes is observable; the SQL text itself
 * is covered in `app/services/analytics.test.ts`.
 */
let p99Query = mock(
	async (_scope: HttpP99Scope): Promise<Result<number | null, Error>> => success(null),
);
mock.module("~/app/services/analytics", () => ({ getHttpP99ResponseTime: p99Query }));

let { default: Monitor } = await import("~/app/data/monitor");

/**
 * Builds a test database that records the query plan SQLite chose for every statement
 * executed through it, so a test can assert how a query is resolved rather than only
 * what it returns.
 *
 * The adapter is wrapped rather than replaced, so the SQL and bindings explained are the
 * real ones the production adapter would send to D1 — both compile identical SQLite
 * statements from the same operations.
 * @returns The `db` handle and the array of per-statement plan step lists.
 */
function createPlanRecordingDatabase() {
	let plans: string[][] = [];
	let sqliteDb = new SqliteDatabase(":memory:");
	applyMigrations(sqliteDb);

	let adapter = createBunSqliteDatabaseAdapter(sqliteDb);
	let observed: DatabaseAdapter = {
		...adapter,
		async execute(request: DataManipulationRequest) {
			let compiled = adapter.compileSql(request.operation)[0];
			let result = await adapter.execute(request);
			plans.push(explain(sqliteDb, compiled?.text ?? "", compiled?.values ?? []));
			return result;
		},
	};

	return { db: createDatabase(observed, { now: () => Date.now() }), plans };
}

/**
 * Asks SQLite how it intends to run a statement, returning one string per plan step
 * (e.g. `SEARCH monitors USING INDEX ...`). Returns nothing for a statement SQLite
 * won't explain, rather than failing the test that asked.
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

/** Narrows a compiled binding to something `bun:sqlite` accepts. */
function toBinding(value: unknown): SQLQueryBindings {
	if (value === null || value === undefined) return null;
	if (typeof value === "string") return value;
	if (typeof value === "number") return value;
	if (typeof value === "bigint") return value;
	if (typeof value === "boolean") return value ? 1 : 0;
	if (value instanceof Uint8Array) return value;
	return String(value);
}

/**
 * The ids `Monitor.findDue` claimed. The claim returns each monitor's team as well, since
 * the scheduler apportions its own cost across the teams whose monitors were due, and every
 * assertion here is about which monitors moved.
 */
async function dueIds(db: Database, scheduledAt: number) {
	let due = await Monitor.findDue(db, scheduledAt);
	return due.map((row) => row.id);
}

/** Inserts a team row so `findDue`'s join to `teams` has an owner to resolve. */
async function createTeam(db: Database, overrides: Partial<{ ownerId: string }> = {}) {
	return await db.create(
		teams,
		{
			id: crypto.randomUUID(),
			owner_id: overrides.ownerId ?? crypto.randomUUID(),
			name: "Acme",
			slug: `acme-${crypto.randomUUID()}`,
			logo: null,
		},
		{ touch: true, returnRow: true },
	);
}

describe("Monitor.create", () => {
	test("creates a monitor for a team, enabled immediately", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);

		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
		});

		expect(monitor.team_id).toBe(team.id);
		expect(monitor.author_id).toBe("author-1");
		expect(monitor.name).toBe("Homepage");
		expect(monitor.url).toBe("https://example.com");
		expect(monitor.enabled_at).not.toBeNull();
		expect(monitor.id).toMatch(/^[0-9a-f-]{36}$/);
		// Due immediately, so the first check runs on the next tick rather than a whole
		// interval later.
		expect(monitor.next_due_at).not.toBeNull();
		expect(monitor.next_due_at).toBeLessThanOrEqual(Date.now());
	});
});

describe("Monitor.listByTeam", () => {
	test("lists a team's monitors, most recently created first", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);

		let first = await Monitor.create(db, team.id, "author-1", {
			name: "First",
			url: "https://a.example.com",
		});
		/**
		 * Force a distinct `created_at` so the ordering assertion below is
		 * deterministic — two creates in the same millisecond would otherwise tie.
		 */
		await db.update(monitors, first.id, { created_at: first.created_at - 1000 }, { touch: false });
		let second = await Monitor.create(db, team.id, "author-1", {
			name: "Second",
			url: "https://b.example.com",
		});

		let rows = await Monitor.listByTeam(db, team.id);
		expect(rows.map((row) => row.id)).toEqual([second.id, first.id]);
	});

	test("never returns another team's monitors", async () => {
		let { db } = createTestDatabase();
		let teamA = await createTeam(db);
		let teamB = await createTeam(db);
		await Monitor.create(db, teamA.id, "author-1", { name: "A", url: "https://a.example.com" });

		expect(await Monitor.listByTeam(db, teamB.id)).toEqual([]);
	});
});

describe("Monitor.countByTeam", () => {
	test("counts a team's monitors and ignores other teams", async () => {
		let { db } = createTestDatabase();
		let teamA = await createTeam(db);
		let teamB = await createTeam(db);
		await Monitor.create(db, teamA.id, "author-1", { name: "A", url: "https://a.example.com" });
		await Monitor.create(db, teamA.id, "author-1", { name: "B", url: "https://b.example.com" });

		expect(await Monitor.countByTeam(db, teamA.id)).toBe(2);
		expect(await Monitor.countByTeam(db, teamB.id)).toBe(0);
	});
});

describe("Monitor.listSslEnabled", () => {
	test("lists only SSL-monitoring-enabled monitors, across every team", async () => {
		let { db } = createTestDatabase();
		let teamA = await createTeam(db);
		let teamB = await createTeam(db);

		let sslEnabled = await Monitor.create(db, teamA.id, "author-1", {
			name: "SSL on",
			url: "https://a.example.com",
			ssl_monitoring_enabled: true,
		});
		await Monitor.create(db, teamB.id, "author-1", {
			name: "SSL off",
			url: "https://b.example.com",
			ssl_monitoring_enabled: false,
		});

		let rows = await Monitor.listSslEnabled(db);
		expect(rows.map((row) => row.id)).toEqual([sslEnabled.id]);
	});
});

describe("Monitor.findByIdForTeam", () => {
	test("finds a monitor scoped to its team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
		});

		let found = await Monitor.findByIdForTeam(db, team.id, monitor.id);
		expect(found?.id).toBe(monitor.id);
	});

	test("returns null when the monitor belongs to a different team", async () => {
		let { db } = createTestDatabase();
		let teamA = await createTeam(db);
		let teamB = await createTeam(db);
		let monitor = await Monitor.create(db, teamA.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
		});

		expect(await Monitor.findByIdForTeam(db, teamB.id, monitor.id)).toBeNull();
	});

	test("returns null when the id doesn't exist", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);

		expect(await Monitor.findByIdForTeam(db, team.id, crypto.randomUUID())).toBeNull();
	});
});

describe("Monitor.updateById", () => {
	test("updates a monitor's editable fields", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
		});

		let updated = await Monitor.updateById(db, monitor.id, { name: "Renamed" });
		expect(updated.name).toBe("Renamed");
		expect(updated.updated_at).toBeGreaterThanOrEqual(monitor.updated_at);
	});
});

describe("Monitor.deleteById", () => {
	test("deletes a monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
		});

		expect(await Monitor.deleteById(db, monitor.id)).toBe(true);
		expect(await Monitor.findByIdForTeam(db, team.id, monitor.id)).toBeNull();
	});

	test("returns false for a monitor that doesn't exist", async () => {
		let { db } = createTestDatabase();
		expect(await Monitor.deleteById(db, crypto.randomUUID())).toBe(false);
	});
});

describe("Monitor.ping", () => {
	test("enqueues a checkHttp message with a job id derived from the monitor id", async () => {
		queueSend.mockClear();
		let { db } = createTestDatabase();
		let monitorId = crypto.randomUUID();
		await createActiveSubscription(db, "owner-1");

		expect(await Monitor.ping(db, monitorId, "owner-1")).toBe(true);

		expect(queueSend).toHaveBeenCalledTimes(1);
		let message = queueSend.mock.calls[0]?.[0];
		expect(message?.type).toBe("checkHttp");
		expect(message?.monitorId).toBe(monitorId);
		expect(message?.id.startsWith(`${monitorId}:manual:`)).toBe(true);
		expect(typeof message?.scheduledAt).toBe("number");
	});

	test("enqueues nothing when the team owner is known to be unsubscribed", async () => {
		queueSend.mockClear();
		let { db } = createTestDatabase();
		await createRevokedSubscription(db, "owner-1");

		expect(await Monitor.ping(db, crypto.randomUUID(), "owner-1")).toBe(false);

		expect(queueSend).not.toHaveBeenCalled();
	});

	/**
	 * Fails open, which is the behaviour ADR-005 inverted: a missed webhook leaves the
	 * projection empty, and refusing on that basis would be the read-time subscription gate
	 * the ADR removed.
	 */
	test("enqueues when the owner's subscription state is unknown", async () => {
		queueSend.mockClear();
		let { db } = createTestDatabase();

		expect(await Monitor.ping(db, crypto.randomUUID(), "owner-nobody")).toBe(true);

		expect(queueSend).toHaveBeenCalledTimes(1);
	});

	test("gives two cron deliveries in the same minute one shared job id", async () => {
		let monitorId = crypto.randomUUID();
		// The two deliveries this cron really produces: same minute, ~7s apart.
		let first = Date.UTC(2026, 6, 28, 12, 34, 8, 0);
		let second = Date.UTC(2026, 6, 28, 12, 34, 15, 0);

		expect(Monitor.scheduledJobId(monitorId, first)).toBe(
			Monitor.scheduledJobId(monitorId, second),
		);
	});

	test("gives consecutive minutes distinct job ids", async () => {
		let monitorId = crypto.randomUUID();
		let minute = Date.UTC(2026, 6, 28, 12, 34, 8, 0);
		let nextMinute = Date.UTC(2026, 6, 28, 12, 35, 8, 0);

		expect(Monitor.scheduledJobId(monitorId, minute)).not.toBe(
			Monitor.scheduledJobId(monitorId, nextMinute),
		);
	});

	test("scopes the scheduled job id to the monitor", async () => {
		let scheduledAt = Date.UTC(2026, 6, 28, 12, 34, 8, 0);

		expect(Monitor.scheduledJobId("monitor-a", scheduledAt)).not.toBe(
			Monitor.scheduledJobId("monitor-b", scheduledAt),
		);
	});

	/**
	 * The job id is what the check is billed under, so a manual id colliding with a
	 * scheduled one would make one of the two checks free: the second delivery would
	 * short-circuit on the `monitor_results` primary key and never reach the meter.
	 */
	test("gives an on-demand check an id no scheduled check can be given", async () => {
		queueSend.mockClear();
		let monitorId = crypto.randomUUID();
		let scheduledAt = Date.UTC(2026, 6, 28, 12, 34, 8, 0);

		let { db } = createTestDatabase();
		await createActiveSubscription(db, "owner-1");
		await Monitor.ping(db, monitorId, "owner-1");

		let manualId = queueSend.mock.calls[0]?.[0]?.id;
		expect(manualId).not.toBe(Monitor.scheduledJobId(monitorId, scheduledAt));
		// The segment a scheduled id cannot contain, since its second segment is a number.
		expect(manualId).toContain(":manual:");
		expect(Monitor.scheduledJobId(monitorId, scheduledAt)).not.toContain(":manual:");
	});

	test("gives each on-demand check its own job id", async () => {
		queueSend.mockClear();
		let monitorId = crypto.randomUUID();

		let { db } = createTestDatabase();
		await createActiveSubscription(db, "owner-1");

		await Monitor.ping(db, monitorId, "owner-1");
		await Monitor.ping(db, monitorId, "owner-1");

		let [first, second] = queueSend.mock.calls.map((call) => call[0]?.id);
		expect(first).not.toBe(second);
	});
});

/**
 * `findDue` is a claim, not a query: it takes the monitors whose `next_due_at` has
 * arrived and advances that column in the same call, so what matters is the state it
 * leaves behind. Every case below therefore calls it more than once, or inspects
 * `next_due_at` afterwards, rather than asserting on a single return value.
 *
 * `monitor_results` is deliberately absent from this suite. Completion times no longer
 * take part in scheduling at all, which is the point of the change: a check's own
 * latency can't push the next one out.
 */
describe("Monitor.findDue", () => {
	/** The `next_due_at` currently stored for a monitor, which is what a claim moves. */
	async function nextDueAt(db: Database, monitorId: string) {
		let monitor = await db.findOne(monitors, { where: { id: monitorId } });
		return monitor?.next_due_at ?? null;
	}

	test("claims a newly created monitor on the first tick after it exists", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
			interval_seconds: 60,
		});

		let due = await dueIds(db, Date.now() + 1000);
		expect(due).toEqual([monitor.id]);
	});

	test("never claims the same monitor twice in the same minute", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
			interval_seconds: 60,
		});

		// The two deliveries this cron really produces: same minute, ~7s apart.
		let first = Date.now() + 1000;
		expect(await dueIds(db, first)).toHaveLength(1);
		expect(await dueIds(db, first + 7000)).toEqual([]);
	});

	test("claims the monitor again once its next due time arrives", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
			interval_seconds: 60,
		});

		let scheduledAt = Date.now() + 1000;
		await dueIds(db, scheduledAt);

		expect(await dueIds(db, scheduledAt + 60_000)).toEqual([monitor.id]);
	});

	test("advances the due time from the previous one, so latency can't cause drift", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
			interval_seconds: 60,
		});
		let anchor = Date.now();
		await db.update(monitors, monitor.id, { next_due_at: anchor }, { touch: false });

		// Claimed 1.5s late, as a real delivery is. The next due time is still the
		// anchor plus exactly one interval, not the claim time plus one.
		await dueIds(db, anchor + 1500);

		expect(await nextDueAt(db, monitor.id)).toBe(anchor + 60_000);
	});

	test("a monitor left unscheduled for an hour is claimed once, not sixty times", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
			interval_seconds: 60,
		});
		let anchor = Date.now();
		await db.update(monitors, monitor.id, { next_due_at: anchor }, { touch: false });

		// An hour of missed ticks: the due time skips to the first interval boundary
		// strictly after now rather than replaying the sixty it slept through.
		let scheduledAt = anchor + 60 * 60_000;
		expect(await dueIds(db, scheduledAt)).toHaveLength(1);
		expect(await nextDueAt(db, monitor.id)).toBe(scheduledAt + 60_000);
		expect(await dueIds(db, scheduledAt)).toEqual([]);
	});

	test("keeps the cadence on interval boundaries when the claim lands mid-interval", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
			interval_seconds: 300,
		});
		let anchor = Date.now();
		await db.update(monitors, monitor.id, { next_due_at: anchor }, { touch: false });

		// 7 minutes late on a 5-minute monitor: two whole intervals have passed, so the
		// next due time is the anchor plus two, which is 3 minutes out.
		await dueIds(db, anchor + 7 * 60_000);

		expect(await nextDueAt(db, monitor.id)).toBe(anchor + 10 * 60_000);
	});

	test("never claims a disabled monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
			interval_seconds: 60,
		});
		await Monitor.updateById(db, monitor.id, { enabled_at: null });

		expect(await nextDueAt(db, monitor.id)).toBeNull();
		expect(await dueIds(db, Date.now() + 60 * 60_000)).toEqual([]);
	});

	test("claims a re-enabled monitor again on the next tick", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
			interval_seconds: 60,
		});
		await Monitor.updateById(db, monitor.id, { enabled_at: null });
		await Monitor.updateById(db, monitor.id, { enabled_at: Date.now() });

		expect(await dueIds(db, Date.now() + 1000)).toEqual([monitor.id]);
	});

	/**
	 * The claim's whole justification is its query plan (ADR-003): the query it replaced
	 * had to read every row of `monitor_results` to answer a question about a handful of
	 * monitors, which was 97% of the app's D1 rows read. Rows returned can't see that —
	 * only the plan can — so this asserts the plan directly.
	 */
	test("claims through the next_due_at index instead of scanning a table", async () => {
		let { db, plans } = createPlanRecordingDatabase();
		let team = await createTeam(db);
		await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
		});
		plans.length = 0;

		expect(await dueIds(db, Date.now() + 1000)).toHaveLength(1);

		let steps = plans.flat();
		expect(steps.filter((step) => step.startsWith("SCAN "))).toEqual([]);
		expect(steps.some((step) => step.includes("monitors_next_due_at_idx"))).toBe(true);
	});

	test("never claims a monitor belonging to no team, and resolves the owner of one that does", async () => {
		let { db } = createTestDatabase();
		let teamA = await createTeam(db);
		let teamB = await createTeam(db);
		let a = await Monitor.create(db, teamA.id, "author-1", {
			name: "A",
			url: "https://a.example.com",
		});
		let b = await Monitor.create(db, teamB.id, "author-1", {
			name: "B",
			url: "https://b.example.com",
		});

		let due = await dueIds(db, Date.now() + 1000);

		expect(due).toContainEqual(a.id);
		expect(due).toContainEqual(b.id);
	});
});

describe("Monitor.updateById scheduling", () => {
	test("re-anchors the schedule when the interval changes", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
			interval_seconds: 3600,
		});
		// Pushed an hour out by a claim, so a shorter interval must bring it back.
		await db.update(
			monitors,
			monitor.id,
			{ next_due_at: Date.now() + 3_600_000 },
			{ touch: false },
		);

		await Monitor.updateById(db, monitor.id, { interval_seconds: 60 });

		expect(await dueIds(db, Date.now() + 1000)).toEqual([monitor.id]);
	});

	test("leaves the schedule alone for an edit that doesn't touch it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
			interval_seconds: 60,
		});
		let scheduled = Date.now() + 3_600_000;
		await db.update(monitors, monitor.id, { next_due_at: scheduled }, { touch: false });

		// The web form resubmits the unchanged interval on every edit, so neither a rename
		// nor a same-value interval may restart the cadence.
		let renamed = await Monitor.updateById(db, monitor.id, {
			name: "Renamed",
			interval_seconds: 60,
		});

		expect(renamed.next_due_at).toBe(scheduled);
	});

	test("keeps a disabled monitor unscheduled when its interval changes", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
			interval_seconds: 60,
		});
		await Monitor.updateById(db, monitor.id, { enabled_at: null });

		let updated = await Monitor.updateById(db, monitor.id, { interval_seconds: 120 });

		expect(updated.next_due_at).toBeNull();
		expect(await dueIds(db, Date.now() + 60 * 60_000)).toEqual([]);
	});
});

/**
 * Every case below reads the month as of 2026-07-15, which puts the raw-counting
 * window at July 14–15 and the rollup window at July 1–13. `monitor_results` rows
 * dated before the 14th therefore never count on their own — after `CleanJob`'s
 * retention they wouldn't exist anyway, and the rollup is what stands in for them.
 */
describe("Monitor.countConsumedPingsByTeam", () => {
	let date = new Date("2026-07-15T12:00:00.000Z");
	let insideRawWindow = Date.UTC(2026, 6, 14, 8, 0, 0);

	/** A completed HTTP check recorded at `createdAt`, the row one consumed ping produces. */
	async function createHttpResult(db: Database, monitorId: string, createdAt: number) {
		let result = await db.create(
			monitorResults,
			{
				id: crypto.randomUUID(),
				monitor_id: monitorId,
				response_status: 200,
				response_time_ms: 100,
				completed_at: createdAt,
			},
			{ touch: true, returnRow: true },
		);
		// `touch` stamps `created_at` with the current time, so backdate it afterwards.
		await db.update(monitorResults, result.id, { created_at: createdAt }, { touch: false });
	}

	/** A rolled-up day for one monitor, as `AggregateDailyStatsJob` would have written it. */
	async function createDailyStats(
		db: Database,
		monitorId: string,
		monitorType: "http" | "dns" | "tcp" | "cron",
		day: string,
		totalChecks: number,
	) {
		await db.create(
			monitorDailyStats,
			{
				id: crypto.randomUUID(),
				monitor_id: monitorId,
				monitor_type: monitorType,
				date: day,
				total_checks: totalChecks,
				successful_checks: totalChecks,
				failed_checks: 0,
				avg_response_time_ms: 100,
				max_response_time_ms: 200,
				p95_response_time_ms: null,
				status: "up",
			},
			{ touch: true },
		);
	}

	/** One monitor of every type for `teamId`, to hang results and rollup rows off. */
	async function createMonitors(db: Database, teamId: string) {
		let http = await Monitor.create(db, teamId, "author-1", {
			name: "HTTP",
			url: "https://example.com",
		});
		let dns = await db.create(
			dnsMonitors,
			{
				id: crypto.randomUUID(),
				team_id: teamId,
				name: "DNS",
				domain: "example.com",
				record_type: "A",
			},
			{ touch: true, returnRow: true },
		);
		let tcp = await db.create(
			tcpMonitors,
			{ id: crypto.randomUUID(), team_id: teamId, name: "TCP", host: "example.com", port: 443 },
			{ touch: true, returnRow: true },
		);
		let cron = await db.create(
			cronJobMonitors,
			{ id: crypto.randomUUID(), team_id: teamId, name: "Nightly", cron_expression: "0 0 * * *" },
			{ touch: true, returnRow: true },
		);

		return { http, dns, tcp, cron };
	}

	test("sums the rollup and the raw window across every monitor type", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let { http, dns, tcp, cron } = await createMonitors(db, team.id);

		// Rolled-up days, inside the month and before the raw window: 1000 + 100 + 10 + 1.
		await createDailyStats(db, http.id, "http", "2026-07-02", 1000);
		await createDailyStats(db, dns.id, "dns", "2026-07-02", 100);
		await createDailyStats(db, tcp.id, "tcp", "2026-07-13", 10);
		await createDailyStats(db, cron.id, "cron", "2026-07-13", 1);

		// Raw results the rollup hasn't reached yet: 2 HTTP + 1 DNS + 1 TCP + 1 cron.
		await createHttpResult(db, http.id, insideRawWindow);
		await createHttpResult(db, http.id, insideRawWindow + 60_000);
		await db.create(dnsMonitorResults, {
			id: crypto.randomUUID(),
			dns_monitor_id: dns.id,
			status: "ok",
			resolved_value: "1.1.1.1",
			response_time_ms: 10,
			error_message: null,
			checked_at: insideRawWindow,
		});
		await db.create(tcpMonitorResults, {
			id: crypto.randomUUID(),
			tcp_monitor_id: tcp.id,
			status: "up",
			response_time_ms: 10,
			error_message: null,
			checked_at: insideRawWindow,
		});
		let ping = await db.create(
			cronJobPings,
			{ id: crypto.randomUUID(), cron_job_monitor_id: cron.id, was_on_time: true },
			{ touch: true, returnRow: true },
		);
		await db.update(cronJobPings, ping.id, { created_at: insideRawWindow }, { touch: false });

		expect(await Monitor.countConsumedPingsByTeam(db, team.id, date)).toBe(1116);
	});

	test("never double counts a day that has both a rollup row and surviving raw rows", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let { http } = await createMonitors(db, team.id);

		// The 13th is rolled up, and its raw rows are still inside the 7-day retention.
		await createDailyStats(db, http.id, "http", "2026-07-13", 5);
		await createHttpResult(db, http.id, Date.UTC(2026, 6, 13, 6, 0, 0));
		await createHttpResult(db, http.id, Date.UTC(2026, 6, 13, 7, 0, 0));

		expect(await Monitor.countConsumedPingsByTeam(db, team.id, date)).toBe(5);
	});

	test("counts the whole month raw when the raw window covers it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let { http } = await createMonitors(db, team.id);

		// On the 1st the raw window is clamped to the month, leaving no rolled-up days.
		await createHttpResult(db, http.id, Date.UTC(2026, 6, 1, 0, 30, 0));
		await createHttpResult(db, http.id, Date.UTC(2026, 6, 1, 1, 30, 0));

		expect(
			await Monitor.countConsumedPingsByTeam(db, team.id, new Date("2026-07-01T12:00:00.000Z")),
		).toBe(2);
	});

	test("never counts another month or another team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let otherTeam = await createTeam(db);
		let { http, dns, tcp, cron } = await createMonitors(db, team.id);

		// Rolled-up days on either side of July.
		await createDailyStats(db, http.id, "http", "2026-06-30", 1000);
		await createDailyStats(db, dns.id, "dns", "2026-08-01", 1000);
		// Raw checks the millisecond before July starts and the millisecond after it ends.
		await createHttpResult(db, http.id, Date.UTC(2026, 6, 1) - 1);
		await createHttpResult(db, http.id, Date.UTC(2026, 7, 1));
		// A rollup row for the right day, but keyed to the wrong monitor type.
		await createDailyStats(db, tcp.id, "cron", "2026-07-02", 1000);
		await createDailyStats(db, cron.id, "tcp", "2026-07-02", 1000);

		let other = await createMonitors(db, otherTeam.id);
		await createDailyStats(db, other.http.id, "http", "2026-07-02", 1000);
		await createHttpResult(db, other.http.id, insideRawWindow);

		expect(await Monitor.countConsumedPingsByTeam(db, team.id, date)).toBe(0);
	});

	test("counts zero, not null, for a team that has never been checked", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);

		expect(await Monitor.countConsumedPingsByTeam(db, team.id, date)).toBe(0);
	});
});

/**
 * Same month and same windows as the team-scoped block above — as of 2026-07-15 the raw
 * window is July 14–15 and the rollup window July 1–13 — since both methods have to cut
 * the two stores identically or the monitor card and the dashboard card would disagree.
 */
describe("Monitor.countConsumedPingsByMonitor", () => {
	let date = new Date("2026-07-15T12:00:00.000Z");
	let insideRawWindow = Date.UTC(2026, 6, 14, 8, 0, 0);

	/** A completed HTTP check recorded at `createdAt`, the row one consumed ping produces. */
	async function createHttpResult(db: Database, monitorId: string, createdAt: number) {
		let result = await db.create(
			monitorResults,
			{
				id: crypto.randomUUID(),
				monitor_id: monitorId,
				response_status: 200,
				response_time_ms: 100,
				completed_at: createdAt,
			},
			{ touch: true, returnRow: true },
		);
		// `touch` stamps `created_at` with the current time, so backdate it afterwards.
		await db.update(monitorResults, result.id, { created_at: createdAt }, { touch: false });
	}

	/** A rolled-up day for one monitor, as `AggregateDailyStatsJob` would have written it. */
	async function createDailyStats(
		db: Database,
		monitorId: string,
		day: string,
		totalChecks: number,
	) {
		await db.create(
			monitorDailyStats,
			{
				id: crypto.randomUUID(),
				monitor_id: monitorId,
				monitor_type: "http",
				date: day,
				total_checks: totalChecks,
				successful_checks: totalChecks,
				failed_checks: 0,
				avg_response_time_ms: 100,
				max_response_time_ms: 200,
				p95_response_time_ms: null,
				status: "up",
			},
			{ touch: true },
		);
	}

	test("sums this monitor's rollup days and its raw window", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "HTTP",
			url: "https://example.com",
		});

		await createDailyStats(db, monitor.id, "2026-07-02", 100);
		await createDailyStats(db, monitor.id, "2026-07-13", 10);
		await createHttpResult(db, monitor.id, insideRawWindow);
		await createHttpResult(db, monitor.id, insideRawWindow + 60_000);

		expect(await Monitor.countConsumedPingsByMonitor(db, monitor.id, date)).toBe(112);
	});

	test("never double counts a day that has both a rollup row and surviving raw rows", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "HTTP",
			url: "https://example.com",
		});

		// The 13th is rolled up, and its raw rows are still inside the 7-day retention.
		await createDailyStats(db, monitor.id, "2026-07-13", 5);
		await createHttpResult(db, monitor.id, Date.UTC(2026, 6, 13, 6, 0, 0));
		await createHttpResult(db, monitor.id, Date.UTC(2026, 6, 13, 7, 0, 0));

		expect(await Monitor.countConsumedPingsByMonitor(db, monitor.id, date)).toBe(5);
	});

	test("counts the whole month raw when the raw window covers it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "HTTP",
			url: "https://example.com",
		});

		// On the 1st the raw window is clamped to the month, leaving no rolled-up days.
		await createHttpResult(db, monitor.id, Date.UTC(2026, 6, 1, 0, 30, 0));
		await createHttpResult(db, monitor.id, Date.UTC(2026, 6, 1, 1, 30, 0));

		expect(
			await Monitor.countConsumedPingsByMonitor(
				db,
				monitor.id,
				new Date("2026-07-01T12:00:00.000Z"),
			),
		).toBe(2);
	});

	test("never counts another month or another monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "HTTP",
			url: "https://example.com",
		});
		let sibling = await Monitor.create(db, team.id, "author-1", {
			name: "Other",
			url: "https://other.example.com",
		});

		// Rolled-up days on either side of July.
		await createDailyStats(db, monitor.id, "2026-06-30", 1000);
		await createDailyStats(db, monitor.id, "2026-08-01", 1000);
		// Raw checks the millisecond before July starts and the millisecond after it ends.
		await createHttpResult(db, monitor.id, Date.UTC(2026, 6, 1) - 1);
		await createHttpResult(db, monitor.id, Date.UTC(2026, 7, 1));

		// The other monitor on the same team is fully checked, and counts for none of it.
		await createDailyStats(db, sibling.id, "2026-07-02", 1000);
		await createHttpResult(db, sibling.id, insideRawWindow);

		expect(await Monitor.countConsumedPingsByMonitor(db, monitor.id, date)).toBe(0);
	});

	test("counts zero, not null, for a monitor that has never been checked", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "HTTP",
			url: "https://example.com",
		});

		expect(await Monitor.countConsumedPingsByMonitor(db, monitor.id, date)).toBe(0);
	});
});

describe("Monitor.estimateConsumedPingsByTeam", () => {
	test("projects HTTP/DNS/TCP monitors from their interval and sums cron occurrences", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let date = new Date("2026-07-15T12:00:00.000Z");

		// 31-day month, checking every 3600s -> 24 checks/day * 31 = 744.
		await Monitor.create(db, team.id, "author-1", {
			name: "HTTP",
			url: "https://example.com",
			interval_seconds: 3600,
		});
		await db.create(dnsMonitors, {
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "DNS",
			domain: "example.com",
			record_type: "A",
			interval_seconds: 3600,
			is_enabled: true,
		});
		await db.create(tcpMonitors, {
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "TCP",
			host: "example.com",
			port: 443,
			interval_seconds: 3600,
			is_enabled: true,
		});
		// Runs once a day at midnight -> 31 occurrences in July.
		await db.create(cronJobMonitors, {
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "Nightly job",
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: Date.now(),
		});

		let estimate = await Monitor.estimateConsumedPingsByTeam(db, team.id, date);
		// 744 (http) + 744 (dns) + 744 (tcp) = 2232, plus cron occurrences strictly
		// after the 1st at midnight through the 31st: 30.
		expect(estimate).toBe(2262);
	});

	test("ignores disabled monitors and jobs", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let date = new Date("2026-07-15T12:00:00.000Z");

		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "HTTP",
			url: "https://example.com",
			interval_seconds: 3600,
		});
		await Monitor.updateById(db, monitor.id, { enabled_at: null });
		await db.create(dnsMonitors, {
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "DNS",
			domain: "example.com",
			record_type: "A",
			interval_seconds: 3600,
			is_enabled: false,
		});
		await db.create(cronJobMonitors, {
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "Disabled job",
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: null,
		});

		expect(await Monitor.estimateConsumedPingsByTeam(db, team.id, date)).toBe(0);
	});

	test("never counts another team's monitors", async () => {
		let { db } = createTestDatabase();
		let teamA = await createTeam(db);
		let teamB = await createTeam(db);
		let date = new Date("2026-07-15T12:00:00.000Z");

		await Monitor.create(db, teamB.id, "author-1", {
			name: "HTTP",
			url: "https://example.com",
			interval_seconds: 3600,
		});

		expect(await Monitor.estimateConsumedPingsByTeam(db, teamA.id, date)).toBe(0);
	});

	test("skips a cron job with an invalid expression instead of throwing", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let date = new Date("2026-07-15T12:00:00.000Z");

		await db.create(cronJobMonitors, {
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "Broken job",
			cron_expression: "not a cron expression",
			timezone: "UTC",
			enabled_at: Date.now(),
		});

		expect(await Monitor.estimateConsumedPingsByTeam(db, team.id, date)).toBe(0);
	});
});

describe("Monitor.getStats", () => {
	/** A completed HTTP check, the row the D1 half of the stats card aggregates. */
	async function createResult(db: Database, monitorId: string, responseStatus: number) {
		await db.create(
			monitorResults,
			{
				id: crypto.randomUUID(),
				monitor_id: monitorId,
				response_status: responseStatus,
				response_time_ms: 100,
				completed_at: 1_700_000_000_000,
			},
			{ touch: true },
		);
	}

	test("takes total/uptime/lastCheck from D1 and the p99 from Analytics Engine", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "HTTP",
			url: "https://example.com",
		});
		await createResult(db, monitor.id, 200);
		await createResult(db, monitor.id, 500);

		p99Query.mockClear();
		p99Query.mockImplementation(async () => success(410));

		let stats = await Monitor.getStatsByTeamId(db, team.id);

		expect(stats.total).toBe(2);
		expect(stats.uptime).toBe(50);
		expect(stats.lastCheck).toBe(1_700_000_000_000);
		expect(stats.p99).toBe(410);
		expect(p99Query).toHaveBeenCalledWith({ teamId: team.id });
	});

	test("scopes the Analytics Engine query to the monitor for getStatsById", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "HTTP",
			url: "https://example.com",
		});
		await createResult(db, monitor.id, 200);

		p99Query.mockClear();
		p99Query.mockImplementation(async () => success(120));

		let stats = await Monitor.getStatsById(db, monitor.id);

		expect(stats.total).toBe(1);
		expect(stats.uptime).toBe(100);
		expect(stats.p99).toBe(120);
		expect(p99Query).toHaveBeenCalledWith({ monitorId: monitor.id });
	});

	test("degrades the p99 to null when Analytics Engine fails, keeping the D1 figures", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "HTTP",
			url: "https://example.com",
		});
		await createResult(db, monitor.id, 200);

		p99Query.mockClear();
		p99Query.mockImplementation(async () => failure(new Error("Analytics query failed: 503")));

		let stats = await Monitor.getStatsByTeamId(db, team.id);

		expect(stats.total).toBe(1);
		expect(stats.uptime).toBe(100);
		expect(stats.p99).toBeNull();
	});

	test("reports zero checks and a null p99 for a team that has never been checked", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);

		p99Query.mockClear();
		p99Query.mockImplementation(async () => success(null));

		let stats = await Monitor.getStatsByTeamId(db, team.id);

		expect(stats.total).toBe(0);
		expect(stats.uptime).toBeNull();
		expect(stats.lastCheck).toBeNull();
		expect(stats.p99).toBeNull();
	});
});
