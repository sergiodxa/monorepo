/**
 * Runs the shared conformance suite against a real KV namespace inside workerd,
 * once awaiting each write and once deferring it to `waitUntil`, so the two
 * modes are held to answering identically rather than merely to both working.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import { conformance } from "../testing/conformance.js";

import { WorkerKVCache } from "./worker-kv.js";

/** One hour in seconds, the unit KV's `expirationTtl` counts. */
const HOUR_SECONDS = 60 * 60;

/** Slack allowed when comparing a stored absolute expiry against an expected TTL. */
const TOLERANCE_SECONDS = 30;

/** Seconds until the stored entry for `key` expires, or null when it never does. */
async function ttlOf(key: string): Promise<number | null> {
	let listed = await env.CACHE.list({ prefix: key });
	let entry = listed.keys.find((candidate) => candidate.name === key);
	if (entry === undefined) throw new Error(`no KV entry for ${key}`);
	if (entry.expiration === undefined) return null;
	return Math.round(entry.expiration - Date.now() / 1000);
}

conformance({
	name: "WorkerKVCache",
	create: () => new WorkerKVCache(env.CACHE),
});

describe("WorkerKVCache with deferred writes", () => {
	let pending: Promise<unknown>[] = [];

	conformance({
		name: "WorkerKVCache (deferred)",
		create() {
			pending = [];
			return new WorkerKVCache(env.CACHE, { waitUntil: (promise) => pending.push(promise) });
		},
	});

	test("hands the put to waitUntil rather than making the caller wait", async () => {
		let handed: Promise<unknown>[] = [];
		let cache = new WorkerKVCache(env.CACHE, { waitUntil: (promise) => handed.push(promise) });

		await cache.write("deferred:handed", "value");

		expect(handed).toHaveLength(1);
	});

	test("reads a deferred write back before the put has finished", async () => {
		let settle: (() => void) | undefined;
		let blocked = new Promise<void>((resolve) => {
			settle = resolve;
		});
		let cache = new WorkerKVCache(env.CACHE, { waitUntil: () => blocked });

		await cache.write("deferred:early", { id: 1 });

		expect(await cache.read("deferred:early")).toStrictEqual({ id: 1 });
		settle?.();
	});

	test("lands the value in KV once the deferred put settles", async () => {
		let handed: Promise<unknown>[] = [];
		let cache = new WorkerKVCache(env.CACHE, { waitUntil: (promise) => handed.push(promise) });

		await cache.write("deferred:landed", "value");
		await Promise.all(handed);

		expect(await env.CACHE.get("deferred:landed", "text")).toBe(`"value"`);
	});

	test("keeps two writes to one key in the order they were made", async () => {
		let handed: Promise<unknown>[] = [];
		let cache = new WorkerKVCache(env.CACHE, { waitUntil: (promise) => handed.push(promise) });

		await cache.write("deferred:ordered", "first");
		await cache.write("deferred:ordered", "second");
		await Promise.all(handed);

		expect(await env.CACHE.get("deferred:ordered", "text")).toBe(`"second"`);
	});

	test("removes a key whose write is still in flight", async () => {
		let handed: Promise<unknown>[] = [];
		let cache = new WorkerKVCache(env.CACHE, { waitUntil: (promise) => handed.push(promise) });

		await cache.write("deferred:removed", "value");
		await cache.delete("deferred:removed");
		await Promise.all(handed);

		expect(await env.CACHE.get("deferred:removed", "text")).toBeNull();
	});
});

describe("WorkerKVCache expiry", () => {
	test("passes a numeric ttl through as seconds", async () => {
		let cache = new WorkerKVCache(env.CACHE);

		await cache.write("ttl:number", "value", { ttl: HOUR_SECONDS });

		expect(await ttlOf("ttl:number")).toBeCloseTo(HOUR_SECONDS, -Math.log10(TOLERANCE_SECONDS));
	});

	test("counts a duration string as the same lifetime as its seconds", async () => {
		let cache = new WorkerKVCache(env.CACHE);

		await cache.write("ttl:duration", "value", { ttl: "1 hour" });

		expect(await ttlOf("ttl:duration")).toBeCloseTo(HOUR_SECONDS, -Math.log10(TOLERANCE_SECONDS));
	});

	test("stores no expiry when no ttl is given", async () => {
		let cache = new WorkerKVCache(env.CACHE);

		await cache.write("ttl:none", "value");

		expect(await ttlOf("ttl:none")).toBeNull();
	});

	test("leaves the entry unwritten when the ttl is below what KV accepts", async () => {
		let cache = new WorkerKVCache(env.CACHE);

		await cache.write("ttl:rejected", "value", { ttl: 30 });

		expect(await cache.read("ttl:rejected")).toBeNull();
	});
});
