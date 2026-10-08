/**
 * `handle` for every row of the processing table, with the memory stores and a resolver
 * that serves documents from a map: what the package does to the stores and sends before
 * the app's handler runs, which activities it acknowledges unhandled, and what it retries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success, unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { ResolvedKey, Resolver, ResolveOptions } from "../remote.js";
import type { Follower } from "../store.js";

import { ActivityPubFetchError } from "../errors.js";
import {
	LOCAL_ACTOR,
	LOCAL_ARTICLE,
	MASTODON_ACCEPT,
	MASTODON_ACTOR,
	MASTODON_ANNOUNCE,
	MASTODON_CREATE_NOTE,
	MASTODON_DELETE_NOTE,
	MASTODON_FOLLOW,
	MASTODON_LIKE,
	MASTODON_QUOTE,
	MASTODON_UNDO_FOLLOW,
	MISSKEY_ACTOR,
	MISSKEY_REACTION,
} from "../fixtures/index.js";
import {
	MemoryFollowerStore,
	MemoryKeyProvider,
	MemoryLocalObjects,
	MemorySeenActivities,
} from "../memory.js";

import type { DeleteInbound, HandleOptions, Inbound } from "./inbox-handle.js";
import type { ActivityPub } from "./types.js";

import { handle } from "./inbox-handle.js";
import { parseActivity, parseActor, parseObject } from "./parse.js";

const ALICE = MASTODON_ACTOR.id;
const ALICE_NOTE = MASTODON_CREATE_NOTE.object.id;
const LOCAL_INBOX = "https://letters.blog/activitypub/inbox";

/** The local actor, which follows are addressed to. */
const LOCAL = unwrap(
	parseActor({
		id: LOCAL_ACTOR,
		type: "Person",
		preferredUsername: "hello",
		inbox: LOCAL_INBOX,
		endpoints: { sharedInbox: LOCAL_INBOX },
	}),
);

/** The local article every reply, like and boost in the fixtures names. */
const ARTICLE = unwrap(
	parseObject({ id: LOCAL_ARTICLE, type: "Article", attributedTo: LOCAL_ACTOR }),
);

/** What a served IRI answers: a document, or a fetch failure. */
type Served = Record<string, unknown> | ActivityPubFetchError;

/** A resolver over a map of documents, recording every lookup and eviction. */
class MapResolver implements Resolver {
	documents = new Map<string, Served>();
	lookups: Array<{ iri: string; fresh: boolean }> = [];
	evicted: string[] = [];

	/** Serves `document` at its own id, or `served` at `iri`. */
	serve(iri: string, served: Served): this {
		this.documents.set(iri, served);
		return this;
	}

	async actor(iri: string, options?: ResolveOptions) {
		let json = this.#load(iri, options);
		if (isFailure(json)) return json;
		let actor = parseActor(json.data);
		if (isFailure(actor)) return failure(new ActivityPubFetchError("invalid-document", iri, "no"));
		return actor;
	}

	async key(keyId: string): Promise<Result<ResolvedKey, ActivityPubFetchError>> {
		return failure(new ActivityPubFetchError("not-found", keyId, "keys are not served here"));
	}

	async object(iri: string, options?: ResolveOptions) {
		let json = this.#load(iri, options);
		if (isFailure(json)) return json;
		let parsed = "actor" in json.data ? parseActivity(json.data) : parseObject(json.data);
		if (isFailure(parsed)) return failure(new ActivityPubFetchError("invalid-document", iri, "no"));
		return success<ActivityPub.Object | ActivityPub.Activity>(parsed.data);
	}

	async document(iri: string, options?: ResolveOptions) {
		return this.#load(iri, options);
	}

	async evict(iri: string) {
		this.evicted.push(iri);
	}

	#load(
		iri: string,
		options?: ResolveOptions,
	): Result<Record<string, unknown>, ActivityPubFetchError> {
		this.lookups.push({ iri, fresh: options?.fresh === true });
		let served = this.documents.get(iri);
		if (served === undefined) return failure(new ActivityPubFetchError("not-found", iri, "404"));
		if (served instanceof ActivityPubFetchError) return failure(served);
		return success(served);
	}
}

