/**
 * Tests the DNS monitors model against a migrated in-memory database: team-scoped reads, the
 * per-team limit, `recordCheckResult`'s history insert and cached-fields update, the delete
 * cascade, and the `next_due_at` scheduling the claim and the create/edit writes keep in step.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { UptimeModels } from "~/app/models";
import type { InsertDnsMonitor } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels, recordJobs } from "~/app/lib/test/models";
import { MAX_DNS_MONITORS_PER_TEAM } from "~/app/models/dns-monitors";
import { dnsMonitorResults, dnsMonitors } from "~/database/schema";

let db: Database;
let models: UptimeModels;

beforeEach(() => {
	db = createTestDatabase().db;
	models = bindModels(db, recordJobs().jobs);
});

/** A valid `dnsMonitors.create` input for `team-1`, with any field overridable per test. */
async function createMonitor(overrides: Partial<InsertDnsMonitor> = {}) {
	return unwrap(
		await models.dnsMonitors.create({
			team_id: "team-1",
			name: "Example A record",
			domain: "a.example.com",
			...overrides,
		}),
	);
}

describe("dnsMonitors.create", () => {
	test("creates a DNS monitor for a team, applying column defaults", async () => {
		let monitor = unwrap(
			await models.dnsMonitors.create({
				team_id: "team-1",
				name: "Example A record",
				domain: "example.com",
			}),
		);

		expect(monitor.id).toBeTruthy();
		expect(monitor.team_id).toBe("team-1");
		expect(monitor.name).toBe("Example A record");
		expect(monitor.domain).toBe("example.com");
		expect(monitor.interval_seconds).toBe(86_400);
		expect(monitor.is_enabled).toBeTruthy();
		expect(monitor.last_checked_at).toBeNull();
		expect(monitor.next_due_at).not.toBeNull();
		expect(monitor.next_due_at).toBeLessThanOrEqual(Date.now());
	});

	test("leaves a monitor created with checking disabled unscheduled", async () => {
		let monitor = await createMonitor({ is_enabled: false });

		expect(monitor.next_due_at).toBeNull();
	});

	test("accepts an explicit interval", async () => {
		let monitor = unwrap(
			await models.dnsMonitors.create({
				team_id: "team-1",
				name: "MX check",
				domain: "example.com",
				interval_seconds: 900,
			}),
		);

		expect(monitor.interval_seconds).toBe(900);
	});
});

describe("dnsMonitors.inTeam listing", () => {
	test("lists only the team's monitors, newest first", async () => {
		let first = unwrap(
			await models.dnsMonitors.create({
				team_id: "team-1",
				name: "First",
				domain: "a.example.com",
			}),
		);
		let second = unwrap(
			await models.dnsMonitors.create({
				team_id: "team-1",
				name: "Second",
				domain: "b.example.com",
			}),
		);
		unwrap(
			await models.dnsMonitors.create({
				team_id: "team-2",
				name: "Other team",
				domain: "c.example.com",
			}),
		);

		unwrap(await models.dnsMonitors.update(first.id, { created_at: Date.now() - 60_000 }));

		let monitors = await models.dnsMonitors.inTeam("team-1").orderBy("created_at", "desc").all();
		expect(monitors.map((monitor) => monitor.id)).toEqual([second.id, first.id]);
	});
});

describe("dnsMonitors.inTeam count", () => {
	test("counts a team's monitors, scoped by team", async () => {
		unwrap(
			await models.dnsMonitors.create({ team_id: "team-1", name: "A", domain: "a.example.com" }),
		);
		unwrap(
			await models.dnsMonitors.create({ team_id: "team-1", name: "B", domain: "b.example.com" }),
		);
		unwrap(
			await models.dnsMonitors.create({ team_id: "team-2", name: "C", domain: "c.example.com" }),
		);

		expect(await models.dnsMonitors.inTeam("team-1").count()).toBe(2);
		expect(await models.dnsMonitors.inTeam("team-2").count()).toBe(1);
		expect(MAX_DNS_MONITORS_PER_TEAM).toBe(20);
	});
});

/**
 * `claimDue` mutates as it reads: it takes the monitors whose `next_due_at` has arrived and
 * advances that column in the same call, so every case below calls it more than once or
 * inspects `next_due_at` afterwards.
 */
