/**
 * Data-access model for maintenance windows: CRUD, the "end early" action, `isSuppressing`,
 * and the iCalendar events a row stands for. A recurring row's activity and its calendar
 * feed both come from the same RRULE, so what a subscriber sees is what suppresses alerts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ICalendar } from "@sdxc/icalendar";
import type { Database } from "remix/data-table";

import { utc } from "@sdxc/icalendar";
import { occurrences } from "@sdxc/icalendar/rrule";
import { isSuccess } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid";

import type { MonitorScopeType } from "~/app/lib/monitor-scope";
import type { InsertMaintenanceWindow, SelectMaintenanceWindow } from "~/database/schema";

import { monitorScopeMatches, storedMonitorScope } from "~/app/lib/monitor-scope";
import { maintenanceWindows } from "~/database/schema";

const WEEKDAYS = [
	"sunday",
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
] as const;

type Weekday = (typeof WEEKDAYS)[number];

/** The RRULE weekday code for each of {@link WEEKDAYS}, in the same order. */
const RRULE_WEEKDAYS: ICalendar.Weekday[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/**
 * How long after its end a one-off window stays on a status page's calendar, so a
 * subscriber still sees last month's maintenance in their history.
 */
const STATUS_PAGE_HISTORY_MS = 30 * DAY_MS;

/** A service a status page shows, by the scope pair a window's scope is matched against. */
export interface StatusPageService {
	type: MonitorScopeType;
	id: string;
}

interface RecurringPattern {
	type: "daily" | "weekly" | "monthly";
	dayOfWeek?: Weekday;
	dayOfMonth?: number;
	startTime: string;
	endTime: string;
}

export default class MaintenanceWindow {
	/** Creates a maintenance window for a team. */
	static async create(db: Database, teamId: string, input: InsertMaintenanceWindow) {
		return await db.create(
			maintenanceWindows,
			{ id: generateUUID(), team_id: teamId, ...input },
			{ touch: true, returnRow: true },
		);
	}

	/** Lists every maintenance window for a team, most recently created first. */
	static async listByTeam(db: Database, teamId: string) {
		return await db.findMany(maintenanceWindows, {
			where: { team_id: teamId },
			orderBy: ["created_at", "desc"],
		});
	}

	/**
	 * Every maintenance window for a team, as a query for a paging strategy to finish.
	 *
	 * The ordering is left off deliberately: `Pagination.byKeyset()` owns it, because
	 * it needs the sort keys both to seek and to mint the cursor.
	 */
	static listByTeamQuery(db: Database, teamId: string) {
		return db.query(maintenanceWindows).where({ team_id: teamId });
	}

	/** Finds a window among a team's own rows; an id owned by another team yields `null`. */
	static async findByIdForTeam(db: Database, teamId: string, windowId: string) {
		return await db.findOne(maintenanceWindows, { where: { id: windowId, team_id: teamId } });
	}

	/** Updates a window's editable fields. */
	static async updateById(
		db: Database,
		windowId: string,
		changes: Partial<InsertMaintenanceWindow>,
	) {
		return await db.update(maintenanceWindows, windowId, changes, { touch: true });
	}

	/** Deletes a maintenance window. */
	static async deleteById(db: Database, windowId: string) {
		return await db.delete(maintenanceWindows, windowId);
	}

	/** Marks a window as manually ended, effective immediately. */
	static async endEarly(db: Database, windowId: string) {
		return await db.update(
			maintenanceWindows,
			windowId,
			{ ended_early_at: Date.now() },
			{ touch: true },
		);
	}

	/**
	 * Whether `window` covers `now`: its one-off range, or an occurrence of its recurring
	 * pattern. The occurrence is read off {@link recurringEvent}'s RRULE, the one the status
	 * page's calendar publishes; an occurrence's end is exclusive.
	 */
	static isActiveAt(window: SelectMaintenanceWindow, now: number): boolean {
		let effectiveEnd = window.ended_early_at ?? window.ends_at;
		if (window.starts_at <= now && effectiveEnd >= now) return true;

		let event = recurringEvent(window);
		if (!event) return false;
		let found = occurrences(event, { from: now, to: now + 1, limit: 1 });
		return isSuccess(found) && found.data.length > 0;
	}

	/**
	 * The windows a status page publishes: flagged `show_on_status_page`, scoped team-wide or
	 * to a service the page shows, and either recurring or ended within the last 30 days.
	 * Earliest start first, so a page lists them in the order they happen.
	 */
	static async listForStatusPage(
		db: Database,
		teamId: string,
		services: StatusPageService[],
		now: number,
	): Promise<SelectMaintenanceWindow[]> {
		let rows = await db.findMany(maintenanceWindows, {
			where: { team_id: teamId, show_on_status_page: true },
			orderBy: ["starts_at", "asc"],
		});

		return rows.filter((window) => {
			let scope = storedMonitorScope(window);
			let covers =
				scope.monitorType === null ||
				services.some((service) => monitorScopeMatches(scope, service.type, service.id));
			if (!covers) return false;
			if (window.is_recurring && recurringEvent(window)) return true;
			return (window.ended_early_at ?? window.ends_at) >= now - STATUS_PAGE_HISTORY_MS;
		});
	}

	/**
	 * Whether an active, alert-suppressing window covers a monitor right now: one scoped
	 * to it, to its whole type, or team-wide. Two concurrent statements each seek
	 * `(team_id, monitor_id)`, returning a set small enough to match the type in memory.
	 */
	static async isSuppressing(
		db: Database,
		params: { teamId: string; monitorId: string; monitorType: MonitorScopeType },
	): Promise<boolean> {
		let [monitorScoped, unscopedByMonitor] = await Promise.all([
			db.findMany(maintenanceWindows, {
				where: { team_id: params.teamId, monitor_id: params.monitorId },
			}),
			db.findMany(maintenanceWindows, {
				where: { team_id: params.teamId, monitor_id: null },
			}),
		]);

		let now = Date.now();

		return [...monitorScoped, ...unscopedByMonitor].some(
			(window) =>
				window.suppress_alerts &&
				monitorScopeMatches(storedMonitorScope(window), params.monitorType, params.monitorId) &&
				MaintenanceWindow.isActiveAt(window, now),
		);
	}
}

const DAILY_PATTERN = /^daily:(\d{2}:\d{2})-(\d{2}:\d{2})$/;
const WEEKLY_PATTERN = /^weekly:([a-z]+):(\d{2}:\d{2})-(\d{2}:\d{2})$/;
const MONTHLY_PATTERN = /^monthly:(\d{1,2}):(\d{2}:\d{2})-(\d{2}:\d{2})$/;

/**
 * Parses `"daily:HH:MM-HH:MM"` / `"weekly:<day>:HH:MM-HH:MM"` / `"monthly:<day>:HH:MM-HH:MM"`.
 * A monthly day outside 1-31 names no day of any month, so it reads as no pattern.
 */
export function parseRecurringPattern(pattern: string): RecurringPattern | null {
	let daily = DAILY_PATTERN.exec(pattern);
	if (daily?.[1] && daily[2]) return { type: "daily", startTime: daily[1], endTime: daily[2] };

	let weekly = WEEKLY_PATTERN.exec(pattern);
	if (weekly?.[1] && isWeekday(weekly[1]) && weekly[2] && weekly[3]) {
		return { type: "weekly", dayOfWeek: weekly[1], startTime: weekly[2], endTime: weekly[3] };
	}

	let monthly = MONTHLY_PATTERN.exec(pattern);
	let dayOfMonth = Number(monthly?.[1]);
	if (monthly?.[2] && monthly[3] && dayOfMonth >= 1 && dayOfMonth <= 31) {
		return {
			type: "monthly",
			dayOfMonth,
			startTime: monthly[2],
			endTime: monthly[3],
		};
	}

	return null;
}

function isWeekday(value: string): value is Weekday {
	return WEEKDAYS.includes(value as Weekday);
}

/** Minutes past midnight for an `HH:MM` wall clock. */
function minutesOf(time: string): number {
	let [hours, minutes] = time.split(":").map(Number);
	return (hours ?? 0) * 60 + (minutes ?? 0);
}

/**
 * The RRULE a pattern repeats by, in UTC. A monthly day past the 28th takes the month's last
 * day when the month is shorter, which `BYSETPOS=-1` over the candidate days expresses and a
 * bare `BYMONTHDAY=31` (every month that has a 31st) would not.
 */
function recurrenceRule(pattern: RecurringPattern): ICalendar.RecurrenceRule {
	if (pattern.type === "weekly" && pattern.dayOfWeek) {
		let weekday = RRULE_WEEKDAYS[WEEKDAYS.indexOf(pattern.dayOfWeek)] ?? "MO";
		return { frequency: "WEEKLY", byDay: [{ weekday }] };
	}
	if (pattern.type === "monthly" && pattern.dayOfMonth) {
		let day = pattern.dayOfMonth;
		if (day <= 28) return { frequency: "MONTHLY", byMonthDay: [day] };
		let candidates = Array.from({ length: day - 27 }, (_, index) => 28 + index);
		return { frequency: "MONTHLY", byMonthDay: candidates, bySetPosition: [-1] };
	}
	return { frequency: "DAILY" };
}

/** Whether a pattern's occurrence starts on the UTC day beginning at `dayStart`. */
function startsOn(pattern: RecurringPattern, dayStart: number): boolean {
	let day = new Date(dayStart);
	if (pattern.type === "weekly")
		return day.getUTCDay() === WEEKDAYS.indexOf(pattern.dayOfWeek ?? "sunday");
	if (pattern.type === "monthly") {
		let daysInMonth = new Date(
			Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0),
		).getUTCDate();
		return day.getUTCDate() === Math.min(pattern.dayOfMonth ?? 1, daysInMonth);
	}
	return true;
}

