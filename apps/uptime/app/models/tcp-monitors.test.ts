/**
 * Tests the TCP monitors model against a migrated in-memory database: team-scoped reads, the
 * delete cascade over results, `recordCheckResult`'s history insert and cached-fields update,
 * and the `next_due_at` scheduling the claim and the create/edit writes keep in step.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CreateValues } from "@sdxc/data-model";
import type { Database } from "remix/data-table";

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { TcpMonitors } from "~/app/models/tcp-monitors";
import type { TcpCheckResult } from "~/app/services/tcp-check";

import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels, recordJobs } from "~/app/lib/test/models";
import { tcpMonitorResults, tcpMonitors } from "~/database/schema";

/** What `tcpMonitors.create` takes besides the team. */
type TcpMonitorInput = Omit<CreateValues<typeof TcpMonitors>, "team_id">;

/** A valid `tcpMonitors.create` input, with any field overridable per test. */
function tcpMonitorInput(overrides: Partial<TcpMonitorInput> = {}): TcpMonitorInput {
	return {
		name: "Postgres",
		host: "db.example.com",
		port: 5432,
		...overrides,
	};
}

describe("tcpMonitors.create", () => {
	test("creates a TCP monitor for a team, enabled immediately", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let teamId = crypto.randomUUID();

		let monitor = unwrap(
			await models.tcpMonitors.create({ team_id: teamId, ...tcpMonitorInput() }),
		);

		expect(monitor.team_id).toBe(teamId);
		expect(monitor.host).toBe("db.example.com");
		expect(monitor.port).toBe(5432);
		/**
		 * SQLite (and the production D1 adapter, identically) round-trips boolean columns as
		 * 0/1, so this asserts truthiness.
		 */
		expect(monitor.is_enabled).toBeTruthy();
		expect(monitor.next_due_at).not.toBeNull();
		expect(monitor.next_due_at).toBeLessThanOrEqual(Date.now());
	});

	test("leaves a monitor created with checking disabled unscheduled", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);

		let monitor = unwrap(
			await models.tcpMonitors.create({
				team_id: crypto.randomUUID(),
				...tcpMonitorInput({ is_enabled: false }),
			}),
		);

		expect(monitor.next_due_at).toBeNull();
	});
});

describe("tcpMonitors.inTeam listing", () => {
	test("lists a team's TCP monitors, most recently created first", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let teamId = crypto.randomUUID();
		let first = unwrap(await models.tcpMonitors.create({ team_id: teamId, ...tcpMonitorInput() }));
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
		let second = unwrap(
			await models.tcpMonitors.create({ team_id: teamId, ...tcpMonitorInput({ name: "Redis" }) }),
		);

		let rows = await models.tcpMonitors.inTeam(teamId).orderBy("created_at", "desc").all();
		expect(rows.map((row) => row.id)).toEqual([second.id, first.id]);
	});

	test("never returns another team's TCP monitors", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let teamA = crypto.randomUUID();
		let teamB = crypto.randomUUID();
		unwrap(await models.tcpMonitors.create({ team_id: teamA, ...tcpMonitorInput() }));

		expect(await models.tcpMonitors.inTeam(teamB).orderBy("created_at", "desc").all()).toEqual([]);
	});
});

/**
 * `claimDue` both reads and writes: it takes the monitors whose `next_due_at` has arrived
 * and advances that column in the same call, so what matters is the state it leaves behind.
 * Every case below calls it twice, or inspects `next_due_at` afterwards.
 */
