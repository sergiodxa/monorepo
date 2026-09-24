/**
 * Exercises the subscriber half of WebSub section by section: the subscription form and its
 * limits (§5.1), the hub's verification of intent and the answers to it (§5.2, §5.3), signed
 * content distribution (§7, §8) and the renewal instant of a granted lease.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Hex, hmac } from "@sdxc/crypto";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import {
	acknowledge,
	gone,
	parseVerification,
	received,
	refuse,
	renewalAt,
	subscribe,
	subscriptionRequest,
	unsubscribe,
	verifyDelivery,
} from "./subscriber.js";

import type { SignatureAlgorithm } from "./index.js";

import { WebSubRequestError, WebSubSignatureError, WebSubVerificationError } from "./index.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The hub every request in this file goes to. */
const HUB = "https://hub.example.com/";

/** The topic every subscription in this file is made under. */
const TOPIC = "https://blog.example.com/feed.xml";

/** The subscriber's callback, whose last segment is the unguessable half. */
const CALLBACK = "https://reader.example.com/websub/feed-1/3f9c2a";

/** The shared secret every signed delivery in this file uses. */
const SECRET = "a-shared-secret";

/** The options of a subscription that passes every check. */
const SUBSCRIPTION = { hub: HUB, topic: TOPIC, callback: CALLBACK, secret: SECRET };

/** The hash name WebCrypto keys each signature algorithm with. */
const WEBCRYPTO_HASH = {
	sha1: "SHA-1",
	sha256: "SHA-256",
	sha384: "SHA-384",
	sha512: "SHA-512",
} as const;

/** Signs a body the way a hub does, as the `method=hex` value of `X-Hub-Signature`. */
async function sign(body: string, algorithm: SignatureAlgorithm = "sha256", secret = SECRET) {
	let mac = unwrap(await hmac.sign(secret, body, { hash: WEBCRYPTO_HASH[algorithm] }));
	return `${algorithm}=${Hex.encode(mac)}`;
}

/** A delivery POST to the callback carrying the given body and headers. */
function delivery(body: BodyInit | null, headers: Record<string, string> = {}) {
	return new Request(CALLBACK, { method: "POST", body, headers });
}

/** Reads the form a request carries, as the hub would. */
async function formOf(request: Request) {
	return new URLSearchParams(await request.text());
}

