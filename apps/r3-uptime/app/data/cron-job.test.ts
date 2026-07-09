/**
 * Unit tests for the `CronJobMonitor` data-access model: team-scoped CRUD over
 * cron-job monitors, ping-history recording via the single `recordPing` write path,
 * the scheduled-sweep query `listActionable`, and the pure cron-expression helpers
 * (`calculateNextExpected`, `validateCronExpression`, `describeCronExpression`).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { Database } from "remix/data-table";

import CronJobMonitor from "~/app/data/cron-job";
import { createTestDatabase } from "~/app/lib/test/db";
import { cronJobPings } from "~/database/schema";

let db: Database;

beforeEach(() => {
	db = createTestDatabase().db;
});

describe("CronJobMonitor.create", () => {
	test("computes next_expected_at when created enabled", async () => {
		let enabledAt = Date.now();
		let monitor = await CronJobMonitor.create(db, "team-1", {
			name: "Nightly backup",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: enabledAt,
		});

		expect(monitor.id).toBeTruthy();
		expect(monitor.team_id).toBe("team-1");
		expect(monitor.status).toBe("new");
		expect(monitor.next_expected_at).not.toBeNull();
		expect(typeof monitor.next_expected_at).toBe("number");
	});

	test("leaves next_expected_at null when created disabled", async () => {
		let monitor = await CronJobMonitor.create(db, "team-1", {
			name: "Disabled job",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: null,
		});

		expect(monitor.next_expected_at).toBeNull();
	});
});

describe("CronJobMonitor.listByTeam", () => {
	test("lists only the team's monitors, newest first", async () => {
		let first = await CronJobMonitor.create(db, "team-1", {
			name: "First",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: null,
		});
		let second = await CronJobMonitor.create(db, "team-1", {
			name: "Second",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: null,
		});
		await CronJobMonitor.create(db, "team-2", {
			name: "Other team",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: null,
		});

		await CronJobMonitor.updateById(db, first.id, { created_at: Date.now() - 60_000 });

		let monitors = await CronJobMonitor.listByTeam(db, "team-1");
		expect(monitors.map((monitor) => monitor.id)).toEqual([second.id, first.id]);
	});
});

describe("CronJobMonitor.findByIdForTeam", () => {
	test("finds a monitor scoped to its team", async () => {
		let monitor = await CronJobMonitor.create(db, "team-1", {
			name: "A",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: null,
		});

		expect(await CronJobMonitor.findByIdForTeam(db, "team-1", monitor.id)).toEqual(monitor);
	});

	test("returns null when the monitor belongs to a different team", async () => {
		let monitor = await CronJobMonitor.create(db, "team-1", {
			name: "A",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: null,
		});

		expect(await CronJobMonitor.findByIdForTeam(db, "team-2", monitor.id)).toBeNull();
	});

	test("returns null for a missing id", async () => {
		expect(await CronJobMonitor.findByIdForTeam(db, "team-1", "missing")).toBeNull();
	});
});

describe("CronJobMonitor.findById", () => {
	test("finds a monitor by id regardless of team, for the public ping endpoint", async () => {
		let monitor = await CronJobMonitor.create(db, "team-1", {
			name: "A",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: null,
		});

		expect(await CronJobMonitor.findById(db, monitor.id)).toEqual(monitor);
	});

	test("returns null for a missing id", async () => {
		expect(await CronJobMonitor.findById(db, "missing")).toBeNull();
	});
});

describe("CronJobMonitor.updateById", () => {
	test("updates a monitor's editable fields", async () => {
		let monitor = await CronJobMonitor.create(db, "team-1", {
			name: "A",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: null,
		});

		let updated = await CronJobMonitor.updateById(db, monitor.id, {
			name: "Renamed",
			grace_period_seconds: 600,
		});

		expect(updated.name).toBe("Renamed");
		expect(updated.grace_period_seconds).toBe(600);
	});
});

describe("CronJobMonitor.deleteById", () => {
	test("deletes a monitor and its ping history", async () => {
		let monitor = await CronJobMonitor.create(db, "team-1", {
			name: "A",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: Date.now(),
		});
		await CronJobMonitor.recordPing(db, monitor, true, {
			sourceIp: "1.2.3.4",
			userAgent: "curl/8.0",
		});

		await CronJobMonitor.deleteById(db, monitor.id);

		expect(await CronJobMonitor.findById(db, monitor.id)).toBeNull();
		expect(await db.findMany(cronJobPings, { where: { cron_job_monitor_id: monitor.id } })).toEqual(
			[],
		);
	});
});

describe("CronJobMonitor.listPings", () => {
	test("lists a monitor's pings, newest first", async () => {
		let monitor = await CronJobMonitor.create(db, "team-1", {
			name: "A",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: Date.now(),
		});

		await CronJobMonitor.recordPing(db, monitor, true, { sourceIp: null, userAgent: null });
		await new Promise((resolve) => setTimeout(resolve, 2));
		await CronJobMonitor.recordPing(db, monitor, false, { sourceIp: null, userAgent: null });

		let pings = await CronJobMonitor.listPings(db, monitor.id);
		expect(pings).toHaveLength(2);
		expect(pings[0]?.was_on_time).toBeFalsy();
		expect(pings[1]?.was_on_time).toBeTruthy();
	});

	test("caps ping history at 50 entries", async () => {
		let monitor = await CronJobMonitor.create(db, "team-1", {
			name: "A",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: Date.now(),
		});

		for (let index = 0; index < 55; index++) {
			await db.create(
				cronJobPings,
				{
					id: crypto.randomUUID(),
					cron_job_monitor_id: monitor.id,
					was_on_time: true,
					source_ip: null,
					user_agent: null,
					created_at: Date.now() + index,
				},
				{ touch: false, returnRow: true },
			);
		}

		let pings = await CronJobMonitor.listPings(db, monitor.id);
		expect(pings).toHaveLength(50);
	});

	test("does not include another monitor's pings", async () => {
		let monitorA = await CronJobMonitor.create(db, "team-1", {
			name: "A",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: Date.now(),
		});
		let monitorB = await CronJobMonitor.create(db, "team-1", {
			name: "B",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: Date.now(),
		});
		await CronJobMonitor.recordPing(db, monitorB, true, { sourceIp: null, userAgent: null });

		expect(await CronJobMonitor.listPings(db, monitorA.id)).toEqual([]);
	});
});

describe("CronJobMonitor.listActionable", () => {
	test("only includes enabled, scheduled monitors that are healthy or late", async () => {
		let healthy = await CronJobMonitor.create(db, "team-1", {
			name: "Healthy",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: Date.now(),
		});
		await CronJobMonitor.updateStatus(db, healthy.id, "healthy");

		let late = await CronJobMonitor.create(db, "team-1", {
			name: "Late",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: Date.now(),
		});
		await CronJobMonitor.updateStatus(db, late.id, "late");

		let missed = await CronJobMonitor.create(db, "team-1", {
			name: "Missed",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: Date.now(),
		});
		await CronJobMonitor.updateStatus(db, missed.id, "missed");

		// Still "new" — never received a first ping, and has no next_expected_at yet.
		await CronJobMonitor.create(db, "team-1", {
			name: "New",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: null,
		});

		let disabled = await CronJobMonitor.create(db, "team-1", {
			name: "Disabled",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: Date.now(),
		});
		await CronJobMonitor.updateStatus(db, disabled.id, "healthy");
		await CronJobMonitor.updateById(db, disabled.id, { enabled_at: null });

		let actionable = await CronJobMonitor.listActionable(db);
		expect(new Set(actionable.map((monitor) => monitor.id))).toEqual(
			new Set([healthy.id, late.id]),
		);
	});
});

describe("CronJobMonitor.updateStatus", () => {
	test("sets the monitor's status directly", async () => {
		let monitor = await CronJobMonitor.create(db, "team-1", {
			name: "A",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: null,
		});

		let updated = await CronJobMonitor.updateStatus(db, monitor.id, "missed");
		expect(updated.status).toBe("missed");
	});
});

describe("CronJobMonitor.recordPing", () => {
	test("records an on-time ping as healthy and refreshes next_expected_at", async () => {
		let monitor = await CronJobMonitor.create(db, "team-1", {
			name: "A",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: Date.now(),
		});
		await CronJobMonitor.updateStatus(db, monitor.id, "late");

		await CronJobMonitor.recordPing(db, monitor, true, {
			sourceIp: "1.2.3.4",
			userAgent: "curl/8.0",
		});

		let pings = await CronJobMonitor.listPings(db, monitor.id);
		expect(pings).toHaveLength(1);
		expect(pings[0]?.was_on_time).toBeTruthy();
		expect(pings[0]?.source_ip).toBe("1.2.3.4");
		expect(pings[0]?.user_agent).toBe("curl/8.0");

		let updated = await CronJobMonitor.findById(db, monitor.id);
		expect(updated?.status).toBe("healthy");
		expect(typeof updated?.last_ping_at).toBe("number");
		expect(typeof updated?.next_expected_at).toBe("number");
	});

	test("records a late ping and marks the monitor late, never missed", async () => {
		let monitor = await CronJobMonitor.create(db, "team-1", {
			name: "A",
			description: null,
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: Date.now(),
		});

		await CronJobMonitor.recordPing(db, monitor, false, { sourceIp: null, userAgent: null });

		let updated = await CronJobMonitor.findById(db, monitor.id);
		expect(updated?.status).toBe("late");
	});
});

describe("CronJobMonitor.calculateNextExpected", () => {
	test("computes the next UTC run for a daily cron expression", () => {
		let next = CronJobMonitor.calculateNextExpected(
			"0 0 * * *",
			"UTC",
			new Date("2026-01-05T10:00:00Z"),
		);
		expect(next).toBe(new Date("2026-01-06T00:00:00.000Z").getTime());
	});

	test("honors the given timezone", () => {
		let from = new Date("2026-01-05T10:00:00Z");
		let utc = CronJobMonitor.calculateNextExpected("0 9 * * *", "UTC", from);
		let ny = CronJobMonitor.calculateNextExpected("0 9 * * *", "America/New_York", from);

		expect(new Date(utc).toISOString()).toBe("2026-01-06T09:00:00.000Z");
		expect(new Date(ny).toISOString()).toBe("2026-01-05T14:00:00.000Z");
	});
});

describe("CronJobMonitor.validateCronExpression", () => {
	test("does not throw for a valid expression", () => {
		expect(() => CronJobMonitor.validateCronExpression("0 0 * * *", "UTC")).not.toThrow();
	});

	test("throws for an invalid expression", () => {
		expect(() => CronJobMonitor.validateCronExpression("not-a-cron", "UTC")).toThrow();
	});
});

describe("CronJobMonitor.describeCronExpression", () => {
	test("uses the named shortcuts", () => {
		expect(CronJobMonitor.describeCronExpression("@daily")).toBe("Every day at midnight");
		expect(CronJobMonitor.describeCronExpression("@hourly")).toBe("Every hour");
		expect(CronJobMonitor.describeCronExpression("@weekly")).toBe("Every Sunday at midnight");
	});

	test("describes every-minute and every-hour patterns", () => {
		expect(CronJobMonitor.describeCronExpression("* * * * *")).toBe("Every minute");
		expect(CronJobMonitor.describeCronExpression("0 * * * *")).toBe("Every hour");
		expect(CronJobMonitor.describeCronExpression("*/15 * * * *")).toBe("Every 15 minutes");
		expect(CronJobMonitor.describeCronExpression("5 * * * *")).toBe("Every hour at minute 5");
	});

	test("describes daily patterns", () => {
		expect(CronJobMonitor.describeCronExpression("0 0 * * *")).toBe("Every day at midnight");
		expect(CronJobMonitor.describeCronExpression("0 9 * * *")).toBe("Every day at 9:00");
		expect(CronJobMonitor.describeCronExpression("30 9 * * *")).toBe("Every day at 9:30");
	});

	test("describes weekly patterns", () => {
		expect(CronJobMonitor.describeCronExpression("0 0 * * 1")).toBe("Every Monday at midnight");
		expect(CronJobMonitor.describeCronExpression("0 9 * * 1")).toBe("Every Monday at 9:00");
	});

	test("describes monthly patterns", () => {
		expect(CronJobMonitor.describeCronExpression("0 0 15 * *")).toBe(
			"Monthly on day 15 at midnight",
		);
	});

	test("falls back to a generic 'Scheduled' description for valid but unmatched expressions", () => {
		expect(CronJobMonitor.describeCronExpression("0 0 1 1 1")).toMatch(/^Scheduled \(next: .+\)$/);
	});

	test("falls back to 'Custom schedule' for expressions that fail to parse", () => {
		expect(CronJobMonitor.describeCronExpression("not-a-cron")).toBe("Custom schedule");
	});
});