describe("dnsMonitors.claimDue", () => {
	/** The `next_due_at` currently stored for a monitor, which is what a claim moves. */
	async function nextDueAt(monitorId: string) {
		let monitor = await db.findOne(dnsMonitors, { where: { id: monitorId } });
		return monitor?.next_due_at ?? null;
	}

	test("claims monitors across every team, never one with checking disabled", async () => {
		let enabledA = await createMonitor({ name: "Enabled A", domain: "a.example.com" });
		let enabledB = await createMonitor({ name: "Enabled B", domain: "b.example.com" });
		let disabled = await createMonitor({ name: "Disabled", is_enabled: false });

		let claimed = await models.dnsMonitors.claimDue(Date.now() + 1000);

		expect(new Set(claimed.map((monitor) => monitor.id))).toEqual(
			new Set([enabledA.id, enabledB.id]),
		);
		expect(await nextDueAt(disabled.id)).toBeNull();
	});

	/** The two deliveries this cron really produces: same minute, ~7s apart. */
	test("never claims the same monitor twice in the same minute", async () => {
		await createMonitor({ interval_seconds: 300 });

		let first = Date.now() + 1000;
		expect(await models.dnsMonitors.claimDue(first)).toHaveLength(1);
		expect(await models.dnsMonitors.claimDue(first + 7000)).toEqual([]);
	});

	test("honours the configured interval instead of the sweep's cadence", async () => {
		let monitor = await createMonitor({ interval_seconds: 300 });
		let anchor = Date.now();
		await db.update(dnsMonitors, monitor.id, { next_due_at: anchor }, { touch: false });

		await models.dnsMonitors.claimDue(anchor);

		expect(await models.dnsMonitors.claimDue(anchor + 60_000)).toEqual([]);
		expect(await models.dnsMonitors.claimDue(anchor + 5 * 60_000)).toHaveLength(1);
	});

	/**
	 * A day late on an hourly monitor: the due time lands on the first hour boundary after
	 * the claim, so the 24 slept-through runs collapse into one.
	 */
	test("advances the due time by whole intervals from the previous one", async () => {
		let monitor = await createMonitor({ interval_seconds: 3600 });
		let anchor = Date.now();
		await db.update(dnsMonitors, monitor.id, { next_due_at: anchor }, { touch: false });

		let scheduledAt = anchor + 24 * 60 * 60_000;
		expect(await models.dnsMonitors.claimDue(scheduledAt)).toHaveLength(1);
		expect(await nextDueAt(monitor.id)).toBe(scheduledAt + 60 * 60_000);
		expect(await models.dnsMonitors.claimDue(scheduledAt)).toEqual([]);
	});

	test("projects only the columns a check reads, plus the team that pays for it", async () => {
		let monitor = await createMonitor();

		let [claimed] = await models.dnsMonitors.claimDue(Date.now() + 1000);

		expect(claimed).toEqual({
			id: monitor.id,
			team_id: monitor.team_id,
			name: "Example A record",
			domain: "a.example.com",
			zone_file_imported_at: null,
			last_status: null,
		});
	});
});

