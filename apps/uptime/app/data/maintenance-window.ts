/**
 * Data-access model for maintenance windows: CRUD over `maintenance_windows`, the
 * "end early" lifecycle action, and `isSuppressing` — the single active/recurring-aware
 * check the dashboard status badge and the alert pipeline share, so a recurring
 * window's current occurrence counts as active everywhere. Scoping is the
 * `(monitor_type, monitor_id)` pair from `~/app/lib/monitor-scope`: a window covers
 * everything, one monitor type, or one monitor of one type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";

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

	/** Whether `window`'s current occurrence covers `now` (recurring-aware). */
	static isActiveAt(window: SelectMaintenanceWindow, now: number): boolean {
		let effectiveEnd = window.ended_early_at ?? window.ends_at;
		if (window.starts_at <= now && effectiveEnd >= now) return true;

		if (window.is_recurring && window.recurring_pattern) {
			let pattern = parseRecurringPattern(window.recurring_pattern);
			if (pattern && isRecurringPatternActive(pattern, new Date(now))) return true;
		}

		return false;
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

/** Parses `"daily:HH:MM-HH:MM"` / `"weekly:<day>:HH:MM-HH:MM"` / `"monthly:<day>:HH:MM-HH:MM"`. */
export function parseRecurringPattern(pattern: string): RecurringPattern | null {
	let daily = DAILY_PATTERN.exec(pattern);
	if (daily?.[1] && daily[2]) return { type: "daily", startTime: daily[1], endTime: daily[2] };

	let weekly = WEEKLY_PATTERN.exec(pattern);
	if (weekly?.[1] && isWeekday(weekly[1]) && weekly[2] && weekly[3]) {
		return { type: "weekly", dayOfWeek: weekly[1], startTime: weekly[2], endTime: weekly[3] };
	}

	let monthly = MONTHLY_PATTERN.exec(pattern);
	if (monthly?.[1] && monthly[2] && monthly[3]) {
		return {
			type: "monthly",
			dayOfMonth: Number(monthly[1]),
			startTime: monthly[2],
			endTime: monthly[3],
		};
	}

	return null;
}

function isWeekday(value: string): value is Weekday {
	return WEEKDAYS.includes(value as Weekday);
}

/** Whether `pattern`'s current occurrence (UTC wall-clock) covers `now`. */
export function isRecurringPatternActive(pattern: RecurringPattern, now: Date): boolean {
	let [startHours, startMinutes] = pattern.startTime.split(":").map(Number);
	let [endHours, endMinutes] = pattern.endTime.split(":").map(Number);
	let startTimeMinutes = (startHours ?? 0) * 60 + (startMinutes ?? 0);
	let endTimeMinutes = (endHours ?? 0) * 60 + (endMinutes ?? 0);
	let currentTimeMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
	let inTimeRange = currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes;

	if (pattern.type === "daily") return inTimeRange;

	if (pattern.type === "weekly") {
		if (!pattern.dayOfWeek) return false;
		return now.getUTCDay() === WEEKDAYS.indexOf(pattern.dayOfWeek) && inTimeRange;
	}

	if (pattern.type === "monthly") {
		if (!pattern.dayOfMonth) return false;
		let daysInMonth = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
		).getUTCDate();
		let targetDayOfMonth = Math.min(pattern.dayOfMonth, daysInMonth);
		return now.getUTCDate() === targetDayOfMonth && inTimeRange;
	}

	return false;
}
