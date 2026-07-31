/**
 * Unit tests for the `TcpMonitor` data-access model: CRUD scoped to a team, the
 * delete cascade over `tcp_monitor_results`, the results history limit/ordering,
 * `recordCheckResult`'s dual write (history insert plus cached-field update) staying in
 * sync, and the `next_due_at` scheduling — the raw-SQL `claimDue` claim each sweep runs and
 * the create/edit writes that keep the column consistent with whether and how often a
 * monitor should be checked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Database } from "remix/data-table";

import type { TcpCheckResult } from "~/app/services/tcp-check";
import type { InsertTcpMonitor } from "~/database/schema";

import TcpMonitor from "~/app/data/tcp-monitor";
import { createTestDatabase } from "~/app/lib/test/db";
import { tcpMonitorResults, tcpMonitors } from "~/database/schema";

/** A valid `TcpMonitor.create` input, with any field overridable per test. */
function tcpMonitorInput(overrides: Partial<InsertTcpMonitor> = {}): InsertTcpMonitor {
	return {
		name: "Postgres",
		host: "db.example.com",
		port: 5432,
		...overrides,
	};
}

describe("TcpMonitor.create", () => {
	test("creates a TCP monitor for a team, enabled immediately", async () => {
		let { db } = createTestDatabase();
		let teamId = crypto.randomUUID();

		let monitor = await TcpMonitor.create(db, teamId, tcpMonitorInput());

		expect(monitor.team_id).toBe(teamId);
		expect(monitor.host).toBe("db.example.com");
		expect(monitor.port).toBe(5432);
		/**
		 * SQLite (and the production D1 adapter, identically) round-trips boolean
		 * columns as 0/1, not real booleans — assert truthiness, not strict `true`.
		 */
		expect(monitor.is_enabled).toBeTruthy();
		// Due immediately, so the first check runs on the next tick rather than a whole
		// interval later.
		expect(monitor.next_due_at).not.toBeNull();
		expect(monitor.next_due_at).toBeLessThanOrEqual(Date.now());
	});

	test("leaves a monitor created with checking disabled unscheduled", async () => {
		let { db } = createTestDatabase();

		let monitor = await TcpMonitor.create(
			db,
			crypto.randomUUID(),
			tcpMonitorInput({ is_enabled: false }),
		);

		expect(monitor.next_due_at).toBeNull();
	});
});

describe("TcpMonitor.listByTeam", () => {
	test("lists a team's TCP monitors, most recently created first", async () => {
		let { db } = createTestDatabase();
		let teamId = crypto.randomUUID();
		let first = await TcpMonitor.create(db, teamId, tcpMonitorInput());
		/**
		 * Force a distinct `created_at` so the ordering assertion below is
		 * deterministic — two creates in the same millisecond would otherwise tie.
		 */
		await db.update(
			tcpMonitors,
			first.id,
			{ created_at: first.created_at - 1000 },
			{ touch: false },
		);
		let second = await TcpMonitor.create(db, teamId, tcpMonitorInput({ name: "Redis" }));

		let rows = await TcpMonitor.listByTeam(db, teamId);
		expect(rows.map((row) => row.id)).toEqual([second.id, first.id]);
	});

	test("never returns another team's TCP monitors", async () => {
		let { db } = createTestDatabase();
		let teamA = crypto.randomUUID();
		let teamB = crypto.randomUUID();
		await TcpMonitor.create(db, teamA, tcpMonitorInput());

		expect(await TcpMonitor.listByTeam(db, teamB)).toEqual([]);
	});
});

/**
 * `claimDue` is a claim, not a query: it takes the monitors whose `next_due_at` has arrived
 * and advances that column in the same call, so what matters is the state it leaves behind.
 * Every case below therefore calls it more than once, or inspects `next_due_at` afterwards,
 * rather than asserting on a single return value.
 */
