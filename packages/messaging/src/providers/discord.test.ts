/**
 * Exercises `DiscordWebhook` over MSW against Discord's real answers: the embed body,
 * the message id waited for, edits and thread replies, `gone` for a deleted webhook,
 * the body's `retry_after`, and that no error carries the webhook token.
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

import { DiscordWebhook, discordEmbed } from "./discord.js";

const WEBHOOK_URL = "https://discord.com/api/webhooks/123/secret-token";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** One request the webhook received. */
interface Received {
	method: string;
	url: URL;
	body: unknown;
}

/** Answers every post and edit with the message Discord created, recording each request. */
function acceptWebhook(received: Received[] = []) {
	let record = async ({ request }: { request: Request }) => {
		received.push({
			method: request.method,
			url: new URL(request.url),
			body: await request.json(),
		});
		return HttpResponse.json({ id: "999", channel_id: "42", type: 0 });
	};
	server.use(http.post(WEBHOOK_URL, record), http.patch(`${WEBHOOK_URL}/messages/:id`, record));
	return received;
}

/** Answers the next post with a `429` whose delay is only in the body, as Discord sends it. */
function rateLimitNext(delayMs: number) {
	server.use(
		http.post(
			WEBHOOK_URL,
			() =>
				HttpResponse.json(
					{ message: "You are being rate limited.", retry_after: delayMs / 1000, global: false },
					{ status: 429 },
				),
			{ once: true },
		),
	);
}

const MESSAGE: Message = {
	title: "api.example.com is down",
	text: "Timed out from **gru** after `30s`.",
	severity: "critical",
	fields: [{ label: "Region", value: "<gru>_1", inline: true }],
	links: [{ label: "Open dashboard", url: "https://uptime.example.com/m/1" }],
	timestamp: new Date("2026-10-06T12:00:00.000Z"),
};

describeDestination({
	name: "DiscordWebhook",
	capabilities: ["update"],
	create: () => {
		acceptWebhook();
		return new DiscordWebhook({ url: WEBHOOK_URL });
	},
	rateLimitNext,
});

describeDestination({
	name: "DiscordWebhook in a thread",
	capabilities: ["update", "reply"],
	create: () => {
		acceptWebhook();
		return new DiscordWebhook({ url: WEBHOOK_URL, threadId: "777" });
	},
	rateLimitNext,
});

