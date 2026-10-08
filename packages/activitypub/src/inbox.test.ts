/**
 * `receive`, `verifyFetch`, `accepted` and `rejected` against requests signed with real
 * keys in both schemes, a resolver over MSW servers, and every refusal in the order the
 * inbox checks them, including forwarded replies, key rotation and deleted accounts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Scheme } from "@sdxc/http-signatures";

import { MemoryCache } from "@sdxc/cache/memory";
import { sign } from "@sdxc/http-signatures";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import * as s from "remix/data-schema";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { InboxErrorCode, ReceiveOptions } from "./inbox.js";
import type { ActorKeys } from "./keys.js";

import { MASTODON_ACTOR, MASTODON_CREATE_NOTE, MASTODON_DELETE_ACTOR } from "./fixtures/index.js";
import { accepted, INBOX_INPUT, InboxError, receive, rejected, verifyFetch } from "./inbox.js";
import { generateActorKeys, importActorKeys, publicKeyOf } from "./keys.js";
import { recordFailure } from "./lib/availability.js";
import { createResolver } from "./remote.js";

const INBOX = "https://letters.blog/activitypub/inbox";
const LOCAL_ACTOR = "https://letters.blog/activitypub/actor";
const ALICE = "https://mastodon.social/users/alice";
const BOB = "https://hachyderm.io/users/bob";
const USER_AGENT = "letters.blog/1.0 (+https://letters.blog)";

const server = setupServer();

let aliceKeys: ActorKeys;
let rotatedKeys: ActorKeys;
let bobKeys: ActorKeys;
let fetched: string[];

beforeAll(async () => {
	server.listen({ onUnhandledRequest: "error" });
	aliceKeys = await keysFor(ALICE);
	rotatedKeys = await keysFor(ALICE);
	bobKeys = await keysFor(BOB);
});

beforeEach(() => {
	fetched = [];
	server.use(publicDns());
	server.events.on("request:start", ({ request }) => {
		if (!request.url.startsWith("https://cloudflare-dns.com/")) fetched.push(request.url);
	});
});

afterEach(() => {
	server.events.removeAllListeners();
	server.resetHandlers();
});

afterAll(() => server.close());

/** A fresh RSA key pair for an actor. */
async function keysFor(actor: string): Promise<ActorKeys> {
	let generated = unwrap(await generateActorKeys());
	return unwrap(await importActorKeys({ actor, privateKeyPem: generated.privateKeyPem }));
}

/** Every name resolves to one public address, so the resolver's DoH check lets requests through. */
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

/** Serves `json` at `url` as ActivityStreams. */
function serve(url: string, json: Record<string, unknown>) {
	return http.get(url, () =>
		HttpResponse.json(json, { headers: { "content-type": "application/activity+json" } }),
	);
}

/** Alice's actor document, publishing `keys`. */
function alice(keys: ActorKeys = aliceKeys): Record<string, unknown> {
	return { ...MASTODON_ACTOR, publicKey: publicKeyOf(keys) };
}

/** Bob's actor document on another server. */
function bob(): Record<string, unknown> {
	return {
		...MASTODON_ACTOR,
		id: BOB,
		inbox: `${BOB}/inbox`,
		preferredUsername: "bob",
		publicKey: publicKeyOf(bobKeys),
	};
}

/** How a test request is built and signed. */
interface PostOptions {
	scheme?: Scheme;
	keys?: ActorKeys;
	contentType?: string;
	created?: Date;
	components?: string[];
	/** Sent in place of the signed body. */
	tamper?: string;
	unsigned?: boolean;
}

/** A POST of `activity` to the inbox, signed as `keys` (Alice by default). */
async function post(activity: unknown, options: PostOptions = {}): Promise<Request> {
	let text = JSON.stringify(activity);
	let body = new TextEncoder().encode(text);
	let request = new Request(INBOX, {
		method: "POST",
		headers: { "content-type": options.contentType ?? "application/activity+json" },
		body,
	});
	if (options.unsigned) return request;

	let keys = options.keys ?? aliceKeys;
	let signed = unwrap(
		await sign(request, {
			scheme: options.scheme ?? "draft-cavage",
			key: { id: keys.rsa.id, privateKey: keys.rsa.privateKey },
			body,
			...(options.created ? { created: options.created } : {}),
			...(options.components ? { components: options.components } : {}),
		}),
	);
	if (options.tamper === undefined) return signed;
	return new Request(INBOX, { method: "POST", headers: signed.headers, body: options.tamper });
}

