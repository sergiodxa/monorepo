/**
 * Pins the webhook contract customers verify: the exact JSON body, field for field and in
 * order, and either signature scheme, which an empty secret leaves off. Signatures are
 * recomputed with Web Crypto as a receiver would; MSW intercepts them at a public host.
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

import { destinationFor } from "~/app/services/alerts/destination";
import { alertMessage } from "~/app/services/alerts/message";
import { standardWebhooksSecret, UptimeWebhook } from "~/app/services/uptime-webhook";

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

/**
 * The Standard Webhooks `v1` signature a receiver computes: HMAC-SHA256 over
 * `id.timestamp.body`, keyed by the decoded `whsec_` secret, in base64.
 */
async function expectedStandardSignature(secret: string, headers: Headers, body: string) {
	let encoder = new TextEncoder();
	let keyBytes = Uint8Array.from(atob(secret.slice("whsec_".length)), (char) => char.charCodeAt(0));
	let key = await crypto.subtle.importKey(
		"raw",
		keyBytes,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	let content = `${headers.get("webhook-id")}.${headers.get("webhook-timestamp")}.${body}`;
	let mac = await crypto.subtle.sign("HMAC", key, encoder.encode(content));
	return `v1,${btoa(String.fromCharCode(...new Uint8Array(mac)))}`;
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

	test("signs a Standard Webhooks delivery a receiver verifies with the derived secret", async () => {
		await new UptimeWebhook({
			url: WEBHOOK_URL,
			secret: "shh",
			signature: "standard-webhooks",
		}).send(queuedMessage(), { id: "event-1" });

		let headers = deliveries[0]?.headers ?? new Headers();
		expect(headers.get("webhook-id")).toBe("event-1");
		expect(headers.get("webhook-timestamp")).toMatch(/^\d+$/);
		expect(headers.get("webhook-signature")).toBe(
			await expectedStandardSignature("whsec_c2ho", headers, deliveries[0]?.body ?? ""),
		);
	});

	test("sends no Standard Webhooks headers when the alert has no secret", async () => {
		await new UptimeWebhook({
			url: WEBHOOK_URL,
			secret: "",
			signature: "standard-webhooks",
		}).send(queuedMessage());

		expect(deliveries[0]?.headers.has("webhook-signature")).toBe(false);
		expect(deliveries[0]?.headers.has("webhook-id")).toBe(false);
	});

	test("signs a stored alert with the scheme it was saved with", async () => {
		await destinationFor({
			strategy: "webhook",
			config: { url: WEBHOOK_URL, secret: "shh", signature: "standard-webhooks" },
		}).send(queuedMessage());
		await destinationFor({
			strategy: "webhook",
			config: { url: WEBHOOK_URL, secret: "shh" },
		}).send(queuedMessage());

		expect(deliveries[0]?.headers.get("webhook-signature")).toMatch(/^v1,/);
		expect(deliveries[1]?.headers.get("Webhook-Signature")).toBe(
			await expectedSignature("shh", deliveries[1]?.body ?? ""),
		);
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

describe("standardWebhooksSecret", () => {
	test("encodes any other secret's UTF-8 bytes behind the whsec_ prefix", () => {
		expect(standardWebhooksSecret("shh")).toBe("whsec_c2ho");
		expect(standardWebhooksSecret("whsec_")).toBe("whsec_d2hzZWNf");
	});

	test("keeps a secret already written as whsec_ and base64", () => {
		expect(standardWebhooksSecret("whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw")).toBe(
			"whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
		);
	});
});
