/**
 * The remote resolver against MSW servers: what each request carries, the id and owner
 * checks that decide whether a document is trusted, the status mapping, the cache that
 * spares refetches without ever failing one, and signed GETs that verify end to end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Cache } from "@sdxc/cache";

import { CacheError } from "@sdxc/cache";
import { MemoryCache } from "@sdxc/cache/memory";
import { sign, verify } from "@sdxc/http-signatures";
import { failure, isFailure, success, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { ActorKeys } from "./keys.js";

import { MASTODON_ACTOR } from "./fixtures/index.js";
import { generateActorKeys, importActorKeys, importPublicKey, publicKeyOf } from "./keys.js";
import { ACTIVITY_ACCEPT } from "./lib/constants.js";
import { createResolver } from "./remote.js";

const LOCAL_ACTOR = "https://letters.blog/activitypub/actor";
const REMOTE_ACTOR = "https://mastodon.social/users/alice";
const REMOTE_KEY_ID = `${REMOTE_ACTOR}#main-key`;
const USER_AGENT = "letters.blog/1.0 (+https://letters.blog)";

const server = setupServer();

let localKeys: ActorKeys;
let remoteKeys: ActorKeys;
let requests: Request[];

beforeAll(async () => {
	server.listen({ onUnhandledRequest: "error" });
	let local = unwrap(await generateActorKeys());
	localKeys = unwrap(
		await importActorKeys({ actor: LOCAL_ACTOR, privateKeyPem: local.privateKeyPem }),
	);
	let remote = unwrap(await generateActorKeys());
	remoteKeys = unwrap(
		await importActorKeys({ actor: REMOTE_ACTOR, privateKeyPem: remote.privateKeyPem }),
	);
});

beforeEach(() => {
	requests = [];
	server.use(publicDns());
	server.events.on("request:start", ({ request }) => {
		if (!request.url.startsWith("https://cloudflare-dns.com/")) requests.push(request.clone());
	});
});

afterEach(() => {
	server.events.removeAllListeners();
	server.resetHandlers();
});

afterAll(() => server.close());

/** Every name resolves to one public address, so `resolve: true` lets the request through. */
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

/** The remote actor as Mastodon serves it, publishing `remoteKeys`. */
function remoteActor(): Record<string, unknown> {
	return { ...MASTODON_ACTOR, publicKey: publicKeyOf(remoteKeys) };
}

/** Serves `json` at `url` as ActivityStreams. */
function serve(url: string, json: Record<string, unknown>) {
	return http.get(url, () =>
		HttpResponse.json(json, { headers: { "content-type": "application/activity+json" } }),
	);
}

/** A resolver over a fresh memory cache unless one is given. */
function resolverWith(options: { cache?: Cache; signed?: boolean; maxBytes?: number } = {}) {
	return createResolver({
		cache: options.cache ?? new MemoryCache(),
		userAgent: USER_AGENT,
		...(options.signed ? { signer: { actor: LOCAL_ACTOR, keys: localKeys } } : {}),
		...(options.maxBytes === undefined ? {} : { maxBytes: options.maxBytes }),
	});
}

