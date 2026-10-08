/**
 * Exercises `GoogleChatWebhook` over MSW against a space webhook's real answers: the
 * `cardsV2` body, `key` threading with the URL's own credential kept, `gone` for a
 * deleted space, and that no error carries the webhook's key or token.
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

import { GoogleChatWebhook } from "./google-chat.js";

/** The webhook path MSW matches, which ignores the query. */
const WEBHOOK_PATH = "https://chat.googleapis.com/v1/spaces/AAAA/messages";

const WEBHOOK_URL = `${WEBHOOK_PATH}?key=secret-key&token=secret-token`;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** One request the webhook received. */
interface Received {
	url: URL;
	body: unknown;
}

/** Answers every post with the message Google Chat created, recording each request. */
function acceptWebhook(received: Received[] = []) {
	server.use(
		http.post(WEBHOOK_PATH, async ({ request }) => {
			received.push({ url: new URL(request.url), body: await request.json() });
			return HttpResponse.json({ name: "spaces/AAAA/messages/BBBB.BBBB" });
		}),
	);
	return received;
}

const MESSAGE: Message = {
	title: "api.example.com is down",
	text: "Timed out from **gru** after `30s`.",
	severity: "critical",
	fields: [{ label: "Region", value: "<gru>", inline: true }],
	links: [{ label: "Open dashboard", url: "https://uptime.example.com/m/1" }],
	timestamp: new Date("2026-10-06T12:00:00.000Z"),
	key: "incident_8f1c",
};

describeDestination({
	name: "GoogleChatWebhook",
	capabilities: [],
	create: () => {
		acceptWebhook();
		return new GoogleChatWebhook({ url: WEBHOOK_URL });
	},
	rateLimitNext: (delayMs) =>
		server.use(
			http.post(
				WEBHOOK_PATH,
				() =>
					HttpResponse.json(
						{ error: { code: 429, status: "RESOURCE_EXHAUSTED" } },
						{ status: 429, headers: { "Retry-After": String(delayMs / 1000) } },
					),
				{ once: true },
			),
		),
});

describe("GoogleChatWebhook", () => {
	test("posts the text and a card, threaded by key", async () => {
		let received = acceptWebhook();

		let sent = await new GoogleChatWebhook({ url: WEBHOOK_URL }).send(MESSAGE);

		expect(isSuccess(sent) && sent.data.ref).toBeNull();
		expect(received[0]?.body).toEqual({
			text: "Timed out from *gru* after `30s`.",
			cardsV2: [
				{
					cardId: "message",
					card: {
						header: { title: "api.example.com is down", subtitle: "2026-10-06 12:00 UTC" },
						sections: [
							{
								widgets: [
									{
										decoratedText: { topLabel: "Region", text: "&lt;gru&gt;", wrapText: true },
									},
									{
										buttonList: {
											buttons: [
												{
													text: "Open dashboard",
													onClick: { openLink: { url: "https://uptime.example.com/m/1" } },
												},
											],
										},
									},
								],
							},
						],
					},
				},
			],
			thread: { threadKey: "incident_8f1c" },
		});
	});

	test("keeps the URL's key and token and asks to reply into the key's thread", async () => {
		let received = acceptWebhook();

		await new GoogleChatWebhook({ url: WEBHOOK_URL }).send(MESSAGE);

		let query = received[0]?.url.searchParams;
		expect(query?.get("key")).toBe("secret-key");
		expect(query?.get("token")).toBe("secret-token");
		expect(query?.get("messageReplyOption")).toBe("REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD");
	});

	test("posts a message without a key, text or widgets as a header-only card", async () => {
		let received = acceptWebhook();

		await new GoogleChatWebhook({ url: WEBHOOK_URL }).send({ title: "Deploy finished" });

		expect(received[0]?.url.searchParams.has("messageReplyOption")).toBe(false);
		expect(received[0]?.body).toEqual({
			cardsV2: [{ cardId: "message", card: { header: { title: "Deploy finished" } } }],
		});
	});

	test.each([
		[404, "NOT_FOUND", "gone"],
		[401, "UNAUTHENTICATED", "unauthorized"],
		[403, "PERMISSION_DENIED", "unauthorized"],
		[400, "INVALID_ARGUMENT", "rejected"],
		[503, "UNAVAILABLE", "unavailable"],
	])("maps a %i %s answer to %s, never naming the credential", async (status, reason, code) => {
		server.use(
			http.post(WEBHOOK_PATH, () =>
				HttpResponse.json({ error: { code: status, status: reason } }, { status }),
			),
		);

		let sent = await new GoogleChatWebhook({ url: WEBHOOK_URL }).send(MESSAGE);

		expect(isFailure(sent)).toBe(true);
		if (!isFailure(sent)) return;
		expect(sent.error.code).toBe(code);
		expect(sent.error.status).toBe(status);
		expect(sent.error.host).toBe("chat.googleapis.com");
		expect(sent.error.message).not.toContain("secret-key");
		expect(sent.error.message).not.toContain("secret-token");
	});

	test("refuses a URL off chat.googleapis.com before any request", async () => {
		let sent = await new GoogleChatWebhook({ url: "https://evil.com/v1/spaces/x" }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("invalid-destination");
		expect(isFailure(GoogleChatWebhook.check("http://chat.googleapis.com/v1/spaces/x"))).toBe(true);
		expect(isSuccess(GoogleChatWebhook.check(WEBHOOK_URL))).toBe(true);
	});
});
