/**
 * The suites that say what each store the package calls is, registered as Vitest tests
 * against whatever the app constructs. An app runs them over its own D1, KV or Durable Object
 * implementations, which is what lets the package rely on the contracts its interfaces state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type {
	Follower,
	FollowerStore,
	KeyProvider,
	LocalObjects,
	SeenActivities,
	StorePage,
} from "./store.js";

/** The local actor most tests follow, and a second one that proves followers are per actor. */
const ACTOR = "https://local.com/users/author";
const OTHER_ACTOR = "https://local.com/users/editor";

/** A TTL long enough that nothing expires mid-test, and the same length in milliseconds. */
const TTL = "1 hour";
const TTL_MS = 3_600_000;

/** What the follower store suite needs. */
export interface FollowerStoreConformanceOptions {
	/** Implementation name, which labels the registered suite. */
	name: string;
	/** Builds an empty store; called for every test, so each starts clean. */
	create: () => FollowerStore | Promise<FollowerStore>;
}

/** What the seen-activities suite needs. */
export interface SeenActivitiesConformanceOptions {
	/** Implementation name, which labels the registered suite. */
	name: string;
	/** Builds a store with nothing claimed; called for every test, so each starts clean. */
	create: () => SeenActivities | Promise<SeenActivities>;
	/**
	 * Moves the store's clock forward in milliseconds, which registers the expiry assertion. A
	 * store whose TTL only passes in real time leaves it out.
	 */
	advance?: (ms: number) => void | Promise<void>;
}

/** What the local objects suite needs. */
export interface LocalObjectsConformanceOptions {
	/** Implementation name, which labels the registered suite. */
	name: string;
	create: () => LocalObjects | Promise<LocalObjects>;
	/** Ids of objects the store built by `create` serves, at least one. */
	served: string[];
}

/** What the key provider suite needs. */
export interface KeyProviderConformanceOptions {
	/** Implementation name, which labels the registered suite. */
	name: string;
	create: () => KeyProvider | Promise<KeyProvider>;
	/** Ids of actors the provider built by `create` hosts, at least one. */
	hosted: string[];
}

/** A follower of `actor` on `server`, accepted, delivered to through its personal inbox. */
function follower(server: string, name: string, overrides: Partial<Follower> = {}): Follower {
	return {
		actor: ACTOR,
		id: `${server}/users/${name}`,
		inbox: `${server}/users/${name}/inbox`,
		sharedInbox: null,
		followId: `${server}/follows/${name}`,
		state: "accepted",
		...overrides,
	};
}

/** Every item of a listing, read page by page with `limit`, failing on a page larger than it. */
async function drain<T>(
	read: (cursor: string | null) => Promise<StorePage<T>>,
	limit: number,
): Promise<T[]> {
	let items: T[] = [];
	let cursor: string | null = null;
	let pages = 0;

	do {
		let current: StorePage<T> = await read(cursor);
		expect(current.items.length).toBeLessThanOrEqual(limit);
		items.push(...current.items);
		cursor = current.next;
		pages += 1;
		expect(pages, "the cursor reaches the end of the listing").toBeLessThan(100);
	} while (cursor !== null);

	return items;
}

/**
 * Registers the suite every `FollowerStore` has to pass: idempotent writes keyed by
 * `(actor, id)`, accepted-only listings, and cursors that visit each follower and inbox once.
 *
 * @param options The implementation under test.
 *
 * @example followerStoreConformance({ name: "d1", create: () => new D1FollowerStore(db) });
 */