describe("tcpMonitors.claimDue", () => {
	/** The `next_due_at` currently stored for a monitor, which is what a claim moves. */
	async function nextDueAt(db: Database, monitorId: string) {
		let monitor = await db.findOne(tcpMonitors, { where: { id: monitorId } });
		return monitor?.next_due_at ?? null;
	}

	test("claims a newly created monitor on the first tick after it exists", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let monitor = unwrap(
			await models.tcpMonitors.create({ team_id: crypto.randomUUID(), ...tcpMonitorInput() }),
		);

		let claimed = await models.tcpMonitors.claimDue(Date.now() + 1000);
		expect(claimed.map((row) => row.id)).toEqual([monitor.id]);
	});

	test("never claims a monitor with checking disabled", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let disabled = unwrap(
			await models.tcpMonitors.create({
				team_id: crypto.randomUUID(),
				...tcpMonitorInput({ is_enabled: false }),
			}),
		);

		expect(await nextDueAt(db, disabled.id)).toBeNull();
		expect(await models.tcpMonitors.claimDue(Date.now() + 24 * 60 * 60_000)).toEqual([]);
	});

	/** The two deliveries this cron really produces land in the same minute, ~7s apart. */
	test("never claims the same monitor twice in the same minute", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		unwrap(
			await models.tcpMonitors.create({
				team_id: crypto.randomUUID(),
				...tcpMonitorInput({ interval_seconds: 60 }),
			}),
		);

		let first = Date.now() + 1000;
		expect(await models.tcpMonitors.claimDue(first)).toHaveLength(1);
		expect(await models.tcpMonitors.claimDue(first + 7000)).toEqual([]);
	});

	test("honours the configured interval instead of the sweep's cadence", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let monitor = unwrap(
			await models.tcpMonitors.create({
				team_id: crypto.randomUUID(),
				...tcpMonitorInput({ interval_seconds: 3600 }),
			}),
		);
		let anchor = Date.now();
		await db.update(tcpMonitors, monitor.id, { next_due_at: anchor }, { touch: false });

		await models.tcpMonitors.claimDue(anchor);

		expect(await models.tcpMonitors.claimDue(anchor + 30 * 60_000)).toEqual([]);
		expect(await models.tcpMonitors.claimDue(anchor + 60 * 60_000)).toHaveLength(1);
	});

	/**
	 * 7 minutes late on a 5-minute monitor: the next due time is the anchor plus two whole
	 * intervals, so a sweep that fell behind resumes on the original grid.
	 */
	test("advances the due time by whole intervals from the previous one", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let monitor = unwrap(
			await models.tcpMonitors.create({
				team_id: crypto.randomUUID(),
				...tcpMonitorInput({ interval_seconds: 300 }),
			}),
		);
		let anchor = Date.now();
		await db.update(tcpMonitors, monitor.id, { next_due_at: anchor }, { touch: false });

		await models.tcpMonitors.claimDue(anchor + 7 * 60_000);

		expect(await nextDueAt(db, monitor.id)).toBe(anchor + 10 * 60_000);
	});

	test("projects only the columns a check reads, plus the team that pays for it", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let monitor = unwrap(
			await models.tcpMonitors.create({ team_id: crypto.randomUUID(), ...tcpMonitorInput() }),
		);

		let [claimed] = await models.tcpMonitors.claimDue(Date.now() + 1000);

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

describe("tcpMonitors.update scheduling", () => {
	test("re-anchors the schedule when the interval changes", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let monitor = unwrap(
			await models.tcpMonitors.create({
				team_id: crypto.randomUUID(),
				...tcpMonitorInput({ interval_seconds: 3600 }),
			}),
		);
		await db.update(
			tcpMonitors,
			monitor.id,
			{ next_due_at: Date.now() + 3_600_000 },
			{ touch: false },
		);

		unwrap(await models.tcpMonitors.update(monitor.id, { interval_seconds: 60 }));

		expect(await models.tcpMonitors.claimDue(Date.now() + 1000)).toHaveLength(1);
	});

	/**
	 * The web form resubmits the unchanged interval on every edit, so a rename and a
	 * same-value interval both have to leave the cadence where it stands.
	 */
	test("leaves the schedule alone for an edit that doesn't touch it", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let monitor = unwrap(
			await models.tcpMonitors.create({
				team_id: crypto.randomUUID(),
				...tcpMonitorInput({ interval_seconds: 60 }),
			}),
		);
		let scheduled = Date.now() + 3_600_000;
		await db.update(tcpMonitors, monitor.id, { next_due_at: scheduled }, { touch: false });

		let renamed = unwrap(
			await models.tcpMonitors.update(monitor.id, {
				name: "Renamed",
				interval_seconds: 60,
			}),
		);

		expect(renamed.next_due_at).toBe(scheduled);
	});

	test("unschedules a disabled monitor and reschedules a re-enabled one", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let monitor = unwrap(
			await models.tcpMonitors.create({ team_id: crypto.randomUUID(), ...tcpMonitorInput() }),
		);

		let disabled = unwrap(await models.tcpMonitors.update(monitor.id, { is_enabled: false }));
		expect(disabled.next_due_at).toBeNull();
		expect(await models.tcpMonitors.claimDue(Date.now() + 24 * 60 * 60_000)).toEqual([]);

		unwrap(await models.tcpMonitors.update(monitor.id, { is_enabled: true }));
		expect(await models.tcpMonitors.claimDue(Date.now() + 1000)).toHaveLength(1);
	});

	test("keeps a disabled monitor unscheduled when its interval changes", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let monitor = unwrap(
			await models.tcpMonitors.create({
				team_id: crypto.randomUUID(),
				...tcpMonitorInput({ is_enabled: false, interval_seconds: 60 }),
			}),
		);

		let updated = unwrap(await models.tcpMonitors.update(monitor.id, { interval_seconds: 120 }));

		expect(updated.next_due_at).toBeNull();
	});
});

