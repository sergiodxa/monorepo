/**
 * Exercises `TelegramBot` over MSW against the Bot API's real answers: the HTML body,
 * the ref it answers, `gone` for a closed chat, an unchanged edit as success, and that
 * the token in the request path never reaches an error or the log.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Log } from "@sdxc/logger";
import { isFailure, isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { Message } from "../message.js";

import { describeDestination } from "../conformance.js";

import { TelegramBot, telegramText } from "./telegram.js";

const TOKEN = "123456:ABC-secret-telegram-token";

const SEND_URL = /^https:\/\/api\.telegram\.org\/bot[^/]+\/sendMessage$/u;

const EDIT_URL = /^https:\/\/api\.telegram\.org\/bot[^/]+\/editMessageText$/u;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const MESSAGE: Message = {
	title: "api.example.com is down",
	text: "Timed out from **gru** after `30s`.",
	severity: "critical",
	fields: [{ label: "Region", value: "<gru>", inline: true }],
	links: [{ label: "Open dashboard", url: "https://uptime.example.com/m/1" }],
	timestamp: new Date("2026-10-06T12:00:00.000Z"),
};

/** One request the Bot API received. */
interface Call {
	url: string;
	body: Record<string, unknown>;
}

/** Answers a Bot API method with a sent `Message`, recording each request. */
function acceptMethod(url: RegExp, messageId = 42) {
	let calls: Call[] = [];
	server.use(
		http.post(url, async ({ request }) => {
			let body = (await request.json()) as Record<string, unknown>;
			calls.push({ url: request.url, body });
			return HttpResponse.json({
				ok: true,
				result: { message_id: messageId, chat: { id: -1001234, type: "supergroup" }, text: "…" },
			});
		}),
	);
	return calls;
}

/** Answers every request to a method with a Bot API failure. */
function failMethod(url: RegExp, status: number, description: string, extra: object = {}) {
	server.use(
		http.post(url, () =>
			HttpResponse.json({ ok: false, error_code: status, description, ...extra }, { status }),
		),
	);
}

/** A bot posting to the chat the tests use. */
function bot() {
	return new TelegramBot({ token: TOKEN, chatId: -1001234 });
}

describeDestination({
	name: "TelegramBot",
	capabilities: ["update", "reply"],
	create: () => {
		acceptMethod(SEND_URL);
		acceptMethod(EDIT_URL);
		return bot();
	},
	rateLimitNext: (delayMs) =>
		server.use(
			http.post(
				SEND_URL,
				() =>
					HttpResponse.json(
						{
							ok: false,
							error_code: 429,
							description: `Too Many Requests: retry after ${delayMs / 1000}`,
							parameters: { retry_after: delayMs / 1000 },
						},
						{ status: 429 },
					),
				{ once: true },
			),
		),
});

