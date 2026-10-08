/**
 * Exercises `PagerDuty` over MSW against the Events API v2's real answers: the trigger
 * and resolve bodies, a missing key refused before any request, an unknown routing key
 * as `unauthorized`, and that no error carries the routing key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { Message } from "../message.js";

import { describeDestination } from "../conformance.js";

import { PagerDuty } from "./pagerduty.js";

const ENQUEUE_URL = "https://events.pagerduty.com/v2/enqueue";

const ROUTING_KEY = "R0UT1NGK3Y0000000000000000000000";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Answers every event with PagerDuty's `202`, recording each body and request. */
function acceptEvents(bodies: unknown[] = [], requests: Request[] = []) {
	server.use(
		http.post(ENQUEUE_URL, async ({ request }) => {
			requests.push(request.clone());
			let body = (await request.json()) as { dedup_key?: string };
			bodies.push(body);
			return HttpResponse.json(
				{ status: "success", message: "Event processed", dedup_key: body.dedup_key },
				{ status: 202 },
			);
		}),
	);
	return bodies;
}

const MESSAGE: Message = {
	title: "api.example.com is down",
	text: "Timed out from **gru**, see [the log](https://logs.example.com/1).",
	severity: "critical",
	fields: [{ label: "Region", value: "gru", inline: true }],
	links: [{ label: "Open dashboard", url: "https://uptime.example.com/m/1" }],
	timestamp: new Date("2026-10-06T12:00:00.000Z"),
	key: "incident_8f1c",
	data: { monitorId: "m_1" },
};

describeDestination({
	name: "PagerDuty",
	capabilities: [],
	create: () => {
		acceptEvents();
		return new PagerDuty({ routingKey: ROUTING_KEY });
	},
	rateLimitNext: (delayMs) =>
		server.use(
			http.post(
				ENQUEUE_URL,
				() =>
					HttpResponse.json(
						{
							status: "throttle event",
							message: "Requests for this service are arriving too quickly.",
						},
						{ status: 429, headers: { "Retry-After": String(delayMs / 1000) } },
					),
				{ once: true },
			),
		),
});

describe("PagerDuty", () => {
	test("triggers an incident deduplicated by the message key", async () => {
		let requests: Request[] = [];
		let bodies = acceptEvents([], requests);

		let sent = await new PagerDuty({
			routingKey: () => ROUTING_KEY,
			source: "uptime",
			component: "api",
			group: "production",
			class: "http",
		}).send(MESSAGE);

		expect(isSuccess(sent) && sent.data.ref).toEqual({
			provider: "pagerduty",
			dedupKey: "incident_8f1c",
		});
		expect(requests[0]?.headers.get("content-type")).toBe("application/json");
		expect(requests[0]?.headers.get("traceparent")).toBeNull();
		expect(bodies[0]).toEqual({
			routing_key: ROUTING_KEY,
			event_action: "trigger",
			dedup_key: "incident_8f1c",
			payload: {
				summary: "api.example.com is down",
				source: "uptime",
				severity: "critical",
				timestamp: "2026-10-06T12:00:00.000Z",
				component: "api",
				group: "production",
				class: "http",
				custom_details: {
					text: "Timed out from gru, see the log: https://logs.example.com/1.",
					fields: { Region: "gru" },
					monitorId: "m_1",
				},
			},
			links: [{ href: "https://uptime.example.com/m/1", text: "Open dashboard" }],
		});
	});

	test("resolves the incident a resolved message names", async () => {
		let bodies = acceptEvents();

		await new PagerDuty({ routingKey: ROUTING_KEY }).send({ ...MESSAGE, state: "resolved" });

		expect(bodies[0]).toEqual({
			routing_key: ROUTING_KEY,
			event_action: "resolve",
			dedup_key: "incident_8f1c",
		});
	});

	test("renders a minimal message with the default source and severity", () => {
		let event = new PagerDuty({ routingKey: ROUTING_KEY }).render({
			title: "x".repeat(2000),
			severity: "success",
			key: "k",
		});

		expect(event).toEqual({
			event_action: "trigger",
			dedup_key: "k",
			payload: { summary: `${"x".repeat(1023)}…`, source: "sdxc-messaging", severity: "info" },
		});
	});

	test("refuses a message without a key before any request", async () => {
		let sent = await new PagerDuty({ routingKey: ROUTING_KEY }).send({ title: "No key" });

		expect(isFailure(sent) && sent.error.code).toBe("invalid-message");
	});

	test("maps an unknown routing key to unauthorized, never naming it", async () => {
		server.use(
			http.post(ENQUEUE_URL, () =>
				HttpResponse.json(
					{
						status: "invalid event",
						message: "Event object is invalid",
						errors: ["Invalid routing key"],
					},
					{ status: 400 },
				),
			),
		);

		let sent = await new PagerDuty({ routingKey: ROUTING_KEY }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("unauthorized");
		expect(isFailure(sent) && sent.error.message).not.toContain(ROUTING_KEY);
	});

	test("rejects an invalid event, naming PagerDuty's errors without the key", async () => {
		server.use(
			http.post(ENQUEUE_URL, () =>
				HttpResponse.json(
					{
						status: "invalid event",
						message: "Event object is invalid",
						errors: [`'payload.summary' is missing for ${ROUTING_KEY}`],
					},
					{ status: 400 },
				),
			),
		);

		let sent = await new PagerDuty({ routingKey: ROUTING_KEY }).send(MESSAGE);

		expect(isFailure(sent)).toBe(true);
		if (!isFailure(sent)) return;
		expect(sent.error.code).toBe("rejected");
		expect(sent.error.status).toBe(400);
		expect(sent.error.message).toContain("'payload.summary' is missing");
		expect(sent.error.message).not.toContain(ROUTING_KEY);
	});

	test.each([
		[429, "rate-limited"],
		[500, "unavailable"],
		[503, "unavailable"],
	])("maps a %i answer to %s", async (status, code) => {
		server.use(http.post(ENQUEUE_URL, () => new HttpResponse(null, { status })));

		let sent = await new PagerDuty({ routingKey: ROUTING_KEY }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe(code);
		expect(isFailure(sent) && sent.error.host).toBe("events.pagerduty.com");
	});

	test("fails unavailable when the routing key cannot be read", async () => {
		let sent = await new PagerDuty({
			routingKey: () => {
				throw new Error("store down");
			},
		}).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("unavailable");
	});
});
