---
title: How to Build an Alert Deduplication System with Cooldowns
excerpt: Prevent notification fatigue by deduplicating alerts with a time based cooldown system.
technologies: drizzle-orm@0.30.0
---

Imagine you're building a monitoring system that sends alerts when services go down. Without proper deduplication, a flapping service (one that goes up and down repeatedly) could trigger dozens of notifications in minutes, overwhelming your users with noise. This [alert fatigue](/articles/designing-alerts-that-dont-cause-fatigue) is a common problem in uptime monitoring, error tracking, and any system that generates alerts based on events.

The solution is a cooldown system: after sending an alert, you suppress duplicate alerts of the same type for a configurable period. This ensures users get notified about issues without being bombarded when a service is unstable.

## Define the Alert Events Table

First, create a table to track every alert event. This serves as both an audit trail and the source of truth for cooldown calculations.

```ts {% path="db/schema.ts" %}
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const alertEvents = sqliteTable(
	"alert_events",
	{
		id: text("id").primaryKey(),
		createdAt: text("created_at").notNull(),
		sentAt: text("sent_at").notNull(),
		alertId: text("alert_id").notNull(),
		monitorId: text("monitor_id").notNull(),
		eventType: text("event_type", {
			enum: ["down", "up", "degraded"],
		}).notNull(),
		status: text("status", {
			enum: ["sent", "skipped_cooldown", "failed"],
		}).notNull(),
		errorMessage: text("error_message"),
	},
	(table) => [
		index("alert_events_alert_id_idx").on(table.alertId),
		index("alert_events_monitor_id_idx").on(table.monitorId),
		index("alert_events_sent_at_idx").on(table.sentAt),
		index("alert_events_alert_monitor_event_sent_idx").on(
			table.alertId,
			table.monitorId,
			table.eventType,
			table.sentAt,
		),
	],
);
```

The `status` field tracks whether an alert was actually sent, skipped due to cooldown, or failed. The `eventType` field maps to [the three states of service health](/articles/the-three-states-of-service-health): down, up, and degraded. The composite index on `alertId`, `monitorId`, `eventType`, and `sentAt` optimizes the cooldown lookup query.

## Check If an Alert Is in Cooldown

Create a function that checks whether a specific alert type is within its cooldown period. The key insight is that cooldown applies per alert, per monitor, and per event type: a "down" alert for Monitor A doesn't affect "up" alerts or alerts for Monitor B.

```ts {% path="app/services/alert-cooldown.ts" %}
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { and, desc, eq, gte } from "drizzle-orm";
import * as schema from "~/db/schema";

const MINUTES_TO_MS = 60 * 1000;

export interface CooldownCheckResult {
	isInCooldown: boolean;
	lastSentAt: Date | null;
	cooldownEndsAt: Date | null;
}

export async function checkAlertCooldown(
	db: DrizzleD1Database<typeof schema>,
	alertId: string,
	monitorId: string,
	eventType: "down" | "up" | "degraded",
	cooldownMinutes: number,
): Promise<CooldownCheckResult> {
	if (cooldownMinutes === 0) {
		return { isInCooldown: false, lastSentAt: null, cooldownEndsAt: null };
	}

	let cooldownMs = cooldownMinutes * MINUTES_TO_MS;
	let cooldownStartTime = new Date(Date.now() - cooldownMs);

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
```

The function queries for the most recent successfully sent alert of the same type within the cooldown window. If one exists, the alert is in cooldown. Returning `cooldownEndsAt` lets callers know when they can retry.

## Record Alert Events

Every alert attempt should be recorded, whether it succeeds, fails, or gets skipped. This creates an audit trail and ensures the cooldown check has accurate data.

```ts {% path="app/services/alert-cooldown.ts" %}
export interface RecordAlertEventParams {
	alertId: string;
	monitorId: string;
	eventType: "down" | "up" | "degraded";
	status: "sent" | "skipped_cooldown" | "failed";
	sentAt: Date;
	errorMessage?: string | null;
}

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
		})
		.returning();

	if (!event) {
		throw new Error("Failed to record alert event");
	}

	return event;
}
```

Recording `skipped_cooldown` events is important for debugging. If users report missing alerts, you can check the audit trail to see if they were suppressed by cooldown.

## Use the Cooldown System

Combine both functions in your alert sending logic. Check cooldown first, then either send the alert or record that it was skipped.

```ts {% path="app/services/send-alert.ts" %}
import { checkAlertCooldown, recordAlertEvent } from "./alert-cooldown";

export async function sendMonitorAlert(
	db: DrizzleD1Database<typeof schema>,
	alert: Alert,
	monitor: Monitor,
	eventType: "down" | "up" | "degraded",
) {
	let cooldownResult = await checkAlertCooldown(
		db,
		alert.id,
		monitor.id,
		eventType,
		alert.cooldownMinutes,
	);

	if (cooldownResult.isInCooldown) {
		await recordAlertEvent(db, {
			alertId: alert.id,
			monitorId: monitor.id,
			eventType,
			status: "skipped_cooldown",
			sentAt: new Date(),
		});
		return { sent: false, reason: "cooldown" };
	}

	try {
		await deliverNotification(alert, monitor, eventType);

		await recordAlertEvent(db, {
			alertId: alert.id,
			monitorId: monitor.id,
			eventType,
			status: "sent",
			sentAt: new Date(),
		});

		return { sent: true };
	} catch (error) {
		await recordAlertEvent(db, {
			alertId: alert.id,
			monitorId: monitor.id,
			eventType,
			status: "failed",
			sentAt: new Date(),
			errorMessage: error instanceof Error ? error.message : "Unknown error",
		});

		return { sent: false, reason: "failed" };
	}
}
```

The pattern is straightforward: check, act, record. Even failed attempts are recorded so you can track delivery issues separately from cooldown behavior.

## Final Thoughts

This cooldown system prevents notification fatigue while maintaining a complete audit trail. The per alert, per monitor, per event type granularity ensures that unrelated alerts don't interfere with each other. Setting `cooldownMinutes` to zero disables the feature entirely for alerts that should always fire. You might also consider adding [grace periods](/articles/designing-grace-periods-for-variance) to avoid alerting on brief transient failures.

For production use, consider adding a cleanup job to delete old alert events and prevent unbounded table growth.
