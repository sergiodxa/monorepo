/**
 * Drives `WebPush` against push services MSW stands in for: the headers and VAPID token a
 * service authenticates by, the token cache, every status a service answers and what it
 * classifies as, the refusals decided before a request, and rotation between key pairs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64Url } from "@sdxc/crypto";
import { JWK, JWT } from "@sdxc/jwt";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { Subscription, VapidKeys } from "./index.js";

import { MAX_PAYLOAD_BYTES, PUSH_SERVICE_HOSTS, WebPush } from "./index.js";

/** Endpoints shaped like the four push services the major browsers use. */
const ENDPOINTS = {
	fcm: "https://fcm.googleapis.com/fcm/send/device-1",
	mozilla: "https://updates.push.services.mozilla.com/wpush/v2/device-1",
	apple: "https://web.push.apple.com/QGuQyavXutnMTrS-7ZmN5qLL",
	wns: "https://wns2-par02p.notify.windows.com/w/?token=device-1",
} as const;

/** The client key material from RFC 8291's example, which a browser could have issued. */
const KEYS = {
	p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
	auth: "BTBZMqHH6r4Tts7J_aSIgg",
};

/** A subscription on Firebase, which most tests send to. */
const SUBSCRIPTION: Subscription = { endpoint: ENDPOINTS.fcm, keys: KEYS };

/** What each push service received, in order. */
let received: Request[] = [];

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
	server.resetHandlers();
	vi.useRealTimers();
});
afterAll(() => server.close());

beforeEach(() => {
	received = [];
	answer(201);
});

/** Answers every push with one status and headers, recording what arrived. */
function answer(status: number, headers: Record<string, string> = {}): void {
	server.use(
		http.post(/.*/u, ({ request }) => {
			received.push(request.clone());
			return new HttpResponse(null, { status, headers });
		}),
	);
}

/** A fresh identity, as an app would generate and store one. */
async function identity(): Promise<VapidKeys> {
	return { ...(await WebPush.generateKeys()), subject: "mailto:ops@example.com" };
}

/** Reads the token and key out of a `vapid t=…, k=…` header. */
function credential(header: string | null): { token: string; key: string } {
	let match = /^vapid t=([^,]+), k=(.+)$/u.exec(header ?? "");
	return { token: match?.[1] ?? "", key: match?.[2] ?? "" };
}

/** Verifies a VAPID token against the public key it names, as a push service does. */
async function verify(token: string, publicKey: string, audience: string): Promise<JWT> {
	let point = unwrap(Base64Url.decode(publicKey));
	let key = await crypto.subtle.importKey(
		"raw",
		Uint8Array.from(point),
		{ name: "ECDSA", namedCurve: "P-256" },
		true,
		["verify"],
	);
	let jwk = { ...(await crypto.subtle.exportKey("jwk", key)), kid: "vapid", alg: "ES256" };
	return await JWT.verify(token, [{ jwk }], { audience, algorithms: [JWK.Algorithm.ES256] });
}