describe(subscriptionRequest, () => {
	test("writes the subscribe form as an urlencoded POST to the hub (§5.1)", async () => {
		let request = unwrap(subscriptionRequest({ ...SUBSCRIPTION, leaseSeconds: 864_000 }));

		expect(request.method).toBe("POST");
		expect(request.url).toBe(HUB);
		expect(request.headers.get("content-type")).toBe("application/x-www-form-urlencoded");
		expect(Object.fromEntries(await formOf(request))).toEqual({
			"hub.mode": "subscribe",
			"hub.topic": TOPIC,
			"hub.callback": CALLBACK,
			"hub.secret": SECRET,
			"hub.lease_seconds": "864000",
		});
	});

	test("leaves hub.lease_seconds out when the subscriber leaves the lease to the hub", async () => {
		let form = await formOf(unwrap(subscriptionRequest(SUBSCRIPTION)));
		expect(form.has("hub.lease_seconds")).toBe(false);
	});

	test("writes the unsubscribe form without a secret or a lease", async () => {
		let request = unwrap(
			subscriptionRequest({ mode: "unsubscribe", hub: HUB, topic: TOPIC, callback: CALLBACK }),
		);

		expect(Object.fromEntries(await formOf(request))).toEqual({
			"hub.mode": "unsubscribe",
			"hub.topic": TOPIC,
			"hub.callback": CALLBACK,
		});
	});

	test("sends the topic verbatim, since the hub keys the subscription by that exact string", async () => {
		let topic = "https://blog.example.com/feed?format=rss&x=%7E";
		let form = await formOf(unwrap(subscriptionRequest({ ...SUBSCRIPTION, topic })));
		expect(form.get("hub.topic")).toBe(topic);
	});

	test("accepts a secret of 199 bytes and refuses one of 200 (§5.1.1)", () => {
		expect(isSuccess(subscriptionRequest({ ...SUBSCRIPTION, secret: "a".repeat(199) }))).toBe(true);

		let refused = subscriptionRequest({ ...SUBSCRIPTION, secret: "a".repeat(200) });
		expect(isFailure(refused) && refused.error).toBeInstanceOf(WebSubRequestError);
	});

	test("counts the secret's limit in UTF-8 bytes rather than characters", () => {
		let secret = "é".repeat(100);
		expect(isFailure(subscriptionRequest({ ...SUBSCRIPTION, secret }))).toBe(true);
	});

	test("refuses an empty secret, since every delivery must be verifiable", () => {
		expect(isFailure(subscriptionRequest({ ...SUBSCRIPTION, secret: "" }))).toBe(true);
	});

	test("refuses a hub reached over plain http, which would put the secret on the wire", () => {
		let refused = subscriptionRequest({ ...SUBSCRIPTION, hub: "http://hub.example.com/" });
		expect(isFailure(refused) && refused.error.status).toBeNull();
	});

	test("refuses a hub or callback that is not an absolute URL", () => {
		expect(isFailure(subscriptionRequest({ ...SUBSCRIPTION, hub: "/hub" }))).toBe(true);
		expect(isFailure(subscriptionRequest({ ...SUBSCRIPTION, callback: "/callback" }))).toBe(true);
	});

	test("refuses an empty topic", () => {
		expect(isFailure(subscriptionRequest({ ...SUBSCRIPTION, topic: "" }))).toBe(true);
	});

	test("refuses a lease that is not a positive whole number of seconds", () => {
		expect(isFailure(subscriptionRequest({ ...SUBSCRIPTION, leaseSeconds: 0 }))).toBe(true);
		expect(isFailure(subscriptionRequest({ ...SUBSCRIPTION, leaseSeconds: 1.5 }))).toBe(true);
	});
});

describe(subscribe, () => {
	test("succeeds when the hub answers 202 Accepted (§5.1.2)", async () => {
		let sent: URLSearchParams | undefined;
		server.use(
			http.post(HUB, async ({ request }) => {
				sent = await formOf(request);
				return new HttpResponse(null, { status: 202 });
			}),
		);

		expect(isSuccess(await subscribe(SUBSCRIPTION))).toBe(true);
		expect(sent?.get("hub.mode")).toBe("subscribe");
	});

	test("reports any other status as a refusal carrying it", async () => {
		server.use(http.post(HUB, () => new HttpResponse("nope", { status: 400 })));

		let result = await subscribe(SUBSCRIPTION);
		expect(isFailure(result) && result.error.status).toBe(400);
	});

	test("reports a 200, which a hub verifying asynchronously never sends, as a refusal", async () => {
		server.use(http.post(HUB, () => new HttpResponse(null, { status: 200 })));
		expect(isFailure(await subscribe(SUBSCRIPTION))).toBe(true);
	});

	test("reports a network failure with no status", async () => {
		server.use(http.post(HUB, () => HttpResponse.error()));

		let result = await subscribe(SUBSCRIPTION);
		expect(isFailure(result) && result.error.status).toBeNull();
	});

	test("gives up after the timeout", async () => {
		server.use(
			http.post(HUB, async () => {
				await new Promise((resolve) => setTimeout(resolve, 200));
				return new HttpResponse(null, { status: 202 });
			}),
		);

		let result = await subscribe({ ...SUBSCRIPTION, timeoutMs: 20 });
		expect(isFailure(result) && result.error.status).toBeNull();
	});

	test("sends nothing for options the builder refuses", async () => {
		let result = await subscribe({ ...SUBSCRIPTION, hub: "http://hub.example.com/" });
		expect(isFailure(result)).toBe(true);
	});
});

