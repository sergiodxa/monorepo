/**
 * Tests the alert events model against a migrated in-memory database: recording and settling
 * delivery outcomes, the cooldown and per-incident counts that gate re-firing (a queued
 * `pending` delivery counting as notified), the ref a recovery edits, and the listings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { Pagination } from "@sdxc/pagination";
import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { AlertEventOutcome } from "~/app/models/alert-events";
import type { SelectAlertEvent } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels } from "~/app/lib/test/models";
import { NEWEST_FIRST } from "~/app/services/pagination";
import { alertEvents } from "~/database/schema";

let db: Database;
let models: ReturnType<typeof bindModels>;

beforeEach(() => {
	db = createTestDatabase().db;
	models = bindModels(db);
});

/** Records an outcome, failing the test when the write is refused. */
async function record(values: AlertEventOutcome): Promise<SelectAlertEvent> {
	return unwrap(await models.alertEvents.record(values));
}

/**
 * Records one event for `alert-1`/`monitor-1` backdated by `agoMs`, so a whole incident
 * can be laid out in order — `record()` always stamps `Date.now()`.
 */
async function recordAt(
	agoMs: number,
	event_type: SelectAlertEvent["event_type"],
	status: SelectAlertEvent["status"],
): Promise<SelectAlertEvent> {
	let row = await record({
		alert_id: "alert-1",
		monitor_id: "monitor-1",
		event_type,
		status,
		error_message: null,
		monitor_type: "http",
		monitor_name: "My site",
	});
	let sentAt = Date.now() - agoMs;
	await db.update(alertEvents, row.id, { sent_at: sentAt });
	return { ...row, sent_at: sentAt };
}

describe("alertEvents.record", () => {
	test("records a sent event and returns the created row", async () => {
		let row = await record({
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "down",
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "My site",
		});

		expect(row.id).toBeTruthy();
		expect(row.alert_id).toBe("alert-1");
		expect(row.monitor_id).toBe("monitor-1");
		expect(row.event_type).toBe("down");
		expect(row.status).toBe("sent");
		expect(row.monitor_type).toBe("http");
		expect(row.monitor_name).toBe("My site");
		expect(row.snapshot).toBeNull();
		expect(typeof row.sent_at).toBe("number");
		expect(typeof row.created_at).toBe("number");
	});

	test("records a snapshot and round-trips it as an object", async () => {
		let row = await record({
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "down",
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "My site",
			snapshot: {
				type: "http",
				responseStatus: 500,
				responseTimeMs: 1200,
				expectedStatus: 200,
				url: "https://example.com",
			},
		});

		expect(row.snapshot).toEqual({
			type: "http",
			responseStatus: 500,
			responseTimeMs: 1200,
			expectedStatus: 200,
			url: "https://example.com",
		});
	});

	test("records a failed delivery with an error message", async () => {
		let row = await record({
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "up",
			status: "failed",
			error_message: "webhook timed out",
			monitor_type: null,
			monitor_name: null,
		});

		expect(row.status).toBe("failed");
		expect(row.error_message).toBe("webhook timed out");
	});
});

describe("alertEvents.isInCooldown", () => {
	test("returns false immediately when cooldownMinutes is 0, without matching any row", async () => {
		await record({
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "down",
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "My site",
		});

		let inCooldown = await models.alertEvents.isInCooldown("alert-1", "monitor-1", "down", 0);
		expect(inCooldown).toBe(false);
	});

	test("returns false when no matching event exists", async () => {
		let inCooldown = await models.alertEvents.isInCooldown("alert-1", "monitor-1", "down", 30);
		expect(inCooldown).toBe(false);
	});

	test("returns true when a matching sent event exists within the cooldown window", async () => {
		await record({
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "down",
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "My site",
		});

		let inCooldown = await models.alertEvents.isInCooldown("alert-1", "monitor-1", "down", 30);
		expect(inCooldown).toBe(true);
	});

	test("returns false when the matching event is outside the cooldown window", async () => {
		let row = await record({
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "down",
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "My site",
		});

		/**
		 * Backdate `sent_at` past the 30-minute cooldown window — `record()` always
		 * stamps `Date.now()`, so this is the only way to exercise the boundary.
		 */
		await db.update(alertEvents, row.id, { sent_at: Date.now() - 31 * 60_000 });

		let inCooldown = await models.alertEvents.isInCooldown("alert-1", "monitor-1", "down", 30);
		expect(inCooldown).toBe(false);
	});

	test("ignores events for a different alert, monitor, or event type", async () => {
		await record({
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "down",
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "My site",
		});

		expect(await models.alertEvents.isInCooldown("alert-2", "monitor-1", "down", 30)).toBe(false);
		expect(await models.alertEvents.isInCooldown("alert-1", "monitor-2", "down", 30)).toBe(false);
		expect(await models.alertEvents.isInCooldown("alert-1", "monitor-1", "up", 30)).toBe(false);
	});

	test("ignores events whose status isn't sent", async () => {
		await record({
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "down",
			status: "skipped_cooldown",
			error_message: null,
			monitor_type: "http",
			monitor_name: "My site",
		});
		await record({
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "down",
			status: "failed",
			error_message: "boom",
			monitor_type: "http",
			monitor_name: "My site",
		});

		let inCooldown = await models.alertEvents.isInCooldown("alert-1", "monitor-1", "down", 30);
		expect(inCooldown).toBe(false);
	});
});

