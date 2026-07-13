/**
 * Unit tests for the `TcpMonitor` data-access model: CRUD scoped to a team, the
 * delete cascade over `tcp_monitor_results`, the results history limit/ordering,
 * and `recordCheckResult`'s dual write (history insert plus cached-field update)
 * staying in sync.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

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

describe("TcpMonitor.listEnabled", () => {
	test("lists only enabled TCP monitors, across every team", async () => {
		let { db } = createTestDatabase();
		let enabled = await TcpMonitor.create(db, crypto.randomUUID(), tcpMonitorInput());
		let disabled = await TcpMonitor.create(
			db,
			crypto.randomUUID(),
			tcpMonitorInput({ is_enabled: false }),
		);

		let rows = await TcpMonitor.listEnabled(db);
		let ids = rows.map((row) => row.id);
		expect(ids).toContain(enabled.id);
		expect(ids).not.toContain(disabled.id);
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
