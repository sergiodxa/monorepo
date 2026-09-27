/**
 * Unit tests for `MaintenanceWindow`: `parseRecurringPattern`, the iCalendar events a row
 * maps to, `isActiveAt` reading its recurrence off that RRULE, and the two queries that need
 * a real database — `isSuppressing`'s tenant isolation and `listForStatusPage`'s filters.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { parse, stringify } from "@sdxc/icalendar";
import { stringifyRecurrence } from "@sdxc/icalendar/rrule";
import { isSuccess } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { InsertMaintenanceWindow, SelectMaintenanceWindow } from "~/database/schema";

import MaintenanceWindow, {
	oneOffEvent,
	parseRecurringPattern,
	recurringEvent,
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

/** The row was created on Thursday 2026-01-01; its one-off range is long over. */
const CREATED_AT = Date.UTC(2026, 0, 1, 12);

/** A recurring window row for `pattern`, as the database returns it. */
function recurringRow(
	pattern: string,
	overrides: Partial<SelectMaintenanceWindow> = {},
): SelectMaintenanceWindow {
	return {
		id: "window-1",
		created_at: CREATED_AT,
		updated_at: CREATED_AT,
		team_id: "team-1",
		monitor_type: null,
		monitor_id: null,
		name: "Database upgrade",
		starts_at: CREATED_AT - 7_200_000,
		ends_at: CREATED_AT - 3_600_000,
		ended_early_at: null,
		suppress_alerts: true,
		show_on_status_page: true,
		is_recurring: true,
		recurring_pattern: pattern,
		...overrides,
	};
}

/** Whether the row is active at an ISO instant. */
function activeAt(row: SelectMaintenanceWindow, iso: string): boolean {
	return MaintenanceWindow.isActiveAt(row, Date.parse(iso));
}

describe("parseRecurringPattern day of month", () => {
	test("rejects a monthly day no month has", () => {
		expect(parseRecurringPattern("monthly:0:02:00-04:00")).toBeNull();
		expect(parseRecurringPattern("monthly:32:02:00-04:00")).toBeNull();
	});
});

describe("recurringEvent", () => {
	test("maps a daily pattern to a daily RRULE with the window's length", () => {
		let event = recurringEvent(recurringRow("daily:02:00-04:00"));

		expect(event?.uid).toBe("window-1-recurring@uptime");
		expect(event?.start).toEqual({
			type: "date-time",
			wall: { year: 2026, month: 1, day: 2, hour: 2, minute: 0, second: 0 },
			zone: "utc",
		});
		expect(event?.duration).toEqual({ hours: 2, minutes: 0 });
		expect(event && stringifyRecurrence(event.recurrence ?? { frequency: "DAILY" })).toBe(
			"FREQ=DAILY",
		);
	});

	test("starts on the first occurrence still running when the row was created", () => {
		let event = recurringEvent(recurringRow("daily:11:00-13:00"));

		expect(event?.start).toMatchObject({ wall: { day: 1, hour: 11 } });
	});

	test("maps a weekly pattern to its weekday and starts on that weekday", () => {
		let event = recurringEvent(recurringRow("weekly:monday:02:00-04:00"));

		expect(event?.recurrence).toEqual({ frequency: "WEEKLY", byDay: [{ weekday: "MO" }] });
		/** 2026-01-05 is the first Monday after the row was created. */
		expect(event?.start).toMatchObject({ wall: { month: 1, day: 5 } });
	});

	test("maps a monthly day up to the 28th to a plain BYMONTHDAY", () => {
		expect(recurringEvent(recurringRow("monthly:15:02:00-04:00"))?.recurrence).toEqual({
			frequency: "MONTHLY",
			byMonthDay: [15],
		});
	});

	test("maps monthly:31 to the month's last day, so short months keep their window", () => {
		expect(recurringEvent(recurringRow("monthly:31:02:00-04:00"))?.recurrence).toEqual({
			frequency: "MONTHLY",
			byMonthDay: [28, 29, 30, 31],
			bySetPosition: [-1],
		});
	});

	test("gives an overnight pattern the hours it spans across midnight", () => {
		expect(recurringEvent(recurringRow("daily:23:00-01:00"))?.duration).toEqual({
			hours: 2,
			minutes: 0,
		});
	});

	test("has no event for a zero-length pattern, one-off rows or unreadable patterns", () => {
		expect(recurringEvent(recurringRow("daily:02:00-02:00"))).toBeNull();
		expect(recurringEvent(recurringRow("daily:02:00-04:00", { is_recurring: false }))).toBeNull();
		expect(recurringEvent(recurringRow("garbage"))).toBeNull();
	});

	test("raises SEQUENCE on every edit and stamps the edit time", () => {
		let edited = recurringEvent(
			recurringRow("daily:02:00-04:00", { updated_at: CREATED_AT + 90_000 }),
		);

		expect(edited?.sequence).toBe(90);
		expect(edited?.dtstamp).toEqual(new Date(CREATED_AT + 90_000));
	});

	test("survives a round trip through the calendar format", () => {
		let event = recurringEvent(recurringRow("monthly:31:23:30-00:30"));
		if (!event) throw new Error("expected an event");

		let parsed = parse(
			stringify({
				productId: "-//test//EN",
				timeZones: [],
				events: [event],
				components: [],
				properties: [],
			}),
		);

		expect(isSuccess(parsed) && parsed.data.calendar.events[0]?.recurrence).toEqual(
			event.recurrence,
		);
	});
});