describe("alertEvents.latestForAlerts", () => {
	test("returns an empty array for an empty id list without querying", async () => {
		expect(await models.alertEvents.latestForAlerts([], 10)).toEqual([]);
	});

	test("lists events across multiple alerts, newest first", async () => {
		let first = await record({
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "down",
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "My site",
		});
		let second = await record({
			alert_id: "alert-2",
			monitor_id: "monitor-2",
			event_type: "up",
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "Other site",
		});
		/** A third alert, outside the requested ids, is the control for the scoping. */
		await record({
			alert_id: "alert-3",
			monitor_id: "monitor-3",
			event_type: "down",
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "Excluded site",
		});

		await db.update(alertEvents, first.id, { sent_at: Date.now() - 60_000 });

		let events = await models.alertEvents.latestForAlerts(["alert-1", "alert-2"], 10);
		expect(events.map((event) => event.id)).toEqual([second.id, first.id]);
	});

	test("respects the limit argument", async () => {
		for (let index = 0; index < 3; index++) {
			let row = await record({
				alert_id: "alert-1",
				monitor_id: "monitor-1",
				event_type: "down",
				status: "sent",
				error_message: null,
				monitor_type: "http",
				monitor_name: "My site",
			});
			await db.update(alertEvents, row.id, { sent_at: Date.now() - index * 1000 });
		}

		let events = await models.alertEvents.latestForAlerts(["alert-1"], 2);
		expect(events).toHaveLength(2);
	});
});

describe("alertEvents.countSentSinceRecovery", () => {
	test("returns 0 when the pair has no events at all", async () => {
		expect(
			await models.alertEvents.countSentSinceRecovery("alert-1", "monitor-1", "down", 10),
		).toBe(0);
	});

	test("counts every sent event when the pair has never recovered", async () => {
		await recordAt(3000, "down", "sent");
		await recordAt(2000, "down", "sent");

		expect(
			await models.alertEvents.countSentSinceRecovery("alert-1", "monitor-1", "down", 10),
		).toBe(2);
	});

	test("counts only the sent events after the last recovery", async () => {
		await recordAt(5000, "down", "sent");
		await recordAt(4000, "down", "sent");
		await recordAt(3000, "up", "sent");
		await recordAt(2000, "down", "sent");

		expect(
			await models.alertEvents.countSentSinceRecovery("alert-1", "monitor-1", "down", 10),
		).toBe(1);
	});

	test("ignores suppressed and failed attempts, and other event types", async () => {
		await recordAt(4000, "down", "skipped_cooldown");
		await recordAt(3000, "down", "skipped_cap");
		await recordAt(2000, "down", "failed");
		await recordAt(1000, "degraded", "sent");

		expect(
			await models.alertEvents.countSentSinceRecovery("alert-1", "monitor-1", "down", 10),
		).toBe(0);
	});

	test("stops counting at the limit instead of reading the whole incident", async () => {
		for (let index = 0; index < 5; index++) await recordAt(5000 - index * 100, "down", "sent");

		expect(await models.alertEvents.countSentSinceRecovery("alert-1", "monitor-1", "down", 3)).toBe(
			3,
		);
	});
});

describe("alertEvents.summarizeIncident", () => {
	test("reports zero for a monitor with no history", async () => {
		expect(await models.alertEvents.summarizeIncident("alert-1", "monitor-1")).toEqual({
			sent: 0,
			suppressed: 0,
		});
	});

	test("splits the current incident into sent and suppressed, ignoring the previous one", async () => {
		await recordAt(9000, "down", "sent");
		await recordAt(8000, "down", "skipped_cooldown");
		await recordAt(7000, "up", "sent");
		await recordAt(6000, "down", "sent");
		await recordAt(5000, "down", "skipped_cooldown");
		await recordAt(4000, "down", "skipped_cap");
		await recordAt(3000, "degraded", "skipped_cap");
		await recordAt(2000, "down", "failed");

		expect(await models.alertEvents.summarizeIncident("alert-1", "monitor-1")).toEqual({
			sent: 1,
			suppressed: 3,
		});
	});
});