/** The options every test starts from: an MSW-backed resolver and nothing blocked. */
function options(overrides: Partial<ReceiveOptions> = {}): ReceiveOptions {
	return {
		resolver: createResolver({ cache: new MemoryCache(), userAgent: USER_AGENT }),
		blocked: () => false,
		...overrides,
	};
}

/** Asserts `receive` failed with `code` and the matching status. */
function expectRefused(result: Awaited<ReturnType<typeof receive>>, code: InboxErrorCode) {
	if (!isFailure(result)) throw new Error(`expected ${code}, got success`);
	expect(result.error).toBeInstanceOf(InboxError);
	expect(result.error.code).toBe(code);
	return result.error;
}

describe("receive", () => {
	test.each<Scheme>(["draft-cavage", "rfc9421"])("verifies a %s signature", async (scheme) => {
		server.use(serve(ALICE, alice()));

		let received = unwrap(await receive(await post(MASTODON_CREATE_NOTE, { scheme }), options()));

		expect(received).toMatchObject({
			activity: MASTODON_CREATE_NOTE,
			actor: ALICE,
			signer: ALICE,
			keyId: `${ALICE}#main-key`,
			origin: "https://mastodon.social",
			verification: "signature",
		});
		expect(Date.parse(received.receivedAt)).not.toBeNaN();
	});

	test("answers plain JSON that INBOX_INPUT reads back unchanged", async () => {
		server.use(serve(ALICE, alice()));
		let received = unwrap(await receive(await post(MASTODON_CREATE_NOTE), options()));

		let roundTrip = JSON.parse(JSON.stringify(received));

		expect(s.parse(INBOX_INPUT, roundTrip)).toEqual(received);
	});

	test("accepts application/ld+json with a profile", async () => {
		server.use(serve(ALICE, alice()));
		let contentType = 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"';

		let result = await receive(await post(MASTODON_CREATE_NOTE, { contentType }), options());

		expect(isSuccess(result)).toBe(true);
	});

	test("415 for a body that is not ActivityStreams", async () => {
		let request = await post(MASTODON_CREATE_NOTE, { contentType: "application/json" });

		let error = expectRefused(await receive(request, options()), "unsupported-media-type");

		expect(error.status).toBe(415);
		expect(fetched).toEqual([]);
	});

	test("413 for a body over maxBytes", async () => {
		let request = await post(MASTODON_CREATE_NOTE);

		let error = expectRefused(await receive(request, options({ maxBytes: 64 })), "too-large");

		expect(error.status).toBe(413);
	});

	test("400 for a body that is not JSON", async () => {
		let request = new Request(INBOX, {
			method: "POST",
			headers: { "content-type": "application/activity+json" },
			body: "{nope",
		});

		let error = expectRefused(await receive(request, options()), "invalid-activity");

		expect(error.status).toBe(400);
	});

	test("400 for JSON that is not an activity", async () => {
		let request = await post({ id: "https://mastodon.social/x", type: "Note" });

		expectRefused(await receive(request, options()), "invalid-activity");
	});

	test("403 for a blocked actor host, before any fetch", async () => {
		let blocked: string[] = [];
		let request = await post(MASTODON_CREATE_NOTE);

		let error = expectRefused(
			await receive(
				request,
				options({
					blocked: (host) => {
						blocked.push(host);
						return host === "mastodon.social";
					},
				}),
			),
			"blocked",
		);

		expect(error.status).toBe(403);
		expect(blocked).toEqual(["mastodon.social"]);
		expect(fetched).toEqual([]);
	});

	test("403 for a blocked keyId host, before any fetch", async () => {
		let request = await post(MASTODON_CREATE_NOTE, { keys: bobKeys });

		expectRefused(
			await receive(request, options({ blocked: async (host) => host === "hachyderm.io" })),
			"blocked",
		);
		expect(fetched).toEqual([]);
	});

	test("401 for an unsigned request", async () => {
		let request = await post(MASTODON_CREATE_NOTE, { unsigned: true });

		let error = expectRefused(await receive(request, options()), "unsigned");

		expect(error.status).toBe(401);
	});

	test("401 for a body that differs from the signed digest", async () => {
		let request = await post(MASTODON_CREATE_NOTE, {
			tamper: JSON.stringify({ ...MASTODON_CREATE_NOTE, type: "Update" }),
		});

		expectRefused(await receive(request, options()), "digest-mismatch");
		expect(fetched).toEqual([]);
	});

	test("401 for a signature that leaves the digest out", async () => {
		let request = await post(MASTODON_CREATE_NOTE, {
			components: ["(request-target)", "host", "date"],
		});

		expectRefused(await receive(request, options()), "digest-mismatch");
	});

	test("401 for a signature older than maxAge", async () => {
		let created = new Date(Date.now() - 2 * 60 * 60 * 1000);
		let request = await post(MASTODON_CREATE_NOTE, { created });

		expectRefused(await receive(request, options()), "stale-signature");
		expect(fetched).toEqual([]);
	});

	test("401 for a signature by a key the actor does not publish, after one fresh refetch", async () => {
		server.use(serve(ALICE, alice(rotatedKeys)));

		let request = await post(MASTODON_CREATE_NOTE);

		expectRefused(await receive(request, options()), "invalid-signature");
		expect(fetched).toEqual([ALICE, ALICE]);
	});

	test("verifies a rotated key by refetching the cached actor once", async () => {
		let resolver = createResolver({ cache: new MemoryCache(), userAgent: USER_AGENT });
		server.use(serve(ALICE, alice()));
		unwrap(await resolver.actor(ALICE));
		server.use(serve(ALICE, alice(rotatedKeys)));

		let request = await post(MASTODON_CREATE_NOTE, { keys: rotatedKeys });
		let received = await receive(request, options({ resolver }));

		expect(unwrap(received).verification).toBe("signature");
		expect(fetched).toEqual([ALICE, ALICE]);
	});

	test("401 when the key cannot be fetched", async () => {
		server.use(http.get(ALICE, () => new HttpResponse(null, { status: 404 })));

		let error = expectRefused(
			await receive(await post(MASTODON_CREATE_NOTE), options()),
			"key-unavailable",
		);

		expect(error.status).toBe(401);
	});

	test("ignores a deleted account's Delete of itself with 202", async () => {
		let deleted = { ...MASTODON_DELETE_ACTOR, actor: ALICE, object: ALICE, id: `${ALICE}#delete` };
		server.use(http.get(ALICE, () => new HttpResponse(null, { status: 410 })));

		let error = expectRefused(await receive(await post(deleted), options()), "ignored");

		expect(error.status).toBe(202);
	});

	test("401 for a gone key on anything other than the account's own Delete", async () => {
		server.use(http.get(ALICE, () => new HttpResponse(null, { status: 410 })));

		expectRefused(await receive(await post(MASTODON_CREATE_NOTE), options()), "key-unavailable");
	});

	test("accepts a forwarded reply by refetching it from its actor's origin", async () => {
		let original = { ...MASTODON_CREATE_NOTE, signature: undefined };
		let forwarded = { ...MASTODON_CREATE_NOTE, cc: [LOCAL_ACTOR] };
		server.use(serve(BOB, bob()), serve(MASTODON_CREATE_NOTE.id, original));

		let received = unwrap(
			await receive(await post(forwarded, { keys: bobKeys, scheme: "rfc9421" }), options()),
		);

		expect(received.verification).toBe("refetched");
		expect(received.signer).toBe(BOB);
		expect(received.actor).toBe(ALICE);
		expect(received.activity).toEqual(JSON.parse(JSON.stringify(original)));
		expect(fetched).toContain(MASTODON_CREATE_NOTE.id);
	});

	test("401 for a forwarded activity whose origin serves another one", async () => {
		server.use(
			serve(BOB, bob()),
			serve(MASTODON_CREATE_NOTE.id, {
				...MASTODON_CREATE_NOTE,
				actor: "https://mastodon.social/users/mallory",
			}),
		);

		expectRefused(
			await receive(await post(MASTODON_CREATE_NOTE, { keys: bobKeys }), options()),
			"actor-mismatch",
		);
	});

	test("401 for an activity signed by someone else and not on its actor's origin", async () => {
		server.use(serve(BOB, bob()));
		let activity = { ...MASTODON_CREATE_NOTE, id: "https://hachyderm.io/forged/1" };

		let error = expectRefused(
			await receive(await post(activity, { keys: bobKeys }), options()),
			"actor-mismatch",
		);

		expect(error.status).toBe(401);
		expect(fetched).toEqual([BOB]);
	});

	test("clears the signer's origin from the failing-delivery record", async () => {
		let cache = new MemoryCache();
		await recordFailure(cache, "https://mastodon.social", Date.now() - 1000);
		server.use(serve(ALICE, alice()));

		unwrap(await receive(await post(MASTODON_CREATE_NOTE), options({ cache })));

		expect(unwrap(await cache.read("activitypub:unavailable:https://mastodon.social"))).toBeNull();
	});
});

