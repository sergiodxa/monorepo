/**
 * Exercises `WhatsAppCloud` over MSW against the Cloud API's real answers: the template
 * body with normalized parameters, Graph error codes mapped to their meaning, and that
 * no error carries the access token.
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

import type { WhatsAppCloudOptions } from "./whatsapp.js";

import { normalizeParameter, WhatsAppCloud } from "./whatsapp.js";

const MESSAGES_URL = "https://graph.facebook.com/v21.0/106540352242922/messages";

const ACCESS_TOKEN = "EAAGsecretaccesstoken";

const OPTIONS: WhatsAppCloudOptions = {
	accessToken: ACCESS_TOKEN,
	phoneNumberId: "106540352242922",
	to: "15551234567",
	template: {
		name: "monitor_alert",
		language: "en",
		parameters: (message) => [message.title, message.fields?.[0]?.value ?? ""],
	},
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Answers every send with the Cloud API's accepted message, recording each request. */
function acceptMessages(url = MESSAGES_URL) {
	let seen: { request: Request; body: unknown }[] = [];
	server.use(
		http.post(url, async ({ request }) => {
			seen.push({ request: request.clone(), body: await request.json() });
			return HttpResponse.json({
				messaging_product: "whatsapp",
				contacts: [{ input: "15551234567", wa_id: "15551234567" }],
				messages: [{ id: "wamid.HBgLMTU1NTEyMzQ1NjcVAgARGBI", message_status: "accepted" }],
			});
		}),
	);
	return seen;
}

/** Answers with a Graph error carrying `code`, as Meta does. */
function graphError(status: number, code: number, message: string) {
	server.use(
		http.post(MESSAGES_URL, () =>
			HttpResponse.json(
				{
					error: { message, type: "OAuthException", code, error_subcode: 2494010, fbtrace_id: "A" },
				},
				{ status },
			),
		),
	);
}

const MESSAGE: Message = {
	title: "api.example.com\nis down",
	fields: [{ label: "Region", value: "gru\t\tsouth      america" }],
};

describeDestination({
	name: "WhatsAppCloud",
	capabilities: [],
	create: () => {
		acceptMessages();
		return new WhatsAppCloud(OPTIONS);
	},
	rateLimitNext: (delayMs) =>
		server.use(
			http.post(
				MESSAGES_URL,
				() =>
					HttpResponse.json(
						{ error: { message: "Rate limit hit", code: 130429 } },
						{ status: 429, headers: { "Retry-After": String(delayMs / 1000) } },
					),
				{ once: true },
			),
		),
});

describe("WhatsAppCloud", () => {
	test("sends the template with its normalized body parameters", async () => {
		let seen = acceptMessages();

		let sent = await new WhatsAppCloud({ ...OPTIONS, accessToken: () => ACCESS_TOKEN }).send(
			MESSAGE,
		);

		expect(isSuccess(sent) && sent.data.ref).toEqual({
			provider: "whatsapp-cloud",
			id: "wamid.HBgLMTU1NTEyMzQ1NjcVAgARGBI",
		});
		let request = seen[0]?.request;
		expect(request?.headers.get("authorization")).toBe(`Bearer ${ACCESS_TOKEN}`);
		expect(request?.headers.get("content-type")).toBe("application/json");
		expect(request?.headers.get("traceparent")).toBeNull();
		expect(seen[0]?.body).toEqual({
			messaging_product: "whatsapp",
			recipient_type: "individual",
			to: "15551234567",
			type: "template",
			template: {
				name: "monitor_alert",
				language: { code: "en" },
				components: [
					{
						type: "body",
						parameters: [
							{ type: "text", text: "api.example.com is down" },
							{ type: "text", text: "gru south    america" },
						],
					},
				],
			},
		});
	});

	test("omits components for a template without parameters", () => {
		let payload = new WhatsAppCloud({
			...OPTIONS,
			template: { name: "ping", language: "pt_BR", parameters: () => [] },
		}).render(MESSAGE);

		expect(payload.template).toEqual({ name: "ping", language: { code: "pt_BR" } });
	});

	test("posts to the API version the caller pins", async () => {
		let seen = acceptMessages("https://graph.facebook.com/v23.0/106540352242922/messages");

		let sent = await new WhatsAppCloud({ ...OPTIONS, apiVersion: "v23.0" }).send(MESSAGE);

		expect(isSuccess(sent)).toBe(true);
		expect(seen).toHaveLength(1);
	});

	test("normalizes line breaks, tabs and long runs of spaces", () => {
		expect(normalizeParameter("a\r\nb\tc")).toBe("a b c");
		expect(normalizeParameter("a    b")).toBe("a    b");
		expect(normalizeParameter("a         b")).toBe("a    b");
	});

	test("fails invalid-message when the parameter mapping throws, before any request", async () => {
		let sent = await new WhatsAppCloud({
			...OPTIONS,
			template: {
				name: "monitor_alert",
				language: "en",
				parameters: () => {
					throw new Error("missing field");
				},
			},
		}).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("invalid-message");
	});

	test.each([
		[400, 131047, "outside-window"],
		[401, 190, "unauthorized"],
		[400, 131026, "gone"],
		[400, 131030, "rejected"],
		[400, 4, "rate-limited"],
		[400, 80007, "rate-limited"],
		[400, 130429, "rate-limited"],
		[400, 131056, "rate-limited"],
		[400, 100, "rejected"],
		[500, 1, "unavailable"],
	])("maps a %i Graph error %i to %s, never naming the token", async (status, code, expected) => {
		graphError(status, code, `Failure for token ${ACCESS_TOKEN.slice(0, 4)}`);

		let sent = await new WhatsAppCloud(OPTIONS).send(MESSAGE);

		expect(isFailure(sent)).toBe(true);
		if (!isFailure(sent)) return;
		expect(sent.error.code).toBe(expected);
		expect(sent.error.status).toBe(status);
		expect(sent.error.host).toBe("graph.facebook.com");
		expect(sent.error.message).not.toContain(ACCESS_TOKEN);
	});
});
