import { and, eq, gte, isNull, lte, or } from "drizzle-orm";

import type { Database } from "~/db";
import type { SelectMaintenanceWindow } from "~/db/schema";

import * as schema from "~/db/schema";

export interface MaintenanceStatus {
	isInMaintenance: boolean;
	activeWindow: SelectMaintenanceWindow | null;
	suppressAlerts: boolean;
}

/**
 * Check if a specific monitor is currently in a maintenance window
 */
export async function checkMonitorMaintenance(
	db: Database,
	monitorId: string,
	teamId: string,
	now: Date = new Date(),
): Promise<MaintenanceStatus> {
	let effectiveEndTime = now;

	// Find active maintenance windows that apply to this monitor
	// A window applies if:
	// 1. monitorId is null (applies to all monitors) OR monitorId matches
	// 2. startsAt <= now AND endsAt > now
	// 3. endedEarlyAt is null (not ended early) OR endedEarlyAt > now
	let activeWindow = await db.query.maintenanceWindows.findFirst({
		where: and(
			eq(schema.maintenanceWindows.teamId, teamId),
			or(
				isNull(schema.maintenanceWindows.monitorId),
				eq(schema.maintenanceWindows.monitorId, monitorId),
			),
			lte(schema.maintenanceWindows.startsAt, effectiveEndTime),
			gte(schema.maintenanceWindows.endsAt, effectiveEndTime),
			or(
				isNull(schema.maintenanceWindows.endedEarlyAt),
				gte(schema.maintenanceWindows.endedEarlyAt, effectiveEndTime),
			),
		),
		orderBy(fields, operators) {
			return operators.desc(fields.startsAt);
		},
	});

	// Handle recurring maintenance windows
	if (!activeWindow) {
		let recurringWindow = await findActiveRecurringWindow(db, teamId, monitorId, now);
		if (recurringWindow) {
			activeWindow = recurringWindow;
		}
	}

	return {
		isInMaintenance: !!activeWindow,
		activeWindow: activeWindow ?? null,
		suppressAlerts: activeWindow?.suppressAlerts ?? false,
	};
}

/**
 * Check if any active maintenance window exists for a team
 */
export async function checkTeamMaintenance(
	db: Database,
	teamId: string,
	now: Date = new Date(),
): Promise<MaintenanceStatus> {
	let effectiveEndTime = now;

	let activeWindow = await db.query.maintenanceWindows.findFirst({
		where: and(
			eq(schema.maintenanceWindows.teamId, teamId),
			lte(schema.maintenanceWindows.startsAt, effectiveEndTime),
			gte(schema.maintenanceWindows.endsAt, effectiveEndTime),
			or(
				isNull(schema.maintenanceWindows.endedEarlyAt),
				gte(schema.maintenanceWindows.endedEarlyAt, effectiveEndTime),
			),
		),
		orderBy(fields, operators) {
			return operators.desc(fields.startsAt);
		},
	});

	// Handle recurring maintenance windows
	if (!activeWindow) {
		let recurringWindow = await findActiveRecurringWindow(db, teamId, null, now);
		if (recurringWindow) {
			activeWindow = recurringWindow;
		}
	}

	return {
		isInMaintenance: !!activeWindow,
		activeWindow: activeWindow ?? null,
		suppressAlerts: activeWindow?.suppressAlerts ?? false,
	};
}

/**
 * Get all active maintenance windows for a team
 */
export async function getActiveMaintenanceWindows(
	db: Database,
	teamId: string,
	now: Date = new Date(),
): Promise<SelectMaintenanceWindow[]> {
	let effectiveEndTime = now;

	let windows = await db.query.maintenanceWindows.findMany({
		where: and(
			eq(schema.maintenanceWindows.teamId, teamId),
			lte(schema.maintenanceWindows.startsAt, effectiveEndTime),
			gte(schema.maintenanceWindows.endsAt, effectiveEndTime),
			or(
				isNull(schema.maintenanceWindows.endedEarlyAt),
				gte(schema.maintenanceWindows.endedEarlyAt, effectiveEndTime),
			),
		),
		orderBy(fields, operators) {
			return operators.desc(fields.startsAt);
		},
	});

	return windows;
}

/**
 * Parse recurring pattern string
 * Format: "weekly:monday:02:00-04:00" or "daily:02:00-04:00" or "monthly:15:02:00-04:00"
 */
