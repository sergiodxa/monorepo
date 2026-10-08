/**
 * `Federation` end to end through the public entry points: signed inbox POSTs queued and
 * processed into the app's handlers, Follow answers, fan-out and signed delivery to MSW
 * inboxes, gone inboxes and retry delays, the actor's collections, and content negotiation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Scheme } from "@sdxc/http-signatures";
import type { Result } from "@sdxc/result";

import { MemoryCache } from "@sdxc/cache/memory";
import { Pem } from "@sdxc/crypto";
import { sign, verify } from "@sdxc/http-signatures";
import { failure, isFailure, success, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import * as s from "remix/data-schema";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import {
	LOCAL_ACTOR,
	LOCAL_ARTICLE,
	MASTODON_ACTOR,
	MASTODON_CREATE_NOTE,
	MASTODON_FOLLOW,
	MASTODON_LIKE,
} from "./fixtures/index.js";
import {
	MemoryFollowerStore,
	MemoryKeyProvider,
	MemoryLocalObjects,
	MemorySeenActivities,
} from "./testing.js";

import type { ActivityPub, Follower } from "./index.js";

import {
	ActorKeys,
	Federation,
	FederationError,
	parseActor,
	parseObject,
	PUBLIC,
	tombstone,
} from "./index.js";

const INBOX = "https://letters.blog/activitypub/inbox";
const OUTBOX = "https://letters.blog/activitypub/outbox";
const FOLLOWERS = "https://letters.blog/activitypub/followers";
const FOLLOWING = "https://letters.blog/activitypub/following";
const ALICE = "https://mastodon.social/users/alice";
const USER_AGENT = "letters.blog/1.0 (+https://letters.blog)";

/** The local actor, read through `parseActor` so every member is present. */
const ACTOR: ActivityPub.Actor = unwrap(
	parseActor({
		id: LOCAL_ACTOR,
		type: "Person",
		preferredUsername: "hello",
		inbox: INBOX,
		outbox: OUTBOX,
		followers: FOLLOWERS,
		following: FOLLOWING,
		endpoints: { sharedInbox: INBOX },
	}),
);

/** The local article remote servers reply to and like. */
const ARTICLE: ActivityPub.Object = unwrap(
	parseObject({ id: LOCAL_ARTICLE, type: "Article", attributedTo: LOCAL_ACTOR, name: "Remix v3" }),
);

const server = setupServer();

let localKeys: ActorKeys;
let localPublicKey: CryptoKey;
let aliceKeys: ActorKeys;
let queued: Federation.Message[];
let followers: MemoryFollowerStore;
let delivered: Delivered[];

/** What an MSW inbox saw: the verified scheme, or `null` when the signature failed. */
interface Delivered {
	url: string;
	scheme: Scheme | null;
	body: string;
}

beforeAll(async () => {
	server.listen({ onUnhandledRequest: "error" });
	localKeys = await keysFor(LOCAL_ACTOR);
	aliceKeys = await keysFor(ALICE);
	let spki = unwrap(Pem.decode(localKeys.publicKey.publicKeyPem, "PUBLIC KEY"));
	localPublicKey = await crypto.subtle.importKey(
		"spki",
		spki,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["verify"],
	);
});

