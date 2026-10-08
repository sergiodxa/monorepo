/**
 * Runs the federation package's seen-activities suite against `SeenActivityCache` over the
 * real `CACHE` KV namespace, in the Workers pool, since the guarantee under test is that a
 * claim written to KV is found there again, and that a TTL under KV's minute is accepted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { seenActivitiesConformance } from "@sdxc/activitypub/testing";
import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { isFailure, unwrap } from "@sdxc/result";
import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import { SeenActivityCache } from "./seen-activities";

/** A claim id no other test in this isolate has used. */
function freshId(): string {
	return `https://remote.com/activities/${crypto.randomUUID()}`;
}

/**
 * Forgets every claim, because KV outlives a single test and the suite reuses its ids
 * across tests that each expect nothing claimed.
 */
async function forgetClaims(): Promise<void> {
	let { keys } = await env.CACHE.list();
	let claims = keys.filter((key) => key.name.startsWith("activitypub:seen:"));
	await Promise.all(claims.map((key) => env.CACHE.delete(key.name)));
}

seenActivitiesConformance({
	name: "SeenActivityCache",
	create: async () => {
		await forgetClaims();
		return new SeenActivityCache(new WorkerKVCache(env.CACHE));
	},
});

describe("SeenActivityCache", () => {
	test("holds a claim shorter than KV's minimum for a minute instead of failing", async () => {
		let seen = new SeenActivityCache(new WorkerKVCache(env.CACHE));
		let id = freshId();

		expect(unwrap(await seen.claim(id, "5 seconds"))).toBe(true);
		expect(unwrap(await seen.claim(id, "5 seconds"))).toBe(false);
	});

	test("keeps its claims under its own prefix of the shared namespace", async () => {
		let seen = new SeenActivityCache(new WorkerKVCache(env.CACHE));
		let id = freshId();

		unwrap(await seen.claim(id, "1 hour"));

		expect(await env.CACHE.get(`activitypub:seen:${id}`)).not.toBeNull();
	});

	test("refuses a TTL that is not a positive duration", async () => {
		let seen = new SeenActivityCache(new WorkerKVCache(env.CACHE));

		expect(isFailure(await seen.claim(freshId(), 0))).toBe(true);
	});
});
