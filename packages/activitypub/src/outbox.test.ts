/**
 * Delivery against MSW inboxes that verify every signature they receive: double-knocking
 * between the two schemes and the per-origin memory of the one that landed, each outcome
 * row, and fan-out's addressing, deduplication, paging, skipping and size bound.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { CacheError } from "@sdxc/cache";
import { MemoryCache } from "@sdxc/cache/memory";
import { verify } from "@sdxc/http-signatures";
import { failure, isFailure, success, unwrap } from "@sdxc/result";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { ActorKeys } from "./keys.js";
import type { DeliveryInput, FanOutOptions } from "./outbox.js";
import type { Follower } from "./store.js";

import { generateActorKeys, importActorKeys, importPublicKey } from "./keys.js";
import { isUnavailable, recordFailure, UNAVAILABLE_AFTER } from "./lib/availability.js";
import { PUBLIC } from "./lib/constants.js";
import { MemoryFollowerStore, MemoryKeyProvider } from "./memory.js";
import {
	DELIVERY_BACKOFF,
	DELIVERY_INPUT,
	DeliveryError,
	FAN_OUT_INPUT,
	MAX_ACTIVITY_BYTES,
	deliver,
	fanOut,
	parseRetryAfter,
} from "./outbox.js";
import { createResolver } from "./remote.js";

const ACTOR_ID = "https://letters.blog/activitypub/actor";
const FOLLOWERS_ID = "https://letters.blog/activitypub/followers";
const USER_AGENT = "letters.blog/1.0 (+https://letters.blog)";
const INBOX = "https://mastodon.social/inbox";
const ORIGIN = "https://mastodon.social";

const ACTIVITY = JSON.stringify({
	"@context": "https://www.w3.org/ns/activitystreams",
	id: "https://letters.blog/articles/hello#create",
	type: "Create",
	actor: ACTOR_ID,
	to: [PUBLIC],
	cc: [FOLLOWERS_ID],
	object: {
		id: "https://letters.blog/articles/hello",
		type: "Article",
		attributedTo: ACTOR_ID,
		to: [PUBLIC],
		cc: [FOLLOWERS_ID],
		name: "Hello",
	},
});

const server = setupServer();

let keys: ActorKeys;
let publicKey: CryptoKey;
let received: Received[];

/** What an inbox saw: the scheme it verified, or `null` when the signature failed. */
interface Received {
	url: string;
	scheme: string | null;
	label: string | null;
	components: string[];
	headers: Headers;
	body: string;
}

beforeAll(async () => {
	server.listen({ onUnhandledRequest: "error" });
	let generated = unwrap(await generateActorKeys());
	keys = unwrap(await importActorKeys({ actor: ACTOR_ID, privateKeyPem: generated.privateKeyPem }));
	publicKey = unwrap(await importPublicKey(keys.rsa.publicKeyPem));
});

