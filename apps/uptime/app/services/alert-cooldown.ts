import type { DrizzleD1Database } from "drizzle-orm/d1";

import { and, desc, eq, gte } from "drizzle-orm";

import * as schema from "~/db/schema";

const MINUTES_TO_MS = 60 * 1000;

export interface CooldownCheckResult {
	isInCooldown: boolean;
	lastSentAt: Date | null;
	cooldownEndsAt: Date | null;
}

/**
 * Check if an alert is within its cooldown period for a specific monitor and event type.
 * Cooldown is based on the last successfully sent alert of the same type.
 */
export async function checkAlertCooldown(
	db: DrizzleD1Database<typeof schema>,
	alertId: string,
	monitorId: string,
	eventType: "down" | "up" | "degraded",
	cooldownMinutes: number,
): Promise<CooldownCheckResult> {
	// If cooldown is 0 (disabled), always allow
	if (cooldownMinutes === 0) {
		return { isInCooldown: false, lastSentAt: null, cooldownEndsAt: null };
	}

	let cooldownMs = cooldownMinutes * MINUTES_TO_MS;
	let cooldownStartTime = new Date(Date.now() - cooldownMs);

	// Find the last successfully sent alert event of this type
	let lastSentEvents = await db
		.select()
		.from(schema.alertEvents)
		.where(
			and(
				eq(schema.alertEvents.alertId, alertId),
				eq(schema.alertEvents.monitorId, monitorId),
				eq(schema.alertEvents.eventType, eventType),
				eq(schema.alertEvents.status, "sent"),
				gte(schema.alertEvents.sentAt, cooldownStartTime),
			),
		)
		.orderBy(desc(schema.alertEvents.sentAt))
		.limit(1);

	let lastSentEvent = lastSentEvents[0];

	if (!lastSentEvent) {
		return { isInCooldown: false, lastSentAt: null, cooldownEndsAt: null };
	}

	let cooldownEndsAt = new Date(lastSentEvent.sentAt.getTime() + cooldownMs);

	return {
		isInCooldown: true,
		lastSentAt: lastSentEvent.sentAt,
		cooldownEndsAt,
	};
}

export interface RecordAlertEventParams {
	alertId: string;
	monitorId: string;
	eventType: "down" | "up" | "degraded";
	status: "sent" | "skipped_cooldown" | "failed";
	sentAt: Date;
	errorMessage?: string | null;
	// Enhanced context (nullable for backward compatibility)
	monitorType?: "http" | "dns" | "tcp" | "cron" | "ssl";
	monitorName?: string;
	snapshot?: schema.AlertEventSnapshot;
}

/**
 * Record an alert event in the database for audit trail and cooldown tracking.
 */
export async function recordAlertEvent(
	db: DrizzleD1Database<typeof schema>,
	params: RecordAlertEventParams,
): Promise<schema.SelectAlertEvent> {
	let [event] = await db
		.insert(schema.alertEvents)
		.values({
			alertId: params.alertId,
			monitorId: params.monitorId,
			eventType: params.eventType,
			status: params.status,
			sentAt: params.sentAt,
			errorMessage: params.errorMessage ?? null,
			// Enhanced context (nullable for backward compatibility)
			monitorType: params.monitorType ?? null,
			monitorName: params.monitorName ?? null,
			snapshot: params.snapshot ?? null,
		})
		.returning();

	if (!event) {
		throw new Error("Failed to record alert event");
	}

	return event;
}
