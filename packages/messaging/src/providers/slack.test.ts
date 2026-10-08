/**
 * Exercises the Slack providers over MSW against Slack's real answers: the Block Kit
 * body, `gone` for a dead webhook or channel, `ok: false` read from a `200`, the ref a
 * bot answers, and that no error carries the webhook URL or the bot token.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { Message } from "../message.js";

import { describeDestination } from "../conformance.js";

import { SlackBot, slackBlocks, SlackWebhook } from "./slack.js";

const WEBHOOK_URL = "https://hooks.slack.com/services/T000/B000/secret-token";

const BOT_TOKEN = "xoxb-secret-bot-token";

const POST_MESSAGE_URL = "https://slack.com/api/chat.postMessage";

const UPDATE_URL = "https://slack.com/api/chat.update";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Answers every webhook post with `ok`, recording each body. */
function acceptWebhook(bodies: unknown[] = []) {
	server.use(
		http.post(WEBHOOK_URL, async ({ request }) => {
			bodies.push(await request.json());
			return new HttpResponse("ok");
		}),
	);
	return bodies;
}

const MESSAGE: Message = {
	title: "api.example.com is down",
	text: "Timed out from **gru** after `30s`.",
	severity: "critical",
	fields: [{ label: "Region", value: "<gru>", inline: true }],
	links: [{ label: "Open dashboard", url: "https://uptime.example.com/m/1" }],
	timestamp: new Date("2026-10-06T12:00:00.000Z"),
};

describeDestination({
	name: "SlackWebhook",
	capabilities: [],
	create: () => {
		acceptWebhook();
		return new SlackWebhook({ url: WEBHOOK_URL });
	},
	rateLimitNext: (delayMs) =>
		server.use(
			http.post(
				WEBHOOK_URL,
				() =>
					new HttpResponse("rate_limited", {
						status: 429,
						headers: { "Retry-After": String(delayMs / 1000) },
					}),
				{ once: true },
			),
		),
});