describe("the request that delivers one message", () => {
	test("carries the encrypted record and every header a push service routes on", async () => {
		let push = new WebPush({ vapid: await identity() });

		let request = unwrap(
			await push.request(SUBSCRIPTION, "Twelve unread", {
				ttl: "1 hour",
				urgency: "high",
				topic: "summary",
			}),
		);

		expect(request.method).toBe("POST");
		expect(request.url).toBe(ENDPOINTS.fcm);
		expect(request.redirect).toBe("manual");
		expect(request.headers.get("Content-Encoding")).toBe("aes128gcm");
		expect(request.headers.get("Content-Type")).toBe("application/octet-stream");
		expect(request.headers.get("TTL")).toBe("3600");
		expect(request.headers.get("Urgency")).toBe("high");
		expect(request.headers.get("Topic")).toBe("summary");
		expect((await request.arrayBuffer()).byteLength).toBe(86 + 13 + 17);
	});

	test("defaults to four weeks at normal urgency with no topic", async () => {
		let push = new WebPush({ vapid: await identity() });

		let request = unwrap(await push.request(SUBSCRIPTION, "hello"));

		expect(request.headers.get("TTL")).toBe("2419200");
		expect(request.headers.get("Urgency")).toBe("normal");
		expect(request.headers.has("Topic")).toBe(false);
	});

	test("sends a push with no payload as an empty, unencoded body", async () => {
		let push = new WebPush({ vapid: await identity() });

		let request = unwrap(await push.request(SUBSCRIPTION));

		expect(request.headers.has("Content-Encoding")).toBe(false);
		expect((await request.arrayBuffer()).byteLength).toBe(0);
		expect(request.headers.get("Authorization")).toMatch(/^vapid t=/u);
	});

	test("takes a payload of exactly the limit, padding included, and refuses one byte more", async () => {
		let push = new WebPush({ vapid: await identity() });

		let fits = await push.request(SUBSCRIPTION, "a".repeat(MAX_PAYLOAD_BYTES - 7), {
			padding: 7,
		});
		let over = await push.request(SUBSCRIPTION, "a".repeat(MAX_PAYLOAD_BYTES + 1));

		expect(isSuccess(fits) && (await fits.data.arrayBuffer()).byteLength).toBe(4096);
		expect(isFailure(over) && over.error.code).toBe("payload-too-large");
	});

	/** A title in another script takes several bytes a character, which is what is counted. */
	test("measures a text payload in UTF-8 bytes", async () => {
		let push = new WebPush({ vapid: await identity() });

		let result = await push.request(SUBSCRIPTION, "é".repeat(Math.ceil(MAX_PAYLOAD_BYTES / 2)));

		expect(isFailure(result) && result.error.code).toBe("payload-too-large");
	});

	test.each([
		["a topic over 32 characters", { topic: "a".repeat(33) }],
		["a topic outside base64url", { topic: "new post!" }],
		["a negative TTL", { ttl: -1000 }],
		["padding that cannot fit", { padding: MAX_PAYLOAD_BYTES + 1 }],
		["fractional padding", { padding: 1.5 }],
	])("refuses %s before any request", async (_case, options) => {
		let push = new WebPush({ vapid: await identity() });

		let sent = await push.send(SUBSCRIPTION, "hello", options);

		expect(isFailure(sent) && sent.error.code).toBe("invalid-options");
		expect(received).toHaveLength(0);
	});
});

describe("the VAPID credential", () => {
	test("verifies under the public key it names, for the endpoint's origin, within 24 hours", async () => {
		let vapid = await identity();
		let push = new WebPush({ vapid });

		let request = unwrap(await push.request({ ...SUBSCRIPTION, endpoint: `${ENDPOINTS.fcm}?x=1` }));
		let { token, key } = credential(request.headers.get("Authorization"));

		expect(key).toBe(vapid.publicKey);

		let verified = await verify(token, key, "https://fcm.googleapis.com");
		let exp = verified.payload.exp ?? 0;

		expect(verified.payload.sub).toBe(vapid.subject);
		expect(exp - Date.now() / 1000).toBeGreaterThan(11 * 60 * 60);
		expect(exp - Date.now() / 1000).toBeLessThanOrEqual(24 * 60 * 60);
	});

	test("signs once per push service origin and reuses the token", async () => {
		let push = new WebPush({ vapid: await identity() });

		let first = unwrap(await push.request(SUBSCRIPTION));
		let second = unwrap(
			await push.request({ ...SUBSCRIPTION, endpoint: `${ENDPOINTS.fcm.slice(0, -1)}2` }),
		);
		let mozilla = unwrap(await push.request({ ...SUBSCRIPTION, endpoint: ENDPOINTS.mozilla }));

		expect(second.headers.get("Authorization")).toBe(first.headers.get("Authorization"));
		expect(mozilla.headers.get("Authorization")).not.toBe(first.headers.get("Authorization"));
	});

	test("signs a new token once less than an hour of the old one is left", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(Date.UTC(2026, 9, 8, 0, 0, 0));
		let push = new WebPush({ vapid: await identity() });

		let first = unwrap(await push.request(SUBSCRIPTION)).headers.get("Authorization");
		vi.setSystemTime(Date.UTC(2026, 9, 8, 10, 59, 0));
		let reused = unwrap(await push.request(SUBSCRIPTION)).headers.get("Authorization");
		vi.setSystemTime(Date.UTC(2026, 9, 8, 11, 1, 0));
		let renewed = unwrap(await push.request(SUBSCRIPTION)).headers.get("Authorization");

		expect(reused).toBe(first);
		expect(renewed).not.toBe(first);
	});

	test.each([
		["a subject that is no mailto: or https: URI", { subject: "ops@example.com" }],
		["a public key that is no point", { publicKey: "BAAA" }],
		["a private key of the wrong length", { privateKey: "AAAA" }],
	])("refuses %s as invalid-vapid", async (_case, override) => {
		let push = new WebPush({ vapid: { ...(await identity()), ...override } });

		let sent = await push.send(SUBSCRIPTION, "hello");

		expect(isFailure(sent) && sent.error.code).toBe("invalid-vapid");
		expect(received).toHaveLength(0);
	});

	test("refuses a private key that belongs to another pair", async () => {
		let vapid = await identity();
		let other = await identity();
		let push = new WebPush({ vapid: { ...vapid, privateKey: other.privateKey } });

		let sent = await push.send(SUBSCRIPTION, "hello");

		expect(isFailure(sent) && sent.error.code).toBe("invalid-vapid");
	});
});

