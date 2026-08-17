/**
 * Unit tests for `MaintenanceWindow`'s pure helpers — `parseRecurringPattern` (the
 * `"daily|weekly|monthly:..."` string format `recurring_pattern` rows store) and
 * `isRecurringPatternActive` (whether a recurring pattern's current occurrence covers a
 * given instant, in UTC wall-clock time) — plus `isSuppressing`, whose team/monitor
 * scoping runs as two indexed lookups and so needs the tenant-isolation guarantee
 * covered against a real database. The remaining CRUD methods aren't exercised here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { beforeEach, describe, expect, test } from "vitest";

import type { InsertMaintenanceWindow } from "~/database/schema";

import MaintenanceWindow, {
	isRecurringPatternActive,
	parseRecurringPattern,
} from "~/app/data/maintenance-window";
import { createTestDatabase } from "~/app/lib/test/db";

describe("parseRecurringPattern", () => {
	test("parses a daily pattern", () => {
		expect(parseRecurringPattern("daily:02:00-04:00")).toEqual({
			type: "daily",
			startTime: "02:00",
			endTime: "04:00",
		});
	});

	test("parses a weekly pattern", () => {
		expect(parseRecurringPattern("weekly:monday:02:00-04:00")).toEqual({
			type: "weekly",
			dayOfWeek: "monday",
			startTime: "02:00",
			endTime: "04:00",
		});
	});

	test("parses a monthly pattern", () => {
		expect(parseRecurringPattern("monthly:15:02:00-04:00")).toEqual({
			type: "monthly",
			dayOfMonth: 15,
			startTime: "02:00",
			endTime: "04:00",
		});
	});

	test("rejects an unknown weekday", () => {
		expect(parseRecurringPattern("weekly:someday:02:00-04:00")).toBeNull();
	});

	test("rejects a malformed pattern", () => {
		expect(parseRecurringPattern("garbage")).toBeNull();
		expect(parseRecurringPattern("")).toBeNull();
	});
});

describe("isRecurringPatternActive", () => {
	test("daily pattern is active within its time range", () => {
		let pattern = { type: "daily" as const, startTime: "02:00", endTime: "04:00" };
		expect(isRecurringPatternActive(pattern, new Date("2026-01-05T03:00:00Z"))).toBe(true);
		expect(isRecurringPatternActive(pattern, new Date("2026-01-05T05:00:00Z"))).toBe(false);
	});

	test("daily pattern's end boundary is exclusive", () => {
		let pattern = { type: "daily" as const, startTime: "02:00", endTime: "04:00" };
		expect(isRecurringPatternActive(pattern, new Date("2026-01-05T04:00:00Z"))).toBe(false);
		expect(isRecurringPatternActive(pattern, new Date("2026-01-05T02:00:00Z"))).toBe(true);
	});

	test("weekly pattern only matches its configured day", () => {
		let pattern = {
			type: "weekly" as const,
			dayOfWeek: "monday" as const,
			startTime: "02:00",
			endTime: "04:00",
		};
		/** 2026-01-05 is a Monday. */
		expect(isRecurringPatternActive(pattern, new Date("2026-01-05T03:00:00Z"))).toBe(true);
		/** 2026-01-06 is a Tuesday. */
		expect(isRecurringPatternActive(pattern, new Date("2026-01-06T03:00:00Z"))).toBe(false);
	});

	test("monthly pattern clamps a day beyond the month's length", () => {
		let pattern = {
			type: "monthly" as const,
			dayOfMonth: 31,
			startTime: "02:00",
			endTime: "04:00",
		};
		/** February 2026 has 28 days, so day 31 clamps to the 28th. */
		expect(isRecurringPatternActive(pattern, new Date("2026-02-28T03:00:00Z"))).toBe(true);
		expect(isRecurringPatternActive(pattern, new Date("2026-02-27T03:00:00Z"))).toBe(false);
	});
});