beforeEach(() => {
	queued = [];
	delivered = [];
	followers = new MemoryFollowerStore();
	server.use(publicDns(), serve(ALICE, { ...MASTODON_ACTOR, publicKey: aliceKeys.publicKey }));
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

/** A fresh RSA key pair for an actor. */
async function keysFor(actor: string): Promise<ActorKeys> {
	let generated = unwrap(await ActorKeys.generate());
	return unwrap(await ActorKeys.import({ actor, privateKeyPem: generated.privateKeyPem }));
}

/** Every name resolves to one public address, so outbound requests pass resolution. */
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

/** An inbox that verifies each POST against the local key and answers `status`. */
function inbox(url: string, status = 202, headers: Record<string, string> = {}) {
	return http.post(url, async ({ request }) => {
		let body = new Uint8Array(await request.arrayBuffer());
		let verified = await verify(request, {
			body,
			maxAge: "1 hour",
			key: async (keyId) => success(keyId === localKeys.id ? localPublicKey : null),
		});
		delivered.push({
			url: request.url,
			scheme: isFailure(verified) ? null : verified.data.scheme,
			body: new TextDecoder().decode(body),
		});
		if (isFailure(verified)) return new HttpResponse(null, { status: 401 });
		return new HttpResponse(null, { status, headers });
	});
}

/** A federation over memory stores, queueing into `queued`. */
function federation(overrides: Partial<Federation.Options> = {}): Federation {
	return new Federation({
		actor: ACTOR,
		keys: localKeys,
		stores: {
			followers,
			seen: new MemorySeenActivities(),
			objects: new MemoryLocalObjects([ARTICLE]),
		},
		cache: new MemoryCache(),
		userAgent: USER_AGENT,
		queue: {
			async enqueue(message) {
				queued.push(message);
			},
		},
		...overrides,
	});
}

/** A POST of `activity` to the inbox, signed as `keys` (Alice by default). */
async function post(activity: unknown, keys: ActorKeys | null = aliceKeys): Promise<Request> {
	let body = new TextEncoder().encode(JSON.stringify(activity));
	let request = new Request(INBOX, {
		method: "POST",
		headers: { "content-type": "application/activity+json" },
		body,
	});
	if (keys === null) return request;
	return unwrap(
		await sign(request, {
			scheme: "draft-cavage",
			key: { id: keys.id, privateKey: keys.rsa.privateKey },
			body,
		}),
	);
}

/** A GET of `url` asking for ActivityStreams, signed as Alice unless `unsigned`. */
async function get(url: string, unsigned = false): Promise<Request> {
	let request = new Request(url, { headers: { accept: "application/activity+json" } });
	if (unsigned) return request;
	return unwrap(
		await sign(request, {
			scheme: "draft-cavage",
			key: { id: aliceKeys.id, privateKey: aliceKeys.rsa.privateKey },
		}),
	);
}

/** The message queued at `index`, failing the test when there is none. */
function queuedAt(index: number): Federation.Message {
	let message = queued[index];
	if (message === undefined) throw new Error(`nothing was queued at ${index}`);
	return message;
}

/** The response's body as JSON. */
async function json(response: Response | null): Promise<Record<string, unknown>> {
	if (response === null) throw new Error("expected a response");
	return (await response.json()) as Record<string, unknown>;
}

/** A follower of the local actor. */
function follower(id: string, inboxUrl: string, sharedInbox: string | null): Follower {
	return {
		actor: LOCAL_ACTOR,
		id,
		inbox: inboxUrl,
		sharedInbox,
		followId: `${id}#follow`,
		state: "accepted",
	};
}

/** Asserts `process` failed, answering the error. */
function expectFailed(result: Result<unknown, FederationError>): FederationError {
	if (!isFailure(result)) throw new Error("expected a failure");
	expect(result.error).toBeInstanceOf(FederationError);
	return result.error;
}

describe("inbox", () => {
	test("queues a verified POST, then hands it to the handler with its summary", async () => {
		let federated = federation();
		let summaries: unknown[] = [];
		federated.on("Create", (ctx) => {
			summaries.push(ctx.summary());
		});

		let response = await federated.fetch(await post(MASTODON_CREATE_NOTE));

		expect(response?.status).toBe(202);
		expect(queued).toHaveLength(1);
		let message = s.parse(Federation.MESSAGE, JSON.parse(JSON.stringify(queued[0])));
		expect(message).toMatchObject({ kind: "inbox", actor: ALICE, verification: "signature" });

		let outcome = unwrap(await federated.process(message));

		expect(outcome).toEqual({ kind: "inbox", status: "processed", type: "Create", reason: null });
		expect(summaries).toEqual([
			expect.objectContaining({
				kind: "reply",
				target: LOCAL_ARTICLE,
				id: `${ALICE}/statuses/113250000000000001`,
			}),
		]);
	});

	test("refuses an unsigned POST with 401 and queues nothing", async () => {
		let response = await federation().fetch(await post(MASTODON_CREATE_NOTE, null));

		expect(response?.status).toBe(401);
		expect(await response?.text()).toBe("The request must carry an HTTP signature.");
		expect(queued).toEqual([]);
	});

	test("refuses a POST from a blocked server with 403", async () => {
		let federated = federation({ blocked: (host) => host === "mastodon.social" });

		expect((await federated.fetch(await post(MASTODON_CREATE_NOTE)))?.status).toBe(403);
	});

	test("answers 503 when the queue fails, so the sender retries", async () => {
		let federated = federation({
			queue: { enqueue: async () => failure(new Error("queue down")) },
		});

		expect((await federated.fetch(await post(MASTODON_CREATE_NOTE)))?.status).toBe(503);
	});

	test("hands Like and Announce to one handler registered for both", async () => {
		let federated = federation();
		let kinds: unknown[] = [];
		federated.on(["Like", "Announce"], (ctx) => {
			kinds.push(ctx.summary()?.kind);
		});

		await federated.fetch(await post(MASTODON_LIKE));
		unwrap(await federated.process(queuedAt(0)));

		expect(kinds).toEqual(["like"]);
	});

	test("retries a handler failure after the backoff step", async () => {
		let federated = federation();
		federated.on("Create", () => failure(new Error("database down")));
		await federated.fetch(await post(MASTODON_CREATE_NOTE));

		let error = expectFailed(await federated.process(queuedAt(0)));

		expect(error).toMatchObject({ kind: "inbox", code: "handler", retryable: true });
		expect(error.delay).toBeGreaterThanOrEqual(5 * 60_000 * 0.8);
		expect(error.delay).toBeLessThanOrEqual(5 * 60_000 * 1.2);
	});

	test("retries a handler that throws", async () => {
		let federated = federation();
		federated.on("Create", () => {
			throw new Error("boom");
		});
		await federated.fetch(await post(MASTODON_CREATE_NOTE));

		expect(expectFailed(await federated.process(queuedAt(0))).retryable).toBe(true);
	});
});

describe("Follow", () => {
	test("stores the follower and queues an Accept to its inbox", async () => {
		let federated = federation();
		await federated.fetch(await post(MASTODON_FOLLOW));

		let outcome = unwrap(await federated.process(queuedAt(0)));

		expect(outcome).toMatchObject({ kind: "inbox", status: "processed", type: "Follow" });
		expect(unwrap(await followers.get(LOCAL_ACTOR, ALICE))).toMatchObject({
			sharedInbox: "https://mastodon.social/inbox",
			state: "accepted",
		});
		let reply = queued[1];
		expect(reply).toMatchObject({
			kind: "deliver",
			actor: LOCAL_ACTOR,
			inbox: MASTODON_ACTOR.inbox,
		});
		expect(JSON.parse(reply?.kind === "deliver" ? reply.activity : "{}")).toMatchObject({
			type: "Accept",
			object: { id: MASTODON_FOLLOW.id, type: "Follow" },
		});
	});

	test("queues a Reject when the handler answers reject", async () => {
		let federated = federation();
		federated.on("Follow", () => "reject");
		await federated.fetch(await post(MASTODON_FOLLOW));

		let outcome = unwrap(await federated.process(queuedAt(0)));

		expect(outcome).toMatchObject({ status: "processed", reason: "rejected" });
		expect(unwrap(await followers.get(LOCAL_ACTOR, ALICE))).toBeNull();
		let reply = queued[1];
		expect(JSON.parse(reply?.kind === "deliver" ? reply.activity : "{}")).toMatchObject({
			type: "Reject",
		});
	});

	test("approve accepts a pending follower and queues the Accept of its Follow", async () => {
		let federated = federation();
		federated.on("Follow", () => "pending");
		await federated.fetch(await post(MASTODON_FOLLOW));
		unwrap(await federated.process(queuedAt(0)));
		expect(queued).toHaveLength(1);

		unwrap(await federated.approve(ALICE));

		expect(unwrap(await followers.get(LOCAL_ACTOR, ALICE))).toMatchObject({ state: "accepted" });
		let reply = queued[1];
		expect(reply).toMatchObject({ kind: "deliver", inbox: MASTODON_ACTOR.inbox });
		expect(JSON.parse(reply?.kind === "deliver" ? reply.activity : "{}")).toMatchObject({
			type: "Accept",
			actor: LOCAL_ACTOR,
			to: [ALICE],
			object: { id: MASTODON_FOLLOW.id, type: "Follow", actor: ALICE, object: LOCAL_ACTOR },
		});
	});

	test("reject forgets a pending follower and queues the Reject of its Follow", async () => {
		let federated = federation();
		federated.on("Follow", () => "pending");
		await federated.fetch(await post(MASTODON_FOLLOW));
		unwrap(await federated.process(queuedAt(0)));

		unwrap(await federated.reject(ALICE));

		expect(unwrap(await followers.get(LOCAL_ACTOR, ALICE))).toBeNull();
		let reply = queued[1];
		expect(JSON.parse(reply?.kind === "deliver" ? reply.activity : "{}")).toMatchObject({
			type: "Reject",
			object: { id: MASTODON_FOLLOW.id, type: "Follow" },
		});
	});

	test("approve and reject answer not-found for an actor that never followed", async () => {
		let federated = federation();

		let approved = await federated.approve(ALICE);
		let rejected = await federated.reject(ALICE);

		expect(isFailure(approved) && approved.error.code).toBe("not-found");
		expect(isFailure(rejected) && rejected.error.code).toBe("not-found");
		expect(queued).toHaveLength(0);
	});

	test("reject keeps the follower when the Reject cannot be queued, so a retry sends it", async () => {
		await followers.put({ ...follower(ALICE, MASTODON_ACTOR.inbox, null), state: "pending" });
		let federated = federation({
			queue: {
				async enqueue() {
					return failure(new Error("queue down"));
				},
			},
		});

		let rejected = await federated.reject(ALICE);

		expect(isFailure(rejected) && rejected.error).toMatchObject({
			code: "enqueue",
			retryable: true,
		});
		expect(unwrap(await followers.get(LOCAL_ACTOR, ALICE))).not.toBeNull();
	});
});

describe("publish and delivery", () => {
	/** A Create of the local article, addressed publicly and to followers. */
	const CREATE = {
		id: `${LOCAL_ARTICLE}#create`,
		type: "Create",
		actor: LOCAL_ACTOR,
		to: [PUBLIC],
		cc: [FOLLOWERS],
		object: { id: LOCAL_ARTICLE, type: "Article", name: "Remix v3" },
	} satisfies ActivityPub.Draft<ActivityPub.Activity>;

	test("fans out to each distinct inbox and signs every POST", async () => {
		await followers.put(follower(ALICE, `${ALICE}/inbox`, "https://mastodon.social/inbox"));
		await followers.put(
			follower(
				"https://mastodon.social/users/bob",
				"https://mastodon.social/users/bob/inbox",
				"https://mastodon.social/inbox",
			),
		);
		await followers.put(
			follower("https://hachyderm.io/users/carol", "https://hachyderm.io/users/carol/inbox", null),
		);
		server.use(
			inbox("https://mastodon.social/inbox"),
			inbox("https://hachyderm.io/users/carol/inbox"),
		);
		let federated = federation();

		unwrap(await federated.publish(CREATE));
		expect(queued).toEqual([{ kind: "fanOut", actor: LOCAL_ACTOR, activity: expect.any(String) }]);

		let planned = unwrap(await federated.process(queuedAt(0)));
		expect(planned).toEqual({ kind: "fanOut", inboxes: 2, skipped: 0 });

		let deliveries = queued.slice(1);
		expect(deliveries.map((message) => message.kind === "deliver" && message.inbox)).toEqual([
			"https://mastodon.social/inbox",
			"https://hachyderm.io/users/carol/inbox",
		]);
		for (let message of deliveries) {
			expect(unwrap(await federated.process(message))).toMatchObject({
				kind: "deliver",
				status: 202,
			});
		}

		expect(delivered.map((entry) => entry.scheme)).toEqual(["rfc9421", "rfc9421"]);
		expect(JSON.parse(delivered[0]?.body ?? "{}")).toMatchObject({ id: CREATE.id, type: "Create" });
	});

	test("refuses to publish an activity no delivery message can carry", async () => {
		let large = { ...CREATE, content: "x".repeat(130 * 1024) };

		let published = await federation().publish(large);

		expect(isFailure(published) && published.error.code).toBe("too-large");
		expect(queued).toEqual([]);
	});

	test("drops every follower behind an inbox that answers 410", async () => {
		await followers.put(follower(ALICE, `${ALICE}/inbox`, "https://mastodon.social/inbox"));
		server.use(inbox("https://mastodon.social/inbox", 410));

		let error = expectFailed(
			await federation().process({
				kind: "deliver",
				actor: LOCAL_ACTOR,
				activity: JSON.stringify(CREATE),
				inbox: "https://mastodon.social/inbox",
			}),
		);

		expect(error).toMatchObject({ kind: "deliver", code: "gone", retryable: false, delay: 0 });
		expect(unwrap(await followers.get(LOCAL_ACTOR, ALICE))).toBeNull();
	});

	test("waits the Retry-After an inbox names when it is longer than the backoff", async () => {
		server.use(inbox("https://mastodon.social/inbox", 429, { "retry-after": "7200" }));

		let error = expectFailed(
			await federation().process(
				{
					kind: "deliver",
					actor: LOCAL_ACTOR,
					activity: JSON.stringify(CREATE),
					inbox: "https://mastodon.social/inbox",
				},
				{ attempts: 1 },
			),
		);

		expect(error).toMatchObject({ code: "rate-limited", retryable: true, delay: 7_200_000 });
	});

	test("waits the backoff step of the attempt for a server error", async () => {
		server.use(inbox("https://mastodon.social/inbox", 503));

		let error = expectFailed(
			await federation().process(
				{
					kind: "deliver",
					actor: LOCAL_ACTOR,
					activity: JSON.stringify(CREATE),
					inbox: "https://mastodon.social/inbox",
				},
				{ attempts: 2 },
			),
		);

		expect(error.code).toBe("server");
		expect(error.delay).toBeGreaterThanOrEqual(30 * 60_000 * 0.8);
		expect(error.delay).toBeLessThanOrEqual(30 * 60_000 * 1.2);
	});

	test("signs with keys from a provider", async () => {
		server.use(inbox("https://mastodon.social/inbox"));
		let federated = federation({ keys: new MemoryKeyProvider([localKeys]) });

		let sent = await federated.process({
			kind: "deliver",
			actor: LOCAL_ACTOR,
			activity: JSON.stringify(CREATE),
			inbox: "https://mastodon.social/inbox",
		});

		expect(unwrap(sent)).toMatchObject({ kind: "deliver", status: 202 });
	});
});

describe("documents", () => {
	test("serves the actor with its public key, and HEAD without a body", async () => {
		let federated = federation();

		let actor = await json(await federated.fetch(await get(LOCAL_ACTOR, true)));
		let head = await federated.fetch(new Request(LOCAL_ACTOR, { method: "HEAD" }));

		expect(actor).toMatchObject({ id: LOCAL_ACTOR, inbox: INBOX, publicKey: localKeys.publicKey });
		expect(head?.status).toBe(200);
		expect(await head?.text()).toBe("");
	});

	test("answers null for any other URL and 405 for a method a URL does not serve", async () => {
		let federated = federation();

		expect(await federated.fetch(new Request("https://letters.blog/articles/remix-v3"))).toBeNull();
		expect((await federated.fetch(new Request(INBOX)))?.status).toBe(405);
		expect((await federated.fetch(new Request(FOLLOWERS, { method: "POST" })))?.status).toBe(405);
	});

	test("serves the followers count, then pages of follower ids", async () => {
		for (let name of ["a", "b", "c"]) {
			await followers.put(
				follower(
					`https://mastodon.social/users/${name}`,
					`https://mastodon.social/users/${name}/inbox`,
					null,
				),
			);
		}
		let federated = federation({ collections: { pageSize: 2 } });

		let root = await json(await federated.fetch(await get(FOLLOWERS)));
		let first = await json(await federated.fetch(await get(`${FOLLOWERS}?page=true`)));
		let second = await json(await federated.fetch(await get(String(first.next))));

		expect(root).toMatchObject({
			type: "OrderedCollection",
			totalItems: 3,
			first: `${FOLLOWERS}?page=true`,
		});
		expect(first).toMatchObject({
			type: "OrderedCollectionPage",
			partOf: FOLLOWERS,
			orderedItems: ["https://mastodon.social/users/a", "https://mastodon.social/users/b"],
			next: `${FOLLOWERS}?page=true&cursor=2`,
		});
		expect(second.orderedItems).toEqual(["https://mastodon.social/users/c"]);
		expect(second.next).toBeUndefined();
	});

	test("serves an empty following collection", async () => {
		let following = await json(await federation().fetch(await get(FOLLOWING)));

		expect(following).toMatchObject({ id: FOLLOWING, type: "OrderedCollection", totalItems: 0 });
	});

	test("serves outbox pages from the app's callback", async () => {
		let cursors: (string | null)[] = [];
		let federated = federation({
			async outbox(cursor) {
				cursors.push(cursor);
				return success({
					items: [`${LOCAL_ARTICLE}#create`],
					next: cursor === null ? "2" : null,
					totalItems: 2,
				});
			},
		});

		let root = await json(await federated.fetch(await get(OUTBOX)));
		let page = await json(await federated.fetch(await get(`${OUTBOX}?page=true&cursor=2`)));

		expect(root).toMatchObject({ totalItems: 2, first: `${OUTBOX}?page=true` });
		expect(page).toMatchObject({
			id: `${OUTBOX}?page=true&cursor=2`,
			orderedItems: [`${LOCAL_ARTICLE}#create`],
		});
		expect(cursors).toEqual([null, "2"]);
	});

	test("answers 503 when the follower store fails", async () => {
		let failing = new MemoryFollowerStore();
		failing.count = async () => failure(new Error("database down"));

		let response = await federation({
			stores: {
				followers: failing,
				seen: new MemorySeenActivities(),
				objects: new MemoryLocalObjects(),
			},
		}).fetch(await get(FOLLOWERS));

		expect(response?.status).toBe(503);
	});

	test("requires signed GETs for the collections with authorizedFetch, never for the actor", async () => {
		let federated = federation({ authorizedFetch: true });

		expect((await federated.fetch(await get(FOLLOWERS, true)))?.status).toBe(401);
		expect((await federated.fetch(await get(FOLLOWERS)))?.status).toBe(200);
		expect((await federated.fetch(await get(LOCAL_ACTOR, true)))?.status).toBe(200);
	});
});

describe("respond", () => {
	test("answers null when HTML wins, so the app renders its page", async () => {
		let request = new Request(LOCAL_ARTICLE, { headers: { accept: "text/html,*/*;q=0.8" } });

		expect(await federation().respond(request, ARTICLE)).toBeNull();
	});

	test("answers ActivityStreams with Vary: Accept when it is preferred", async () => {
		let response = await federation().respond(await get(LOCAL_ARTICLE, true), ARTICLE);

		expect(response?.headers.get("content-type")).toBe("application/activity+json; charset=utf-8");
		expect(response?.headers.get("vary")?.toLowerCase()).toBe("accept");
		expect(await json(response)).toMatchObject({ id: LOCAL_ARTICLE, type: "Article" });
	});

	test("answers 410 for a Tombstone", async () => {
		let response = await federation().respond(
			await get(LOCAL_ARTICLE, true),
			tombstone({ id: LOCAL_ARTICLE, formerType: "Article" }),
		);

		expect(response?.status).toBe(410);
	});

	test("requires a signature with authorizedFetch", async () => {
		let federated = federation({ authorizedFetch: true });

		expect((await federated.respond(await get(LOCAL_ARTICLE, true), ARTICLE))?.status).toBe(401);
		expect((await federated.respond(await get(LOCAL_ARTICLE), ARTICLE))?.status).toBe(200);
		expect(unwrap(await federated.verify(await get(LOCAL_ARTICLE)))).toMatchObject({
			signer: ALICE,
		});
	});
});