/**
 * The recurring half of a window as an iCalendar event, or `null` when the row has no
 * readable pattern or one of zero length. An end at or before the start crosses midnight,
 * so `daily:23:00-01:00` lasts two hours. `DTSTART` is the first occurrence still running
 * when the row was created, and `SEQUENCE` grows with every edit through `updated_at`.
 */
export function recurringEvent(window: SelectMaintenanceWindow): ICalendar.Event | null {
	if (!window.is_recurring || !window.recurring_pattern) return null;
	let pattern = parseRecurringPattern(window.recurring_pattern);
	if (!pattern) return null;

	let startMinutes = minutesOf(pattern.startTime);
	let lengthMinutes = minutesOf(pattern.endTime) - startMinutes;
	if (lengthMinutes === 0) return null;
	if (lengthMinutes < 0) lengthMinutes += 24 * 60;

	let dayStart = Math.floor(window.created_at / DAY_MS) * DAY_MS - DAY_MS;
	let start = dayStart + startMinutes * MINUTE_MS;
	while (!startsOn(pattern, dayStart) || start + lengthMinutes * MINUTE_MS <= window.created_at) {
		dayStart += DAY_MS;
		start = dayStart + startMinutes * MINUTE_MS;
	}

	return {
		...revision(window),
		uid: `${window.id}-recurring@uptime`,
		start: utc(start),
		duration: { hours: Math.floor(lengthMinutes / 60), minutes: lengthMinutes % 60 },
		recurrence: recurrenceRule(pattern),
		properties: [],
	};
}

/**
 * The one-off range of a window as an iCalendar event. Ending a window early keeps its
 * `UID` and moves `DTEND`, so a subscribed calendar shortens the event it already holds.
 */
export function oneOffEvent(window: SelectMaintenanceWindow): ICalendar.Event {
	return {
		...revision(window),
		uid: `${window.id}@uptime`,
		start: utc(window.starts_at),
		end: utc(window.ended_early_at ?? window.ends_at),
		properties: [],
	};
}

/** The revision fields every event of a window shares, all derived from its timestamps. */
function revision(window: SelectMaintenanceWindow) {
	return {
		dtstamp: new Date(window.updated_at),
		lastModified: new Date(window.updated_at),
		created: new Date(window.created_at),
		sequence: Math.max(0, Math.floor((window.updated_at - window.created_at) / 1000)),
		summary: window.name,
	};
}