describe("what a push service's answer means", () => {
	test.each(Object.entries(ENDPOINTS))("a 201 from %s is a success", async (_name, endpoint) => {
		let push = new WebPush({ vapid: await identity() });

		let sent = await push.send({ endpoint, keys: KEYS }, "hello");

		expect(sent).toEqual({ status: "success", data: { status: 201 } });
		expect(received[0]?.url).toBe(endpoint);
	});

	test.each([
		[200, null],
		[202, null],
		[404, "gone"],
		[410, "gone"],
		[401, "unauthorized"],
		[403, "unauthorized"],
		[400, "rejected"],
		[413, "rejected"],
		[301, "rejected"],
		[307, "rejected"],
		[429, "rate-limited"],
		[500, "unavailable"],
		[503, "unavailable"],
	])("a %i classifies as %s", async (status, code) => {
		answer(status, status >= 300 && status < 400 ? { Location: "https://example.com/" } : {});
		let push = new WebPush({ vapid: await identity() });

		let sent = await push.send(SUBSCRIPTION, "hello");

		if (code === null) {
			expect(sent).toEqual({ status: "success", data: { status } });
			return;
		}
		expect(isFailure(sent) && sent.error.code).toBe(code);
		expect(isFailure(sent) && sent.error.status).toBe(status);
		expect(isFailure(sent) && sent.error.host).toBe("fcm.googleapis.com");
		expect(received).toHaveLength(1);
	});

	test("carries Retry-After as milliseconds and marks the failure retryable", async () => {
		answer(429, { "Retry-After": "30" });
		let push = new WebPush({ vapid: await identity() });

		let sent = await push.send(SUBSCRIPTION, "hello");

		expect(isFailure(sent) && sent.error.retryAfter).toBe(30_000);
		expect(isFailure(sent) && sent.error.retryable).toBe(true);
	});

	test("reads Retry-After written as an HTTP date", async () => {
		answer(503, { "Retry-After": new Date(Date.now() + 60_000).toUTCString() });
		let push = new WebPush({ vapid: await identity() });

		let sent = await push.send(SUBSCRIPTION, "hello");
		let delay = isFailure(sent) ? (sent.error.retryAfter ?? 0) : 0;

		expect(delay).toBeGreaterThan(55_000);
		expect(delay).toBeLessThanOrEqual(60_000);
	});

	test("a rejected fetch is network, retryable, and names only the host", async () => {
		server.use(http.post(/.*/u, () => HttpResponse.error()));
		let push = new WebPush({ vapid: await identity() });

		let sent = await push.send(SUBSCRIPTION, "hello");

		expect(isFailure(sent) && sent.error.code).toBe("network");
		expect(isFailure(sent) && sent.error.retryable).toBe(true);
		expect(isFailure(sent) && sent.error.message).not.toContain("device-1");
	});

	test("a push service slower than the deadline is a timeout", async () => {
		server.use(http.post(/.*/u, () => new Promise<Response>(() => undefined)));
		let push = new WebPush({ vapid: await identity() });

		let sent = await push.send(SUBSCRIPTION, "hello", { timeout: 50 });

		expect(isFailure(sent) && sent.error.code).toBe("timeout");
	});
});

