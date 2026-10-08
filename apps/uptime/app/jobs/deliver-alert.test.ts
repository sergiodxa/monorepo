/**
 * Unit tests for the `deliverAlert` job over a real database and a `MemoryDestination`
 * installed through the context: a delivery settles its event and keeps the ref, a
 * retryable failure comes back with the platform's delay or the backoff, the last attempt
 * and every permanent failure settle it as failed, `gone` marks the alert broken, and a
 * recovery edits the incident's original message where the platform can.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Destination } from "@sdxc/messaging";
import type { Database } from "remix/data-table";

import { createEnv } from "@sdxc/cloudflare-mocks";
import { MemoryDestination } from "@sdxc/messaging/memory";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { AlertConfig, SelectAlert, SelectAlertEvent } from "~/database/schema";

vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({}) }));

let { Job, createJobContext } = await import("@sdxc/jobs");
let jobs = (await import("~/app/jobs")).default;
let { Database: JobDatabase } = await import("~/app/jobs/middleware/database");
let { Destinations } = await import("~/app/jobs/middleware/destinations");
let { default: deliverAlert, MAX_ATTEMPTS } = await import("./deliver-alert");
let { default: Alert } = await import("~/app/data/alert");
let { default: AlertEvent } = await import("~/app/data/alert-event");
let { alertMessage } = await import("~/app/services/alert-message");
let { createTestDatabase } = await import("~/app/lib/test/db");
let { alertEvents } = await import("~/database/schema");

const SLACK: AlertConfig = {
	strategy: "slack",
	config: { webhookUrl: "https://hooks.slack.com/services/T000/B000/XXXX" },
};

let db: Database;
let destination: MemoryDestination;
/** Every config the job asked the factory for, so a test can tell which channel it built. */
let built: AlertConfig[] = [];

beforeEach(() => {
	db = createTestDatabase().db;
	destination = new MemoryDestination();
	built = [];
});

async function createAlert(config: AlertConfig = SLACK): Promise<SelectAlert> {
	return await Alert.create(db, "team-1", { monitor_id: null, name: "On call", config });
}

/** Records the event `dispatchAlerts` would have, `agoMs` in the past. */
async function recordEvent(
	alert: SelectAlert,
	eventType: SelectAlertEvent["event_type"],
	status: SelectAlertEvent["status"] = "pending",
	agoMs = 0,
): Promise<SelectAlertEvent> {
	let row = await AlertEvent.record(db, {
		alert_id: alert.id,
		monitor_id: "monitor-1",
		event_type: eventType,
		status,
		error_message: null,
		monitor_type: "http",
		monitor_name: "Homepage",
	});
	let sentAt = Date.now() - agoMs;
	await db.update(alertEvents, row.id, { sent_at: sentAt });
	return { ...row, sent_at: sentAt };
}

function messageFor(eventType: SelectAlertEvent["event_type"]) {
	return alertMessage({
		monitorId: "monitor-1",
		monitorType: "http",
		monitorName: "Homepage",
		eventType,
		snapshot: {
			type: "http",
			responseStatus: 500,
			responseTimeMs: 100,
			expectedStatus: 200,
			url: "https://example.com",
		},
		dashboardUrl: "https://uptime.sergiodxa.com/x",
		incident: null,
		occurredAt: new Date(),
	});
}

/**
 * Runs the handler as the dispatcher would and answers how the run ended: `done`, or the
 * ending it threw (ack or retry), so a test asserts on the decision rather than a throw.
 */
async function run(
	alert: SelectAlert,
	event: SelectAlertEvent,
	options: { attempts?: number; destination?: Destination } = {},
) {
	let ctx = createJobContext(jobs.deliverAlert, {
		id: "message-1",
		attempts: options.attempts ?? 1,
		input: { alertId: alert.id, eventId: event.id, message: messageFor(event.event_type) },
	});
	ctx.set(JobDatabase, db, { property: "database" });
	ctx.set(
		Destinations,
		(config) => {
			built.push(config);
			return options.destination ?? destination;
		},
		{ property: "destinations" },
	);

	try {
		await deliverAlert(ctx);
		return { type: "done" as const };
	} catch (error) {
		if (error instanceof Job.Retry) return { type: "retry" as const, delay: error.delay };
		if (error instanceof Job.Ack) return { type: "ack" as const, reason: error.message };
		throw error;
	}
}