describe("TcpMonitor.claimDue", () => {
	/** The `next_due_at` currently stored for a monitor, which is what a claim moves. */
	async function nextDueAt(db: Database, monitorId: string) {
		let monitor = await db.findOne(tcpMonitors, { where: { id: monitorId } });
		return monitor?.next_due_at ?? null;
	}

	test("claims a newly created monitor on the first tick after it exists", async () => {
		let { db } = createTestDatabase();
		let monitor = await TcpMonitor.create(db, crypto.randomUUID(), tcpMonitorInput());

		let claimed = await TcpMonitor.claimDue(db, Date.now() + 1000);
		expect(claimed.map((row) => row.id)).toEqual([monitor.id]);
	});

	test("never claims a monitor with checking disabled", async () => {
		let { db } = createTestDatabase();
		let disabled = await TcpMonitor.create(
			db,
			crypto.randomUUID(),
			tcpMonitorInput({ is_enabled: false }),
		);

		expect(await nextDueAt(db, disabled.id)).toBeNull();
		expect(await TcpMonitor.claimDue(db, Date.now() + 24 * 60 * 60_000)).toEqual([]);
	});

	test("never claims the same monitor twice in the same minute", async () => {
		let { db } = createTestDatabase();
		await TcpMonitor.create(db, crypto.randomUUID(), tcpMonitorInput({ interval_seconds: 60 }));

		// The two deliveries this cron really produces: same minute, ~7s apart.
		let first = Date.now() + 1000;
		expect(await TcpMonitor.claimDue(db, first)).toHaveLength(1);
		expect(await TcpMonitor.claimDue(db, first + 7000)).toEqual([]);
	});

	test("honours the configured interval instead of the sweep's cadence", async () => {
		let { db } = createTestDatabase();
		let monitor = await TcpMonitor.create(
			db,
			crypto.randomUUID(),
			tcpMonitorInput({ interval_seconds: 3600 }),
		);
		let anchor = Date.now();
		await db.update(tcpMonitors, monitor.id, { next_due_at: anchor }, { touch: false });

		await TcpMonitor.claimDue(db, anchor);

		// An hourly monitor is claimed once an hour, however often the sweep runs.
		expect(await TcpMonitor.claimDue(db, anchor + 30 * 60_000)).toEqual([]);
		expect(await TcpMonitor.claimDue(db, anchor + 60 * 60_000)).toHaveLength(1);
	});

	test("advances the due time by whole intervals from the previous one", async () => {
		let { db } = createTestDatabase();
		let monitor = await TcpMonitor.create(
			db,
			crypto.randomUUID(),
			tcpMonitorInput({ interval_seconds: 300 }),
		);
		let anchor = Date.now();
		await db.update(tcpMonitors, monitor.id, { next_due_at: anchor }, { touch: false });

		// 7 minutes late on a 5-minute monitor: two whole intervals have passed, so the next
		// due time is the anchor plus two rather than the claim time plus one, and the
		// intervals it slept through are not replayed.
		await TcpMonitor.claimDue(db, anchor + 7 * 60_000);

		expect(await nextDueAt(db, monitor.id)).toBe(anchor + 10 * 60_000);
	});

	test("projects only the columns a check reads, plus the team that pays for it", async () => {
		let { db } = createTestDatabase();
		let monitor = await TcpMonitor.create(db, crypto.randomUUID(), tcpMonitorInput());

		let [claimed] = await TcpMonitor.claimDue(db, Date.now() + 1000);

		expect(claimed).toEqual({
			id: monitor.id,
			team_id: monitor.team_id,
			host: "db.example.com",
			port: 5432,
			timeout_ms: monitor.timeout_ms,
			last_status: null,
		});
	});
});