describe(unsubscribe, () => {
	test("sends the unsubscribe form and succeeds on 202", async () => {
		let sent: URLSearchParams | undefined;
		server.use(
			http.post(HUB, async ({ request }) => {
				sent = await formOf(request);
				return new HttpResponse(null, { status: 202 });
			}),
		);

		expect(isSuccess(await unsubscribe({ hub: HUB, topic: TOPIC, callback: CALLBACK }))).toBe(true);
		expect(sent?.get("hub.mode")).toBe("unsubscribe");
		expect(sent?.has("hub.secret")).toBe(false);
	});
});

describe(parseVerification, () => {
	/** A verification request the hub sends to the callback with the given `hub.*` fields. */
	function verification(fields: Record<string, string>) {
		let url = new URL(CALLBACK);
		for (let [name, value] of Object.entries(fields)) url.searchParams.set(name, value);
		return url;
	}

	test("reads a subscribe verification with its granted lease (§5.3)", () => {
		let url = verification({
			"hub.mode": "subscribe",
			"hub.topic": TOPIC,
			"hub.challenge": "c-123",
			"hub.lease_seconds": "432000",
		});

		expect(unwrap(parseVerification(url))).toEqual({
			mode: "subscribe",
			topic: TOPIC,
			challenge: "c-123",
			leaseSeconds: 432_000,
		});
	});

	test("reads the same fields off a Request", () => {
		let url = verification({
			"hub.mode": "unsubscribe",
			"hub.topic": TOPIC,
			"hub.challenge": "c-456",
		});

		expect(unwrap(parseVerification(new Request(url)))).toEqual({
			mode: "unsubscribe",
			topic: TOPIC,
			challenge: "c-456",
		});
	});

	test("fails a subscribe verification missing hub.lease_seconds", () => {
		let result = parseVerification(
			verification({ "hub.mode": "subscribe", "hub.topic": TOPIC, "hub.challenge": "c" }),
		);
		expect(isFailure(result) && result.error).toBeInstanceOf(WebSubVerificationError);
	});

	test("fails a lease that is not a whole number of seconds", () => {
		for (let lease of ["-1", "1.5", "ten", ""]) {
			let result = parseVerification(
				verification({
					"hub.mode": "subscribe",
					"hub.topic": TOPIC,
					"hub.challenge": "c",
					"hub.lease_seconds": lease,
				}),
			);
			expect(isFailure(result)).toBe(true);
		}
	});

	test("fails a verification without a challenge or a topic", () => {
		expect(
			isFailure(parseVerification(verification({ "hub.mode": "unsubscribe", "hub.topic": TOPIC }))),
		).toBe(true);
		expect(
			isFailure(
				parseVerification(verification({ "hub.mode": "unsubscribe", "hub.challenge": "c" })),
			),
		).toBe(true);
	});

	test("reads a denial with its reason (§5.2)", () => {
		let url = verification({
			"hub.mode": "denied",
			"hub.topic": TOPIC,
			"hub.reason": "unauthorized topic",
		});

		expect(unwrap(parseVerification(url))).toEqual({
			mode: "denied",
			topic: TOPIC,
			reason: "unauthorized topic",
		});
	});

	test("reads a denial without a reason as a null reason", () => {
		let url = verification({ "hub.mode": "denied", "hub.topic": TOPIC });
		expect(unwrap(parseVerification(url))).toEqual({ mode: "denied", topic: TOPIC, reason: null });
	});

	test("fails an unknown or missing mode", () => {
		expect(isFailure(parseVerification(verification({ "hub.mode": "publish" })))).toBe(true);
		expect(isFailure(parseVerification(new URL(CALLBACK)))).toBe(true);
	});
});

