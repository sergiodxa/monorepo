/**
 * The behavior every `IdempotencyStore` promises, written once as a Vitest suite so the
 * in-memory store, both SQLite drivers and a real D1 binding are held to the same claim,
 * completion, release, lease and expiry rules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { ClaimRequest, IdempotencyStore, StoredResponse } from "../types.js";

/** The instant every contract case starts at. */
const NOW = 1_700_000_000_000;

/** A stored `201` with a JSON body, as the middleware would write it. */
const CREATED: StoredResponse = {
	status: 201,
	headers: [
		["content-type", "application/json"],
		["location", "/monitors/1"],
	],
	body: btoa('{"id":1}'),
};

/**
 * A claim on `id` at `now`, with a one second lease and a one minute expiry.
 *
 * @param id - The record id
 * @param overrides - Fields a case changes
 */
function claimOf(id: string, overrides: Partial<ClaimRequest> = {}): ClaimRequest {
	let now = overrides.now ?? NOW;
	return {
		id,
		fingerprint: "fp-1",
		now,
		leaseMs: 1_000,
		expiresAt: now + 60_000,
		...overrides,
	};
}

/**
 * Claims and requires the store to answer `claimed`, returning the lease.
 *
 * @param store - The store under test
 * @param request - The claim
 */
async function mustClaim(store: IdempotencyStore, request: ClaimRequest): Promise<string> {
	let outcome = unwrap(await store.claim(request));
	expect(outcome.status).toBe("claimed");
	return outcome.status === "claimed" ? outcome.lease : "";
}

/**
 * Registers the store contract under `name`.
 *
 * @param name - How the suite is labelled
 * @param createStore - Builds an empty store per case
 */
export function describeStoreContract(
	name: string,
	createStore: () => IdempotencyStore | Promise<IdempotencyStore>,
): void {
	describe(`${name} store contract`, () => {
		test("the first claim wins and a second one sees it in flight", async () => {
			let store = await createStore();
			let lease = await mustClaim(store, claimOf("a"));
			expect(lease).toEqual(expect.any(String));

			let second = unwrap(await store.claim(claimOf("a", { fingerprint: "fp-2" })));
			expect(second).toEqual({ status: "in-flight", fingerprint: "fp-1" });
		});

		test("a completed record answers every later claim with its response", async () => {
			let store = await createStore();
			let lease = await mustClaim(store, claimOf("a"));
			unwrap(await store.complete("a", lease, CREATED, NOW + 60_000));

			let replay = unwrap(await store.claim(claimOf("a", { now: NOW + 5_000 })));
			expect(replay).toEqual({ status: "completed", fingerprint: "fp-1", response: CREATED });
		});

		test("a record without a fingerprint keeps null", async () => {
			let store = await createStore();
			let lease = await mustClaim(store, claimOf("a", { fingerprint: null }));
			unwrap(await store.complete("a", lease, CREATED, NOW + 60_000));

			let replay = unwrap(await store.claim(claimOf("a")));
			expect(replay).toEqual({ status: "completed", fingerprint: null, response: CREATED });
		});

		test("a released claim can be taken again", async () => {
			let store = await createStore();
			let lease = await mustClaim(store, claimOf("a"));
			unwrap(await store.release("a", lease));

			let again = await mustClaim(store, claimOf("a"));
			expect(again).not.toBe(lease);
		});

		test("ids are independent", async () => {
			let store = await createStore();
			await mustClaim(store, claimOf("a"));
			await mustClaim(store, claimOf("b"));
		});

		test("an abandoned claim is taken over once its lease runs out", async () => {
			let store = await createStore();
			await mustClaim(store, claimOf("a"));

			let early = unwrap(await store.claim(claimOf("a", { now: NOW + 999 })));
			expect(early.status).toBe("in-flight");

			await mustClaim(store, claimOf("a", { now: NOW + 1_000, fingerprint: "fp-2" }));
		});

		test("a stale lease can neither complete nor release the new claim", async () => {
			let store = await createStore();
			let stale = await mustClaim(store, claimOf("a"));
			let fresh = await mustClaim(store, claimOf("a", { now: NOW + 1_000 }));

			unwrap(await store.complete("a", stale, CREATED, NOW + 60_000));
			unwrap(await store.release("a", stale));

			let state = unwrap(await store.claim(claimOf("a", { now: NOW + 1_500 })));
			expect(state.status).toBe("in-flight");

			unwrap(await store.complete("a", fresh, CREATED, NOW + 60_000));
			let replay = unwrap(await store.claim(claimOf("a", { now: NOW + 1_500 })));
			expect(replay.status).toBe("completed");
		});

		test("release leaves a completed record in place", async () => {
			let store = await createStore();
			let lease = await mustClaim(store, claimOf("a"));
			unwrap(await store.complete("a", lease, CREATED, NOW + 60_000));
			unwrap(await store.release("a", lease));

			let replay = unwrap(await store.claim(claimOf("a")));
			expect(replay.status).toBe("completed");
		});

		test("a completed record is claimable again once it expires", async () => {
			let store = await createStore();
			let lease = await mustClaim(store, claimOf("a"));
			unwrap(await store.complete("a", lease, CREATED, NOW + 10_000));

			let before = unwrap(await store.claim(claimOf("a", { now: NOW + 9_999 })));
			expect(before.status).toBe("completed");

			await mustClaim(store, claimOf("a", { now: NOW + 10_000 }));
		});

		test("exactly one of many concurrent claims wins", async () => {
			let store = await createStore();
			let outcomes = await Promise.all(Array.from({ length: 10 }, () => store.claim(claimOf("a"))));
			let statuses = outcomes.map((outcome) => unwrap(outcome).status);

			expect(statuses.filter((status) => status === "claimed")).toHaveLength(1);
			expect(statuses.filter((status) => status === "in-flight")).toHaveLength(9);
		});
	});
}