export function followerStoreConformance({ name, create }: FollowerStoreConformanceOptions): void {
	describe(`${name} FollowerStore conformance`, () => {
		test("reads a follower back as it was put", async () => {
			let store = await create();
			let alice = follower("https://one.com", "alice", { sharedInbox: "https://one.com/inbox" });

			unwrap(await store.put(alice));

			expect(unwrap(await store.get(ACTOR, alice.id))).toStrictEqual(alice);
		});

		test("answers null for an actor that follows nobody here", async () => {
			let store = await create();

			expect(unwrap(await store.get(ACTOR, "https://one.com/users/nobody"))).toBeNull();
		});

		test("a repeated put replaces the follower, refreshing inbox and followId", async () => {
			let store = await create();
			let alice = follower("https://one.com", "alice");
			let refreshed = {
				...alice,
				inbox: "https://one.com/new/inbox",
				sharedInbox: "https://one.com/inbox",
				followId: "https://one.com/follows/again",
			};

			unwrap(await store.put(alice));
			unwrap(await store.put(refreshed));

			expect(unwrap(await store.get(ACTOR, alice.id))).toStrictEqual(refreshed);
			expect(unwrap(await store.count(ACTOR))).toBe(1);
			expect(unwrap(await store.list(ACTOR, { cursor: null, limit: 10 })).items).toStrictEqual([
				refreshed,
			]);
		});

		test("a put moves a pending follower to accepted", async () => {
			let store = await create();
			let alice = follower("https://one.com", "alice", { state: "pending" });

			unwrap(await store.put(alice));
			unwrap(await store.put({ ...alice, state: "accepted" }));

			expect(unwrap(await store.get(ACTOR, alice.id))?.state).toBe("accepted");
			expect(unwrap(await store.count(ACTOR))).toBe(1);
		});

		test("keys followers by (actor, id), so following two local actors is two followers", async () => {
			let store = await create();
			let alice = follower("https://one.com", "alice");
			let ofEditor = { ...alice, actor: OTHER_ACTOR, followId: "https://one.com/follows/editor" };

			unwrap(await store.put(alice));
			unwrap(await store.put(ofEditor));

			expect(unwrap(await store.get(ACTOR, alice.id))).toStrictEqual(alice);
			expect(unwrap(await store.get(OTHER_ACTOR, alice.id))).toStrictEqual(ofEditor);
			expect(unwrap(await store.count(ACTOR))).toBe(1);
			expect(unwrap(await store.count(OTHER_ACTOR))).toBe(1);

			unwrap(await store.remove(ACTOR, alice.id));

			expect(unwrap(await store.get(ACTOR, alice.id))).toBeNull();
			expect(unwrap(await store.get(OTHER_ACTOR, alice.id))).toStrictEqual(ofEditor);
		});

		test("keeps a pending follower readable by get and out of list, count and inboxes", async () => {
			let store = await create();
			let alice = follower("https://one.com", "alice");
			let bob = follower("https://two.com", "bob", { state: "pending" });

			unwrap(await store.put(alice));
			unwrap(await store.put(bob));

			expect(unwrap(await store.get(ACTOR, bob.id))).toStrictEqual(bob);
			expect(unwrap(await store.list(ACTOR, { cursor: null, limit: 10 })).items).toStrictEqual([
				alice,
			]);
			expect(unwrap(await store.count(ACTOR))).toBe(1);
			expect(unwrap(await store.inboxes(ACTOR, { cursor: null, limit: 10 })).items).toStrictEqual([
				alice.inbox,
			]);
		});

		test("answers an empty listing and a zero count for an actor nobody follows", async () => {
			let store = await create();

			unwrap(await store.put(follower("https://one.com", "alice")));

			expect(unwrap(await store.list(OTHER_ACTOR, { cursor: null, limit: 10 }))).toStrictEqual({
				items: [],
				next: null,
			});
			expect(unwrap(await store.count(OTHER_ACTOR))).toBe(0);
			expect(unwrap(await store.inboxes(OTHER_ACTOR, { cursor: null, limit: 10 }))).toStrictEqual({
				items: [],
				next: null,
			});
		});

		test("narrows list to followers whose id has the given origin", async () => {
			let store = await create();
			let alice = follower("https://one.com", "alice");
			let bob = follower("https://two.com", "bob");
			let carol = follower("https://one.com", "carol");

			for (let one of [alice, bob, carol]) unwrap(await store.put(one));

			let items = unwrap(
				await store.list(ACTOR, { cursor: null, limit: 10, origin: "https://one.com" }),
			).items;

			expect(items).toHaveLength(2);
			expect(new Set(items.map((one) => one.id))).toStrictEqual(new Set([alice.id, carol.id]));
		});

		test("pages through list with limit and cursor, visiting each follower once", async () => {
			let store = await create();
			let all = Array.from({ length: 7 }, (_, index) =>
				follower(`https://server${index}.com`, `user${index}`),
			);

			for (let one of all) unwrap(await store.put(one));

			let seen = await drain(
				async (cursor) => unwrap(await store.list(ACTOR, { cursor, limit: 3 })),
				3,
			);

			expect(seen).toHaveLength(all.length);
			expect(new Set(seen.map((one) => one.id))).toStrictEqual(new Set(all.map((one) => one.id)));
		});

		test("answers next null on the page that reaches the end", async () => {
			let store = await create();

			unwrap(await store.put(follower("https://one.com", "alice")));
			unwrap(await store.put(follower("https://two.com", "bob")));

			expect(unwrap(await store.list(ACTOR, { cursor: null, limit: 5 })).next).toBeNull();
			expect(unwrap(await store.inboxes(ACTOR, { cursor: null, limit: 5 })).next).toBeNull();
		});

		test("lists each delivery target once, preferring the shared inbox", async () => {
			let store = await create();
			let shared = "https://one.com/inbox";

			unwrap(await store.put(follower("https://one.com", "alice", { sharedInbox: shared })));
			unwrap(await store.put(follower("https://one.com", "carol", { sharedInbox: shared })));
			unwrap(await store.put(follower("https://two.com", "bob")));

			let targets = unwrap(await store.inboxes(ACTOR, { cursor: null, limit: 10 })).items;

			expect(targets).toHaveLength(2);
			expect(new Set(targets)).toStrictEqual(new Set([shared, "https://two.com/users/bob/inbox"]));
		});

		test("pages through inboxes with limit and cursor, visiting each target once", async () => {
			let store = await create();
			let expected: string[] = [];

			for (let index = 0; index < 5; index += 1) {
				let server = `https://server${index}.com`;
				let shared = `${server}/inbox`;
				expected.push(shared);
				unwrap(await store.put(follower(server, "alice", { sharedInbox: shared })));
				unwrap(await store.put(follower(server, "bob", { sharedInbox: shared })));
			}
			unwrap(await store.put(follower("https://solo.com", "carol")));
			expected.push("https://solo.com/users/carol/inbox");

			let seen = await drain(
				async (cursor) => unwrap(await store.inboxes(ACTOR, { cursor, limit: 2 })),
				2,
			);

			expect(seen).toHaveLength(expected.length);
			expect(new Set(seen)).toStrictEqual(new Set(expected));
		});

		test("removeInbox drops every follower delivered through that personal inbox", async () => {
			let store = await create();
			let alice = follower("https://one.com", "alice");
			let bob = follower("https://two.com", "bob");

			unwrap(await store.put(alice));
			unwrap(await store.put({ ...alice, actor: OTHER_ACTOR }));
			unwrap(await store.put(bob));
			unwrap(await store.removeInbox(alice.inbox));

			expect(unwrap(await store.get(ACTOR, alice.id))).toBeNull();
			expect(unwrap(await store.get(OTHER_ACTOR, alice.id))).toBeNull();
			expect(unwrap(await store.get(ACTOR, bob.id))).toStrictEqual(bob);
		});

		test("removeInbox drops every follower whose shared inbox it is", async () => {
			let store = await create();
			let shared = "https://one.com/inbox";
			let alice = follower("https://one.com", "alice", { sharedInbox: shared });
			let carol = follower("https://one.com", "carol", { sharedInbox: shared, state: "pending" });
			let bob = follower("https://two.com", "bob");

			for (let one of [alice, carol, bob]) unwrap(await store.put(one));
			unwrap(await store.removeInbox(shared));

			expect(unwrap(await store.get(ACTOR, alice.id))).toBeNull();
			expect(unwrap(await store.get(ACTOR, carol.id))).toBeNull();
			expect(unwrap(await store.count(ACTOR))).toBe(1);
			expect(unwrap(await store.inboxes(ACTOR, { cursor: null, limit: 10 })).items).toStrictEqual([
				bob.inbox,
			]);
		});

		test("remove deletes the follower, and succeeds again once it is gone", async () => {
			let store = await create();
			let alice = follower("https://one.com", "alice");

			unwrap(await store.put(alice));
			unwrap(await store.remove(ACTOR, alice.id));
			unwrap(await store.remove(ACTOR, alice.id));
			unwrap(await store.remove(ACTOR, "https://one.com/users/nobody"));

			expect(unwrap(await store.get(ACTOR, alice.id))).toBeNull();
			expect(unwrap(await store.count(ACTOR))).toBe(0);
		});

		test("removeInbox succeeds for an inbox no follower uses", async () => {
			let store = await create();
			let alice = follower("https://one.com", "alice");

			unwrap(await store.put(alice));
			unwrap(await store.removeInbox("https://three.com/inbox"));

			expect(unwrap(await store.count(ACTOR))).toBe(1);
		});
	});
}

