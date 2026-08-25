/**
 * Unit tests for the `DnsMonitor` data-access model: team-scoped CRUD, the per-team
 * {@link MAX_DNS_MONITORS_PER_TEAM} limit, `recordCheckResult`'s combined history-insert
 * and cached-fields update, and the `next_due_at` scheduling that the raw-SQL `claimDue`
 * claim and the create/edit writes keep consistent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { beforeEach, describe, expect, test } from "vitest";

import type { InsertDnsMonitor } from "~/database/schema";

import DnsMonitor, { MAX_DNS_MONITORS_PER_TEAM } from "~/app/data/dns-monitor";
import DnsMonitorRecord from "~/app/data/dns-monitor-record";
import { createTestDatabase } from "~/app/lib/test/db";
import { dnsMonitorResults, dnsMonitors } from "~/database/schema";

let db: Database;

beforeEach(() => {
	db = createTestDatabase().db;
});

/** A valid `DnsMonitor.create` input for `team-1`, with any field overridable per test. */
async function createMonitor(overrides: Partial<InsertDnsMonitor> = {}) {
	return await DnsMonitor.create(db, "team-1", {
		name: "Example A record",
		domain: "a.example.com",
		...overrides,
	});
}

describe("DnsMonitor.create", () => {
	test("creates a DNS monitor for a team, applying column defaults", async () => {
		let monitor = await DnsMonitor.create(db, "team-1", {
			name: "Example A record",
			domain: "example.com",
		});

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
		let monitor = await DnsMonitor.create(db, "team-1", {
			name: "MX check",
			domain: "example.com",
			interval_seconds: 900,
		});

		expect(monitor.interval_seconds).toBe(900);
	});
});

describe("DnsMonitor.listByTeam", () => {
	test("lists only the team's monitors, newest first", async () => {
		let first = await DnsMonitor.create(db, "team-1", {
			name: "First",
			domain: "a.example.com",
		});
		let second = await DnsMonitor.create(db, "team-1", {
			name: "Second",
			domain: "b.example.com",
		});
		await DnsMonitor.create(db, "team-2", {
			name: "Other team",
			domain: "c.example.com",
		});

		await DnsMonitor.updateById(db, first.id, { created_at: Date.now() - 60_000 });

		let monitors = await DnsMonitor.listByTeam(db, "team-1");
		expect(monitors.map((monitor) => monitor.id)).toEqual([second.id, first.id]);
	});
});

describe("DnsMonitor.countByTeam", () => {
	test("counts a team's monitors, scoped by team", async () => {
		await DnsMonitor.create(db, "team-1", {
			name: "A",
			domain: "a.example.com",
		});
		await DnsMonitor.create(db, "team-1", {
			name: "B",
			domain: "b.example.com",
		});
		await DnsMonitor.create(db, "team-2", {
			name: "C",
			domain: "c.example.com",
		});

		expect(await DnsMonitor.countByTeam(db, "team-1")).toBe(2);
		expect(await DnsMonitor.countByTeam(db, "team-2")).toBe(1);
		expect(MAX_DNS_MONITORS_PER_TEAM).toBe(20);
	});
});

/**
 * `claimDue` mutates as it reads: it takes the monitors whose `next_due_at` has arrived and
 * advances that column in the same call, so every case below calls it more than once or
 * inspects `next_due_at` afterwards.
 */