describe("TelegramBot", () => {
	test("sends HTML with link previews off and links as URL buttons", async () => {
		let calls = acceptMethod(SEND_URL);

		let sent = await bot().send(MESSAGE);

		expect(isSuccess(sent) && sent.data.ref).toEqual({
			provider: "telegram-bot",
			chatId: "-1001234",
			messageId: "42",
		});
		expect(calls[0]?.url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
		expect(calls[0]?.body).toEqual({
			chat_id: -1001234,
			text: "<b>api.example.com is down</b>\n\nTimed out from <b>gru</b> after <code>30s</code>.\n\n<b>Region</b>: &lt;gru&gt;",
			parse_mode: "HTML",
			link_preview_options: { is_disabled: true },
			reply_markup: {
				inline_keyboard: [[{ text: "Open dashboard", url: "https://uptime.example.com/m/1" }]],
			},
		});
	});

	test("posts into the configured forum topic", async () => {
		let calls = acceptMethod(SEND_URL);

		await new TelegramBot({ token: TOKEN, chatId: "@ops", messageThreadId: 7 }).send({
			title: "Deploy finished",
		});

		expect(calls[0]?.body).toEqual({
			chat_id: "@ops",
			message_thread_id: 7,
			text: "<b>Deploy finished</b>",
			parse_mode: "HTML",
			link_preview_options: { is_disabled: true },
		});
	});

	test("keeps the whole text within 4,096 characters, cutting the body", () => {
		let text = telegramText({
			title: "Long",
			text: "a < b ".repeat(2000),
			fields: [{ label: "Region", value: "gru" }],
		});

		expect(text.length).toBeLessThanOrEqual(4096);
		expect(text.startsWith("<b>Long</b>\n\n")).toBe(true);
		expect(text.endsWith("…\n\n<b>Region</b>: gru")).toBe(true);
		expect(text).not.toMatch(/&[a-z]*…|&[a-z]*$/u);
	});

	test("reads the token from a function at send time", async () => {
		let calls = acceptMethod(SEND_URL);
		let reads = 0;
		let destination = new TelegramBot({
			token: () => {
				reads += 1;
				return TOKEN;
			},
			chatId: 1,
		});

		expect(reads).toBe(0);
		await destination.send(MESSAGE);

		expect(reads).toBe(1);
		expect(calls).toHaveLength(1);
	});

	test("edits with editMessageText on the ref's chat and message", async () => {
		let calls = acceptMethod(EDIT_URL, 99);

		let ref = { provider: "telegram-bot", chatId: "-100555", messageId: "99" };
		let updated = await bot().update(ref, MESSAGE);

		expect(isSuccess(updated) && updated.data.ref).toEqual({
			provider: "telegram-bot",
			chatId: "-1001234",
			messageId: "99",
		});
		expect(calls[0]?.url).toBe(`https://api.telegram.org/bot${TOKEN}/editMessageText`);
		expect(calls[0]?.body).toEqual({
			chat_id: "-100555",
			message_id: 99,
			text: telegramText(MESSAGE),
			parse_mode: "HTML",
			link_preview_options: { is_disabled: true },
			reply_markup: {
				inline_keyboard: [[{ text: "Open dashboard", url: "https://uptime.example.com/m/1" }]],
			},
		});
	});

	test("answers an edit to an unchanged message as success with the same ref", async () => {
		failMethod(
			EDIT_URL,
			400,
			"Bad Request: message is not modified: specified new message content and reply markup are exactly the same",
		);

		let ref = { provider: "telegram-bot", chatId: "-100555", messageId: "99" };
		let updated = await bot().update(ref, MESSAGE);

		expect(isSuccess(updated) && updated.data.ref).toEqual(ref);
	});

	test("replies with reply_parameters naming the ref's message", async () => {
		let calls = acceptMethod(SEND_URL, 43);

		let ref = { provider: "telegram-bot", chatId: "-100555", messageId: "42" };
		let replied = await bot().reply(ref, MESSAGE);

		expect(isSuccess(replied) && replied.data.ref).toMatchObject({ messageId: "43" });
		expect(calls[0]?.body).toMatchObject({
			chat_id: "-100555",
			reply_parameters: { message_id: 42 },
		});
	});

	test.each([
		[{ provider: "slack-bot", chatId: "1", messageId: "1" }],
		[{ provider: "telegram-bot", chatId: "1" }],
		[{ provider: "telegram-bot", messageId: "1" }],
	])("fails invalid-ref for %j before any request", async (ref) => {
		let updated = await bot().update(ref, MESSAGE);
		let replied = await bot().reply(ref, MESSAGE);

		expect(isFailure(updated) && updated.error.code).toBe("invalid-ref");
		expect(isFailure(replied) && replied.error.code).toBe("invalid-ref");
	});

	test.each([
		[400, "Bad Request: chat not found", "gone"],
		[403, "Forbidden: bot was blocked by the user", "gone"],
		[403, "Forbidden: user is deactivated", "gone"],
		[403, "Forbidden: bot was kicked from the supergroup chat", "gone"],
		[401, "Unauthorized", "unauthorized"],
		[403, "Forbidden: bot is not a member of the channel chat", "unauthorized"],
		[400, "Bad Request: can't parse entities", "rejected"],
		[502, "Bad Gateway", "unavailable"],
	])("maps a %i %s to %s", async (status, description, code) => {
		failMethod(SEND_URL, status, description);

		let sent = await bot().send(MESSAGE);

		expect(isFailure(sent)).toBe(true);
		if (!isFailure(sent)) return;
		expect(sent.error.code).toBe(code);
		expect(sent.error.status).toBe(status);
		expect(sent.error.host).toBe("api.telegram.org");
		expect(sent.error.message).toContain(description);
	});

	test("answers the delay a 429 named in parameters.retry_after", async () => {
		failMethod(SEND_URL, 429, "Too Many Requests: retry after 7", {
			parameters: { retry_after: 7 },
		});

		let sent = await bot().send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("rate-limited");
		expect(isFailure(sent) && sent.error.retryAfter).toBe(7000);
	});

	test("keeps the token out of every error and the log, even when an answer echoes it", async () => {
		failMethod(SEND_URL, 404, `Not Found: bot${TOKEN}/sendMessage`);
		let records: Readonly<Record<string, unknown>>[] = [];
		let log = new Log({ kind: "job", sink: (record) => void records.push(record) });

		let sent = await log.run(() => bot().send(MESSAGE));

		expect(isFailure(sent)).toBe(true);
		if (!isFailure(sent)) return;
		let error = JSON.stringify([sent.error.message, Object.entries(sent.error)]);
		expect(error).not.toContain(TOKEN);
		expect(error).not.toContain("ABC-secret");
		expect(sent.error.host).toBe("api.telegram.org");
		expect(JSON.stringify(records)).toContain("messaging.send");
		expect(JSON.stringify(records)).not.toContain("ABC-secret");
	});

	test("keeps the token out of a network failure", async () => {
		server.use(http.post(SEND_URL, () => HttpResponse.error()));

		let sent = await bot().send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("network");
		expect(isFailure(sent) && sent.error.message).not.toContain("ABC-secret");
	});

	test("fails a redirect without following it", async () => {
		server.use(
			http.post(
				SEND_URL,
				() => new HttpResponse(null, { status: 302, headers: { Location: "https://evil.com/" } }),
			),
		);

		let sent = await bot().send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("rejected");
	});
});