/**
 * Registers the suite every `SeenActivities` has to pass: a claim answers `true` once per id
 * within its TTL, and, when the clock can be moved, again after the TTL has passed.
 *
 * @param options The implementation under test.
 *
 * @example seenActivitiesConformance({ name: "kv", create: () => new KvSeenActivities(env.KV) });
 */
export function seenActivitiesConformance({
	name,
	create,
	advance,
}: SeenActivitiesConformanceOptions): void {
	describe(`${name} SeenActivities conformance`, () => {
		test("answers true for the first claim and false for a repeat within the TTL", async () => {
			let seen = await create();
			let id = "https://one.com/activities/1";

			expect(unwrap(await seen.claim(id, TTL))).toBe(true);
			expect(unwrap(await seen.claim(id, TTL))).toBe(false);
			expect(unwrap(await seen.claim(id, TTL))).toBe(false);
		});

		test("claims each id on its own", async () => {
			let seen = await create();

			expect(unwrap(await seen.claim("https://one.com/activities/1", TTL))).toBe(true);
			expect(unwrap(await seen.claim("https://one.com/activities/2", TTL))).toBe(true);
		});

		if (advance) {
			test("answers true again once the TTL has passed", async () => {
				let seen = await create();
				let id = "https://one.com/activities/1";

				expect(unwrap(await seen.claim(id, TTL))).toBe(true);
				await advance(TTL_MS - 1);
				expect(unwrap(await seen.claim(id, TTL))).toBe(false);
				await advance(1);
				expect(unwrap(await seen.claim(id, TTL))).toBe(true);
				expect(unwrap(await seen.claim(id, TTL))).toBe(false);
			});
		}
	});
}