describe("DnsMonitor.claimDue", () => {
	/** The `next_due_at` currently stored for a monitor, which is what a claim moves. */
	async function nextDueAt(monitorId: string) {
		let monitor = await db.findOne(dnsMonitors, { where: { id: monitorId } });
		return monitor?.next_due_at ?? null;
	}

	test("claims monitors across every team, never one with checking disabled", async () => {
		let enabledA = await createMonitor({ name: "Enabled A", domain: "a.example.com" });
		let enabledB = await createMonitor({ name: "Enabled B", domain: "b.example.com" });
		let disabled = await createMonitor({ name: "Disabled", is_enabled: false });

		let claimed = await DnsMonitor.claimDue(db, Date.now() + 1000);

		expect(new Set(claimed.map((monitor) => monitor.id))).toEqual(
			new Set([enabledA.id, enabledB.id]),
		);
		expect(await nextDueAt(disabled.id)).toBeNull();
	});

	/** The two deliveries this cron really produces: same minute, ~7s apart. */
	test("never claims the same monitor twice in the same minute", async () => {
		await createMonitor({ interval_seconds: 300 });

		let first = Date.now() + 1000;
		expect(await DnsMonitor.claimDue(db, first)).toHaveLength(1);
		expect(await DnsMonitor.claimDue(db, first + 7000)).toEqual([]);
	});

	test("honours the configured interval instead of the sweep's cadence", async () => {
		let monitor = await createMonitor({ interval_seconds: 300 });
		let anchor = Date.now();
		await db.update(dnsMonitors, monitor.id, { next_due_at: anchor }, { touch: false });

		await DnsMonitor.claimDue(db, anchor);

		expect(await DnsMonitor.claimDue(db, anchor + 60_000)).toEqual([]);
		expect(await DnsMonitor.claimDue(db, anchor + 5 * 60_000)).toHaveLength(1);
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
		expect(await DnsMonitor.claimDue(db, scheduledAt)).toHaveLength(1);
		expect(await nextDueAt(monitor.id)).toBe(scheduledAt + 60 * 60_000);
		expect(await DnsMonitor.claimDue(db, scheduledAt)).toEqual([]);
	});

	test("projects only the columns a check reads, plus the team that pays for it", async () => {
		let monitor = await createMonitor();

		let [claimed] = await DnsMonitor.claimDue(db, Date.now() + 1000);

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

describe("DnsMonitor.updateById scheduling", () => {
	/** The monitor sits a day out from a claim, so a shorter interval must bring it back. */
	test("re-anchors the schedule when the interval changes", async () => {
		let monitor = await createMonitor({ interval_seconds: 86_400 });
		await db.update(
			dnsMonitors,
			monitor.id,
			{ next_due_at: Date.now() + 86_400_000 },
			{ touch: false },
		);

		await DnsMonitor.updateById(db, monitor.id, { interval_seconds: 300 });

		expect(await DnsMonitor.claimDue(db, Date.now() + 1000)).toHaveLength(1);
	});

	/**
	 * The web form resubmits the interval on every edit, so a rename or a same-value
	 * interval must leave the cadence as it stands.
	 */
	test("leaves the schedule alone for an edit that doesn't touch it", async () => {
		let monitor = await createMonitor({ interval_seconds: 3600 });
		let scheduled = Date.now() + 3_600_000;
		await db.update(dnsMonitors, monitor.id, { next_due_at: scheduled }, { touch: false });

		let renamed = await DnsMonitor.updateById(db, monitor.id, {
			name: "Renamed",
			interval_seconds: 3600,
		});

		expect(renamed.next_due_at).toBe(scheduled);
	});

	test("unschedules a disabled monitor and reschedules a re-enabled one", async () => {
		let monitor = await createMonitor();

		let disabled = await DnsMonitor.updateById(db, monitor.id, { is_enabled: false });
		expect(disabled.next_due_at).toBeNull();
		expect(await DnsMonitor.claimDue(db, Date.now() + 24 * 60 * 60_000)).toEqual([]);

		await DnsMonitor.updateById(db, monitor.id, { is_enabled: true });
		expect(await DnsMonitor.claimDue(db, Date.now() + 1000)).toHaveLength(1);
	});

	test("keeps a disabled monitor unscheduled when its interval changes", async () => {
		let monitor = await createMonitor({ is_enabled: false, interval_seconds: 3600 });

		let updated = await DnsMonitor.updateById(db, monitor.id, { interval_seconds: 300 });

		expect(updated.next_due_at).toBeNull();
	});
});

describe("DnsMonitor.findByIdForTeam", () => {
	test("finds a monitor scoped to its team", async () => {
		let monitor = await DnsMonitor.create(db, "team-1", {
			name: "A",
			domain: "a.example.com",
		});

		expect(await DnsMonitor.findByIdForTeam(db, "team-1", monitor.id)).toEqual(monitor);
	});

	test("returns null when the monitor belongs to a different team", async () => {
		let monitor = await DnsMonitor.create(db, "team-1", {
			name: "A",
			domain: "a.example.com",
		});

		expect(await DnsMonitor.findByIdForTeam(db, "team-2", monitor.id)).toBeNull();
	});

	test("returns null for a missing id", async () => {
		expect(await DnsMonitor.findByIdForTeam(db, "team-1", "missing")).toBeNull();
	});
});

describe("DnsMonitor.updateById", () => {
	test("updates a monitor's editable fields", async () => {
		let monitor = await DnsMonitor.create(db, "team-1", {
			name: "A",
			domain: "a.example.com",
		});

		let updated = await DnsMonitor.updateById(db, monitor.id, {
			name: "Renamed",
			interval_seconds: 120,
			is_enabled: false,
		});

		expect(updated.name).toBe("Renamed");
		expect(updated.interval_seconds).toBe(120);
		expect(updated.is_enabled).toBeFalsy();
	});
});

describe("DnsMonitor.deleteById", () => {
	test("deletes a monitor and its check-result history", async () => {
		let monitor = await DnsMonitor.create(db, "team-1", {
			name: "A",
			domain: "a.example.com",
		});
		await DnsMonitor.recordCheckResult(db, monitor.id, {
			status: "ok",
			responseTimeMs: 42,
		});

		await DnsMonitor.deleteById(db, monitor.id);

		expect(await DnsMonitor.findByIdForTeam(db, "team-1", monitor.id)).toBeNull();
		expect(await db.findMany(dnsMonitorResults, { where: { dns_monitor_id: monitor.id } })).toEqual(
			[],
		);
	});

	/**
	 * Regression: the records survived their monitor. The retention sweep visits history
	 * alone and these rows are configuration, so one left behind here is orphaned forever.
	 */
	test("deletes the records the monitor tracked", async () => {
		let monitor = await DnsMonitor.create(db, "team-1", {
			name: "A",
			domain: "a.example.com",
		});
		let other = await DnsMonitor.create(db, "team-1", {
			name: "B",
			domain: "b.example.com",
		});
		await DnsMonitorRecord.importMany(db, monitor.id, [
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
		await DnsMonitorRecord.importMany(db, other.id, [
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

		await DnsMonitor.deleteById(db, monitor.id);

		expect(await DnsMonitorRecord.listByMonitor(db, monitor.id)).toEqual([]);
		expect(await DnsMonitorRecord.countByMonitor(db, other.id)).toBe(1);
	});
});

describe("DnsMonitor.listResults", () => {
	test("lists a monitor's check results, newest first", async () => {
		let monitor = await DnsMonitor.create(db, "team-1", {
			name: "A",
			domain: "a.example.com",
		});

		await DnsMonitor.recordCheckResult(db, monitor.id, {
			status: "ok",
			responseTimeMs: 10,
		});
		await new Promise((resolve) => setTimeout(resolve, 2));
		await DnsMonitor.recordCheckResult(db, monitor.id, {
			status: "changed",
			responseTimeMs: 20,
			recordsChecked: 3,
			recordsChanged: 1,
		});

		let results = await DnsMonitor.listResults(db, monitor.id);
		expect(results).toHaveLength(2);
		expect(results[0]?.status).toBe("changed");
		expect(results[1]?.status).toBe("ok");
	});

	test("does not include another monitor's results", async () => {
		let monitorA = await DnsMonitor.create(db, "team-1", {
			name: "A",
			domain: "a.example.com",
		});
		let monitorB = await DnsMonitor.create(db, "team-1", {
			name: "B",
			domain: "b.example.com",
		});
		await DnsMonitor.recordCheckResult(db, monitorB.id, {
			status: "ok",
			responseTimeMs: 10,
		});

		expect(await DnsMonitor.listResults(db, monitorA.id)).toEqual([]);
	});
});

describe("DnsMonitor.recordCheckResult", () => {
	test("inserts a history row and updates the monitor's cached fields", async () => {
		let monitor = await DnsMonitor.create(db, "team-1", {
			name: "A",
			domain: "a.example.com",
		});

		await DnsMonitor.recordCheckResult(db, monitor.id, {
			status: "error",
			responseTimeMs: 500,
			errorMessage: "timed out",
		});

		let results = await DnsMonitor.listResults(db, monitor.id);
		expect(results).toHaveLength(1);
		expect(results[0]?.status).toBe("error");
		expect(results[0]?.error_message).toBe("timed out");

		let updated = await DnsMonitor.findByIdForTeam(db, "team-1", monitor.id);
		expect(updated?.last_status).toBe("error");
		expect(typeof updated?.last_checked_at).toBe("number");
	});

	test("stores the per-record counters a sweep counted", async () => {
		let monitor = await DnsMonitor.create(db, "team-1", {
			name: "A",
			domain: "a.example.com",
		});

		await DnsMonitor.recordCheckResult(db, monitor.id, {
			status: "changed",
			responseTimeMs: 31,
			recordsChecked: 12,
			recordsChanged: 1,
			recordsMissing: 2,
			recordsNew: 3,
			queriesFailed: 1,
		});

		let [result] = await DnsMonitor.listResults(db, monitor.id);
		expect(result?.records_checked).toBe(12);
		expect(result?.records_changed).toBe(1);
		expect(result?.records_missing).toBe(2);
		expect(result?.records_new).toBe(3);
		expect(result?.queries_failed).toBe(1);
	});

	test("writes zeros for the counters a caller measured nothing for", async () => {
		let monitor = await DnsMonitor.create(db, "team-1", {
			name: "A",
			domain: "a.example.com",
		});

		await DnsMonitor.recordCheckResult(db, monitor.id, { status: "error", responseTimeMs: null });

		let [result] = await DnsMonitor.listResults(db, monitor.id);
		expect(result?.records_checked).toBe(0);
		expect(result?.queries_failed).toBe(0);
		expect(result?.response_time_ms).toBeNull();
	});
});