describe("the subscription a send is addressed to", () => {
	test.each([
		["plain http", { endpoint: "http://fcm.googleapis.com/fcm/send/device-1" }],
		["a private address", { endpoint: "https://10.0.0.1/push" }],
		["the metadata address", { endpoint: "https://169.254.169.254/latest" }],
		["a reserved name", { endpoint: "https://push.internal/send" }],
		["credentials in the URL", { endpoint: "https://user:pass@fcm.googleapis.com/send" }],
		["a string that is no URL", { endpoint: "not a url" }],
		["a short p256dh", { keys: { ...KEYS, p256dh: KEYS.p256dh.slice(0, 40) } }],
		["a point without the 0x04 prefix", { keys: { ...KEYS, p256dh: `A${KEYS.p256dh.slice(1)}` } }],
		["a point off the curve", { keys: { ...KEYS, p256dh: `${KEYS.p256dh.slice(0, -2)}AA` } }],
		["a short auth secret", { keys: { ...KEYS, auth: "BTBZMqHH6r4Tts7J" } }],
	])("refuses %s before any request", async (_case, override) => {
		let push = new WebPush({ vapid: await identity() });

		let sent = await push.send({ ...SUBSCRIPTION, ...override }, "hello");

		expect(isFailure(sent) && sent.error.code).toBe("invalid-subscription");
		expect(received).toHaveLength(0);
	});

	test("an allow list refuses an endpoint on any other public host", async () => {
		let push = new WebPush({ vapid: await identity(), allowedHosts: PUSH_SERVICE_HOSTS });

		let other = await push.send({ endpoint: "https://push.example.com/d", keys: KEYS }, "hi");
		let wns = await push.send({ endpoint: ENDPOINTS.wns, keys: KEYS }, "hi");

		expect(isFailure(other) && other.error.code).toBe("invalid-subscription");
		expect(isSuccess(wns)).toBe(true);
	});
});

describe("rotating the VAPID key", () => {
	test("signs with the pair the subscription was made under", async () => {
		let current = await identity();
		let old = await identity();
		let push = new WebPush({ vapid: current, previous: [old] });

		let underOld = unwrap(
			await push.request({ ...SUBSCRIPTION, applicationServerKey: old.publicKey }),
		);
		let underCurrent = unwrap(
			await push.request({ ...SUBSCRIPTION, applicationServerKey: current.publicKey }),
		);
		let unrecorded = unwrap(await push.request(SUBSCRIPTION));

		let oldCredential = credential(underOld.headers.get("Authorization"));
		expect(oldCredential.key).toBe(old.publicKey);
		await expect(
			verify(oldCredential.token, old.publicKey, "https://fcm.googleapis.com"),
		).resolves.toBeInstanceOf(JWT);

		expect(credential(underCurrent.headers.get("Authorization")).key).toBe(current.publicKey);
		expect(credential(unrecorded.headers.get("Authorization")).key).toBe(current.publicKey);
	});

	test("refuses a subscription made under a key this sender no longer holds", async () => {
		let dropped = await identity();
		let push = new WebPush({ vapid: await identity() });

		let sent = await push.send({ ...SUBSCRIPTION, applicationServerKey: dropped.publicKey }, "hi");

		expect(isFailure(sent) && sent.error.code).toBe("invalid-subscription");
		expect(received).toHaveLength(0);
	});
});