describe("SlackWebhook", () => {
	test("posts Block Kit inside one attachment colored by severity", async () => {
		let bodies = acceptWebhook();

		let sent = await new SlackWebhook({ url: WEBHOOK_URL }).send(MESSAGE);

		expect(isSuccess(sent) && sent.data.ref).toBeNull();
		expect(bodies[0]).toEqual({
			text: "api.example.com is down",
			attachments: [
				{
					color: "#dc2626",
					blocks: [
						{
							type: "header",
							text: { type: "plain_text", text: "api.example.com is down", emoji: true },
						},
						{
							type: "section",
							text: { type: "mrkdwn", text: "Timed out from *gru* after `30s`." },
						},
						{ type: "section", fields: [{ type: "mrkdwn", text: "*Region*\n&lt;gru&gt;" }] },
						{
							type: "context",
							elements: [
								{
									type: "mrkdwn",
									text: "<!date^1791288000^{date_short_pretty} {time}|2026-10-06T12:00:00.000Z>",
								},
							],
						},
						{
							type: "actions",
							elements: [
								{
									type: "button",
									text: { type: "plain_text", text: "Open dashboard", emoji: true },
									url: "https://uptime.example.com/m/1",
								},
							],
						},
					],
				},
			],
		});
	});

	test.each([
		[404, "no_service", "gone"],
		[410, "channel_is_archived", "gone"],
		[403, "action_prohibited", "unauthorized"],
		[400, "invalid_payload", "rejected"],
		[500, "rollup_error", "unavailable"],
	])("maps a %i %s answer to %s, never naming the URL", async (status, body, code) => {
		server.use(http.post(WEBHOOK_URL, () => new HttpResponse(body, { status })));

		let sent = await new SlackWebhook({ url: WEBHOOK_URL }).send(MESSAGE);

		expect(isFailure(sent)).toBe(true);
		if (!isFailure(sent)) return;
		expect(sent.error.code).toBe(code);
		expect(sent.error.status).toBe(status);
		expect(sent.error.host).toBe("hooks.slack.com");
		expect(sent.error.message).not.toContain("secret-token");
	});

	test("fails a redirect without following it", async () => {
		server.use(
			http.post(
				WEBHOOK_URL,
				() => new HttpResponse(null, { status: 302, headers: { Location: "https://evil.com/" } }),
			),
		);

		let sent = await new SlackWebhook({ url: WEBHOOK_URL }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("rejected");
	});

	test("refuses a URL off hooks.slack.com before any request", async () => {
		let sent = await new SlackWebhook({ url: "https://evil.com/services/x" }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("invalid-destination");
		expect(isFailure(SlackWebhook.check("http://hooks.slack.com/services/x"))).toBe(true);
		expect(isSuccess(SlackWebhook.check(WEBHOOK_URL))).toBe(true);
	});

	test("times out with a retryable failure", async () => {
		server.use(
			http.post(WEBHOOK_URL, async () => {
				await delay(200);
				return new HttpResponse("ok");
			}),
		);

		let sent = await new SlackWebhook({ url: WEBHOOK_URL }).send(MESSAGE, { timeout: 20 });

		expect(isFailure(sent) && sent.error.code).toBe("timeout");
		expect(isFailure(sent) && sent.error.retryable).toBe(true);
	});

	test("answers the delay a 429 named", async () => {
		server.use(
			http.post(
				WEBHOOK_URL,
				() => new HttpResponse("rate_limited", { status: 429, headers: { "Retry-After": "2" } }),
			),
		);

		let sent = await new SlackWebhook({ url: WEBHOOK_URL }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.retryAfter).toBe(2000);
	});
});

/** Answers a Web API method with `ok: true`, recording each body and authorization header. */
function acceptBot(url: string, ts = "1728000000.000100") {
	let calls: { body: Record<string, unknown>; authorization: string | null }[] = [];
	server.use(
		http.post(url, async ({ request }) => {
			let body = (await request.json()) as Record<string, unknown>;
			calls.push({ body, authorization: request.headers.get("authorization") });
			return HttpResponse.json({ ok: true, channel: body["channel"], ts });
		}),
	);
	return calls;
}

/** A bot posting to the channel the tests use. */
function bot() {
	return new SlackBot({ token: BOT_TOKEN, channel: "C123" });
}

describeDestination({
	name: "SlackBot",
	capabilities: ["update", "reply"],
	create: () => {
		acceptBot(POST_MESSAGE_URL);
		acceptBot(UPDATE_URL);
		return bot();
	},
	rateLimitNext: (delayMs) =>
		server.use(
			http.post(
				POST_MESSAGE_URL,
				() =>
					HttpResponse.json(
						{ ok: false, error: "ratelimited" },
						{ status: 429, headers: { "Retry-After": String(delayMs / 1000) } },
					),
				{ once: true },
			),
		),
});

describe("SlackBot", () => {
	test("posts Block Kit to the channel with the bearer token and answers channel and ts", async () => {
		let calls = acceptBot(POST_MESSAGE_URL);

		let sent = await bot().send(MESSAGE);

		expect(isSuccess(sent) && sent.data.ref).toEqual({
			provider: "slack-bot",
			channel: "C123",
			ts: "1728000000.000100",
		});
		expect(calls[0]?.authorization).toBe(`Bearer ${BOT_TOKEN}`);
		expect(calls[0]?.body).toEqual({
			channel: "C123",
			text: "api.example.com is down",
			attachments: [{ color: "#dc2626", blocks: slackBlocks(MESSAGE) }],
		});
		expect(calls[0]?.body).toEqual(bot().render(MESSAGE));
	});

	test("reads the token from a function at send time", async () => {
		let calls = acceptBot(POST_MESSAGE_URL);
		let reads = 0;
		let destination = new SlackBot({
			token: () => {
				reads += 1;
				return BOT_TOKEN;
			},
			channel: "C123",
		});

		expect(reads).toBe(0);
		await destination.send(MESSAGE);

		expect(reads).toBe(1);
		expect(calls[0]?.authorization).toBe(`Bearer ${BOT_TOKEN}`);
	});

	test("fails unavailable when the token reader throws, before any request", async () => {
		let destination = new SlackBot({
			token: () => Promise.reject(new Error("store down")),
			channel: "C123",
		});

		let sent = await destination.send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("unavailable");
	});

	test("updates with chat.update on the ref's channel and ts", async () => {
		let calls = acceptBot(UPDATE_URL, "1728000000.000100");

		let ref = { provider: "slack-bot", channel: "C999", ts: "1728000000.000100" };
		let updated = await bot().update(ref, { ...MESSAGE, severity: "success" });

		expect(isSuccess(updated) && updated.data.ref).toEqual(ref);
		expect(calls[0]?.body).toMatchObject({
			channel: "C999",
			ts: "1728000000.000100",
			attachments: [{ color: "#16a34a" }],
		});
	});

	test("replies in the thread with thread_ts and answers the reply's own ts", async () => {
		let calls = acceptBot(POST_MESSAGE_URL, "1728000099.000200");

		let ref = { provider: "slack-bot", channel: "C999", ts: "1728000000.000100" };
		let replied = await bot().reply(ref, MESSAGE);

		expect(isSuccess(replied) && replied.data.ref).toEqual({
			provider: "slack-bot",
			channel: "C999",
			ts: "1728000099.000200",
		});
		expect(calls[0]?.body).toMatchObject({ channel: "C999", thread_ts: "1728000000.000100" });
	});

	test.each([
		[{ provider: "slack-webhook", channel: "C1", ts: "1" }],
		[{ provider: "slack-bot", channel: "C1" }],
		[{ provider: "slack-bot", ts: "1" }],
	])("fails invalid-ref for %j before any request", async (ref) => {
		let updated = await bot().update(ref, MESSAGE);
		let replied = await bot().reply(ref, MESSAGE);

		expect(isFailure(updated) && updated.error.code).toBe("invalid-ref");
		expect(isFailure(replied) && replied.error.code).toBe("invalid-ref");
	});

	test.each([
		["channel_not_found", "gone"],
		["is_archived", "gone"],
		["channel_is_archived", "gone"],
		["account_inactive", "gone"],
		["not_in_channel", "gone"],
		["invalid_auth", "unauthorized"],
		["not_authed", "unauthorized"],
		["token_revoked", "unauthorized"],
		["missing_scope", "unauthorized"],
		["ratelimited", "rate-limited"],
		["msg_too_long", "rejected"],
	])("maps a 200 answering ok: false, %s to %s, never naming the token", async (error, code) => {
		server.use(http.post(POST_MESSAGE_URL, () => HttpResponse.json({ ok: false, error })));

		let sent = await bot().send(MESSAGE);

		expect(isFailure(sent)).toBe(true);
		if (!isFailure(sent)) return;
		expect(sent.error.code).toBe(code);
		expect(sent.error.provider).toBe("slack-bot");
		expect(sent.error.host).toBe("slack.com");
		expect(sent.error.message).toContain(error);
		expect(JSON.stringify([sent.error.message, Object.entries(sent.error)])).not.toContain(
			BOT_TOKEN,
		);
	});

	test("maps a 5xx without a body to unavailable", async () => {
		server.use(http.post(POST_MESSAGE_URL, () => new HttpResponse(null, { status: 503 })));

		let sent = await bot().send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("unavailable");
	});

	test("fails a redirect without following it", async () => {
		server.use(
			http.post(
				POST_MESSAGE_URL,
				() => new HttpResponse(null, { status: 302, headers: { Location: "https://evil.com/" } }),
			),
		);

		let sent = await bot().send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("rejected");
	});
});