let resolver: MapResolver;
let followers: MemoryFollowerStore;
let sent: Array<{ activity: Record<string, unknown>; inbox: string }>;
let calls: Array<{ handler: string; inbound: Inbound | DeleteInbound }>;

beforeEach(() => {
	resolver = new MapResolver().serve(ALICE, MASTODON_ACTOR);
	followers = new MemoryFollowerStore();
	sent = [];
	calls = [];
});

/** A handler that records its call and succeeds. */
function recorder(handler: string) {
	return async (inbound: Inbound | DeleteInbound): Promise<Result<void, Error>> => {
		calls.push({ handler, inbound });
		return success(undefined);
	};
}

/** The options of a single-actor app that records every call and delivery. */
function options(overrides: Partial<HandleOptions> = {}): HandleOptions {
	return {
		actor: LOCAL,
		keys: new MemoryKeyProvider(),
		followers,
		seen: new MemorySeenActivities(),
		objects: new MemoryLocalObjects([ARTICLE]),
		resolver,
		blocked: () => false,
		async send(activity, inbox) {
			sent.push({ activity: JSON.parse(activity) as Record<string, unknown>, inbox });
			return success(undefined);
		},
		on: {
			follow: async (inbound) => {
				calls.push({ handler: "follow", inbound });
				return success(null);
			},
			undo: recorder("undo"),
			create: recorder("create"),
			update: recorder("update"),
			delete: recorder("delete"),
			like: recorder("like"),
			announce: recorder("announce"),
			accept: recorder("accept"),
			reject: recorder("reject"),
			move: recorder("move"),
		},
		...overrides,
	};
}

/** The job input `receive` would have answered for `activity`. */
function input(activity: Record<string, unknown>) {
	let actor = String(activity.actor);
	return {
		activity,
		actor,
		signer: actor,
		keyId: `${actor}#main-key`,
		origin: new URL(actor).origin,
		verification: "signature" as const,
		receivedAt: "2026-10-07T12:00:00.000Z",
	};
}

/** Alice, already following the local actor through `MASTODON_FOLLOW`. */
function aliceFollows(state: Follower["state"] = "accepted"): Follower {
	return {
		actor: LOCAL_ACTOR,
		id: ALICE,
		inbox: MASTODON_ACTOR.inbox,
		sharedInbox: MASTODON_ACTOR.endpoints.sharedInbox,
		followId: MASTODON_FOLLOW.id,
		state,
	};
}

describe("deduplication", () => {
	test("processes an id once and acknowledges the redelivery as a duplicate", async () => {
		let shared = options();

		unwrap(await handle(input(MASTODON_LIKE), shared));
		let again = unwrap(await handle(input(MASTODON_LIKE), shared));

		expect(again.status).toBe("duplicate");
		expect(calls).toHaveLength(1);
	});

	test("skips the claim on a retry, so a failed attempt is processed again", async () => {
		let shared = options();
		unwrap(await handle(input(MASTODON_LIKE), shared));

		let retried = unwrap(await handle(input(MASTODON_LIKE), { ...shared, attempts: 2 }));

		expect(retried.status).toBe("processed");
	});

	test("processes when the seen store fails", async () => {
		let seen = { claim: async () => failure(new Error("kv down")) };

		let outcome = unwrap(await handle(input(MASTODON_LIKE), options({ seen })));

		expect(outcome.status).toBe("processed");
	});
});