describe("actor", () => {
	test("asks for ActivityStreams with the User-Agent, and reads the actor", async () => {
		server.use(serve(REMOTE_ACTOR, remoteActor()));

		let actor = unwrap(await resolverWith().actor(REMOTE_ACTOR));

		expect(actor.id).toBe(REMOTE_ACTOR);
		expect(actor.publicKey?.id).toBe(REMOTE_KEY_ID);
		expect(requests[0]?.headers.get("accept")).toBe(ACTIVITY_ACCEPT);
		expect(requests[0]?.headers.get("user-agent")).toBe(USER_AGENT);
		expect(requests[0]?.headers.has("signature")).toBe(false);
	});

	test("answers the cached copy until asked for a fresh one", async () => {
		server.use(serve(REMOTE_ACTOR, remoteActor()));
		let resolver = resolverWith();

		unwrap(await resolver.actor(REMOTE_ACTOR));
		unwrap(await resolver.actor(REMOTE_ACTOR));
		expect(requests).toHaveLength(1);

		unwrap(await resolver.actor(REMOTE_ACTOR, { fresh: true }));
		expect(requests).toHaveLength(2);
	});

	test("caches the raw document under a namespaced key", async () => {
		server.use(serve(REMOTE_ACTOR, remoteActor()));
		let cache = new MemoryCache();

		unwrap(await resolverWith({ cache }).actor(REMOTE_ACTOR));

		let cached = unwrap(
			await cache.read<{ preferredUsername: string }>(`activitypub:doc:${REMOTE_ACTOR}`),
		);
		expect(cached?.preferredUsername).toBe("alice");
	});

	test("fetches through a cache that fails every call", async () => {
		server.use(serve(REMOTE_ACTOR, remoteActor()));
		let unavailable = () => failure(new CacheError("down", { code: "unavailable", key: "k" }));
		let broken: Cache = {
			read: async () => unavailable(),
			write: async () => unavailable(),
			delete: async () => unavailable(),
			fetch: async () => unavailable(),
		};

		let actor = await resolverWith({ cache: broken }).actor(REMOTE_ACTOR);

		expect(unwrap(actor).id).toBe(REMOTE_ACTOR);
	});

	test("accepts a document redirected within the origin it ended at", async () => {
		server.use(
			http.get("https://mastodon.social/@alice", () => HttpResponse.redirect(REMOTE_ACTOR, 302)),
			serve(REMOTE_ACTOR, remoteActor()),
		);

		let actor = await resolverWith().actor("https://mastodon.social/@alice");

		expect(unwrap(actor).id).toBe(REMOTE_ACTOR);
	});

	test("refuses a document whose id is on another origin", async () => {
		server.use(serve("https://evil.social/users/alice", remoteActor()));

		let result = await resolverWith().actor("https://evil.social/users/alice");

		expect(isFailure(result) && result.error.code).toBe("id-mismatch");
	});

	test("refuses a redirect to another origin that serves the first origin's id", async () => {
		server.use(
			http.get("https://mastodon.social/users/bob", () =>
				HttpResponse.redirect("https://evil.social/users/bob", 302),
			),
			serve("https://evil.social/users/bob", {
				...remoteActor(),
				id: "https://mastodon.social/users/bob",
			}),
		);

		let result = await resolverWith().actor("https://mastodon.social/users/bob");

		expect(isFailure(result) && result.error.code).toBe("id-mismatch");
	});

	test("answers invalid-document for something that is not an actor", async () => {
		server.use(serve(REMOTE_ACTOR, { id: REMOTE_ACTOR, type: "Note", content: "hi" }));

		let result = await resolverWith().actor(REMOTE_ACTOR);

		expect(isFailure(result) && result.error.code).toBe("invalid-document");
	});

	test("answers invalid-document for a body that is not JSON", async () => {
		server.use(http.get(REMOTE_ACTOR, () => HttpResponse.text("<html></html>")));

		let result = await resolverWith().actor(REMOTE_ACTOR);

		expect(isFailure(result) && result.error.code).toBe("invalid-document");
	});

	test.each([
		[404, "not-found", false],
		[401, "unauthorized", false],
		[403, "unauthorized", false],
		[500, "http", true],
		[429, "http", true],
	])("maps %i to %s", async (status, code, retryable) => {
		server.use(http.get(REMOTE_ACTOR, () => new HttpResponse(null, { status })));

		let result = await resolverWith().actor(REMOTE_ACTOR);

		expect(isFailure(result) && result.error.code).toBe(code);
		expect(isFailure(result) && result.error.status).toBe(status);
		expect(isFailure(result) && result.error.retryable).toBe(retryable);
	});

	test("answers gone for a 410 and evicts the cached copy", async () => {
		let cache = new MemoryCache();
		let resolver = resolverWith({ cache });
		server.use(serve(REMOTE_ACTOR, remoteActor()));
		unwrap(await resolver.actor(REMOTE_ACTOR));

		server.use(http.get(REMOTE_ACTOR, () => new HttpResponse(null, { status: 410 })));
		let result = await resolver.actor(REMOTE_ACTOR, { fresh: true });

		expect(isFailure(result) && result.error.code).toBe("gone");
		expect(unwrap(await cache.read(`activitypub:doc:${REMOTE_ACTOR}`))).toBeNull();
	});

	test("answers gone for a Tombstone served with 200", async () => {
		server.use(serve(REMOTE_ACTOR, { id: REMOTE_ACTOR, type: "Tombstone" }));

		let result = await resolverWith().actor(REMOTE_ACTOR);

		expect(isFailure(result) && result.error.code).toBe("gone");
	});

	test("refuses an address inside a network before any request", async () => {
		let result = await resolverWith().actor("http://169.254.169.254/latest/meta-data");

		expect(isFailure(result) && result.error.code).toBe("refused-url");
		expect(requests).toHaveLength(0);
	});

	test("refuses a public name that resolves inside a network", async () => {
		server.use(
			http.get("https://cloudflare-dns.com/dns-query", ({ request }) => {
				let name = new URL(request.url).searchParams.get("name");
				return HttpResponse.json({
					Status: 0,
					Answer: [{ name, type: 1, TTL: 60, data: "10.0.0.5" }],
				});
			}),
		);

		let result = await resolverWith().actor("https://rebind.social/users/alice");

		expect(isFailure(result) && result.error.code).toBe("refused-url");
		expect(requests).toHaveLength(0);
	});

	test("answers too-large past the byte cap", async () => {
		server.use(serve(REMOTE_ACTOR, { ...remoteActor(), summary: "x".repeat(4096) }));

		let result = await resolverWith({ maxBytes: 1024 }).actor(REMOTE_ACTOR);

		expect(isFailure(result) && result.error.code).toBe("too-large");
	});
});