describe("oneOffEvent", () => {
	test("ends at the early end when the window was ended early, under the same UID", () => {
		let row = recurringRow("daily:02:00-04:00", {
			is_recurring: false,
			ended_early_at: CREATED_AT - 5_400_000,
		});

		let event = oneOffEvent(row);

		expect(event.uid).toBe("window-1@uptime");
		expect(event.end).toMatchObject({ wall: { hour: 10, minute: 30 } });
	});
});

describe("MaintenanceWindow.isActiveAt", () => {
	test("covers a daily pattern within its time range, with an exclusive end", () => {
		let row = recurringRow("daily:02:00-04:00");

		expect(activeAt(row, "2026-03-05T02:00:00Z")).toBe(true);
		expect(activeAt(row, "2026-03-05T03:59:00Z")).toBe(true);
		expect(activeAt(row, "2026-03-05T04:00:00Z")).toBe(false);
		expect(activeAt(row, "2026-03-05T05:00:00Z")).toBe(false);
	});

	test("covers a weekly pattern on its configured day only", () => {
		let row = recurringRow("weekly:monday:02:00-04:00");

		/** 2026-03-02 is a Monday. */
		expect(activeAt(row, "2026-03-02T03:00:00Z")).toBe(true);
		expect(activeAt(row, "2026-03-03T03:00:00Z")).toBe(false);
	});

	/** Regression: the old matcher required start <= now < end on one day, so this never matched. */
	test("covers an overnight pattern on both sides of midnight", () => {
		let row = recurringRow("daily:23:00-01:00");

		expect(activeAt(row, "2026-03-05T23:30:00Z")).toBe(true);
		expect(activeAt(row, "2026-03-06T00:30:00Z")).toBe(true);
		expect(activeAt(row, "2026-03-06T01:00:00Z")).toBe(false);
		expect(activeAt(row, "2026-03-05T22:59:00Z")).toBe(false);
	});

	/** Regression: the feed and the matcher now share one RRULE, so short months clamp in both. */
	test("covers monthly:31 on the last day of every shorter month", () => {
		let row = recurringRow("monthly:31:02:00-04:00");

		expect(activeAt(row, "2026-02-28T03:00:00Z")).toBe(true);
		expect(activeAt(row, "2026-02-27T03:00:00Z")).toBe(false);
		expect(activeAt(row, "2026-04-30T03:00:00Z")).toBe(true);
		expect(activeAt(row, "2026-03-30T03:00:00Z")).toBe(false);
		expect(activeAt(row, "2026-03-31T03:00:00Z")).toBe(true);
	});

	test("carries an overnight monthly window into the next month", () => {
		let row = recurringRow("monthly:31:23:00-01:00");

		expect(activeAt(row, "2026-03-01T00:30:00Z")).toBe(true);
	});

	test("covers the one-off range of a recurring row too", () => {
		let row = recurringRow("daily:02:00-04:00");

		expect(MaintenanceWindow.isActiveAt(row, row.starts_at + 1)).toBe(true);
	});
});