describe("TcpMonitor.updateById scheduling", () => {
	test("re-anchors the schedule when the interval changes", async () => {
		let { db } = createTestDatabase();
		let monitor = await TcpMonitor.create(
			db,
			crypto.randomUUID(),
			tcpMonitorInput({ interval_seconds: 3600 }),
		);
		// Pushed an hour out by a claim, so a shorter interval must bring it back.
		await db.update(
			tcpMonitors,
			monitor.id,
			{ next_due_at: Date.now() + 3_600_000 },
			{ touch: false },
		);

		await TcpMonitor.updateById(db, monitor.id, { interval_seconds: 60 });

		expect(await TcpMonitor.claimDue(db, Date.now() + 1000)).toHaveLength(1);
	});

	test("leaves the schedule alone for an edit that doesn't touch it", async () => {
		let { db } = createTestDatabase();
		let monitor = await TcpMonitor.create(
			db,
			crypto.randomUUID(),
			tcpMonitorInput({ interval_seconds: 60 }),
		);
		let scheduled = Date.now() + 3_600_000;
		await db.update(tcpMonitors, monitor.id, { next_due_at: scheduled }, { touch: false });

		// The web form resubmits the unchanged interval on every edit, so neither a rename nor
		// a same-value interval may restart the cadence.
		let renamed = await TcpMonitor.updateById(db, monitor.id, {
			name: "Renamed",
			interval_seconds: 60,
		});

		expect(renamed.next_due_at).toBe(scheduled);
	});

	test("unschedules a disabled monitor and reschedules a re-enabled one", async () => {
		let { db } = createTestDatabase();
		let monitor = await TcpMonitor.create(db, crypto.randomUUID(), tcpMonitorInput());

		let disabled = await TcpMonitor.updateById(db, monitor.id, { is_enabled: false });
		expect(disabled.next_due_at).toBeNull();
		expect(await TcpMonitor.claimDue(db, Date.now() + 24 * 60 * 60_000)).toEqual([]);

		await TcpMonitor.updateById(db, monitor.id, { is_enabled: true });
		expect(await TcpMonitor.claimDue(db, Date.now() + 1000)).toHaveLength(1);
	});

	test("keeps a disabled monitor unscheduled when its interval changes", async () => {
		let { db } = createTestDatabase();
		let monitor = await TcpMonitor.create(
			db,
			crypto.randomUUID(),
			tcpMonitorInput({ is_enabled: false, interval_seconds: 60 }),
		);

		let updated = await TcpMonitor.updateById(db, monitor.id, { interval_seconds: 120 });

		expect(updated.next_due_at).toBeNull();
	});
});

describe("TcpMonitor.findByIdForTeam", () => {
	test("finds a monitor scoped to its team", async () => {
		let { db } = createTestDatabase();
		let teamId = crypto.randomUUID();
		let monitor = await TcpMonitor.create(db, teamId, tcpMonitorInput());

		expect((await TcpMonitor.findByIdForTeam(db, teamId, monitor.id))?.id).toBe(monitor.id);
	});

	test("returns null when the monitor belongs to a different team", async () => {
		let { db } = createTestDatabase();
		let teamA = crypto.randomUUID();
		let teamB = crypto.randomUUID();
		let monitor = await TcpMonitor.create(db, teamA, tcpMonitorInput());

		expect(await TcpMonitor.findByIdForTeam(db, teamB, monitor.id)).toBeNull();
	});

	test("returns null when the id doesn't exist", async () => {
		let { db } = createTestDatabase();
		expect(
			await TcpMonitor.findByIdForTeam(db, crypto.randomUUID(), crypto.randomUUID()),
		).toBeNull();
	});
});

describe("TcpMonitor.updateById", () => {
	test("updates a monitor's editable fields", async () => {
		let { db } = createTestDatabase();
		let monitor = await TcpMonitor.create(db, crypto.randomUUID(), tcpMonitorInput());

		let updated = await TcpMonitor.updateById(db, monitor.id, { port: 6379 });
		expect(updated.port).toBe(6379);
	});
});