describe("dnsMonitors.update scheduling", () => {
	/** The monitor sits a day out from a claim, so a shorter interval must bring it back. */
	test("re-anchors the schedule when the interval changes", async () => {
		let monitor = await createMonitor({ interval_seconds: 86_400 });
		await db.update(
			dnsMonitors,
			monitor.id,
			{ next_due_at: Date.now() + 86_400_000 },
			{ touch: false },
		);

		unwrap(await models.dnsMonitors.update(monitor.id, { interval_seconds: 300 }));

		expect(await models.dnsMonitors.claimDue(Date.now() + 1000)).toHaveLength(1);
	});

	/**
	 * The web form resubmits the interval on every edit, so a rename or a same-value
	 * interval must leave the cadence as it stands.
	 */
	test("leaves the schedule alone for an edit that doesn't touch it", async () => {
		let monitor = await createMonitor({ interval_seconds: 3600 });
		let scheduled = Date.now() + 3_600_000;
		await db.update(dnsMonitors, monitor.id, { next_due_at: scheduled }, { touch: false });

		let renamed = unwrap(
			await models.dnsMonitors.update(monitor.id, {
				name: "Renamed",
				interval_seconds: 3600,
			}),
		);

		expect(renamed.next_due_at).toBe(scheduled);
	});

	test("unschedules a disabled monitor and reschedules a re-enabled one", async () => {
		let monitor = await createMonitor();

		let disabled = unwrap(await models.dnsMonitors.update(monitor.id, { is_enabled: false }));
		expect(disabled.next_due_at).toBeNull();
		expect(await models.dnsMonitors.claimDue(Date.now() + 24 * 60 * 60_000)).toEqual([]);

		unwrap(await models.dnsMonitors.update(monitor.id, { is_enabled: true }));
		expect(await models.dnsMonitors.claimDue(Date.now() + 1000)).toHaveLength(1);
	});

	test("keeps a disabled monitor unscheduled when its interval changes", async () => {
		let monitor = await createMonitor({ is_enabled: false, interval_seconds: 3600 });

		let updated = unwrap(await models.dnsMonitors.update(monitor.id, { interval_seconds: 300 }));

		expect(updated.next_due_at).toBeNull();
	});
});

describe("dnsMonitors.inTeam lookup", () => {
	test("finds a monitor scoped to its team", async () => {
		let monitor = unwrap(
			await models.dnsMonitors.create({ team_id: "team-1", name: "A", domain: "a.example.com" }),
		);

		expect(await models.dnsMonitors.inTeam("team-1").where({ id: monitor.id }).first()).toEqual(
			monitor,
		);
	});

	test("returns null when the monitor belongs to a different team", async () => {
		let monitor = unwrap(
			await models.dnsMonitors.create({ team_id: "team-1", name: "A", domain: "a.example.com" }),
		);

		expect(await models.dnsMonitors.inTeam("team-2").where({ id: monitor.id }).first()).toBeNull();
	});

	test("returns null for a missing id", async () => {
		expect(await models.dnsMonitors.inTeam("team-1").where({ id: "missing" }).first()).toBeNull();
	});
});

describe("dnsMonitors.update", () => {
	test("updates a monitor's editable fields", async () => {
		let monitor = unwrap(
			await models.dnsMonitors.create({ team_id: "team-1", name: "A", domain: "a.example.com" }),
		);

		let updated = unwrap(
			await models.dnsMonitors.update(monitor.id, {
				name: "Renamed",
				interval_seconds: 120,
				is_enabled: false,
			}),
		);

		expect(updated.name).toBe("Renamed");
		expect(updated.interval_seconds).toBe(120);
		expect(updated.is_enabled).toBeFalsy();
	});
});

describe("dnsMonitors.delete", () => {
	test("deletes a monitor and its check-result history", async () => {
		let monitor = unwrap(
			await models.dnsMonitors.create({ team_id: "team-1", name: "A", domain: "a.example.com" }),
		);
		await models.dnsMonitors.recordCheckResult(monitor.id, {
			status: "ok",
			responseTimeMs: 42,
		});

		unwrap(await models.dnsMonitors.delete(monitor.id));

		expect(await models.dnsMonitors.inTeam("team-1").where({ id: monitor.id }).first()).toBeNull();
		expect(await db.findMany(dnsMonitorResults, { where: { dns_monitor_id: monitor.id } })).toEqual(
			[],
		);
	});

	/**
	 * Regression: the records survived their monitor. The retention sweep visits history
	 * alone and these rows are configuration, so one left behind here is orphaned forever.
	 */
	test("deletes the records the monitor tracked", async () => {
		let monitor = unwrap(
			await models.dnsMonitors.create({ team_id: "team-1", name: "A", domain: "a.example.com" }),
		);
		let other = unwrap(
			await models.dnsMonitors.create({ team_id: "team-1", name: "B", domain: "b.example.com" }),
		);
		await models.dnsMonitorRecords.importMany(monitor.id, [
			{
				name: "a.example.com",
				record_type: "A",
				value: "1.2.3.4",
				source: "resolver",
				is_enabled: true,
				status: "ok",
				last_seen_at: Date.now(),
			},
		]);
		await models.dnsMonitorRecords.importMany(other.id, [
			{
				name: "b.example.com",
				record_type: "A",
				value: "5.6.7.8",
				source: "resolver",
				is_enabled: true,
				status: "ok",
				last_seen_at: Date.now(),
			},
		]);

		unwrap(await models.dnsMonitors.delete(monitor.id));

		expect(await models.dnsMonitorRecords.listByMonitor(monitor.id)).toEqual([]);
		expect(await models.dnsMonitorRecords.forMonitor(other.id).count()).toBe(1);
	});
});