/**
 * Registers the suite every `LocalObjects` has to pass: each served id finds its object, and
 * any other IRI finds `null`.
 *
 * @param options The implementation under test and the ids it serves.
 *
 * @example localObjectsConformance({ name: "posts", create: () => posts(db), served: [POST_ID] });
 */
export function localObjectsConformance({
	name,
	create,
	served,
}: LocalObjectsConformanceOptions): void {
	describe(`${name} LocalObjects conformance`, () => {
		test("finds every served object under its own id", async () => {
			let objects = await create();

			expect(served.length, "the suite needs at least one served id").toBeGreaterThan(0);
			for (let id of served) expect(unwrap(await objects.find(id))?.id).toBe(id);
		});

		test("answers null for an IRI it serves nothing under", async () => {
			let objects = await create();

			expect(unwrap(await objects.find(`https://remote.com/${crypto.randomUUID()}`))).toBeNull();
		});
	});
}

/**
 * Registers the suite every `KeyProvider` has to pass: each hosted actor answers its own keys,
 * and any other actor answers `null`.
 *
 * @param options The implementation under test and the actors it hosts.
 *
 * @example keyProviderConformance({ name: "secrets", create: () => keys(env), hosted: [ACTOR] });
 */
export function keyProviderConformance({
	name,
	create,
	hosted,
}: KeyProviderConformanceOptions): void {
	describe(`${name} KeyProvider conformance`, () => {
		test("answers each hosted actor's keys, naming that actor", async () => {
			let provider = await create();

			expect(hosted.length, "the suite needs at least one hosted actor").toBeGreaterThan(0);
			for (let actor of hosted) {
				let keys = unwrap(await provider.keysOf(actor));
				expect(keys?.actor).toBe(actor);
				expect(keys?.rsa.id).toEqual(expect.any(String));
			}
		});

		test("answers null for an actor it does not host", async () => {
			let provider = await create();

			expect(
				unwrap(await provider.keysOf(`https://remote.com/users/${crypto.randomUUID()}`)),
			).toBeNull();
		});
	});
}
