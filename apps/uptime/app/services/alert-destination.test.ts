/**
 * Tests that each stored channel maps to the destination that speaks its platform, and
 * that a PagerDuty alert reaches the Events API with its routing key and resolves the
 * incident under the same key a recovery carries. PagerDuty is intercepted with MSW.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { destinationFor } from "~/app/services/alert-destination";
import { alertMessage } from "~/app/services/alert-message";

/** Every event PagerDuty received, parsed. */
let events: Record<string, unknown>[] = [];

let server = setupServer(
	http.post("https://events.pagerduty.com/v2/enqueue", async ({ request }) => {
		let event = (await request.json()) as Record<string, unknown>;
		events.push(event);
		return HttpResponse.json(
			{ status: "success", message: "Event processed", dedup_key: event["dedup_key"] },
			{ status: 202 },
		);
	}),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
	events = [];
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function message(eventType: "down" | "up") {
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
		occurredAt: new Date("2026-10-07T12:00:00.000Z"),
	});
}

describe("destinationFor", () => {
	test("maps each channel to its platform's provider", () => {
		let url = "https://hooks.slack.com/services/T000/B000/XXXX";
		expect(destinationFor({ strategy: "slack", config: { webhookUrl: url } }).provider).toBe(
			"slack-webhook",
		);
		expect(
			destinationFor({
				strategy: "discord",
				config: { webhookUrl: "https://discord.com/api/webhooks/1/abc" },
			}).provider,
		).toBe("discord-webhook");
		expect(destinationFor({ strategy: "pagerduty", config: { routingKey: "rk" } }).provider).toBe(
			"pagerduty",
		);
		expect(
			destinationFor({ strategy: "webhook", config: { url: "https://acme.com/hook", secret: "" } })
				.provider,
		).toBe("uptime-webhook");
	});

	test("triggers a PagerDuty incident keyed by the monitor, then resolves it on recovery", async () => {
		let pagerduty = destinationFor({ strategy: "pagerduty", config: { routingKey: "R0UTING" } });

		let opened = await pagerduty.send(message("down"));
		let resolved = await pagerduty.send(message("up"));

		expect(isSuccess(opened) && isSuccess(resolved)).toBe(true);
		expect(events[0]).toMatchObject({
			routing_key: "R0UTING",
			event_action: "trigger",
			dedup_key: "http:monitor-1",
			payload: {
				summary: "Homepage is DOWN",
				severity: "critical",
				source: "uptime.sergiodxa.com",
			},
		});
		expect(events[1]).toEqual({
			routing_key: "R0UTING",
			event_action: "resolve",
			dedup_key: "http:monitor-1",
		});
	});
});
