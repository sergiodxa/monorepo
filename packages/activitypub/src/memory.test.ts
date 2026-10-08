/**
 * Runs every store conformance suite against the in-memory implementations, which is what
 * holds the suites to being passable and the memory stores to the contracts a production
 * store meets.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	followerStoreConformance,
	keyProviderConformance,
	localObjectsConformance,
	MemoryFollowerStore,
	MemoryKeyProvider,
	MemoryLocalObjects,
	MemorySeenActivities,
	seenActivitiesConformance,
} from "./testing.js";

import type { ActivityPub } from "./index.js";

import { ActorKeys, parseObject } from "./index.js";

/** Milliseconds the injectable clock starts at, fixed so a test reads the same time twice. */
const EPOCH = 1_757_203_200_000;

const ACTOR = "https://local.com/users/author";
const ARTICLE_ID = "https://local.com/articles/hello";

let clock = { now: EPOCH };

/** The keys of the hosted actor, signing with a freshly generated RSA key. */
async function actorKeys(actor: string): Promise<ActorKeys> {
	let pair = await crypto.subtle.generateKey(
		{
			name: "RSASSA-PKCS1-v1_5",
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: "SHA-256",
		},
		false,
		["sign", "verify"],
	);
	return new ActorKeys({
		actor,
		rsa: { id: `${actor}#main-key`, privateKey: pair.privateKey, publicKeyPem: "" },
	});
}

/** An Article the app serves, read through `parseObject` so every member is present. */
function article(id: string): ActivityPub.Object {
	return unwrap(parseObject({ id, type: "Article", attributedTo: ACTOR, content: "<p>Hi</p>" }));
}

let hosted = await actorKeys(ACTOR);

followerStoreConformance({ name: "MemoryFollowerStore", create: () => new MemoryFollowerStore() });

seenActivitiesConformance({
	name: "MemorySeenActivities",
	create() {
		clock = { now: EPOCH };
		return new MemorySeenActivities({ now: () => clock.now });
	},
	advance(ms) {
		clock.now += ms;
	},
});

localObjectsConformance({
	name: "MemoryLocalObjects",
	create: () => new MemoryLocalObjects([article(ARTICLE_ID)]),
	served: [ARTICLE_ID],
});

keyProviderConformance({
	name: "MemoryKeyProvider",
	create: () => new MemoryKeyProvider([hosted]),
	hosted: [ACTOR],
});

describe("MemoryFollowerStore", () => {
	test("starts with the followers it was given", async () => {
		let follower = {
			actor: ACTOR,
			id: "https://one.com/users/alice",
			inbox: "https://one.com/users/alice/inbox",
			sharedInbox: null,
			followId: "https://one.com/follows/1",
			state: "accepted" as const,
		};
		let store = new MemoryFollowerStore([follower]);

		expect(unwrap(await store.get(ACTOR, follower.id))).toStrictEqual(follower);
	});

	test("fails on a cursor it did not write and on a limit below one", async () => {
		let store = new MemoryFollowerStore();

		expect(isFailure(await store.list(ACTOR, { cursor: "nope", limit: 10 }))).toBe(true);
		expect(isFailure(await store.inboxes(ACTOR, { cursor: null, limit: 0 }))).toBe(true);
	});
});

describe("MemorySeenActivities", () => {
	test("fails on a TTL that is no duration", async () => {
		let seen = new MemorySeenActivities();

		expect(isFailure(await seen.claim("https://one.com/activities/1", Number.NaN))).toBe(true);
	});
});
