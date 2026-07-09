/**
 * Unit tests for the `DnsMonitor` data-access model: team-scoped CRUD, the per-team
 * {@link MAX_DNS_MONITORS_PER_TEAM} limit, and `recordCheckResult`'s combined
 * history-insert + cached-fields-update write path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { Database } from "remix/data-table";

import DnsMonitor, { MAX_DNS_MONITORS_PER_TEAM } from "~/app/data/dns-monitor";
import { createTestDatabase } from "~/app/lib/test/db";
import { dnsMonitorResults } from "~/database/schema";

let db: Database;

beforeEach(() => {
	db = createTestDatabase().db;
});

describe("DnsMonitor.create", () => {
	test("creates a DNS monitor for a team, applying column defaults", async () => {
		let monitor = await DnsMonitor.create(db, "team-1", {
			name: "Example A record",
			domain: "example.com",
			record_type: "A",
			expected_value: null,
		});

		expect(monitor.id).toBeTruthy();
		expect(monitor.team_id).toBe("team-1");
		expect(monitor.name).toBe("Example A record");
		expect(monitor.domain).toBe("example.com");
		expect(monitor.record_type).toBe("A");
		expect(monitor.interval_seconds).toBe(3600);
		expect(monitor.is_enabled).toBeTruthy();
		expect(monitor.last_checked_at).toBeNull();
	});

	test("accepts an explicit expected value and interval", async () => {
		let monitor = await DnsMonitor.create(db, "team-1", {
			name: "MX check",
			domain: "example.com",
			record_type: "MX",
			expected_value: "mail.example.com",
			interval_seconds: 900,
		});

		expect(monitor.expected_value).toBe("mail.example.com");
		expect(monitor.interval_seconds).toBe(900);
	});
});

describe("DnsMonitor.listByTeam", () => {
	test("lists only the team's monitors, newest first", async () => {
		let first = await DnsMonitor.create(db, "team-1", {
			name: "First",
			domain: "a.example.com",
			record_type: "A",
			expected_value: null,
		});
		let second = await DnsMonitor.create(db, "team-1", {
			name: "Second",
			domain: "b.example.com",
			record_type: "A",
			expected_value: null,
		});
		await DnsMonitor.create(db, "team-2", {
			name: "Other team",
			domain: "c.example.com",
			record_type: "A",
			expected_value: null,
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
			record_type: "A",
			expected_value: null,
		});
		await DnsMonitor.create(db, "team-1", {
			name: "B",
			domain: "b.example.com",
			record_type: "A",
			expected_value: null,
		});
		await DnsMonitor.create(db, "team-2", {
			name: "C",
			domain: "c.example.com",
			record_type: "A",
			expected_value: null,
		});

		expect(await DnsMonitor.countByTeam(db, "team-1")).toBe(2);
		expect(await DnsMonitor.countByTeam(db, "team-2")).toBe(1);
		expect(MAX_DNS_MONITORS_PER_TEAM).toBe(20);
	});
});

describe("DnsMonitor.listEnabled", () => {
	test("lists enabled monitors across every team, excluding disabled ones", async () => {
		let enabledA = await DnsMonitor.create(db, "team-1", {
			name: "Enabled A",
			domain: "a.example.com",
			record_type: "A",
			expected_value: null,
		});
		let enabledB = await DnsMonitor.create(db, "team-2", {
			name: "Enabled B",
			domain: "b.example.com",
			record_type: "A",
			expected_value: null,
		});
		await DnsMonitor.create(db, "team-1", {
			name: "Disabled",
			domain: "c.example.com",
			record_type: "A",
			expected_value: null,
			is_enabled: false,
		});

		let monitors = await DnsMonitor.listEnabled(db);
		expect(new Set(monitors.map((monitor) => monitor.id))).toEqual(
			new Set([enabledA.id, enabledB.id]),
		);
	});
});

describe("DnsMonitor.findByIdForTeam", () => {
	test("finds a monitor scoped to its team", async () => {
		let monitor = await DnsMonitor.create(db, "team-1", {
			name: "A",
			domain: "a.example.com",
			record_type: "A",
			expected_value: null,
		});

		expect(await DnsMonitor.findByIdForTeam(db, "team-1", monitor.id)).toEqual(monitor);
	});

	test("returns null when the monitor belongs to a different team", async () => {
		let monitor = await DnsMonitor.create(db, "team-1", {
			name: "A",
			domain: "a.example.com",
			record_type: "A",
			expected_value: null,
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
			record_type: "A",
			expected_value: null,
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
			record_type: "A",
			expected_value: null,
		});
		await DnsMonitor.recordCheckResult(db, monitor.id, {
			status: "ok",
			resolvedValue: "1.2.3.4",
			responseTimeMs: 42,
		});

		await DnsMonitor.deleteById(db, monitor.id);

		expect(await DnsMonitor.findByIdForTeam(db, "team-1", monitor.id)).toBeNull();
		expect(await db.findMany(dnsMonitorResults, { where: { dns_monitor_id: monitor.id } })).toEqual(
			[],
		);
	});
});

describe("DnsMonitor.listResults", () => {
	test("lists a monitor's check results, newest first", async () => {
		let monitor = await DnsMonitor.create(db, "team-1", {
			name: "A",
			domain: "a.example.com",
			record_type: "A",
			expected_value: null,
		});

		await DnsMonitor.recordCheckResult(db, monitor.id, {
			status: "ok",
			resolvedValue: "1.2.3.4",
			responseTimeMs: 10,
		});
		await new Promise((resolve) => setTimeout(resolve, 2));
		await DnsMonitor.recordCheckResult(db, monitor.id, {
			status: "changed",
			resolvedValue: "5.6.7.8",
			responseTimeMs: 20,
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
			record_type: "A",
			expected_value: null,
		});
		let monitorB = await DnsMonitor.create(db, "team-1", {
			name: "B",
			domain: "b.example.com",
			record_type: "A",
			expected_value: null,
		});
		await DnsMonitor.recordCheckResult(db, monitorB.id, {
			status: "ok",
			resolvedValue: "1.2.3.4",
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
			record_type: "A",
			expected_value: null,
		});

		await DnsMonitor.recordCheckResult(db, monitor.id, {
			status: "error",
			resolvedValue: null,
			responseTimeMs: 500,
			errorMessage: "timed out",
		});

		let results = await DnsMonitor.listResults(db, monitor.id);
		expect(results).toHaveLength(1);
		expect(results[0]?.status).toBe("error");
		expect(results[0]?.error_message).toBe("timed out");

		let updated = await DnsMonitor.findByIdForTeam(db, "team-1", monitor.id);
		expect(updated?.last_status).toBe("error");
		expect(updated?.last_value).toBeNull();
		expect(typeof updated?.last_checked_at).toBe("number");
	});
});