describe("Follow", () => {
	test("stores the follower and sends an Accept embedding the Follow to its own inbox", async () => {
		let outcome = unwrap(await handle(input(MASTODON_FOLLOW), options()));

		expect(outcome).toEqual({ status: "processed", type: "Follow", reason: null });
		expect(unwrap(await followers.get(LOCAL_ACTOR, ALICE))).toEqual(aliceFollows());
		expect(sent).toHaveLength(1);
		expect(sent[0]?.inbox).toBe(MASTODON_ACTOR.inbox);
		expect(sent[0]?.activity).toMatchObject({
			type: "Accept",
			actor: LOCAL_ACTOR,
			id: `${LOCAL_ACTOR}#accepts/${encodeURIComponent(MASTODON_FOLLOW.id)}`,
			object: { id: MASTODON_FOLLOW.id, type: "Follow", actor: ALICE, object: LOCAL_ACTOR },
		});
		expect(calls.map((call) => call.handler)).toEqual(["follow"]);
	});

	test("keeps the follower pending without an Accept when the actor approves by hand", async () => {
		let local = { ...LOCAL, manuallyApprovesFollowers: true };

		let outcome = unwrap(await handle(input(MASTODON_FOLLOW), options({ actor: local })));

		expect(outcome.reason).toBe("pending");
		expect(unwrap(await followers.get(LOCAL_ACTOR, ALICE))?.state).toBe("pending");
		expect(sent).toEqual([]);
	});

	test("re-sends the Accept for a repeated Follow of an accepted follower", async () => {
		await followers.put(aliceFollows());
		let local = { ...LOCAL, manuallyApprovesFollowers: true };
		let repeated = { ...MASTODON_FOLLOW, id: "https://mastodon.social/follows/2" };

		unwrap(await handle(input(repeated), options({ actor: local })));

		expect(sent.map((one) => one.activity.type)).toEqual(["Accept"]);
		expect(unwrap(await followers.get(LOCAL_ACTOR, ALICE))?.followId).toBe(repeated.id);
	});

	test("sends a Reject and forgets the follower when the app rejects", async () => {
		await followers.put(aliceFollows("pending"));
		let on = { follow: async () => success("reject" as const) };

		let outcome = unwrap(await handle(input(MASTODON_FOLLOW), options({ on })));

		expect(outcome.reason).toBe("rejected");
		expect(sent.map((one) => one.activity.type)).toEqual(["Reject"]);
		expect(unwrap(await followers.get(LOCAL_ACTOR, ALICE))).toBeNull();
	});

	test("sends a Reject to a blocked server without asking the app", async () => {
		let outcome = unwrap(
			await handle(
				input(MASTODON_FOLLOW),
				options({ blocked: (host) => host === "mastodon.social" }),
			),
		);

		expect(outcome.reason).toBe("blocked");
		expect(sent.map((one) => one.activity.type)).toEqual(["Reject"]);
		expect(calls).toEqual([]);
	});

	test("ignores a Follow of someone else", async () => {
		let follow = { ...MASTODON_FOLLOW, object: "https://letters.blog/someone-else" };

		let outcome = unwrap(await handle(input(follow), options()));

		expect(outcome).toMatchObject({ status: "ignored", reason: "not-addressed" });
	});

	test("retries when the Accept cannot be queued", async () => {
		let send = async () => failure(new Error("queue full"));

		let result = await handle(input(MASTODON_FOLLOW), options({ send }));

		expect(isFailure(result) && result.error.retryable).toBe(true);
	});
});

describe("Undo", () => {
	test("removes the follower named by an embedded Follow", async () => {
		await followers.put(aliceFollows());

		unwrap(await handle(input(MASTODON_UNDO_FOLLOW), options()));

		expect(unwrap(await followers.get(LOCAL_ACTOR, ALICE))).toBeNull();
		expect(calls.map((call) => call.handler)).toEqual(["undo"]);
	});

	test("removes the follower whose followId an IRI names", async () => {
		await followers.put(aliceFollows());
		let undo = { ...MASTODON_UNDO_FOLLOW, object: MASTODON_FOLLOW.id };

		unwrap(await handle(input(undo), options()));

		expect(unwrap(await followers.get(LOCAL_ACTOR, ALICE))).toBeNull();
	});

	test("passes the sender's own undone Like to the handler", async () => {
		let undo = {
			id: `${ALICE}#likes/4400123/undo`,
			type: "Undo",
			actor: ALICE,
			object: MASTODON_LIKE,
		};

		let outcome = unwrap(await handle(input(undo), options()));

		expect(outcome.status).toBe("processed");
		expect(calls[0]?.inbound.object?.id).toBe(MASTODON_LIKE.id);
		expect(calls[0]?.inbound.target).toBe(LOCAL_ARTICLE);
	});

	test("ignores an Undo of an activity by someone else", async () => {
		let theirs = "https://mastodon.social/users/bob/likes/1";
		resolver.serve(theirs, {
			id: theirs,
			type: "Like",
			actor: "https://mastodon.social/users/bob",
			object: LOCAL_ARTICLE,
		});
		let undo = { id: `${ALICE}#undo/1`, type: "Undo", actor: ALICE, object: theirs };

		let outcome = unwrap(await handle(input(undo), options()));

		expect(outcome.reason).toBe("not-owner");
		expect(calls).toEqual([]);
	});
});