describe("DiscordWebhook", () => {
	test("posts one embed with ?wait=true and answers the message id", async () => {
		let received = acceptWebhook();

		let sent = await new DiscordWebhook({ url: WEBHOOK_URL }).send(MESSAGE);

		expect(isSuccess(sent) && sent.data.ref).toEqual({ provider: "discord-webhook", id: "999" });
		expect(received[0]?.url.searchParams.get("wait")).toBe("true");
		expect(received[0]?.url.searchParams.has("thread_id")).toBe(false);
		expect(received[0]?.body).toEqual({
			embeds: [
				{
					title: "api.example.com is down",
					description:
						"Timed out from **gru** after `30s`.\n\n[Open dashboard](https://uptime.example.com/m/1)",
					color: 0xdc2626,
					fields: [{ name: "Region", value: "<gru\\>\\_1", inline: true }],
					timestamp: "2026-10-06T12:00:00.000Z",
				},
			],
			allowed_mentions: { parse: [] },
		});
	});

	test("posts into the configured thread and carries it in the ref", async () => {
		let received = acceptWebhook();

		let sent = await new DiscordWebhook({ url: WEBHOOK_URL, threadId: "777" }).send(MESSAGE);

		expect(received[0]?.url.searchParams.get("thread_id")).toBe("777");
		expect(isSuccess(sent) && sent.data.ref).toEqual({
			provider: "discord-webhook",
			id: "999",
			threadId: "777",
		});
	});

	test("edits a sent message with PATCH in the thread its ref names", async () => {
		let received = acceptWebhook();
		let ref = { provider: "discord-webhook", id: "999", threadId: "777" };

		let updated = await new DiscordWebhook({ url: WEBHOOK_URL }).update(ref, {
			title: "api.example.com is up",
			severity: "success",
		});

		expect(isSuccess(updated) && updated.data.ref).toEqual(ref);
		expect(received[0]?.method).toBe("PATCH");
		expect(received[0]?.url.pathname).toBe("/api/webhooks/123/secret-token/messages/999");
		expect(received[0]?.url.searchParams.get("thread_id")).toBe("777");
		expect(received[0]?.body).toEqual({
			embeds: [{ title: "api.example.com is up", color: 0x16a34a }],
			allowed_mentions: { parse: [] },
		});
	});

	test("edits through a webhook URL ending in thousands of slashes in linear time", async () => {
		let received = acceptWebhook();
		let ref = { provider: "discord-webhook", id: "999" };
		let webhook = new DiscordWebhook({ url: `${WEBHOOK_URL}${"/".repeat(50_000)}` });

		let started = performance.now();
		let updated = await webhook.update(ref, { title: "up", severity: "success" });

		expect(performance.now() - started).toBeLessThan(2_000);
		expect(isSuccess(updated)).toBe(true);
		expect(received[0]?.url.pathname).toBe("/api/webhooks/123/secret-token/messages/999");
	});

	test("declares reply only with a thread, and replies into it", async () => {
		let received = acceptWebhook();
		let ref = { provider: "discord-webhook", id: "999", threadId: "777" };

		expect(new DiscordWebhook({ url: WEBHOOK_URL }).reply).toBeUndefined();
		let replied = await new DiscordWebhook({ url: WEBHOOK_URL, threadId: "777" }).reply?.(
			ref,
			MESSAGE,
		);

		expect(replied).toMatchObject({ status: "success" });
		expect(received[0]?.method).toBe("POST");
		expect(received[0]?.url.searchParams.get("thread_id")).toBe("777");
	});

	test.each([
		[404, { message: "Unknown Webhook", code: 10015 }, "gone"],
		[404, {}, "gone"],
		[401, { message: "Invalid Webhook Token", code: 50027 }, "unauthorized"],
		[400, { message: "Invalid Form Body", code: 50035 }, "rejected"],
		[502, {}, "unavailable"],
	])("maps a %i %j answer to %s, never naming the token", async (status, body, code) => {
		server.use(http.post(WEBHOOK_URL, () => HttpResponse.json(body, { status })));

		let sent = await new DiscordWebhook({ url: WEBHOOK_URL }).send(MESSAGE);

		expect(isFailure(sent)).toBe(true);
		if (!isFailure(sent)) return;
		expect(sent.error.code).toBe(code);
		expect(sent.error.status).toBe(status);
		expect(sent.error.host).toBe("discord.com");
		expect(sent.error.message).not.toContain("secret-token");
	});

	test("answers the fractional retry_after a 429 body named", async () => {
		server.use(
			http.post(WEBHOOK_URL, () =>
				HttpResponse.json({ retry_after: 1.234, global: false }, { status: 429 }),
			),
		);

		let sent = await new DiscordWebhook({ url: WEBHOOK_URL }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.retryAfter).toBe(1234);
	});

	test("refuses a URL off Discord's webhook path before any request", async () => {
		let sent = await new DiscordWebhook({ url: "https://evil.com/api/webhooks/1/x" }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("invalid-destination");
		expect(isFailure(DiscordWebhook.check("https://discord.com/api/channels/1"))).toBe(true);
		expect(isSuccess(DiscordWebhook.check("https://discordapp.com/api/webhooks/1/x"))).toBe(true);
		expect(isSuccess(DiscordWebhook.check(WEBHOOK_URL))).toBe(true);
	});

	test("keeps the whole embed within Discord's limits", () => {
		let embed = discordEmbed({
			title: "t".repeat(300),
			text: "x".repeat(5000),
			fields: Array.from({ length: 30 }, (_, index) => ({
				label: `l${index}`.repeat(100),
				value: "v".repeat(2000),
			})),
			links: [{ label: "Open", url: "https://uptime.example.com/" }],
		});

		let fields = embed.fields ?? [];
		let total =
			embed.title.length +
			(embed.description?.length ?? 0) +
			fields.reduce((sum, field) => sum + field.name.length + field.value.length, 0);
		expect(embed.title.length).toBeLessThanOrEqual(256);
		expect(fields.length).toBeGreaterThan(0);
		expect(fields.every((field) => field.name.length <= 256 && field.value.length <= 1024)).toBe(
			true,
		);
		expect(total).toBeLessThanOrEqual(6000);
	});

	test("keeps at most 25 fields", () => {
		let embed = discordEmbed({
			title: "Many fields",
			fields: Array.from({ length: 30 }, (_, index) => ({ label: `l${index}`, value: "v" })),
		});

		expect(embed.fields).toHaveLength(25);
	});

	test("writes every link in the description when there is no text", () => {
		let embed = discordEmbed({
			title: "Deploy finished",
			links: [
				{ label: "Logs", url: "https://ci.example.com/1" },
				{ label: "Diff [main]", url: "https://git.example.com/(1)" },
			],
		});

		expect(embed.description).toBe(
			"[Logs](https://ci.example.com/1) · [Diff \\[main\\]](https://git.example.com/(1%29)",
		);
	});
});