describe("accepted and rejected", () => {
	test("accepted answers 202 with no body", async () => {
		let response = accepted();

		expect(response.status).toBe(202);
		expect(await response.text()).toBe("");
	});

	test("rejected answers the status with a fixed text", async () => {
		let response = rejected(new InboxError("invalid-signature", "RSA verify failed for key k"));

		expect(response.status).toBe(401);
		let text = await response.text();
		expect(text).toBe("The signature could not be verified.");
		expect(text).not.toContain("RSA");
	});

	test("rejected answers an ignored Delete with an empty 202", async () => {
		let response = rejected(new InboxError("ignored", "gone"));

		expect(response.status).toBe(202);
		expect(await response.text()).toBe("");
	});
});

describe("verifyFetch", () => {
	/** A GET of `url`, signed as Alice unless `unsigned`. */
	async function get(url: string, unsigned = false): Promise<Request> {
		let request = new Request(url, { headers: { accept: "application/activity+json" } });
		if (unsigned) return request;
		return unwrap(
			await sign(request, {
				scheme: "draft-cavage",
				key: { id: aliceKeys.rsa.id, privateKey: aliceKeys.rsa.privateKey },
			}),
		);
	}

	/** The options of a secure-mode app with one local actor. */
	function fetchOptions() {
		return { ...options(), actors: [LOCAL_ACTOR] };
	}

	test("verifies a signed GET and names the signer", async () => {
		server.use(serve(ALICE, alice()));

		let verified = await verifyFetch(
			await get("https://letters.blog/articles/remix-v3"),
			fetchOptions(),
		);

		expect(unwrap(verified)).toEqual({ signer: ALICE, keyId: `${ALICE}#main-key` });
	});

	test("lets the local actor document through unsigned", async () => {
		let verified = await verifyFetch(await get(LOCAL_ACTOR, true), fetchOptions());

		expect(unwrap(verified)).toEqual({ signer: null, keyId: null });
	});

	test("lets exempt URLs through unsigned", async () => {
		let verified = await verifyFetch(await get("https://letters.blog/nodeinfo/2.1", true), {
			...fetchOptions(),
			exempt: (url) => url.pathname.startsWith("/nodeinfo/"),
		});

		expect(isSuccess(verified)).toBe(true);
	});

	test("401 for an unsigned GET", async () => {
		let verified = await verifyFetch(
			await get("https://letters.blog/articles/remix-v3", true),
			fetchOptions(),
		);

		expect(isFailure(verified) && verified.error.code).toBe("unsigned");
	});

	test("403 for a blocked key host, before any fetch", async () => {
		let verified = await verifyFetch(await get("https://letters.blog/articles/remix-v3"), {
			...fetchOptions(),
			blocked: (host) => host === "mastodon.social",
		});

		expect(isFailure(verified) && verified.error.status).toBe(403);
		expect(fetched).toEqual([]);
	});
});
