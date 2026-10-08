/**
 * Exercises the generic webhook over MSW: the portable envelope, a Standard Webhooks
 * signature a receiver verifies, a subclass keeping its own body and signature, the
 * error mapping, and that no failure carries the URL or the secret.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success } from "@sdxc/result";
import { verify } from "@sdxc/webhooks";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { Message } from "../message.js";

import { describeDestination } from "../conformance.js";
import { MessagingError } from "../error.js";

import type { WebhookDelivery, WebhookSignContext } from "./webhook.js";

import { Webhook } from "./webhook.js";

const WEBHOOK_URL = "https://hooks.acme.com/messaging?token=url-secret";

const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** One request as the receiver saw it. */
interface Received {
	headers: Headers;
	body: string;
}

/** Answers every post with `204`, recording each request. */
function acceptWebhook(received: Received[] = []) {
	server.use(
		http.post("https://hooks.acme.com/messaging", async ({ request }) => {
			received.push({ headers: request.headers, body: await request.text() });
			return new HttpResponse(null, { status: 204 });
		}),
	);
	return received;
}

const MESSAGE: Message = {
	title: "api.acme.com is down",
	text: "Timed out from **gru** after `30s`.",
	severity: "critical",
	fields: [{ label: "Region", value: "gru", inline: true }],
	links: [{ label: "Open dashboard", url: "https://uptime.acme.com/m/1" }],
	timestamp: new Date("2026-10-06T12:00:00.000Z"),
	key: "incident_8f1c",
	state: "open",
	data: { monitorId: "m_1" },
};

