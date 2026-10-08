/**
 * Pins the webhook contract customers verify: the exact JSON body, field for field and in
 * order, and the `Webhook-Signature: sha256=<hex>` header keyed by the raw secret, which an
 * empty secret leaves off. Deliveries are intercepted with MSW at a public host.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MESSAGE_SCHEMA } from "@sdxc/messaging";
import { isFailure, isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import * as s from "remix/data-schema";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { AlertEventSnapshot } from "~/database/schema";

import { alertMessage } from "~/app/services/alert-message";
import { UptimeWebhook } from "~/app/services/uptime-webhook";

const WEBHOOK_URL = "https://hooks.acme-receiver.com/uptime";

const OCCURRED_AT = new Date("2026-10-07T12:00:00.000Z");

const SNAPSHOT: AlertEventSnapshot = {
	type: "http",
	responseStatus: 500,
	responseTimeMs: 1200,
	expectedStatus: 200,
	url: "https://example.com",
};

/** One delivery as it went on the wire. */
interface Delivery {
	headers: Headers;
	body: string;
}

let deliveries: Delivery[] = [];

/** Records each POST and answers `status`. */
function receiver(status = 200) {
	return http.post(WEBHOOK_URL, async ({ request }) => {
		deliveries.push({ headers: request.headers, body: await request.text() });
		return new HttpResponse(null, { status });
	});
}

let server = setupServer(receiver());

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
	deliveries = [];
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The message `dispatchAlerts` builds, round-tripped through JSON as the queue carries it. */
function queuedMessage(incident: { sent: number; suppressed: number } | null = null) {
	let built = alertMessage({
		monitorId: "monitor-1",
		monitorType: "http",
		monitorName: "Homepage",
		eventType: incident ? "up" : "down",
		snapshot: SNAPSHOT,
		dashboardUrl: "https://uptime.sergiodxa.com/app/team-1/monitors/monitor-1",
		incident,
		occurredAt: OCCURRED_AT,
	});
	return s.parse(MESSAGE_SCHEMA, JSON.parse(JSON.stringify(built)));
}

/** An HMAC-SHA256 computed independently of the code under test, as a receiver would. */
async function expectedSignature(secret: string, body: string): Promise<string> {
	let encoder = new TextEncoder();
	let key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	let mac = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
	let hex = [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
	return `sha256=${hex}`;
}

describe("UptimeWebhook", () => {
	test("posts exactly the body customers have always received", async () => {
		let sent = await new UptimeWebhook({ url: WEBHOOK_URL, secret: "" }).send(queuedMessage(), {
			id: "event-1",
		});

		expect(isSuccess(sent)).toBe(true);
		expect(deliveries).toHaveLength(1);
		expect(deliveries[0]?.body).toBe(
			JSON.stringify({
				monitorId: "monitor-1",
				monitorType: "http",
				monitorName: "Homepage",
				eventType: "down",
				snapshot: SNAPSHOT,
				message: [
					"Monitor: Homepage (http)",
					"Status: DOWN",
					"URL: https://example.com",
					"Response status: 500 (expected 200)",
					"Response time: 1200ms",
					"Time: 2026-10-07T12:00:00.000Z",
					"Dashboard: https://uptime.sergiodxa.com/app/team-1/monitors/monitor-1",
				].join("\n"),
				timestamp: "2026-10-07T12:00:00.000Z",
			}),
		);
		expect(deliveries[0]?.headers.get("Content-Type")).toBe("application/json");
	});

	test("signs the body with an HMAC-SHA256 keyed by the raw secret", async () => {
		await new UptimeWebhook({ url: WEBHOOK_URL, secret: "shh" }).send(queuedMessage());

		let delivery = deliveries[0];
		expect(delivery).toBeDefined();
		expect(delivery?.headers.get("Webhook-Signature")).toBe(
			await expectedSignature("shh", delivery?.body ?? ""),
		);
		expect(delivery?.headers.has("webhook-id")).toBe(false);
	});

	test("sends no signature header when the alert has no secret", async () => {
		await new UptimeWebhook({ url: WEBHOOK_URL, secret: "" }).send(queuedMessage());

		expect(deliveries[0]?.headers.has("Webhook-Signature")).toBe(false);
	});

	test("ends a recovery's text with the incident totals, after the dashboard link", async () => {
		await new UptimeWebhook({ url: WEBHOOK_URL, secret: "" }).send(
			queuedMessage({ sent: 2, suppressed: 7 }),
		);

		let body = JSON.parse(deliveries[0]?.body ?? "{}") as { eventType: string; message: string };
		expect(body.eventType).toBe("up");
		expect(body.message).toBe(
			[
				"Monitor: Homepage (http)",
				"Status: RECOVERED",
				"URL: https://example.com",
				"Response status: 500 (expected 200)",
				"Response time: 1200ms",
				"Time: 2026-10-07T12:00:00.000Z",
				"Dashboard: https://uptime.sergiodxa.com/app/team-1/monitors/monitor-1",
				"",
				"Notifications for this incident: 2 sent, 7 held back by the alert's cooldown.",
			].join("\n"),
		);
	});

	test("answers a retryable failure when the receiver errors", async () => {
		server.use(receiver(503));

		let sent = await new UptimeWebhook({ url: WEBHOOK_URL, secret: "" }).send(queuedMessage());

		expect(isFailure(sent) && sent.error.code).toBe("unavailable");
		expect(isFailure(sent) && sent.error.retryable).toBe(true);
	});

	test("answers gone when the receiver says the hook was removed", async () => {
		server.use(receiver(410));

		let sent = await new UptimeWebhook({ url: WEBHOOK_URL, secret: "" }).send(queuedMessage());

		expect(isFailure(sent) && sent.error.code).toBe("gone");
	});

	test("refuses a private address before any request", async () => {
		let sent = await new UptimeWebhook({ url: "http://10.0.0.1/hook", secret: "" }).send(
			queuedMessage(),
		);

		expect(isFailure(sent) && sent.error.code).toBe("invalid-destination");
		expect(deliveries).toHaveLength(0);
	});
});
