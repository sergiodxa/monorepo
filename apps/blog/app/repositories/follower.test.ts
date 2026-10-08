/**
 * Runs the federation package's follower store suite against `FollowerRepository` on a
 * migrated in-memory D1, plus the cases the suite leaves to each store: an origin that only
 * shares a prefix with a follower's host, and a cursor minted by the other listing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { followerStoreConformance } from "@sdxc/activitypub/testing";
import { InvalidCursorError } from "@sdxc/pagination";
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { testDatabase } from "~/app/test/database";

import { FollowerRepository } from "./follower";

const ACTOR = "https://sergiodxa.com/activitypub/actor";

followerStoreConformance({
	name: "FollowerRepository",
	create: async () => new FollowerRepository(await testDatabase()),
});

/** An accepted follower of `ACTOR` with the given id. */
function follower(id: string) {
	return {
		actor: ACTOR,
		id,
		inbox: `${id}/inbox`,
		sharedInbox: null,
		followId: `${id}#follow`,
		state: "accepted" as const,
	};
}

describe("FollowerRepository.list", () => {
	test("keeps an origin to its own host, never a host it is a prefix of", async () => {
		let store = new FollowerRepository(await testDatabase());
		let alice = follower("https://a.com/users/alice");

		unwrap(await store.put(alice));
		unwrap(await store.put(follower("https://a.com.evil.net/users/mallory")));
		unwrap(await store.put(follower("https://a.community/users/bob")));

		let page = unwrap(
			await store.list(ACTOR, { cursor: null, limit: 10, origin: "https://a.com" }),
		);

		expect(page.items).toStrictEqual([alice]);
	});

	test("matches nobody for an origin that does not parse", async () => {
		let store = new FollowerRepository(await testDatabase());

		unwrap(await store.put(follower("https://a.com/users/alice")));

		expect(
			unwrap(await store.list(ACTOR, { cursor: null, limit: 10, origin: "a.com" })),
		).toStrictEqual({ items: [], next: null });
	});

	test("refuses a cursor minted by inboxes", async () => {
		let store = new FollowerRepository(await testDatabase());

		unwrap(await store.put(follower("https://a.com/users/alice")));
		unwrap(await store.put(follower("https://b.com/users/bob")));

		let next = unwrap(await store.inboxes(ACTOR, { cursor: null, limit: 1 })).next;
		let listed = await store.list(ACTOR, { cursor: next, limit: 1 });

		expect(isFailure(listed) && listed.error).toBeInstanceOf(InvalidCursorError);
	});
});