describe("Create and Update", () => {
	test("hands a reply to a local object to the create handler", async () => {
		let outcome = unwrap(await handle(input(MASTODON_CREATE_NOTE), options()));

		expect(outcome.status).toBe("processed");
		expect(calls[0]?.handler).toBe("create");
		expect(calls[0]?.inbound.object?.id).toBe(ALICE_NOTE);
		expect(calls[0]?.inbound.target).toBe(LOCAL_ARTICLE);
		expect(calls[0]?.inbound.actor?.id).toBe(ALICE);
	});

	test("hands a quote of a local object to the handler", async () => {
		unwrap(await handle(input(MASTODON_QUOTE), options()));

		expect(calls[0]?.inbound.target).toBe(LOCAL_ARTICLE);
	});

	test("hands a post that only mentions the local actor to the handler", async () => {
		let note = { ...MASTODON_CREATE_NOTE.object, inReplyTo: null };
		let create = { ...MASTODON_CREATE_NOTE, object: note };

		unwrap(await handle(input(create), options()));

		expect(calls[0]?.inbound.target).toBe(LOCAL_ACTOR);
	});

	test("ignores a post that concerns nothing local", async () => {
		let note = { ...MASTODON_CREATE_NOTE.object, inReplyTo: null, tag: [] };

		let outcome = unwrap(await handle(input({ ...MASTODON_CREATE_NOTE, object: note }), options()));

		expect(outcome).toMatchObject({ status: "ignored", reason: "unrelated" });
	});

	test("ignores a post attributed to someone else", async () => {
		let note = {
			...MASTODON_CREATE_NOTE.object,
			attributedTo: "https://mastodon.social/users/bob",
		};

		let outcome = unwrap(await handle(input({ ...MASTODON_CREATE_NOTE, object: note }), options()));

		expect(outcome.reason).toBe("not-owner");
	});

	test("fetches an object embedded from another origin instead of trusting it", async () => {
		let foreign = "https://evil.example/notes/1";
		let note = { ...MASTODON_CREATE_NOTE.object, id: foreign };
		resolver.serve(foreign, { ...note, attributedTo: "https://evil.example/users/eve" });

		let outcome = unwrap(await handle(input({ ...MASTODON_CREATE_NOTE, object: note }), options()));

		expect(resolver.lookups.map((lookup) => lookup.iri)).toContain(foreign);
		expect(outcome.reason).toBe("not-owner");
	});

	test("hands an edit to the update handler", async () => {
		let update = { ...MASTODON_CREATE_NOTE, id: `${ALICE_NOTE}#updates/1`, type: "Update" };

		unwrap(await handle(input(update), options()));

		expect(calls.map((call) => call.handler)).toEqual(["update"]);
	});

	test("retries when the object's server is unreachable", async () => {
		resolver.serve(ALICE_NOTE, new ActivityPubFetchError("timeout", ALICE_NOTE, "slow"));
		let create = { ...MASTODON_CREATE_NOTE, object: ALICE_NOTE };

		let result = await handle(input(create), options());

		expect(isFailure(result) && result.error.retryable).toBe(true);
	});
});

describe("Update of the actor", () => {
	test("evicts the actor and refreshes the stored follower's inboxes", async () => {
		await followers.put(aliceFollows());
		let moved = { ...MASTODON_ACTOR, inbox: `${ALICE}/inbox2`, endpoints: { sharedInbox: null } };
		resolver.serve(ALICE, moved);
		let update = { id: `${ALICE}#updates/1`, type: "Update", actor: ALICE, object: moved };

		unwrap(await handle(input(update), options()));

		expect(resolver.evicted).toContain(ALICE);
		expect(resolver.lookups).toContainEqual({ iri: ALICE, fresh: true });
		expect(unwrap(await followers.get(LOCAL_ACTOR, ALICE))).toMatchObject({
			inbox: `${ALICE}/inbox2`,
			sharedInbox: null,
		});
		expect(calls[0]?.handler).toBe("update");
	});
});