describe("TcpMonitor.deleteById", () => {
	test("deletes the monitor and its check-result history", async () => {
		let { db } = createTestDatabase();
		let teamId = crypto.randomUUID();
		let monitor = await TcpMonitor.create(db, teamId, tcpMonitorInput());
		let result: TcpCheckResult = { status: "up", responseTimeMs: 12 };
		await TcpMonitor.recordCheckResult(db, monitor.id, result);
		await TcpMonitor.recordCheckResult(db, monitor.id, result);

		await TcpMonitor.deleteById(db, monitor.id);

		expect(await TcpMonitor.findByIdForTeam(db, teamId, monitor.id)).toBeNull();
		expect(await TcpMonitor.listResults(db, monitor.id)).toEqual([]);
	});

	test("deleting a monitor with no results at all doesn't throw", async () => {
		let { db } = createTestDatabase();
		let monitor = await TcpMonitor.create(db, crypto.randomUUID(), tcpMonitorInput());

		await TcpMonitor.deleteById(db, monitor.id);
	});
});

describe("TcpMonitor.listResults", () => {
	test("lists a monitor's results newest first", async () => {
		let { db } = createTestDatabase();
		let monitor = await TcpMonitor.create(db, crypto.randomUUID(), tcpMonitorInput());
		let now = Date.now();
		/**
		 * Inserted directly (rather than via `recordCheckResult`) so `checked_at` can be
		 * set to explicit, distinct timestamps instead of racing on `Date.now()`.
		 */
		await db.create(tcpMonitorResults, {
			id: crypto.randomUUID(),
			tcp_monitor_id: monitor.id,
			status: "up",
			response_time_ms: 10,
			checked_at: now - 1000,
		});
		await db.create(tcpMonitorResults, {
			id: crypto.randomUUID(),
			tcp_monitor_id: monitor.id,
			status: "down",
			response_time_ms: null,
			checked_at: now,
		});

		let results = await TcpMonitor.listResults(db, monitor.id);
		expect(results.map((row) => row.status)).toEqual(["down", "up"]);
	});

	test("never mixes another monitor's results in", async () => {
		let { db } = createTestDatabase();
		let monitorA = await TcpMonitor.create(db, crypto.randomUUID(), tcpMonitorInput());
		let monitorB = await TcpMonitor.create(db, crypto.randomUUID(), tcpMonitorInput());
		await TcpMonitor.recordCheckResult(db, monitorA.id, { status: "up", responseTimeMs: 10 });

		expect(await TcpMonitor.listResults(db, monitorB.id)).toEqual([]);
	});
});

describe("TcpMonitor.recordCheckResult", () => {
	test("inserts a history row and updates the monitor's cached fields", async () => {
		let { db } = createTestDatabase();
		let monitor = await TcpMonitor.create(db, crypto.randomUUID(), tcpMonitorInput());

		await TcpMonitor.recordCheckResult(db, monitor.id, {
			status: "timeout",
			responseTimeMs: null,
			errorMessage: "connect ETIMEDOUT",
		});

		let results = await TcpMonitor.listResults(db, monitor.id);
		expect(results).toHaveLength(1);
		expect(results[0]?.status).toBe("timeout");
		expect(results[0]?.error_message).toBe("connect ETIMEDOUT");

		let updated = await TcpMonitor.findByIdForTeam(db, monitor.team_id, monitor.id);
		expect(updated?.last_status).toBe("timeout");
		expect(updated?.last_response_time_ms).toBeNull();
		expect(updated?.last_checked_at).not.toBeNull();
	});

	test("defaults a missing error message to null", async () => {
		let { db } = createTestDatabase();
		let monitor = await TcpMonitor.create(db, crypto.randomUUID(), tcpMonitorInput());

		await TcpMonitor.recordCheckResult(db, monitor.id, { status: "up", responseTimeMs: 8 });

		let results = await TcpMonitor.listResults(db, monitor.id);
		expect(results[0]?.error_message).toBeNull();
	});
});
