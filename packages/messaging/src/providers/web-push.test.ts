/**
 * Exercises the browser push destination over MSW standing in for the push service: the
 * payload a service worker receives, the urgency and topic headers, fitting a long text
 * into one push, and the mapping of every web push failure to a messaging code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Subscription } from "@sdxc/web-push";

import { isFailure, isSuccess } from "@sdxc/result";
import { MAX_PAYLOAD_BYTES, WebPush } from "@sdxc/web-push";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { Message } from "../message.js";

import { describeDestination } from "../conformance.js";

import { BrowserPush } from "./web-push.js";

/** The endpoint every test pushes to. */
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/device-1";

/** A browser subscription with RFC 8291's example key material. */
const SUBSCRIPTION: Subscription = {
	endpoint: ENDPOINT,
	keys: {
		p256dh:
			"BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
		auth: "BTBZMqHH6r4Tts7J_aSIgg",
	},
};

const MESSAGE: Message = {
	title: "api.acme.com is down",
	text: "Timed out from **gru** after `30s`.",
	severity: "critical",
	fields: [{ label: "Region", value: "gru" }],
	links: [
		{ label: "Open dashboard", url: "https://uptime.acme.com/m/1" },
		{ label: "Runbook", url: "https://wiki.acme.com/api" },
	],
	timestamp: new Date("2026-10-08T12:00:00.000Z"),
	key: "monitor-42",
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The sender every destination in this file uses, generated once. */
let push: WebPush;

beforeAll(async () => {
	let keys = await WebPush.generateKeys();
	push = new WebPush({ vapid: { ...keys, subject: "mailto:ops@acme.com" } });
});

/** Every push the service received, as its headers. */
let received: Headers[] = [];

/** Answers every push with `status`, recording the headers that arrived. */
function answer(status: number, headers: Record<string, string> = {}): void {
	server.use(
		http.post(ENDPOINT, ({ request }) => {
			received.push(request.headers);
			return new HttpResponse(null, { status, headers });
		}),
	);
}

beforeEach(() => {
	received = [];
	answer(201);
});

describeDestination({
	name: "BrowserPush",
	capabilities: [],
	create: () => new BrowserPush({ push, subscription: SUBSCRIPTION }),
	rateLimitNext: (delayMs) =>
		server.use(
			http.post(
				ENDPOINT,
				() =>
					new HttpResponse(null, {
						status: 429,
						headers: { "Retry-After": String(delayMs / 1000) },
					}),
				{ once: true },
			),
		),
});

describe("BrowserPush", () => {
	test("renders the payload a service worker draws", () => {
		let payload = new BrowserPush({ push, subscription: SUBSCRIPTION }).render(MESSAGE);

		expect(payload).toEqual({
			title: "api.acme.com is down",
			body: "Timed out from gru after 30s.\nRegion: gru",
			url: "https://uptime.acme.com/m/1",
			tag: "monitor-42",
			severity: "critical",
			timestamp: "2026-10-08T12:00:00.000Z",
		});
	});

	test("renders a bare title with nothing optional", () => {
		let payload = new BrowserPush({ push, subscription: SUBSCRIPTION }).render({ title: "Hi" });

		expect(payload).toEqual({ title: "Hi", body: "", severity: "info" });
	});

	test("sends with the key as its topic and high urgency for a critical message", async () => {
		let sent = await new BrowserPush({ push, subscription: SUBSCRIPTION, ttl: "1 hour" }).send(
			MESSAGE,
		);

		expect(isSuccess(sent) && sent.data.ref).toBeNull();
		expect(received[0]?.get("topic")).toBe("monitor-42");
		expect(received[0]?.get("urgency")).toBe("high");
		expect(received[0]?.get("ttl")).toBe("3600");
	});

	test("hashes a key that is no valid topic into one, the same every time", async () => {
		let destination = new BrowserPush({ push, subscription: SUBSCRIPTION });
		let key = "https://api.acme.com/health is a monitor key";

		await destination.send({ title: "Down", key });
		await destination.send({ title: "Up", key });

		let topic = received[0]?.get("topic") ?? "";
		expect(topic).toMatch(/^[\w-]{32}$/u);
		expect(received[1]?.get("topic")).toBe(topic);
	});

	test("sends a message without a key untopiced at normal urgency", async () => {
		await new BrowserPush({ push, subscription: SUBSCRIPTION }).send({ title: "Deployed" });

		expect(received[0]?.has("topic")).toBe(false);
		expect(received[0]?.get("urgency")).toBe("normal");
	});

	test("cuts a long text so the payload fits one push, and still sends", async () => {
		let destination = new BrowserPush({ push, subscription: SUBSCRIPTION });
		let long: Message = { ...MESSAGE, text: "ünïcödé ".repeat(2000) };

		let payload = destination.render(long);
		let sent = await destination.send(long);

		expect(new TextEncoder().encode(JSON.stringify(payload)).length).toBeLessThanOrEqual(
			MAX_PAYLOAD_BYTES,
		);
		expect(payload.body).toMatch(/…\nRegion: gru$/u);
		expect(isSuccess(sent)).toBe(true);
	});

	test.each([
		[404, "gone"],
		[410, "gone"],
		[403, "unauthorized"],
		[400, "rejected"],
		[503, "unavailable"],
	])("maps a %i to %s, naming the host and not the endpoint", async (status, code) => {
		answer(status);

		let sent = await new BrowserPush({ push, subscription: SUBSCRIPTION }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe(code);
		expect(isFailure(sent) && sent.error.provider).toBe("web-push");
		expect(isFailure(sent) && sent.error.host).toBe("fcm.googleapis.com");
		expect(isFailure(sent) && sent.error.status).toBe(status);
		expect(isFailure(sent) && sent.error.message).not.toContain("device-1");
	});

	test("refuses a subscription on a private host as invalid-destination", async () => {
		let destination = new BrowserPush({
			push,
			subscription: { ...SUBSCRIPTION, endpoint: "https://10.0.0.1/push" },
		});

		let sent = await destination.send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("invalid-destination");
		expect(received).toHaveLength(0);
	});

	test("maps unusable VAPID keys to unauthorized before any request", async () => {
		let broken = new WebPush({
			vapid: { publicKey: "BAAA", privateKey: "AAAA", subject: "mailto:ops@acme.com" },
		});

		let sent = await new BrowserPush({ push: broken, subscription: SUBSCRIPTION }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("unauthorized");
		expect(received).toHaveLength(0);
	});

	test("a rejected fetch is a retryable network failure", async () => {
		server.use(http.post(ENDPOINT, () => HttpResponse.error()));

		let sent = await new BrowserPush({ push, subscription: SUBSCRIPTION }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("network");
		expect(isFailure(sent) && sent.error.retryable).toBe(true);
	});
});