export function parseRecurringPattern(pattern: string): RecurringPattern | null {
	let parts = pattern.split(":");

	if (parts[0] === "daily") {
		// Format: "daily:HH:MM-HH:MM"
		let timeRange = parts.slice(1).join(":");
		let [startTime, endTime] = timeRange.split("-");
		if (!startTime || !endTime) return null;

		return {
			type: "daily",
			startTime,
			endTime,
		};
	}

	if (parts[0] === "weekly") {
		// Format: "weekly:dayOfWeek:HH:MM-HH:MM"
		let dayOfWeek = parts[1];
		let timeRange = parts.slice(2).join(":");
		let [startTime, endTime] = timeRange.split("-");
		if (!dayOfWeek || !startTime || !endTime) return null;

		return {
			type: "weekly",
			dayOfWeek: dayOfWeek.toLowerCase() as DayOfWeek,
			startTime,
			endTime,
		};
	}

	if (parts[0] === "monthly") {
		// Format: "monthly:dayOfMonth:HH:MM-HH:MM"
		let dayOfMonthStr = parts[1];
		let dayOfMonth = Number.parseInt(dayOfMonthStr ?? "", 10);
		let timeRange = parts.slice(2).join(":");
		let [startTime, endTime] = timeRange.split("-");
		if (!dayOfMonthStr || Number.isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31)
			return null;
		if (!startTime || !endTime) return null;

		return {
			type: "monthly",
			dayOfMonth,
			startTime,
			endTime,
		};
	}

	return null;
}

type DayOfWeek = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

interface RecurringPattern {
	type: "daily" | "weekly" | "monthly";
	dayOfWeek?: DayOfWeek;
	dayOfMonth?: number; // 1-31 for monthly patterns
	startTime: string; // "HH:MM" format
	endTime: string; // "HH:MM" format
}

const DAY_MAP: Record<DayOfWeek, number> = {
	sunday: 0,
	monday: 1,
	tuesday: 2,
	wednesday: 3,
	thursday: 4,
	friday: 5,
	saturday: 6,
};

/**
 * Check if a recurring pattern is currently active
 */
export function isRecurringPatternActive(pattern: RecurringPattern, now: Date): boolean {
	let currentDay = now.getUTCDay();
	let currentDayOfMonth = now.getUTCDate();
	let currentHours = now.getUTCHours();
	let currentMinutes = now.getUTCMinutes();
	let currentTimeMinutes = currentHours * 60 + currentMinutes;

	let startParts = pattern.startTime.split(":").map(Number);
	let endParts = pattern.endTime.split(":").map(Number);
	let startHours = startParts[0] ?? 0;
	let startMinutes = startParts[1] ?? 0;
	let endHours = endParts[0] ?? 0;
	let endMinutes = endParts[1] ?? 0;
	let startTimeMinutes = startHours * 60 + startMinutes;
	let endTimeMinutes = endHours * 60 + endMinutes;

	if (pattern.type === "daily") {
		return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes;
	}

	if (pattern.type === "weekly" && pattern.dayOfWeek) {
		let targetDay = DAY_MAP[pattern.dayOfWeek];
		if (currentDay !== targetDay) return false;
		return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes;
	}

	if (pattern.type === "monthly" && pattern.dayOfMonth) {
		// Handle end of month edge case: if dayOfMonth > days in current month, use last day
		let daysInMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate();
		let targetDayOfMonth = Math.min(pattern.dayOfMonth, daysInMonth);
		if (currentDayOfMonth !== targetDayOfMonth) return false;
		return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes;
	}

	return false;
}

/**
 * Find an active recurring maintenance window
 */
async function findActiveRecurringWindow(
	db: Database,
	teamId: string,
	monitorId: string | null,
	now: Date,
): Promise<SelectMaintenanceWindow | null> {
	let whereCondition =
		monitorId !== null
			? and(
					eq(schema.maintenanceWindows.teamId, teamId),
					or(
						isNull(schema.maintenanceWindows.monitorId),
						eq(schema.maintenanceWindows.monitorId, monitorId),
					),
					eq(schema.maintenanceWindows.isRecurring, true),
				)
			: and(
					eq(schema.maintenanceWindows.teamId, teamId),
					eq(schema.maintenanceWindows.isRecurring, true),
				);

	let recurringWindows = await db.query.maintenanceWindows.findMany({
		where: whereCondition,
	});

	for (let window of recurringWindows) {
		if (!window.recurringPattern) continue;

		let pattern = parseRecurringPattern(window.recurringPattern);
		if (!pattern) continue;

		if (isRecurringPatternActive(pattern, now)) {
			return window;
		}
	}

	return null;
}