describe("Delete", () => {
	test("confirms a deleted object with a refetch that answers gone", async () => {
		resolver.serve(ALICE_NOTE, new ActivityPubFetchError("gone", ALICE_NOTE, "410"));

		unwrap(await handle(input(MASTODON_DELETE_NOTE), options()));

		let inbound = calls[0]?.inbound as DeleteInbound;
		expect(inbound.deleted).toEqual({ kind: "object", id: ALICE_NOTE });
		expect(resolver.lookups).toContainEqual({ iri: ALICE_NOTE, fresh: true });
	});

	test("ignores a gone object on another origin than the sender's", async () => {
		let elsewhere = "https://pixelfed.social/p/bob/1";
		resolver.serve(elsewhere, new ActivityPubFetchError("not-found", elsewhere, "404"));
		let deletion = { ...MASTODON_DELETE_NOTE, object: elsewhere };

		let outcome = unwrap(await handle(input(deletion), options()));

		expect(outcome.reason).toBe("not-owner");
		expect(calls).toEqual([]);
	});

	test("ignores a sender whose IRI serves somebody else's actor", async () => {
		let mallory = "https://evil.social/users/mallory";
		resolver.serve(mallory, MASTODON_ACTOR).serve(ALICE_NOTE, MASTODON_CREATE_NOTE.object);
		let deletion = { ...MASTODON_DELETE_NOTE, id: `${mallory}#delete`, actor: mallory };
		deletion.object = { ...deletion.object, id: ALICE_NOTE };

		let outcome = unwrap(await handle(input(deletion), options()));

		expect(outcome).toMatchObject({ status: "ignored", reason: "actor-unavailable" });
		expect(calls).toEqual([]);
	});

	test("ignores a Delete of an object its server still attributes to someone else", async () => {
		resolver.serve(ALICE_NOTE, {
			...MASTODON_CREATE_NOTE.object,
			attributedTo: "https://mastodon.social/users/bob",
		});

		let outcome = unwrap(await handle(input(MASTODON_DELETE_NOTE), options()));

		expect(outcome.reason).toBe("not-owner");
	});

	test("removes a deleted account's follow and evicts it, even when its document is gone", async () => {
		await followers.put(aliceFollows());
		resolver.serve(ALICE, new ActivityPubFetchError("gone", ALICE, "410"));
		let deleted = { id: `${ALICE}#delete`, type: "Delete", actor: ALICE, object: ALICE };

		unwrap(await handle(input(deleted), options()));

		expect(unwrap(await followers.get(LOCAL_ACTOR, ALICE))).toBeNull();
		expect(resolver.evicted).toContain(ALICE);
		let inbound = calls[0]?.inbound as DeleteInbound;
		expect(inbound.actor).toBeNull();
		expect(inbound.deleted).toEqual({ kind: "actor", id: ALICE });
	});
});

describe("Like, EmojiReact and Announce", () => {
	test("hands a Like of a local object to the like handler", async () => {
		unwrap(await handle(input(MASTODON_LIKE), options()));

		expect(calls[0]?.handler).toBe("like");
		expect(calls[0]?.inbound.object?.id).toBe(LOCAL_ARTICLE);
	});

	test("hands a Misskey reaction and a Pleroma EmojiReact to the like handler", async () => {
		resolver.serve(MISSKEY_ACTOR.id, MISSKEY_ACTOR);
		let react = { ...MASTODON_LIKE, id: `${ALICE}#reacts/1`, type: "EmojiReact", content: "🔥" };

		unwrap(await handle(input(MISSKEY_REACTION), options()));
		unwrap(await handle(input(react), options()));

		expect(calls.map((call) => call.handler)).toEqual(["like", "like"]);
	});

	test("hands a boost of a local object to the announce handler", async () => {
		unwrap(await handle(input(MASTODON_ANNOUNCE), options()));

		expect(calls[0]?.handler).toBe("announce");
	});

	test("ignores a Like of anything else", async () => {
		let like = { ...MASTODON_LIKE, object: "https://mastodon.social/notes/1" };

		let outcome = unwrap(await handle(input(like), options()));

		expect(outcome).toMatchObject({ status: "ignored", reason: "unrelated" });
	});
});