/** Hex HMAC-SHA256 of `body` under `secret`, as a receiver of the older scheme computes it. */
async function hmacHex(secret: string, body: string): Promise<string> {
	let key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	let mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
	return Array.from(new Uint8Array(mac), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** An app's own webhook contract: its own payload, signed as `Webhook-Signature: sha256=<hex>`. */
class UptimeWebhook extends Webhook {
	override readonly provider = "uptime-webhook";

	/** The payload this app's receivers already parse. */
	override render(message: Message, delivery: WebhookDelivery) {
		return {
			event: message.state === "resolved" ? "up" : "down",
			monitor: message.title,
			delivery: delivery.id,
		};
	}

	/** The raw-secret HMAC this app's receivers already verify. */
	protected override async sign(
		body: string,
		context: WebhookSignContext,
	): Promise<Result<Headers, MessagingError>> {
		if (context.secret === "") {
			return failure(
				new MessagingError("uptime-webhook has no secret", {
					code: "invalid-destination",
					provider: this.provider,
				}),
			);
		}
		return success(
			new Headers({ "Webhook-Signature": `sha256=${await hmacHex(context.secret, body)}` }),
		);
	}
}

describeDestination({
	name: "Webhook",
	capabilities: [],
	create: () => {
		acceptWebhook();
		return new Webhook({ url: WEBHOOK_URL, secret: SECRET });
	},
	rateLimitNext: (delayMs) =>
		server.use(
			http.post(
				"https://hooks.acme.com/messaging",
				() =>
					new HttpResponse(null, {
						status: 429,
						headers: { "Retry-After": String(delayMs / 1000) },
					}),
				{ once: true },
			),
		),
});

describe("Webhook", () => {
	test("posts the envelope signed with Standard Webhooks under the delivery id", async () => {
		let received = acceptWebhook();

		let sent = await new Webhook({ url: WEBHOOK_URL, secret: () => SECRET }).send(MESSAGE, {
			id: "evt_1",
		});

		expect(isSuccess(sent) && sent.data.ref).toBeNull();
		let [request] = received;
		if (!request) throw new Error("No request arrived");
		expect(request.headers.get("content-type")).toBe("application/json");
		expect(request.headers.get("webhook-id")).toBe("evt_1");
		expect(JSON.parse(request.body)).toEqual({
			type: "message",
			title: "api.acme.com is down",
			text: "Timed out from **gru** after `30s`.",
			severity: "critical",
			fields: [{ label: "Region", value: "gru", inline: true }],
			links: [{ label: "Open dashboard", url: "https://uptime.acme.com/m/1" }],
			timestamp: "2026-10-06T12:00:00.000Z",
			key: "incident_8f1c",
			state: "open",
			data: { monitorId: "m_1" },
		});

		let verified = await verify(
			new Request(WEBHOOK_URL, { method: "POST", headers: request.headers, body: request.body }),
			{ secret: SECRET },
		);
		expect(isSuccess(verified) && verified.data.id).toBe("evt_1");
	});

	test("leaves out every field the message leaves out", () => {
		let body = new Webhook({ url: WEBHOOK_URL, secret: SECRET }).render(
			{ title: "Deployed" },
			{ id: "evt_1", timestamp: new Date() },
		);

		expect(body).toStrictEqual({ type: "message", title: "Deployed" });
	});

	test("generates a msg_ delivery id when the caller names none", async () => {
		let received = acceptWebhook();

		await new Webhook({ url: WEBHOOK_URL, secret: SECRET }).send(MESSAGE);

		expect(received[0]?.headers.get("webhook-id")).toMatch(/^msg_[0-9a-f-]{36}$/u);
	});

	test("lets a subclass send its own body and signature", async () => {
		let received = acceptWebhook();

		let sent = await new UptimeWebhook({ url: WEBHOOK_URL, secret: "raw-secret" }).send(MESSAGE, {
			id: "evt_2",
		});

		expect(isSuccess(sent)).toBe(true);
		let [request] = received;
		if (!request) throw new Error("No request arrived");
		expect(JSON.parse(request.body)).toEqual({
			event: "down",
			monitor: "api.acme.com is down",
			delivery: "evt_2",
		});
		expect(request.headers.get("content-type")).toBe("application/json");
		expect(request.headers.get("webhook-signature")).toBe(
			`sha256=${await hmacHex("raw-secret", request.body)}`,
		);
		expect(request.headers.has("webhook-id")).toBe(false);
	});

	test("fails a secret it cannot sign with as invalid-destination, before any request", async () => {
		let sent = await new Webhook({ url: WEBHOOK_URL, secret: "not base64!" }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("invalid-destination");
		expect(isFailure(sent) && sent.error.message).not.toContain("not base64!");
	});

	test.each([
		[410, "gone"],
		[401, "unauthorized"],
		[404, "rejected"],
		[503, "unavailable"],
	])("maps a %i answer to %s, never naming the URL or secret", async (status, code) => {
		server.use(
			http.post("https://hooks.acme.com/messaging", () => new HttpResponse(null, { status })),
		);

		let sent = await new Webhook({ url: WEBHOOK_URL, secret: SECRET }).send(MESSAGE);

		expect(isFailure(sent)).toBe(true);
		if (!isFailure(sent)) return;
		expect(sent.error.code).toBe(code);
		expect(sent.error.host).toBe("hooks.acme.com");
		expect(sent.error.message).not.toContain("url-secret");
		expect(sent.error.message).not.toContain(SECRET);
	});

	test("fails a redirect without following it", async () => {
		server.use(
			http.post(
				"https://hooks.acme.com/messaging",
				() => new HttpResponse(null, { status: 302, headers: { Location: "https://evil.com/" } }),
			),
		);

		let sent = await new Webhook({ url: WEBHOOK_URL, secret: SECRET }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("rejected");
	});

	test("refuses a private or reserved URL before any request", async () => {
		let sent = await new Webhook({ url: "http://127.0.0.1/hook", secret: SECRET }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("invalid-destination");
		expect(isFailure(Webhook.check("http://169.254.169.254/latest"))).toBe(true);
		expect(isFailure(Webhook.check("https://hooks.example/"))).toBe(true);
		expect(isSuccess(Webhook.check(WEBHOOK_URL))).toBe(true);
	});

	test("with resolve, refuses a public name that resolves to a private address", async () => {
		server.use(
			http.get("https://cloudflare-dns.com/dns-query", ({ request }) => {
				let url = new URL(request.url);
				let asksA = url.searchParams.get("type") === "A";
				return HttpResponse.json({
					Status: 0,
					Answer: asksA ? [{ name: "hooks.acme.com", type: 1, TTL: 60, data: "10.0.0.1" }] : [],
				});
			}),
		);

		let sent = await new Webhook({ url: WEBHOOK_URL, secret: SECRET, resolve: true }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("invalid-destination");
	});
});