beforeEach(() => {
	received = [];
	server.use(publicDns());
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

/** Every name resolves to one public address, so the inbox host passes resolution. */
function publicDns() {
	return http.get("https://cloudflare-dns.com/dns-query", ({ request }) => {
		let url = new URL(request.url);
		let name = url.searchParams.get("name") ?? "";
		let asksA = url.searchParams.get("type") !== "AAAA";
		return HttpResponse.json({
			Status: 0,
			Answer: asksA ? [{ name, type: 1, TTL: 60, data: "93.184.216.34" }] : [],
		});
	});
}

/**
 * Verifies a POST against the local actor's key and records what arrived, so a handler
 * decides its answer from the verified scheme.
 */
async function record(request: Request, label?: string): Promise<Received> {
	let body = new Uint8Array(await request.arrayBuffer());
	let verified = await verify(request, {
		body,
		key: async (keyId) => success(keyId === keys.rsa.id ? publicKey : null),
		maxAge: "1 hour",
		...(label === undefined ? {} : { label }),
	});
	let entry: Received = {
		url: request.url,
		scheme: isFailure(verified) ? null : verified.data.scheme,
		label: isFailure(verified) ? null : verified.data.label,
		components: isFailure(verified) ? [] : verified.data.components,
		headers: new Headers(request.headers),
		body: new TextDecoder().decode(body),
	};
	received.push(entry);
	return entry;
}

/** An inbox that accepts only the given scheme, answering `refusal` to anything else. */
function inboxAccepting(scheme: "rfc9421" | "draft-cavage", url = INBOX, refusal = 401) {
	return http.post(url, async ({ request }) => {
		let entry = await record(request);
		return new HttpResponse(null, { status: entry.scheme === scheme ? 202 : refusal });
	});
}

/** An inbox that answers `status` (and `headers`) to a correctly signed POST. */
function inboxAnswering(status: number, headers: Record<string, string> = {}) {
	return http.post(INBOX, async ({ request }) => {
		let entry = await record(request);
		if (entry.scheme === null) return new HttpResponse(null, { status: 401 });
		return new HttpResponse(null, { status, headers });
	});
}

/** The input every delivery test sends. */
function input(inbox = INBOX): DeliveryInput {
	return { actor: ACTOR_ID, activity: ACTIVITY, inbox };
}

/** `deliver` with the local keys and the given cache. */
function send(cache = new MemoryCache(), overrides: Partial<DeliveryInput> = {}, timeout?: number) {
	return deliver(
		{ ...input(), ...overrides },
		{
			keys: new MemoryKeyProvider([keys]),
			cache,
			userAgent: USER_AGENT,
			...(timeout === undefined ? {} : { timeout }),
		},
	);
}

/** Asserts a delivery failed with `code`, answering the error. */
function expectDeliveryError(
	result: Result<unknown, DeliveryError>,
	code: DeliveryError["code"],
): DeliveryError {
	if (!isFailure(result)) throw new Error(`expected ${code}, got success`);
	expect(result.error).toBeInstanceOf(DeliveryError);
	expect(result.error.code).toBe(code);
	return result.error;
}

describe("deliver", () => {
	test("signs with RFC 9421 first and POSTs the activity byte for byte", async () => {
		server.use(inboxAccepting("rfc9421"));

		let sent = unwrap(await send());

		expect(sent).toEqual({ status: 202, scheme: "rfc9421" });
		expect(received).toHaveLength(1);
		let [first] = received;
		expect(first?.scheme).toBe("rfc9421");
		expect(first?.components).toEqual([
			"@method",
			"@target-uri",
			"content-digest",
			"content-type",
			"date",
		]);
		expect(first?.body).toBe(ACTIVITY);
		expect(first?.headers.get("content-type")).toBe("application/activity+json");
		expect(first?.headers.get("user-agent")).toBe(USER_AGENT);
		expect(first?.headers.get("accept")).toContain("application/activity+json");
		expect(first?.headers.has("content-digest")).toBe(true);
	});

	test("knocks again with draft-cavage after a 401, and remembers it for the origin", async () => {
		server.use(inboxAccepting("draft-cavage"));
		let cache = new MemoryCache();

		let sent = unwrap(await send(cache));

		expect(sent.scheme).toBe("draft-cavage");
		expect(received.map((one) => one.scheme)).toEqual(["rfc9421", "draft-cavage"]);
		expect(received[1]?.components).toEqual([
			"(request-target)",
			"host",
			"date",
			"digest",
			"content-type",
		]);
		expect(received[1]?.headers.has("digest")).toBe(true);
		expect(unwrap(await cache.read(`activitypub:scheme:${ORIGIN}`))).toBe("draft-cavage");

		received = [];
		unwrap(await send(cache));
		expect(received.map((one) => one.scheme)).toEqual(["draft-cavage"]);
	});

	test.each([400, 403])("falls back after a %i as well", async (status) => {
		server.use(inboxAccepting("draft-cavage", INBOX, status));

		let sent = unwrap(await send());

		expect(sent.scheme).toBe("draft-cavage");
		expect(received).toHaveLength(2);
	});

	test("starts with the remembered scheme and switches when the origin changed", async () => {
		server.use(inboxAccepting("rfc9421"));
		let cache = new MemoryCache();
		unwrap(await cache.write(`activitypub:scheme:${ORIGIN}`, "draft-cavage"));

		let sent = unwrap(await send(cache));

		expect(sent.scheme).toBe("rfc9421");
		expect(received.map((one) => one.scheme)).toEqual(["draft-cavage", "rfc9421"]);
		expect(unwrap(await cache.read(`activitypub:scheme:${ORIGIN}`))).toBe("rfc9421");
	});

	test("delivers through a cache that fails every call", async () => {
		server.use(inboxAccepting("rfc9421"));
		let down = () => failure(new CacheError("down", { code: "unavailable", key: "k" }));
		let broken = new MemoryCache();
		broken.read = async () => down();
		broken.write = async () => down();
		broken.delete = async () => down();

		expect(unwrap(await send(broken)).scheme).toBe("rfc9421");
	});

	test("honors Accept-Signature once, with the components it asks for", async () => {
		server.use(
			http.post(INBOX, async ({ request }) => {
				if (request.headers.get("signature-input")?.startsWith("sig2=")) {
					let entry = await record(request, "sig2");
					return new HttpResponse(null, { status: entry.scheme === null ? 401 : 202 });
				}
				await record(request);
				return new HttpResponse(null, {
					status: 401,
					headers: {
						"accept-signature":
							'sig2=("@method" "@target-uri" "@authority" "content-digest" "content-type" "date");created;nonce="n-1"',
					},
				});
			}),
		);

		let sent = unwrap(await send());

		expect(sent.scheme).toBe("rfc9421");
		expect(received).toHaveLength(2);
		expect(received[1]?.label).toBe("sig2");
		expect(received[1]?.components).toContain("@authority");
		expect(received[1]?.headers.get("signature-input")).toContain('nonce="n-1"');
	});

	test("covers the target, method and body whatever Accept-Signature leaves out", async () => {
		server.use(
			http.post(INBOX, async ({ request }) => {
				if (request.headers.get("signature-input")?.startsWith("sig2=")) {
					await record(request, "sig2");
					return new HttpResponse(null, { status: 202 });
				}
				await record(request);
				return new HttpResponse(null, {
					status: 401,
					headers: {
						"accept-signature": 'sig2=("@method" "content-digest";key="sha-256");created',
					},
				});
			}),
		);

		unwrap(await send());

		expect(received[1]?.components).toEqual([
			"@method",
			'content-digest;key="sha-256"',
			"@target-uri",
			"content-digest",
		]);
	});

	test("answers unauthorized when every scheme is refused", async () => {
		server.use(
			http.post(INBOX, async ({ request }) => {
				await record(request);
				return new HttpResponse(null, { status: 403 });
			}),
		);

		let error = expectDeliveryError(await send(), "unauthorized");

		expect(error.retryable).toBe(false);
		expect(error.status).toBe(403);
		expect(received).toHaveLength(2);
	});

	test("answers gone for a 410, without retrying or knocking again", async () => {
		server.use(inboxAnswering(410));

		let error = expectDeliveryError(await send(), "gone");

		expect(error.retryable).toBe(false);
		expect(error.inbox).toBe(INBOX);
		expect(received).toHaveLength(1);
	});

	test("answers rate-limited with the wait Retry-After names, in seconds", async () => {
		server.use(inboxAnswering(429, { "retry-after": "120" }));
		let cache = new MemoryCache();

		let error = expectDeliveryError(await send(cache), "rate-limited");

		expect(error.retryable).toBe(true);
		expect(error.retryAfter).toBe(120_000);
		expect(await isUnavailable(cache, ORIGIN, Date.now() + UNAVAILABLE_AFTER + 60_000)).toBe(true);
	});

	test("answers rate-limited with the wait Retry-After names as a date", async () => {
		let at = new Date(Date.now() + 90_000);
		server.use(inboxAnswering(429, { "retry-after": at.toUTCString() }));

		let error = expectDeliveryError(await send(), "rate-limited");

		expect(error.retryAfter).toBeGreaterThan(80_000);
		expect(error.retryAfter).toBeLessThanOrEqual(90_000);
	});

	test("answers rejected for any other 4xx", async () => {
		server.use(inboxAnswering(422));

		let error = expectDeliveryError(await send(), "rejected");

		expect(error.retryable).toBe(false);
		expect(error.status).toBe(422);
		expect(error.retryAfter).toBeNull();
	});

	test("answers server for a 5xx, retryable, and starts the origin's failure window", async () => {
		server.use(inboxAnswering(503));
		let cache = new MemoryCache();

		let error = expectDeliveryError(await send(cache), "server");

		expect(error.retryable).toBe(true);
		expect(error.status).toBe(503);
		expect(await isUnavailable(cache, ORIGIN)).toBe(false);
		expect(await isUnavailable(cache, ORIGIN, Date.now() + UNAVAILABLE_AFTER + 60_000)).toBe(true);
	});

	test("answers timeout when the inbox takes longer than the deadline", async () => {
		server.use(
			http.post(INBOX, async () => {
				await delay(500);
				return new HttpResponse(null, { status: 202 });
			}),
		);

		let error = expectDeliveryError(await send(new MemoryCache(), {}, 50), "timeout");

		expect(error.retryable).toBe(true);
		expect(error.status).toBeNull();
	});

	test("answers network when the connection fails", async () => {
		server.use(http.post(INBOX, () => HttpResponse.error()));

		let error = expectDeliveryError(await send(), "network");

		expect(error.retryable).toBe(true);
	});

	test.each([
		"http://169.254.169.254/inbox",
		"https://localhost/inbox",
		"https://inbox.example/inbox",
		"ftp://mastodon.social/inbox",
	])("refuses %s before any request", async (inbox) => {
		let error = expectDeliveryError(await send(new MemoryCache(), { inbox }), "refused-url");

		expect(error.retryable).toBe(false);
		expect(received).toHaveLength(0);
	});

	test("fails without retrying for an actor this app holds no keys for", async () => {
		let error = expectDeliveryError(
			await send(new MemoryCache(), { actor: "https://letters.blog/someone-else" }),
			"missing-keys",
		);

		expect(error.retryable).toBe(false);
	});

	test("fails retryable when the key store fails", async () => {
		let sent = await deliver(input(), {
			keys: { keysOf: async () => failure(new Error("secrets store down")) },
			cache: new MemoryCache(),
			userAgent: USER_AGENT,
		});

		expect(expectDeliveryError(sent, "keys-unavailable").retryable).toBe(true);
	});

	test("clears the origin's failure window once a delivery lands", async () => {
		server.use(inboxAccepting("rfc9421"));
		let cache = new MemoryCache();
		await recordFailure(cache, ORIGIN, Date.now() - UNAVAILABLE_AFTER - 60_000);
		expect(await isUnavailable(cache, ORIGIN)).toBe(true);

		unwrap(await send(cache));

		expect(await isUnavailable(cache, ORIGIN)).toBe(false);
	});

	test("signs with a Date taken at delivery time", async () => {
		server.use(inboxAccepting("rfc9421"));
		let now = new Date();

		unwrap(
			await deliver(input(), {
				keys: new MemoryKeyProvider([keys]),
				cache: new MemoryCache(),
				userAgent: USER_AGENT,
				now: () => now,
			}),
		);

		expect(received[0]?.headers.get("date")).toBe(now.toUTCString());
	});
});

describe("parseRetryAfter", () => {
	let now = new Date("2026-10-07T12:00:00Z");

	test.each([
		["30", 30_000],
		["Wed, 07 Oct 2026 12:01:00 GMT", 60_000],
		["Wed, 07 Oct 2026 11:00:00 GMT", 0],
		["soon", null],
		[null, null],
		["-30", 0],
		["31536000", 12 * 60 * 60 * 1000],
		["Fri, 07 Oct 2116 12:00:00 GMT", 12 * 60 * 60 * 1000],
	])("reads %s as %s", (value, expected) => {
		expect(parseRetryAfter(value, now)).toBe(expected);
	});
});

/** A follower of the local actor. */
function follower(
	id: string,
	inbox: string,
	sharedInbox: string | null,
	state: Follower["state"] = "accepted",
): Follower {
	return {
		actor: ACTOR_ID,
		id,
		inbox,
		sharedInbox,
		followId: `${id}#follow`,
		state,
	};
}

/** A remote actor document as a server serves it. */
function actorDocument(id: string, inbox: string, sharedInbox?: string) {
	return http.get(id, () => {
		received.push({
			url: id,
			scheme: null,
			label: null,
			components: [],
			headers: new Headers(),
			body: "",
		});
		return HttpResponse.json(
			{
				"@context": "https://www.w3.org/ns/activitystreams",
				id,
				type: "Person",
				preferredUsername: id.split("/").at(-1),
				inbox,
				...(sharedInbox === undefined ? {} : { endpoints: { sharedInbox } }),
			},
			{ headers: { "content-type": "application/activity+json" } },
		);
	});
}

/** The followers every fan-out test starts with: five accounts on three servers, one pending. */
function followers(): MemoryFollowerStore {
	return new MemoryFollowerStore([
		follower("https://mastodon.social/users/a", "https://mastodon.social/users/a/inbox", INBOX),
		follower("https://mastodon.social/users/b", "https://mastodon.social/users/b/inbox", INBOX),
		follower("https://pixelfed.social/users/c", "https://pixelfed.social/users/c/inbox", null),
		follower(
			"https://misskey.io/users/d",
			"https://misskey.io/users/d/inbox",
			"https://misskey.io/inbox",
		),
		follower(
			"https://gts.social/users/e",
			"https://gts.social/users/e/inbox",
			"https://gts.social/inbox",
			"pending",
		),
	]);
}

/** Fan-out options with a recording `enqueue`; `batches` collects each call. */
function fanOutOptions(overrides: Partial<FanOutOptions> = {}) {
	let batches: DeliveryInput[][] = [];
	let options: FanOutOptions = {
		actor: { id: ACTOR_ID, followers: FOLLOWERS_ID },
		followers: followers(),
		resolver: createResolver({ cache: new MemoryCache(), userAgent: USER_AGENT }),
		blocked: () => false,
		cache: new MemoryCache(),
		enqueue: async (deliveries) => {
			batches.push(deliveries);
		},
		...overrides,
	};
	return { options, batches };
}

/** A member of a hand-written activity or object, as a test edits it before sending. */
interface WireObject {
	[member: string]: unknown;
	to?: string[];
	cc?: string[];
	bto?: string[];
	bcc?: string[];
}

/** A hand-written activity with its embedded object. */
interface WireActivity extends WireObject {
	object: WireObject;
}

/** A fresh copy of {@link ACTIVITY} to edit. */
function draft(): WireActivity {
	return JSON.parse(ACTIVITY) as WireActivity;
}

/** An activity addressed to the public and the followers, plus `extra` members. */
function activity(extra: Record<string, unknown> = {}): string {
	return JSON.stringify({ ...draft(), ...extra });
}

describe("fanOut", () => {
	test("enqueues one delivery per distinct inbox of accepted followers", async () => {
		let { options, batches } = fanOutOptions();

		let planned = unwrap(await fanOut({ actor: ACTOR_ID, activity: ACTIVITY }, options));

		expect(planned).toEqual({ inboxes: 3, skipped: 0 });
		expect(batches.flat().map((one) => one.inbox)).toEqual([
			INBOX,
			"https://pixelfed.social/users/c/inbox",
			"https://misskey.io/inbox",
		]);
		expect(batches.flat().every((one) => one.actor === ACTOR_ID)).toBe(true);
		expect(batches.flat().every((one) => one.activity === ACTIVITY)).toBe(true);
	});

	test("pages through the store and enqueues in batches of pageSize", async () => {
		let { options, batches } = fanOutOptions({ pageSize: 2 });

		let planned = unwrap(await fanOut({ actor: ACTOR_ID, activity: ACTIVITY }, options));

		expect(planned.inboxes).toBe(3);
		expect(batches.map((batch) => batch.length)).toEqual([2, 1]);
	});

	test("resolves mentioned actors to their shared inbox and dedupes against followers", async () => {
		server.use(
			actorDocument(
				"https://mastodon.social/users/zed",
				"https://mastodon.social/users/zed/inbox",
				INBOX,
			),
			actorDocument("https://hachyderm.io/users/yan", "https://hachyderm.io/users/yan/inbox"),
		);
		let { options, batches } = fanOutOptions();

		let planned = unwrap(
			await fanOut(
				{
					actor: ACTOR_ID,
					activity: activity({
						cc: [
							FOLLOWERS_ID,
							"https://mastodon.social/users/zed",
							"https://hachyderm.io/users/yan",
						],
					}),
				},
				options,
			),
		);

		expect(planned).toEqual({ inboxes: 4, skipped: 0 });
		expect(batches.flat().map((one) => one.inbox)).toContain(
			"https://hachyderm.io/users/yan/inbox",
		);
	});

	test("reads addressing from the embedded object too", async () => {
		server.use(
			actorDocument("https://hachyderm.io/users/yan", "https://hachyderm.io/users/yan/inbox"),
		);
		let { options, batches } = fanOutOptions();
		let json = draft();
		json.to = [];
		json.cc = [];
		json.object.to = ["https://hachyderm.io/users/yan"];
		json.object.cc = [];

		let planned = unwrap(
			await fanOut({ actor: ACTOR_ID, activity: JSON.stringify(json) }, options),
		);

		expect(planned.inboxes).toBe(1);
		expect(batches.flat()[0]?.inbox).toBe("https://hachyderm.io/users/yan/inbox");
	});

	test("addresses bto and bcc, and strips them from what it delivers", async () => {
		server.use(
			actorDocument("https://hachyderm.io/users/yan", "https://hachyderm.io/users/yan/inbox"),
		);
		let { options, batches } = fanOutOptions();
		let json = draft();
		json.cc = [];
		json.bcc = ["https://hachyderm.io/users/yan"];
		json.object.bto = [FOLLOWERS_ID];

		let planned = unwrap(
			await fanOut({ actor: ACTOR_ID, activity: JSON.stringify(json) }, options),
		);

		expect(planned.inboxes).toBe(4);
		let delivered = JSON.parse(batches.flat()[0]?.activity ?? "{}") as WireActivity;
		expect(delivered.bcc).toBeUndefined();
		expect(delivered.object.bto).toBeUndefined();
		expect(delivered.object.name).toBe("Hello");
	});

	test("delivers to no follower when the followers collection is not addressed", async () => {
		let { options, batches } = fanOutOptions();

		let json = draft();
		json.cc = [];
		json.object.cc = [];

		let planned = unwrap(
			await fanOut({ actor: ACTOR_ID, activity: JSON.stringify(json) }, options),
		);

		expect(planned).toEqual({ inboxes: 0, skipped: 0 });
		expect(batches).toHaveLength(0);
	});

	test("skips and counts an actor that does not resolve", async () => {
		server.use(
			http.get("https://hachyderm.io/users/gone", () => new HttpResponse(null, { status: 404 })),
		);
		let { options } = fanOutOptions();

		let planned = unwrap(
			await fanOut(
				{
					actor: ACTOR_ID,
					activity: activity({ cc: [FOLLOWERS_ID, "https://hachyderm.io/users/gone"] }),
				},
				options,
			),
		);

		expect(planned).toEqual({ inboxes: 3, skipped: 1 });
	});

	test("skips blocked hosts, without fetching a mentioned actor there", async () => {
		let asked: string[] = [];
		let { options, batches } = fanOutOptions({
			blocked: (host) => {
				asked.push(host);
				return host === "misskey.io" || host === "spam.social";
			},
		});

		let planned = unwrap(
			await fanOut(
				{
					actor: ACTOR_ID,
					activity: activity({ cc: [FOLLOWERS_ID, "https://spam.social/users/x"] }),
				},
				options,
			),
		);

		expect(planned).toEqual({ inboxes: 2, skipped: 2 });
		expect(batches.flat().map((one) => one.inbox)).not.toContain("https://misskey.io/inbox");
		expect(received).toHaveLength(0);
		expect(new Set(asked).size).toBe(asked.length);
	});

	test("skips origins that have been failing past the window", async () => {
		let cache = new MemoryCache();
		await recordFailure(cache, "https://pixelfed.social", Date.now() - UNAVAILABLE_AFTER - 60_000);
		await recordFailure(cache, "https://misskey.io", Date.now() - 60_000);
		let { options, batches } = fanOutOptions({ cache });

		let planned = unwrap(await fanOut({ actor: ACTOR_ID, activity: ACTIVITY }, options));

		expect(planned).toEqual({ inboxes: 2, skipped: 1 });
		expect(batches.flat().map((one) => one.inbox)).toEqual([INBOX, "https://misskey.io/inbox"]);
	});

	test("fails too-large for an activity over 120 KB, before enqueuing anything", async () => {
		let { options, batches } = fanOutOptions();
		let content = "a".repeat(MAX_ACTIVITY_BYTES);
		let json = draft();
		json.object.content = content;

		let planned = await fanOut({ actor: ACTOR_ID, activity: JSON.stringify(json) }, options);

		if (!isFailure(planned)) throw new Error("expected too-large");
		expect(planned.error.code).toBe("too-large");
		expect(planned.error.retryable).toBe(false);
		expect(batches).toHaveLength(0);
	});

	test("batches large activities by count, leaving byte limits to the job writer", async () => {
		let many = new MemoryFollowerStore(
			Array.from({ length: 10 }, (_, index) =>
				follower(`https://s${index}.social/users/u`, `https://s${index}.social/inbox`, null),
			),
		);
		let { options, batches } = fanOutOptions({ followers: many });
		let json = draft();
		json.object.content = "a".repeat(100 * 1024);

		let planned = unwrap(
			await fanOut({ actor: ACTOR_ID, activity: JSON.stringify(json) }, options),
		);

		expect(planned.inboxes).toBe(10);
		expect(batches.map((batch) => batch.length)).toEqual([10]);
	});

	test.each([
		["not json", "invalid-document"],
		["[]", "invalid-document"],
		['{"type":"Create"}', "invalid-document"],
	])("fails %s as %s", async (text, code) => {
		let { options } = fanOutOptions();

		let planned = await fanOut({ actor: ACTOR_ID, activity: text }, options);

		if (!isFailure(planned)) throw new Error(`expected ${code}`);
		expect(planned.error.code).toBe(code);
	});

	test("fails invalid-input when the actor document is another actor's", async () => {
		let { options } = fanOutOptions();

		let planned = await fanOut(
			{ actor: "https://letters.blog/other", activity: ACTIVITY },
			options,
		);

		if (!isFailure(planned)) throw new Error("expected invalid-input");
		expect(planned.error.code).toBe("invalid-input");
	});

	test.each([
		["rejects", () => Promise.reject(new Error("queue down"))],
		["fails", async () => failure(new Error("queue down"))],
	] as const)("fails retryable when enqueue %s", async (_, enqueue) => {
		let { options } = fanOutOptions({ enqueue });

		let planned = await fanOut({ actor: ACTOR_ID, activity: ACTIVITY }, options);

		if (!isFailure(planned)) throw new Error("expected enqueue");
		expect(planned.error.code).toBe("enqueue");
		expect(planned.error.retryable).toBe(true);
	});

	test("fails retryable when the store fails", async () => {
		let store = followers();
		store.inboxes = async () => failure(new Error("d1 down"));
		let { options } = fanOutOptions({ followers: store });

		let planned = await fanOut({ actor: ACTOR_ID, activity: ACTIVITY }, options);

		if (!isFailure(planned)) throw new Error("expected store");
		expect(planned.error.code).toBe("store");
		expect(planned.error.retryable).toBe(true);
	});

	test("accepts an enqueue that answers success", async () => {
		let { options } = fanOutOptions({ enqueue: async () => success(undefined) });

		expect(unwrap(await fanOut({ actor: ACTOR_ID, activity: ACTIVITY }, options)).inboxes).toBe(3);
	});
});

describe("job inputs", () => {
	test("FAN_OUT_INPUT accepts an actor URL and activity text", () => {
		let valid = FAN_OUT_INPUT["~standard"].validate({ actor: ACTOR_ID, activity: ACTIVITY });
		let invalid = FAN_OUT_INPUT["~standard"].validate({ actor: "nobody", activity: 1 });

		expect(valid).toEqual({ value: { actor: ACTOR_ID, activity: ACTIVITY } });
		expect(invalid).toHaveProperty("issues");
	});

	test("DELIVERY_INPUT requires the inbox to be a URL", () => {
		let valid = DELIVERY_INPUT["~standard"].validate(input());
		let invalid = DELIVERY_INPUT["~standard"].validate({ ...input(), inbox: "inbox" });

		expect(valid).toEqual({ value: input() });
		expect(invalid).toHaveProperty("issues");
	});
});

describe("DELIVERY_BACKOFF", () => {
	test.each([
		[1, 5 * 60_000],
		[2, 30 * 60_000],
		[3, 2 * 3_600_000],
		[4, 6 * 3_600_000],
		[5, 12 * 3_600_000],
		[9, 12 * 3_600_000],
	])("waits about the step for attempt %i", (attempt, step) => {
		let delay = DELIVERY_BACKOFF.delay(attempt);

		expect(delay).toBeGreaterThanOrEqual(step * 0.8);
		expect(delay).toBeLessThanOrEqual(step * 1.2);
	});
});