describe("answering a verification", () => {
	test("acknowledge echoes the challenge as 200 text/plain (§5.3.1)", async () => {
		let response = acknowledge({ mode: "unsubscribe", topic: TOPIC, challenge: "c-789" });

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
		expect(await response.text()).toBe("c-789");
	});

	test("refuse answers 404 with an empty body", async () => {
		let response = refuse();
		expect(response.status).toBe(404);
		expect(await response.text()).toBe("");
	});

	test("gone answers 410, which ends the hub's subscription (§7)", () => {
		expect(gone().status).toBe(410);
	});

	test("received answers 202 with an empty body", async () => {
		let response = received();
		expect(response.status).toBe(202);
		expect(await response.text()).toBe("");
	});
});

describe(verifyDelivery, () => {
	/** The feed a hub distributes in the tests below. */
	const BODY = `<?xml version="1.0"?><rss version="2.0"><channel><title>Blog</title></channel></rss>`;

	test.each(["sha1", "sha256", "sha384", "sha512"] as const)(
		"accepts a body signed with %s (§8)",
		async (algorithm) => {
			let request = delivery(BODY, {
				"content-type": "application/rss+xml",
				"x-hub-signature": await sign(BODY, algorithm),
			});

			let result = unwrap(await verifyDelivery(request, SECRET));
			expect(new TextDecoder().decode(result.body)).toBe(BODY);
			expect(result.algorithm).toBe(algorithm);
			expect(result.contentType).toBe("application/rss+xml");
		},
	);

	test("accepts an uppercase hex signature", async () => {
		let [method, hex] = (await sign(BODY)).split("=");
		let request = delivery(BODY, { "x-hub-signature": `${method}=${hex?.toUpperCase()}` });

		expect(isSuccess(await verifyDelivery(request, SECRET))).toBe(true);
	});

	test("checks the bytes exactly as they arrived", async () => {
		let bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x3c, 0x61, 0x2f, 0x3e, 0xff]);
		let mac = unwrap(await hmac.sign(SECRET, bytes));
		let request = delivery(bytes, { "x-hub-signature": `sha256=${Hex.encode(mac)}` });

		let result = unwrap(await verifyDelivery(request, SECRET));
		expect(result.body).toEqual(bytes);
	});

	test("refuses a delivery with no signature as missing, never as a pass", async () => {
		let result = await verifyDelivery(delivery(BODY), SECRET);

		expect(isFailure(result) && result.error).toBeInstanceOf(WebSubSignatureError);
		expect(isFailure(result) && result.error.reason).toBe("missing");
	});

	test("refuses a signature signed with a different secret as a mismatch", async () => {
		let request = delivery(BODY, { "x-hub-signature": await sign(BODY, "sha256", "other") });

		let result = await verifyDelivery(request, SECRET);
		expect(isFailure(result) && result.error.reason).toBe("mismatch");
	});

	test("refuses a signature over a different body as a mismatch", async () => {
		let request = delivery(`${BODY} `, { "x-hub-signature": await sign(BODY) });

		let result = await verifyDelivery(request, SECRET);
		expect(isFailure(result) && result.error.reason).toBe("mismatch");
	});

	test("refuses an unknown method as algorithm", async () => {
		let request = delivery(BODY, { "x-hub-signature": "md5=d41d8cd98f00b204e9800998ecf8427e" });

		let result = await verifyDelivery(request, SECRET);
		expect(isFailure(result) && result.error.reason).toBe("algorithm");
	});

	test("refuses an algorithm the caller narrowed out", async () => {
		let request = delivery(BODY, { "x-hub-signature": await sign(BODY, "sha1") });

		let result = await verifyDelivery(request, SECRET, { algorithms: ["sha256", "sha512"] });
		expect(isFailure(result) && result.error.reason).toBe("algorithm");
	});

	test.each(["sha256", "sha256=", "=abcd", "sha256=zz", "sha256=abc"])(
		"refuses the malformed signature %j",
		async (header) => {
			let result = await verifyDelivery(delivery(BODY, { "x-hub-signature": header }), SECRET);
			expect(isFailure(result) && result.error.reason).toBe("malformed");
		},
	);

	test("refuses a body past maxBytes before checking its signature", async () => {
		let body = "x".repeat(2_048);
		let request = delivery(body, { "x-hub-signature": await sign(body) });

		let result = await verifyDelivery(request, SECRET, { maxBytes: 1_024 });
		expect(isFailure(result) && result.error.reason).toBe("too-large");
	});

	test("refuses a streamed body past maxBytes that declares no length", async () => {
		let chunk = new TextEncoder().encode("x".repeat(600));
		let stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(chunk);
				controller.enqueue(chunk);
				controller.close();
			},
		});
		let request = new Request(CALLBACK, {
			method: "POST",
			body: stream,
			headers: { "x-hub-signature": await sign("x".repeat(1_200)) },
			duplex: "half",
		} as RequestInit);

		let result = await verifyDelivery(request, SECRET, { maxBytes: 1_024 });
		expect(isFailure(result) && result.error.reason).toBe("too-large");
	});

	test("accepts a body of exactly maxBytes", async () => {
		let body = "x".repeat(1_024);
		let request = delivery(body, { "x-hub-signature": await sign(body) });

		expect(isSuccess(await verifyDelivery(request, SECRET, { maxBytes: 1_024 }))).toBe(true);
	});

	test("reads rel=hub and rel=self off the delivery's Link header (§7)", async () => {
		let request = delivery(BODY, {
			"x-hub-signature": await sign(BODY),
			link: `<${HUB}>; rel="hub", <${TOPIC}>; rel="self"`,
		});

		let result = unwrap(await verifyDelivery(request, SECRET));
		expect(result.hub).toBe(HUB);
		expect(result.self).toBe(TOPIC);
	});

	test("reports null links and content type for a delivery that sends none", async () => {
		let request = delivery(new TextEncoder().encode(BODY), { "x-hub-signature": await sign(BODY) });

		let result = unwrap(await verifyDelivery(request, SECRET));
		expect(result.hub).toBeNull();
		expect(result.self).toBeNull();
		expect(result.contentType).toBeNull();
	});
});

