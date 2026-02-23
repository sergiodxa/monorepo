---
title: How to Implement Recurring Maintenance Windows
excerpt: Build a pattern matching system for daily, weekly, and monthly maintenance schedules.
technologies: date-fns@3.0.0
---

Imagine you're building an uptime monitoring service where users need to schedule recurring maintenance windows. During these windows, the system should suppress alerts because downtime is expected. Treating [maintenance windows as a first-class concept](/articles/maintenance-windows-as-a-first-class-concept) prevents false positives and reduces alert fatigue. Users might want maintenance every night at 2 AM, every Sunday morning, or on the 15th of each month.

The challenge is parsing a human-readable pattern string like `"weekly:monday:02:00-04:00"` and determining if the current time falls within that window. You need to handle daily, weekly, and monthly patterns, each with different matching logic.

## Define the Pattern Types

```ts {% path="app/services/check-maintenance.ts" %}
type DayOfWeek = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

interface RecurringPattern {
	type: "daily" | "weekly" | "monthly";
	dayOfWeek?: DayOfWeek;
	dayOfMonth?: number;
	startTime: string;
	endTime: string;
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
```

The `RecurringPattern` interface represents a parsed maintenance window. The `type` determines which fields are relevant: daily patterns only need times, weekly patterns need a day of the week, and monthly patterns need a day of the month. The `DAY_MAP` maps day names to JavaScript's `getUTCDay()` values where Sunday is 0.

## Parse the Pattern String

```ts {% path="app/services/check-maintenance.ts" %}
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
```

The parser splits the pattern string by colons and extracts the relevant parts based on the pattern type. For daily patterns like `"daily:02:00-04:00"`, it extracts just the time range. For weekly patterns like `"weekly:monday:02:00-04:00"`, it extracts the day name and time range. For monthly patterns like `"monthly:15:02:00-04:00"`, it extracts the day number and time range. The function returns `null` for invalid patterns.

## Check if a Pattern Is Active

```ts {% path="app/services/check-maintenance.ts" %}
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
```

This function converts both the current time and the pattern times to minutes since midnight for easy comparison. For daily patterns, it only checks if the current time falls within the range. For weekly patterns, it first verifies the day of the week matches before checking the time. For monthly patterns, it handles an edge case: if the pattern specifies day 31 but the current month only has 30 days, it uses the last day of the month instead.

## Find Active Recurring Windows

```ts {% path="app/services/check-maintenance.ts" %}
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
```

This function queries all recurring maintenance windows from the database and checks each one against the current time. It first filters by team and optionally by monitor (windows with `monitorId` set to null apply to all monitors). Then it iterates through the results, parsing each pattern and checking if it's currently active. The first matching window is returned.

## Integrate with Maintenance Checks

```ts {% path="app/services/check-maintenance.ts" %}
export interface MaintenanceStatus {
	isInMaintenance: boolean;
	activeWindow: SelectMaintenanceWindow | null;
	suppressAlerts: boolean;
}

export async function checkMonitorMaintenance(
	db: Database,
	monitorId: string,
	teamId: string,
	now: Date = new Date(),
): Promise<MaintenanceStatus> {
	// First check for one-time maintenance windows
	let activeWindow = await db.query.maintenanceWindows.findFirst({
		where: and(
			eq(schema.maintenanceWindows.teamId, teamId),
			or(
				isNull(schema.maintenanceWindows.monitorId),
				eq(schema.maintenanceWindows.monitorId, monitorId),
			),
			lte(schema.maintenanceWindows.startsAt, now),
			gte(schema.maintenanceWindows.endsAt, now),
			or(
				isNull(schema.maintenanceWindows.endedEarlyAt),
				gte(schema.maintenanceWindows.endedEarlyAt, now),
			),
		),
	});

	// Fall back to recurring windows if no one-time window is active
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
```

The main check function first looks for one-time maintenance windows with explicit start and end dates. If none are found, it falls back to checking recurring patterns. This allows users to have both scheduled recurring maintenance and ad-hoc one-time windows. The `suppressAlerts` flag tells the monitoring system whether to send notifications during this window, helping to [prevent alert fatigue](/articles/designing-alerts-that-dont-cause-fatigue).

## Example Usage

Here are some example pattern strings you can use:

```txt
daily:02:00-04:00           # Every day from 2 AM to 4 AM UTC
weekly:sunday:03:00-05:00   # Every Sunday from 3 AM to 5 AM UTC
monthly:1:00:00-02:00       # First day of each month from midnight to 2 AM UTC
monthly:31:22:00-23:59      # Last day of each month from 10 PM to midnight UTC
```

The monthly pattern with day 31 automatically adjusts to the last day of shorter months, so it works correctly for February (28 or 29), April (30), and other months with fewer than 31 days.