describe("key", () => {
	test("resolves a #main-key to the actor that publishes it, and verifies its signatures", async () => {
		server.use(serve(REMOTE_ACTOR, remoteActor()));
		let resolver = resolverWith();
		let body = new TextEncoder().encode('{"type":"Follow"}');
		let signed = unwrap(
			await sign(
				new Request("https://letters.blog/activitypub/inbox", {
					method: "POST",
					headers: { "content-type": "application/activity+json" },
					body,
				}),
				{
					scheme: "draft-cavage",
					key: { id: remoteKeys.rsa.id, privateKey: remoteKeys.rsa.privateKey },
					body,
				},
			),
		);

		let owner: string | null = null;
		let verified = await verify(signed, {
			body,
			maxAge: "1 hour",
			key: async (keyId) => {
				let resolved = await resolver.key(keyId);
				if (isFailure(resolved)) return resolved;
				owner = resolved.data.owner;
				return success(resolved.data.publicKey);
			},
		});

		expect(unwrap(verified).keyId).toBe(REMOTE_KEY_ID);
		expect(owner).toBe(REMOTE_ACTOR);
	});

	test("follows a standalone key document to its owner", async () => {
		let keyId = `${REMOTE_ACTOR}/main-key`;
		server.use(
			serve(keyId, { id: keyId, owner: REMOTE_ACTOR, publicKeyPem: remoteKeys.rsa.publicKeyPem }),
			serve(REMOTE_ACTOR, {
				...remoteActor(),
				publicKey: { id: keyId, owner: REMOTE_ACTOR, publicKeyPem: remoteKeys.rsa.publicKeyPem },
			}),
		);

		let resolved = unwrap(await resolverWith().key(keyId));

		expect(resolved.owner).toBe(REMOTE_ACTOR);
		expect(resolved.actor.preferredUsername).toBe("alice");
		expect(resolved.publicKey.usages).toEqual(["verify"]);
	});

	test("refuses a key document claiming an actor that does not publish it", async () => {
		let keyId = "https://evil.social/keys/1";
		server.use(
			serve(keyId, { id: keyId, owner: REMOTE_ACTOR, publicKeyPem: localKeys.rsa.publicKeyPem }),
			serve(REMOTE_ACTOR, remoteActor()),
		);

		let result = await resolverWith().key(keyId);

		expect(isFailure(result) && result.error.code).toBe("not-found");
	});

	test("refuses a key whose owner is not the actor publishing it", async () => {
		server.use(
			serve(REMOTE_ACTOR, {
				...remoteActor(),
				publicKey: { ...publicKeyOf(remoteKeys), owner: "https://mastodon.social/users/bob" },
			}),
		);

		let result = await resolverWith().key(REMOTE_KEY_ID);

		expect(isFailure(result) && result.error.code).toBe("id-mismatch");
	});

	test("answers not-found for a key the actor no longer lists, until refetched", async () => {
		let cache = new MemoryCache();
		let resolver = resolverWith({ cache });
		server.use(
			serve(REMOTE_ACTOR, {
				...remoteActor(),
				publicKey: { ...publicKeyOf(remoteKeys), id: `${REMOTE_ACTOR}#old-key` },
			}),
		);
		unwrap(await resolver.actor(REMOTE_ACTOR));

		let stale = await resolver.key(REMOTE_KEY_ID);
		expect(isFailure(stale) && stale.error.code).toBe("not-found");

		server.use(serve(REMOTE_ACTOR, remoteActor()));
		let rotated = await resolver.key(REMOTE_KEY_ID, { fresh: true });
		expect(unwrap(rotated).owner).toBe(REMOTE_ACTOR);
	});

	test("answers invalid-document for a key PEM that does not import", async () => {
		server.use(
			serve(REMOTE_ACTOR, {
				...remoteActor(),
				publicKey: {
					...publicKeyOf(remoteKeys),
					publicKeyPem: "-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----\n",
				},
			}),
		);

		let result = await resolverWith().key(REMOTE_KEY_ID);

		expect(isFailure(result) && result.error.code).toBe("invalid-document");
	});
});