describe(renewalAt, () => {
	/** The instant every lease in this block is granted at. */
	const VERIFIED_AT = Date.UTC(2026, 8, 24);

	/** One hour, in milliseconds. */
	const HOUR = 3_600_000;

	test("renews once the default share of a long lease has elapsed", () => {
		let leaseSeconds = 10 * 24 * 3_600;
		expect(renewalAt({ verifiedAt: VERIFIED_AT, leaseSeconds })).toBe(
			VERIFIED_AT + leaseSeconds * 1000 * 0.8,
		);
	});

	test("renews at least the minimum lead before expiry when the share would leave less", () => {
		expect(renewalAt({ verifiedAt: VERIFIED_AT, leaseSeconds: 24 * 3_600 })).toBe(
			VERIFIED_AT + 18 * HOUR,
		);
	});

	test("renews a lease shorter than the minimum lead at its midpoint, never immediately", () => {
		let at = renewalAt({ verifiedAt: VERIFIED_AT, leaseSeconds: 4 * 3_600 });
		expect(at).toBe(VERIFIED_AT + 2 * HOUR);
	});

	test("honours a custom share and lead", () => {
		expect(
			renewalAt({
				verifiedAt: VERIFIED_AT,
				leaseSeconds: 100 * 3_600,
				share: 0.5,
				minimumLeadMs: HOUR,
			}),
		).toBe(VERIFIED_AT + 50 * HOUR);
	});

	test("renews a zero-second lease at once", () => {
		expect(renewalAt({ verifiedAt: VERIFIED_AT, leaseSeconds: 0 })).toBe(VERIFIED_AT);
	});
});