describe("dnsMonitorResults.recent", () => {
	test("lists a monitor's check results, newest first", async () => {
		let monitor = unwrap(
			await models.dnsMonitors.create({ team_id: "team-1", name: "A", domain: "a.example.com" }),
		);

		await models.dnsMonitors.recordCheckResult(monitor.id, {
			status: "ok",
			responseTimeMs: 10,
		});
		await new Promise((resolve) => setTimeout(resolve, 2));
		await models.dnsMonitors.recordCheckResult(monitor.id, {
			status: "changed",
			responseTimeMs: 20,
			recordsChecked: 3,
			recordsChanged: 1,
		});

		let results = await models.dnsMonitorResults.recent(monitor.id);
		expect(results).toHaveLength(2);
		expect(results[0]?.status).toBe("changed");
		expect(results[1]?.status).toBe("ok");
	});

	test("does not include another monitor's results", async () => {
		let monitorA = unwrap(
			await models.dnsMonitors.create({ team_id: "team-1", name: "A", domain: "a.example.com" }),
		);
		let monitorB = unwrap(
			await models.dnsMonitors.create({ team_id: "team-1", name: "B", domain: "b.example.com" }),
		);
		await models.dnsMonitors.recordCheckResult(monitorB.id, {
			status: "ok",
			responseTimeMs: 10,
		});

		expect(await models.dnsMonitorResults.recent(monitorA.id)).toEqual([]);
	});
});

describe("dnsMonitors.recordCheckResult", () => {
	test("inserts a history row and updates the monitor's cached fields", async () => {
		let monitor = unwrap(
			await models.dnsMonitors.create({ team_id: "team-1", name: "A", domain: "a.example.com" }),
		);

		await models.dnsMonitors.recordCheckResult(monitor.id, {
			status: "error",
			responseTimeMs: 500,
			errorMessage: "timed out",
		});

		let results = await models.dnsMonitorResults.recent(monitor.id);
		expect(results).toHaveLength(1);
		expect(results[0]?.status).toBe("error");
		expect(results[0]?.error_message).toBe("timed out");

		let updated = await models.dnsMonitors.inTeam("team-1").where({ id: monitor.id }).first();
		expect(updated?.last_status).toBe("error");
		expect(typeof updated?.last_checked_at).toBe("number");
	});

	test("stores the per-record counters a sweep counted", async () => {
		let monitor = unwrap(
			await models.dnsMonitors.create({ team_id: "team-1", name: "A", domain: "a.example.com" }),
		);

		await models.dnsMonitors.recordCheckResult(monitor.id, {
			status: "changed",
			responseTimeMs: 31,
			recordsChecked: 12,
			recordsChanged: 1,
			recordsMissing: 2,
			recordsNew: 3,
			queriesFailed: 1,
		});

		let [result] = await models.dnsMonitorResults.recent(monitor.id);
		expect(result?.records_checked).toBe(12);
		expect(result?.records_changed).toBe(1);
		expect(result?.records_missing).toBe(2);
		expect(result?.records_new).toBe(3);
		expect(result?.queries_failed).toBe(1);
	});

	test("writes zeros for the counters a caller measured nothing for", async () => {
		let monitor = unwrap(
			await models.dnsMonitors.create({ team_id: "team-1", name: "A", domain: "a.example.com" }),
		);

		await models.dnsMonitors.recordCheckResult(monitor.id, {
			status: "error",
			responseTimeMs: null,
		});

		let [result] = await models.dnsMonitorResults.recent(monitor.id);
		expect(result?.records_checked).toBe(0);
		expect(result?.queries_failed).toBe(0);
		expect(result?.response_time_ms).toBeNull();
	});
});