describe("pending deliveries count as notified", () => {
	test("a queued delivery holds the alert in its cooldown", async () => {
		await recordAt(1000, "down", "pending");

		expect(await models.alertEvents.isInCooldown("alert-1", "monitor-1", "down", 30)).toBe(true);
	});

	test("a queued delivery makes the next check a repeat rather than the incident's first", async () => {
		await recordAt(1000, "down", "pending");

		expect(await models.alertEvents.countSentSinceRecovery("alert-1", "monitor-1", "down", 1)).toBe(
			1,
		);
	});

	test("a recovery reports a queued delivery among the incident's sent notifications", async () => {
		await recordAt(3000, "down", "pending");
		await recordAt(2000, "down", "sent");
		await recordAt(1000, "down", "skipped_cooldown");

		expect(await models.alertEvents.summarizeIncident("alert-1", "monitor-1")).toEqual({
			sent: 2,
			suppressed: 1,
		});
	});
});

describe("alertEvents.markSent / markFailed", () => {
	test("settles a pending delivery as sent and keeps the platform's ref", async () => {
		let event = await recordAt(0, "down", "pending");

		await models.alertEvents.markSent(event.id, { provider: "discord-webhook", id: "m-1" });

		let settled = await models.alertEvents.find(event.id);
		expect(settled?.status).toBe("sent");
		expect(settled?.delivery_ref).toEqual({ provider: "discord-webhook", id: "m-1" });
	});

	test("settles a pending delivery as failed with the reason", async () => {
		let event = await recordAt(0, "down", "pending");

		await models.alertEvents.markFailed(event.id, "Slack answered no_service (gone)");

		let settled = await models.alertEvents.find(event.id);
		expect(settled?.status).toBe("failed");
		expect(settled?.error_message).toBe("Slack answered no_service (gone)");
	});
});

describe("alertEvents.refForRecovery", () => {
	test("answers the ref of the newest delivered notification of the incident", async () => {
		let first = await recordAt(5000, "down", "pending");
		await models.alertEvents.markSent(first.id, { provider: "memory", id: "1" });
		let repeat = await recordAt(4000, "down", "pending");
		await models.alertEvents.markSent(repeat.id, { provider: "memory", id: "2" });
		let recovery = await recordAt(1000, "up", "pending");

		expect(await models.alertEvents.refForRecovery(recovery)).toEqual({
			provider: "memory",
			id: "2",
		});
	});

	test("answers null when the incident's notifications landed with no ref", async () => {
		let down = await recordAt(5000, "down", "pending");
		await models.alertEvents.markSent(down.id, null);
		let recovery = await recordAt(1000, "up", "pending");

		expect(await models.alertEvents.refForRecovery(recovery)).toBeNull();
	});

	test("never reaches back into an incident a previous recovery closed", async () => {
		let old = await recordAt(9000, "down", "pending");
		await models.alertEvents.markSent(old.id, { provider: "memory", id: "old" });
		await recordAt(8000, "up", "sent");
		await recordAt(5000, "down", "failed");
		let recovery = await recordAt(1000, "up", "pending");

		expect(await models.alertEvents.refForRecovery(recovery)).toBeNull();
	});
});

describe("alertEvents.forAlert / forMonitor", () => {
	test("pages one alert's events newest first, leaving the ordering to the pager", async () => {
		let older = await recordAt(2000, "down", "sent");
		let newer = await recordAt(1000, "up", "sent");
		await record({
			alert_id: "alert-2",
			monitor_id: "monitor-1",
			event_type: "down",
			status: "sent",
		});
		await db.update(alertEvents, older.id, { created_at: Date.now() - 60_000 });

		let page = unwrap(
			await Pagination.byKeyset(models.alertEvents.forAlert("alert-1"), {
				orderBy: NEWEST_FIRST,
				limit: 10,
			}),
		);
		expect(page.items.map((event) => event.id)).toEqual([newer.id, older.id]);
	});

	test("selects one monitor's events and none of another monitor's", async () => {
		let mine = await recordAt(0, "down", "sent");
		await record({
			alert_id: "alert-1",
			monitor_id: "monitor-2",
			event_type: "down",
			status: "sent",
		});

		let rows = await models.alertEvents.forMonitor("monitor-1").all();
		expect(rows.map((event) => event.id)).toEqual([mine.id]);
	});
});