describe("deliverAlert", () => {
	test("sends the message and settles the event as sent with the platform's ref", async () => {
		let alert = await createAlert();
		let event = await recordEvent(alert, "down");

		expect(await run(alert, event)).toEqual({ type: "done" });

		expect(built).toEqual([SLACK]);
		expect(destination.messages).toHaveLength(1);
		expect(destination.last?.message.title).toBe("Homepage is DOWN");
		expect(destination.last?.options?.id).toBe(event.id);

		let settled = await AlertEvent.findById(db, event.id);
		expect(settled?.status).toBe("sent");
		expect(settled?.delivery_ref).toEqual({ provider: "memory", id: "1" });
	});

	test("retries a rate-limited send after the delay the platform asked for", async () => {
		let alert = await createAlert();
		let event = await recordEvent(alert, "down");
		destination.failNext({ code: "rate-limited", status: 429, retryAfter: 42_000 });

		expect(await run(alert, event)).toEqual({ type: "retry", delay: 42_000 });

		expect((await AlertEvent.findById(db, event.id))?.status).toBe("pending");
	});

	test("retries a failure with no named delay on the backoff schedule", async () => {
		let alert = await createAlert();
		let event = await recordEvent(alert, "down");
		destination.failNext({ code: "unavailable", status: 503 });

		let outcome = await run(alert, event, { attempts: 2 });

		expect(outcome.type).toBe("retry");
		expect(outcome.type === "retry" && outcome.delay).toBeGreaterThanOrEqual(48_000);
		expect(outcome.type === "retry" && outcome.delay).toBeLessThanOrEqual(72_000);
	});

	test("settles the event as failed on the last attempt instead of retrying", async () => {
		let alert = await createAlert();
		let event = await recordEvent(alert, "down");
		destination.failNext({ code: "timeout" });

		let outcome = await run(alert, event, { attempts: MAX_ATTEMPTS });

		expect(outcome.type).toBe("ack");
		let settled = await AlertEvent.findById(db, event.id);
		expect(settled?.status).toBe("failed");
		expect(settled?.error_message).toContain("(timeout)");
	});

	test("marks the alert broken and the event failed when the destination is gone", async () => {
		let alert = await createAlert();
		let event = await recordEvent(alert, "down");
		destination.failNext({ code: "gone", message: "slack-webhook answered no_service" });

		expect((await run(alert, event)).type).toBe("ack");

		let broken = await Alert.findById(db, alert.id);
		expect(broken?.broken_at).toEqual(expect.any(Number));
		expect(broken?.broken_reason).toBe("slack-webhook answered no_service");

		let settled = await AlertEvent.findById(db, event.id);
		expect(settled?.status).toBe("failed");
		expect(settled?.error_message).toBe("slack-webhook answered no_service (gone)");
	});

	test("fails a refused credential for good without marking the alert broken", async () => {
		let alert = await createAlert();
		let event = await recordEvent(alert, "down");
		destination.failNext({ code: "unauthorized", status: 403 });

		expect((await run(alert, event)).type).toBe("ack");

		expect((await Alert.findById(db, alert.id))?.broken_at).toBeNull();
		expect((await AlertEvent.findById(db, event.id))?.status).toBe("failed");
	});

	test("acks without sending when the alert was deleted after queueing", async () => {
		let alert = await createAlert();
		let event = await recordEvent(alert, "down");
		await Alert.deleteById(db, alert.id);

		expect((await run(alert, event)).type).toBe("ack");

		expect(destination.messages).toHaveLength(0);
		expect((await AlertEvent.findById(db, event.id))?.status).toBe("failed");
	});

	test("sends nothing twice when a settled event is redelivered", async () => {
		let alert = await createAlert();
		let event = await recordEvent(alert, "down");
		await run(alert, event);

		expect((await run(alert, event)).type).toBe("ack");

		expect(destination.messages).toHaveLength(1);
	});
});

describe("deliverAlert — recovery", () => {
	test("edits the incident's original message where the platform can", async () => {
		destination = new MemoryDestination({ capabilities: ["update"] });
		let alert = await createAlert();
		let down = await recordEvent(alert, "down", "pending", 60_000);
		await run(alert, down);
		let recovery = await recordEvent(alert, "up");

		expect(await run(alert, recovery)).toEqual({ type: "done" });

		expect(destination.messages.map((entry) => entry.kind)).toEqual(["send", "update"]);
		expect(destination.last?.parent).toEqual({ provider: "memory", id: "1" });
		expect(destination.last?.message.state).toBe("resolved");
		expect((await AlertEvent.findById(db, recovery.id))?.status).toBe("sent");
	});

	test("sends the recovery as its own message on a platform that cannot edit", async () => {
		let alert = await createAlert();
		let down = await recordEvent(alert, "down", "pending", 60_000);
		await run(alert, down);
		let recovery = await recordEvent(alert, "up");

		await run(alert, recovery);

		expect(destination.messages.map((entry) => entry.kind)).toEqual(["send", "send"]);
	});

	test("sends the recovery as its own message when the incident left no ref", async () => {
		destination = new MemoryDestination({ capabilities: ["update"] });
		let alert = await createAlert();
		await recordEvent(alert, "down", "failed", 60_000);
		let recovery = await recordEvent(alert, "up");

		await run(alert, recovery);

		expect(destination.messages.map((entry) => entry.kind)).toEqual(["send"]);
	});

	test("sends the recovery when the stored ref belongs to another provider", async () => {
		let alert = await createAlert();
		let down = await recordEvent(alert, "down", "pending", 60_000);
		await AlertEvent.markSent(db, down.id, { provider: "discord-webhook", id: "9" });
		let recovery = await recordEvent(alert, "up");
		destination = new MemoryDestination({ capabilities: ["update"] });

		await run(alert, recovery);

		expect(destination.messages.map((entry) => entry.kind)).toEqual(["send"]);
	});
});