describe("MaintenanceWindow.isSuppressing", () => {
	let db: Database;

	beforeEach(() => {
		db = createTestDatabase().db;
	});

	/** Creates a window covering right now, suppressing alerts unless overridden. */
	async function createActiveWindow(
		teamId: string,
		monitorId: string | null,
		overrides: Partial<InsertMaintenanceWindow> = {},
	) {
		let now = Date.now();
		return await MaintenanceWindow.create(db, teamId, {
			monitor_id: monitorId,
			name: "Window",
			starts_at: now - 60_000,
			ends_at: now + 60_000,
			...overrides,
		});
	}

	test("a window scoped to the monitor suppresses that HTTP monitor", async () => {
		await createActiveWindow("team-1", "monitor-1");

		expect(
			await MaintenanceWindow.isSuppressing(db, {
				teamId: "team-1",
				monitorId: "monitor-1",
				monitorType: "http",
			}),
		).toBe(true);
	});

	test("a team-wide window suppresses every monitor type", async () => {
		await createActiveWindow("team-1", null);

		for (let monitorType of ["http", "dns", "tcp", "cron"] as const) {
			expect(
				await MaintenanceWindow.isSuppressing(db, {
					teamId: "team-1",
					monitorId: "monitor-1",
					monitorType,
				}),
			).toBe(true);
		}
	});

	test("a window scoped to another monitor doesn't suppress", async () => {
		await createActiveWindow("team-1", "monitor-2");

		expect(
			await MaintenanceWindow.isSuppressing(db, {
				teamId: "team-1",
				monitorId: "monitor-1",
				monitorType: "http",
			}),
		).toBe(false);
	});

	test("another team's windows never suppress, even for the same monitor id", async () => {
		await createActiveWindow("team-2", "monitor-1");
		await createActiveWindow("team-2", null);

		expect(
			await MaintenanceWindow.isSuppressing(db, {
				teamId: "team-1",
				monitorId: "monitor-1",
				monitorType: "http",
			}),
		).toBe(false);
	});

	/**
	 * A row from before `monitor_type` existed, whose id could only ever have named an HTTP
	 * monitor. Read as team-wide it would silence every check the team runs; read as HTTP it
	 * keeps covering exactly what it covered, which is what this asserts from both sides.
	 */
	test("a window with a monitor id and no type reads as HTTP-scoped, never as team-wide", async () => {
		await createActiveWindow("team-1", "monitor-1", { monitor_type: null });

		expect(
			await MaintenanceWindow.isSuppressing(db, {
				teamId: "team-1",
				monitorId: "monitor-1",
				monitorType: "http",
			}),
		).toBe(true);

		expect(
			await MaintenanceWindow.isSuppressing(db, {
				teamId: "team-1",
				monitorId: "monitor-1",
				monitorType: "dns",
			}),
		).toBe(false);
	});

	test("a window scoped to a whole type suppresses every monitor of it, and nothing else", async () => {
		await createActiveWindow("team-1", null, { monitor_type: "dns" });

		expect(
			await MaintenanceWindow.isSuppressing(db, {
				teamId: "team-1",
				monitorId: "dns-1",
				monitorType: "dns",
			}),
		).toBe(true);

		expect(
			await MaintenanceWindow.isSuppressing(db, {
				teamId: "team-1",
				monitorId: "dns-2",
				monitorType: "dns",
			}),
		).toBe(true);

		expect(
			await MaintenanceWindow.isSuppressing(db, {
				teamId: "team-1",
				monitorId: "http-1",
				monitorType: "http",
			}),
		).toBe(false);
	});

	test("a window scoped to one non-HTTP monitor suppresses that monitor alone", async () => {
		await createActiveWindow("team-1", "dns-1", { monitor_type: "dns" });

		expect(
			await MaintenanceWindow.isSuppressing(db, {
				teamId: "team-1",
				monitorId: "dns-1",
				monitorType: "dns",
			}),
		).toBe(true);

		expect(
			await MaintenanceWindow.isSuppressing(db, {
				teamId: "team-1",
				monitorId: "dns-2",
				monitorType: "dns",
			}),
		).toBe(false);
	});

	/** The gap this scoping closed: an HTTP window used to be the only monitor-scoped kind. */
	test("an HTTP-scoped window doesn't suppress a DNS check that shares its id", async () => {
		await createActiveWindow("team-1", "monitor-1", { monitor_type: "http" });

		expect(
			await MaintenanceWindow.isSuppressing(db, {
				teamId: "team-1",
				monitorId: "monitor-1",
				monitorType: "dns",
			}),
		).toBe(false);
	});

	test("a window that doesn't suppress alerts is ignored", async () => {
		await createActiveWindow("team-1", "monitor-1", { suppress_alerts: false });

		expect(
			await MaintenanceWindow.isSuppressing(db, {
				teamId: "team-1",
				monitorId: "monitor-1",
				monitorType: "http",
			}),
		).toBe(false);
	});

	test("a window ended early is no longer active", async () => {
		let window = await createActiveWindow("team-1", "monitor-1");
		await MaintenanceWindow.updateById(db, window.id, { ended_early_at: Date.now() - 1_000 });

		expect(
			await MaintenanceWindow.isSuppressing(db, {
				teamId: "team-1",
				monitorId: "monitor-1",
				monitorType: "http",
			}),
		).toBe(false);
	});

	test("returns false when the team has no windows at all", async () => {
		expect(
			await MaintenanceWindow.isSuppressing(db, {
				teamId: "team-1",
				monitorId: "monitor-1",
				monitorType: "http",
			}),
		).toBe(false);
	});
});
