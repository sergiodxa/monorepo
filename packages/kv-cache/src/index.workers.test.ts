/**
 * Tests for the KV-backed cache, run inside workerd against a real KV namespace.
 *
 * They pin down how a TTL written as a number or as a duration string reaches
 * KV, so the two forms can never drift apart. Expiry is read back from the
 * namespace's own listing, so assertions check the expiry KV actually stored.
 *
 * That distinction found a real limit: KV rejects an `expirationTtl` below 60 with a 400, and
 * the fake this replaced accepted any value, so the suite used to assert that a 30-second TTL
 * worked. It does not. The last test states the limit instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:test";
import { beforeEach, describe, expect, test } from "vitest";

import { Cache } from "./index.js";

/** One hour in seconds, the unit KV's `expirationTtl` counts. */
const HOUR_SECONDS = 60 * 60;

/** Slack allowed when comparing a stored absolute expiry against an expected TTL. */
const TOLERANCE_SECONDS = 30;

describe("Cache.KVStore", () => {
	let pending: Promise<unknown>[];
	let store: Cache.KVStore;

	/** Collects the store's deferred writes so a test can await them. */
	function waitUntil(promise: Promise<unknown>): void {
		pending.push(promise);
	}

	/** Awaits every deferred write recorded so far. */
	async function flush(): Promise<void> {
		await Promise.all(pending);
		pending.length = 0;
	}

	/** Seconds until the stored entry for `key` expires, or null when it never does. */
	async function ttlOf(key: string): Promise<number | null> {
		let listed = await env.CACHE.list({ prefix: key });
		let entry = listed.keys.find((candidate) => candidate.name === key);
		if (entry === undefined) throw new Error(`no KV entry for ${key}`);
		if (entry.expiration === undefined) return null;
		return Math.round(entry.expiration - Date.now() / 1000);
	}

	beforeEach(() => {
		pending = [];
		store = new Cache.KVStore(env.CACHE, waitUntil);
	});

	test("passes a numeric ttl through as seconds", async () => {
		await store.write("key", "value", { ttl: HOUR_SECONDS });
		await flush();

		expect(await ttlOf("key")).toBeCloseTo(HOUR_SECONDS, -Math.log10(TOLERANCE_SECONDS));
	});

	test("a numeric ttl and a duration string store the same expiry", async () => {
		await store.write("numeric", "value", { ttl: HOUR_SECONDS });
		await store.write("string", "value", { ttl: "1 hour" });
		await flush();

		let numeric = await ttlOf("numeric");
		let string = await ttlOf("string");
		expect(numeric).not.toBeNull();
		expect(Math.abs((numeric ?? 0) - (string ?? 0))).toBeLessThanOrEqual(1);
		expect(numeric ?? 0).toBeGreaterThan(HOUR_SECONDS - TOLERANCE_SECONDS);
	});

	test("converts every duration unit to whole seconds", async () => {
		await store.write("seconds", "value", { ttl: "90 seconds" });
		await store.write("minutes", "value", { ttl: "5 minutes" });
		await store.write("short", "value", { ttl: "1w" });
		await flush();

		for (let [key, expected] of [
			["seconds", 90],
			["minutes", 300],
			["short", 604_800],
		] as const) {
			let actual = await ttlOf(key);
			expect(actual, key).not.toBeNull();
			expect(Math.abs((actual ?? 0) - expected), key).toBeLessThanOrEqual(TOLERANCE_SECONDS);
		}
	});

	test("omitting the ttl leaves the entry without expiration", async () => {
		await store.write("forever", "value");
		await flush();

		expect(await ttlOf("forever")).toBeNull();
	});

	test("keeps metadata alongside the converted ttl", async () => {
		await store.write("withMeta", "value", { ttl: "10 minutes", metadata: { source: "test" } });
		await flush();

		let stored = await env.CACHE.getWithMetadata("withMeta");
		expect(stored.metadata).toEqual({ source: "test" });
		expect(Math.abs((await ttlOf("withMeta")) ?? 0) - 600).toBeLessThanOrEqual(TOLERANCE_SECONDS);
	});

	test("fetch stores the computed value with the given duration", async () => {
		let value = await store.fetch("computed", async () => "computed-value", { ttl: "1 hour" });
		await flush();

		expect(value).toBe("computed-value");
		expect(await env.CACHE.get("computed")).toContain("computed-value");
	});

	test("fetch returns the cached value without recomputing", async () => {
		await store.write("cached", "first", { ttl: "1 hour" });
		await flush();

		let recomputed = false;
		let value = await store.fetch(
			"cached",
			async () => {
				recomputed = true;
				return "second";
			},
			{ ttl: "1 hour" },
		);
		await flush();

		expect(value).toBe("first");
		expect(recomputed).toBe(false);
	});

	test("keys entries by a cacheKey property or method", async () => {
		await store.write({ cacheKey: "from-property" }, "value", { ttl: "1 hour" });
		await store.write({ cacheKey: () => "from-method" }, "value", { ttl: "1 hour" });
		await flush();

		expect(await env.CACHE.get("from-property")).not.toBeNull();
		expect(await env.CACHE.get("from-method")).not.toBeNull();
	});

	/**
	 * KV enforces a 60 second floor on `expirationTtl`; the store passes a TTL
	 * through unchanged, so anything shorter is rejected by the binding. This
	 * test keeps that limit visible for a future sub-minute TTL.
	 */
	test("a ttl below KV's 60 second floor is rejected by the binding", async () => {
		await store.write("tooShort", "value", { ttl: "30 seconds" });

		await expect(Promise.all(pending)).rejects.toThrow(/at least 60/);
		pending.length = 0;
	});
});