describe("tcpMonitors.inTeam lookup", () => {
	test("finds a monitor scoped to its team", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let teamId = crypto.randomUUID();
		let monitor = unwrap(
			await models.tcpMonitors.create({ team_id: teamId, ...tcpMonitorInput() }),
		);

		expect((await models.tcpMonitors.inTeam(teamId).where({ id: monitor.id }).first())?.id).toBe(
			monitor.id,
		);
	});

	test("returns null when the monitor belongs to a different team", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let teamA = crypto.randomUUID();
		let teamB = crypto.randomUUID();
		let monitor = unwrap(await models.tcpMonitors.create({ team_id: teamA, ...tcpMonitorInput() }));

		expect(await models.tcpMonitors.inTeam(teamB).where({ id: monitor.id }).first()).toBeNull();
	});

	test("returns null when the id doesn't exist", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		expect(
			await models.tcpMonitors
				.inTeam(crypto.randomUUID())
				.where({ id: crypto.randomUUID() })
				.first(),
		).toBeNull();
	});
});

describe("tcpMonitors.update", () => {
	test("updates a monitor's editable fields", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let monitor = unwrap(
			await models.tcpMonitors.create({ team_id: crypto.randomUUID(), ...tcpMonitorInput() }),
		);

		let updated = unwrap(await models.tcpMonitors.update(monitor.id, { port: 6379 }));
		expect(updated.port).toBe(6379);
	});
});

describe("tcpMonitors.delete", () => {
	test("deletes the monitor and its check-result history", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let teamId = crypto.randomUUID();
		let monitor = unwrap(
			await models.tcpMonitors.create({ team_id: teamId, ...tcpMonitorInput() }),
		);
		let result: TcpCheckResult = { status: "up", responseTimeMs: 12 };
		await models.tcpMonitors.recordCheckResult(monitor.id, result);
		await models.tcpMonitors.recordCheckResult(monitor.id, result);

		unwrap(await models.tcpMonitors.delete(monitor.id));

		expect(await models.tcpMonitors.inTeam(teamId).where({ id: monitor.id }).first()).toBeNull();
		expect(await models.tcpMonitorResults.recent(monitor.id)).toEqual([]);
	});

	test("deleting a monitor with no results at all doesn't throw", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let monitor = unwrap(
			await models.tcpMonitors.create({ team_id: crypto.randomUUID(), ...tcpMonitorInput() }),
		);

		unwrap(await models.tcpMonitors.delete(monitor.id));
	});
});

describe("tcpMonitorResults.recent", () => {
	test("lists a monitor's results newest first", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let monitor = unwrap(
			await models.tcpMonitors.create({ team_id: crypto.randomUUID(), ...tcpMonitorInput() }),
		);
		let now = Date.now();
		/**
		 * Inserted with explicit, distinct `checked_at` timestamps so the ordering assertion
		 * is deterministic.
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

		let results = await models.tcpMonitorResults.recent(monitor.id);
		expect(results.map((row) => row.status)).toEqual(["down", "up"]);
	});

	test("never mixes another monitor's results in", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let monitorA = unwrap(
			await models.tcpMonitors.create({ team_id: crypto.randomUUID(), ...tcpMonitorInput() }),
		);
		let monitorB = unwrap(
			await models.tcpMonitors.create({ team_id: crypto.randomUUID(), ...tcpMonitorInput() }),
		);
		await models.tcpMonitors.recordCheckResult(monitorA.id, { status: "up", responseTimeMs: 10 });

		expect(await models.tcpMonitorResults.recent(monitorB.id)).toEqual([]);
	});
});

describe("tcpMonitors.recordCheckResult", () => {
	test("inserts a history row and updates the monitor's cached fields", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let monitor = unwrap(
			await models.tcpMonitors.create({ team_id: crypto.randomUUID(), ...tcpMonitorInput() }),
		);

		await models.tcpMonitors.recordCheckResult(monitor.id, {
			status: "timeout",
			responseTimeMs: null,
			errorMessage: "connect ETIMEDOUT",
		});

		let results = await models.tcpMonitorResults.recent(monitor.id);
		expect(results).toHaveLength(1);
		expect(results[0]?.status).toBe("timeout");
		expect(results[0]?.error_message).toBe("connect ETIMEDOUT");

		let updated = await models.tcpMonitors
			.inTeam(monitor.team_id)
			.where({ id: monitor.id })
			.first();
		expect(updated?.last_status).toBe("timeout");
		expect(updated?.last_response_time_ms).toBeNull();
		expect(updated?.last_checked_at).not.toBeNull();
	});

	test("defaults a missing error message to null", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db, recordJobs().jobs);
		let monitor = unwrap(
			await models.tcpMonitors.create({ team_id: crypto.randomUUID(), ...tcpMonitorInput() }),
		);

		await models.tcpMonitors.recordCheckResult(monitor.id, { status: "up", responseTimeMs: 8 });

		let results = await models.tcpMonitorResults.recent(monitor.id);
		expect(results[0]?.error_message).toBeNull();
	});
});