describe("Accept and Reject", () => {
	test("hands an Accept of a Follow the local actor sent to the handler", async () => {
		unwrap(await handle(input(MASTODON_ACCEPT), options()));

		expect(calls[0]?.handler).toBe("accept");
		expect(calls[0]?.inbound.object?.id).toBe(MASTODON_ACCEPT.object.id);
	});

	test("ignores an Accept of a Follow no local actor sent", async () => {
		let accept = {
			...MASTODON_ACCEPT,
			object: { ...MASTODON_ACCEPT.object, actor: "https://letters.blog/users/nobody" },
		};

		let outcome = unwrap(await handle(input(accept), options()));

		expect(outcome.reason).toBe("not-addressed");
	});

	test("hands a Reject naming a local Follow IRI to the handler", async () => {
		let reject = { ...MASTODON_ACCEPT, type: "Reject", object: MASTODON_ACCEPT.object.id };

		unwrap(await handle(input(reject), options()));

		expect(calls[0]?.handler).toBe("reject");
	});
});

describe("Move", () => {
	let target = "https://hachyderm.io/users/alice";
	let move = { id: `${ALICE}#moves/1`, type: "Move", actor: ALICE, object: ALICE, target };

	test("hands a move both accounts confirm to the handler", async () => {
		resolver.serve(ALICE, { ...MASTODON_ACTOR, movedTo: target }).serve(target, {
			...MASTODON_ACTOR,
			id: target,
			inbox: `${target}/inbox`,
			alsoKnownAs: [ALICE],
		});

		unwrap(await handle(input(move), options()));

		expect(calls[0]?.handler).toBe("move");
		expect(calls[0]?.inbound.object?.id).toBe(target);
		expect(resolver.lookups).toContainEqual({ iri: target, fresh: true });
	});

	test("ignores a move the target does not confirm", async () => {
		resolver
			.serve(ALICE, { ...MASTODON_ACTOR, movedTo: target })
			.serve(target, { ...MASTODON_ACTOR, id: target, inbox: `${target}/inbox`, alsoKnownAs: [] });

		let outcome = unwrap(await handle(input(move), options()));

		expect(outcome.reason).toBe("unverifiable");
	});
});

describe("anything else", () => {
	test("acknowledges an activity type it does not process", async () => {
		let flag = { id: `${ALICE}#flags/1`, type: "Flag", actor: ALICE, object: LOCAL_ACTOR };

		let outcome = unwrap(await handle(input(flag), options()));

		expect(outcome).toEqual({ status: "ignored", type: "Flag", reason: "unhandled" });
	});

	test("ignores everything from a server blocked after it was received", async () => {
		let outcome = unwrap(
			await handle(input(MASTODON_LIKE), options({ blocked: async () => true })),
		);

		expect(outcome.reason).toBe("blocked");
	});

	test("ignores an activity whose actor cannot be fetched for good", async () => {
		resolver.serve(ALICE, new ActivityPubFetchError("not-found", ALICE, "404"));

		let outcome = unwrap(await handle(input(MASTODON_LIKE), options()));

		expect(outcome.reason).toBe("actor-unavailable");
	});

	test("retries when the actor's server is unreachable", async () => {
		resolver.serve(ALICE, new ActivityPubFetchError("network", ALICE, "reset"));

		let result = await handle(input(MASTODON_LIKE), options());

		expect(isFailure(result) && result.error.retryable).toBe(true);
	});

	test("retries a handler failure", async () => {
		let on = { like: async () => failure(new Error("d1 busy")) };

		let result = await handle(input(MASTODON_LIKE), options({ on }));

		expect(isFailure(result) && result.error.code).toBe("handler");
		expect(isFailure(result) && result.error.retryable).toBe(true);
	});
});