describe("MaintenanceWindow.listForStatusPage", () => {
	let db: Database;

	beforeEach(() => {
		db = createTestDatabase().db;
	});

	/** Creates a window for team-1 ending an hour from now. */
	async function createWindow(overrides: Partial<InsertMaintenanceWindow> = {}) {
		let now = Date.now();
		return await MaintenanceWindow.create(db, "team-1", {
			name: "Window",
			starts_at: now,
			ends_at: now + 3_600_000,
			monitor_id: null,
			...overrides,
		});
	}

	let services = [{ type: "http" as const, id: "monitor-1" }];

	test("publishes team-wide windows and windows scoped to a service on the page", async () => {
		let teamWide = await createWindow();
		let scoped = await createWindow({ monitor_type: "http", monitor_id: "monitor-1" });
		let byType = await createWindow({ monitor_type: "http" });
		await createWindow({ monitor_type: "http", monitor_id: "monitor-2" });
		await createWindow({ monitor_type: "dns" });

		let rows = await MaintenanceWindow.listForStatusPage(db, "team-1", services, Date.now());

		expect(rows.map((row) => row.id).sort()).toEqual([teamWide.id, scoped.id, byType.id].sort());
	});

	test("leaves out windows hidden from status pages", async () => {
		await createWindow({ show_on_status_page: false });

		expect(await MaintenanceWindow.listForStatusPage(db, "team-1", services, Date.now())).toEqual(
			[],
		);
	});

	test("leaves out another team's windows", async () => {
		let now = Date.now();
		await MaintenanceWindow.create(db, "team-2", {
			name: "Theirs",
			starts_at: now,
			ends_at: now + 60_000,
			monitor_id: null,
		});

		expect(await MaintenanceWindow.listForStatusPage(db, "team-1", services, now)).toEqual([]);
	});

	test("keeps a one-off window for 30 days after it ends, and a recurring one always", async () => {
		let now = Date.now();
		let day = 86_400_000;
		let recent = await createWindow({ starts_at: now - 21 * day, ends_at: now - 20 * day });
		await createWindow({ starts_at: now - 41 * day, ends_at: now - 40 * day });
		let recurring = await createWindow({
			starts_at: now - 41 * day,
			ends_at: now - 40 * day,
			is_recurring: true,
			recurring_pattern: "daily:02:00-04:00",
		});

		let rows = await MaintenanceWindow.listForStatusPage(db, "team-1", services, now);

		expect(rows.map((row) => row.id).sort()).toEqual([recent.id, recurring.id].sort());
	});
});

describe("MaintenanceWindow.listByTeamQuery", () => {
	test("selects the team's windows and none of another team's", async () => {
		let db = createTestDatabase().db;
		let now = Date.now();
		let window = { name: "Window", starts_at: now, ends_at: now + 60_000, monitor_id: null };
		let mine = await MaintenanceWindow.create(db, "team-1", window);
		await MaintenanceWindow.create(db, "team-2", window);

		let rows = await MaintenanceWindow.listByTeamQuery(db, "team-1").all();
		expect(rows.map((row) => row.id)).toEqual([mine.id]);
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
