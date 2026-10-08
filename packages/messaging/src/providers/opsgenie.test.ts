/**
 * Exercises `Opsgenie` over MSW against the Alert API v2's real answers: the create and
 * close requests, the region's origin, a missing key refused before any request, the
 * status mapping, and that no error carries the API key.
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

import { Opsgenie } from "./opsgenie.js";

const ALERTS_URL = "https://api.opsgenie.com/v2/alerts";

const API_KEY = "eb243592-faa2-4ba2-a551q-1afdf565c889";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Opsgenie's answer to every accepted request, processed asynchronously. */
function accepted() {
	return HttpResponse.json(
		{ result: "Request will be processed", took: 0.302, requestId: "43a29c5c-3dbf" },
		{ status: 202 },
	);
}

/** Answers every alert request, recording each request and its body. */
function acceptAlerts(origin = "https://api.opsgenie.com") {
	let seen: { request: Request; body: unknown }[] = [];
	server.use(
		http.post(`${origin}/v2/alerts*`, async ({ request }) => {
			seen.push({ request: request.clone(), body: await request.json() });
			return accepted();
		}),
	);
	return seen;
}

const MESSAGE: Message = {
	title: "api.example.com is down",
	text: "Timed out from **gru**.",
	severity: "warning",
	fields: [{ label: "Region", value: "gru" }],
	links: [{ label: "Open dashboard", url: "https://uptime.example.com/m/1" }],
	key: "incident/8f1c",
	data: { monitorId: "m_1", attempts: 3 },
};

describeDestination({
	name: "Opsgenie",
	capabilities: [],
	create: () => {
		acceptAlerts();
		return new Opsgenie({ apiKey: API_KEY });
	},
	rateLimitNext: (delayMs) =>
		server.use(
			http.post(
				ALERTS_URL,
				() =>
					HttpResponse.json(
						{ message: "You are making too many requests!", took: 0, requestId: "r" },
						{ status: 429, headers: { "Retry-After": String(delayMs / 1000) } },
					),
				{ once: true },
			),
		),
});

describe("Opsgenie", () => {
	test("creates an alert aliased by the message key", async () => {
		let seen = acceptAlerts();

		let sent = await new Opsgenie({
			apiKey: () => API_KEY,
			responders: [{ type: "team", name: "SRE" }],
			tags: ["uptime"],
			source: "uptime",
		}).send(MESSAGE);

		expect(isSuccess(sent) && sent.data.ref).toEqual({
			provider: "opsgenie",
			alias: "incident/8f1c",
			requestId: "43a29c5c-3dbf",
		});
		let request = seen[0]?.request;
		expect(request?.url).toBe(ALERTS_URL);
		expect(request?.headers.get("authorization")).toBe(`GenieKey ${API_KEY}`);
		expect(request?.headers.get("content-type")).toBe("application/json");
		expect(request?.headers.get("traceparent")).toBeNull();
		expect(seen[0]?.body).toEqual({
			message: "api.example.com is down",
			alias: "incident/8f1c",
			description: "Timed out from gru.\n\nOpen dashboard: https://uptime.example.com/m/1",
			priority: "P3",
			details: { Region: "gru", monitorId: "m_1", attempts: "3" },
			responders: [{ type: "team", name: "SRE" }],
			source: "uptime",
			tags: ["uptime"],
		});
	});

	test("closes the alert a resolved message names", async () => {
		let seen = acceptAlerts();

		await new Opsgenie({ apiKey: API_KEY }).send({ ...MESSAGE, state: "resolved" });

		expect(seen[0]?.request.url).toBe(
			"https://api.opsgenie.com/v2/alerts/incident%2F8f1c/close?identifierType=alias",
		);
		expect(seen[0]?.body).toEqual({ note: "api.example.com is down" });
	});

	test("sends to the EU origin for an EU account", async () => {
		let seen = acceptAlerts("https://api.eu.opsgenie.com");

		let sent = await new Opsgenie({ apiKey: API_KEY, region: "eu" }).send(MESSAGE);

		expect(isSuccess(sent)).toBe(true);
		expect(seen[0]?.request.url).toBe("https://api.eu.opsgenie.com/v2/alerts");
	});

	test("cuts the title to Opsgenie's 130-character message and maps critical to P1", () => {
		let rendered = new Opsgenie({ apiKey: API_KEY }).render({
			title: "x".repeat(200),
			severity: "critical",
			key: "k",
		});

		expect(rendered).toEqual({
			path: "v2/alerts",
			body: { message: `${"x".repeat(129)}…`, alias: "k", priority: "P1" },
		});
	});

	test("refuses a message without a key before any request", async () => {
		let sent = await new Opsgenie({ apiKey: API_KEY }).send({ title: "No key" });

		expect(isFailure(sent) && sent.error.code).toBe("invalid-message");
	});

	test.each([
		[401, "unauthorized"],
		[403, "unauthorized"],
		[422, "rejected"],
		[429, "rate-limited"],
		[500, "unavailable"],
	])("maps a %i answer to %s, never naming the key", async (status, code) => {
		server.use(
			http.post(ALERTS_URL, () =>
				HttpResponse.json(
					{ message: `Key ${API_KEY} refused`, took: 0, requestId: "r" },
					{ status },
				),
			),
		);

		let sent = await new Opsgenie({ apiKey: API_KEY }).send(MESSAGE);

		expect(isFailure(sent)).toBe(true);
		if (!isFailure(sent)) return;
		expect(sent.error.code).toBe(code);
		expect(sent.error.status).toBe(status);
		expect(sent.error.host).toBe("api.opsgenie.com");
		expect(sent.error.message).not.toContain(API_KEY);
	});
});