describe("object", () => {
	test("reads an activity when the document has an actor, and an object otherwise", async () => {
		let note = {
			id: "https://mastodon.social/users/alice/statuses/1",
			type: "Note",
			attributedTo: REMOTE_ACTOR,
			content: "<p>Hi</p>",
		};
		let create = { id: `${note.id}/activity`, type: "Create", actor: REMOTE_ACTOR, object: note };
		server.use(serve(note.id, note), serve(create.id, create));
		let resolver = resolverWith();

		let object = unwrap(await resolver.object(note.id));
		let activity = unwrap(await resolver.object(create.id));

		expect(object.content).toBe("<p>Hi</p>");
		expect("actor" in activity && activity.actor).toBe(REMOTE_ACTOR);
	});

	test("answers gone for a Tombstone", async () => {
		let id = "https://mastodon.social/users/alice/statuses/2";
		server.use(serve(id, { id, type: "Tombstone", formerType: "Note" }));

		let result = await resolverWith().object(id);

		expect(isFailure(result) && result.error.code).toBe("gone");
	});
});

describe("document", () => {
	test("answers the decoded JSON after the id check", async () => {
		let id = "https://mastodon.social/users/alice/collections/featured";
		server.use(serve(id, { id, type: "OrderedCollection", totalItems: 0 }));

		let json = unwrap(await resolverWith().document(id));

		expect(json).toMatchObject({ id, type: "OrderedCollection" });
	});
});

describe("evict", () => {
	test("forgets the cached copy, so the next read refetches", async () => {
		server.use(serve(REMOTE_ACTOR, remoteActor()));
		let resolver = resolverWith();
		unwrap(await resolver.actor(REMOTE_ACTOR));

		await resolver.evict(REMOTE_KEY_ID);
		unwrap(await resolver.actor(REMOTE_ACTOR));

		expect(requests).toHaveLength(2);
	});
});

describe("signer", () => {
	test("signs every GET with draft-cavage over (request-target) host date", async () => {
		let publicKey = unwrap(await importPublicKey(localKeys.rsa.publicKeyPem));
		server.use(
			http.get(REMOTE_ACTOR, async ({ request }) => {
				let verified = await verify(request, {
					maxAge: "1 minute",
					key: async (keyId) => success(keyId === localKeys.rsa.id ? publicKey : null),
				});
				if (isFailure(verified)) return new HttpResponse(null, { status: 401 });
				return HttpResponse.json(remoteActor());
			}),
		);

		let actor = await resolverWith({ signed: true }).actor(REMOTE_ACTOR);

		expect(unwrap(actor).id).toBe(REMOTE_ACTOR);
		let signature = requests[0]?.headers.get("signature") ?? "";
		expect(signature).toContain(`keyId="${LOCAL_ACTOR}#main-key"`);
		expect(signature).toContain('headers="(request-target) host date"');
	});

	test("signs again for the URL a redirect ended at when it refuses the first signature", async () => {
		let publicKey = unwrap(await importPublicKey(localKeys.rsa.publicKeyPem));
		let final = "https://mastodon.social/users/alice";
		server.use(
			http.get("https://mastodon.social/@alice", () => HttpResponse.redirect(final, 301)),
			http.get(final, async ({ request }) => {
				let verified = await verify(request, {
					maxAge: "1 minute",
					key: async () => success(publicKey),
				});
				if (isFailure(verified)) return new HttpResponse(null, { status: 401 });
				return HttpResponse.json(remoteActor());
			}),
		);

		let actor = await resolverWith({ signed: true }).actor("https://mastodon.social/@alice");

		expect(unwrap(actor).id).toBe(REMOTE_ACTOR);
		expect(requests.map((request) => request.url)).toEqual([
			"https://mastodon.social/@alice",
			final,
			final,
		]);
	});
});
