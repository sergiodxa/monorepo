/**
 * Unit tests for the KV-backed cache. Using an in-memory KV fake that records
 * every put, they pin down how a TTL written as a number or as a duration string
 * reaches KV's `expirationTtl`, so the two forms can never drift apart and a
 * numeric call site can never silently change its expiry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

// This package typechecks with only the Workers types loaded, which leaves out
// the test runner's declarations; pull them in here so the file stays type-safe.

import { describe, expect, test } from "vitest";

import { Cache } from "./index";

/**
 * One hour in seconds, the unit KV's `expirationTtl` counts, kept here so the
 * expected expiry reads in named units instead of a bare number.
 */
const HOUR_SECONDS = 60 * 60;

describe("Cache.KVStore", () => {
	test("passes a numeric ttl through as seconds", async () => {
		let kv = createFakeKV();
		let store = new Cache.KVStore(kv.namespace, kv.waitUntil);

		await store.write("key", "value", { ttl: HOUR_SECONDS });
		await kv.flush();

		expect(kv.puts).toHaveLength(1);
		expect(kv.puts[0]?.options?.expirationTtl).toBe(HOUR_SECONDS);
	});

	test("a numeric ttl and a duration string store the same expiry", async () => {
		let kv = createFakeKV();
		let store = new Cache.KVStore(kv.namespace, kv.waitUntil);

		await store.write("numeric", "value", { ttl: HOUR_SECONDS });
		await store.write("string", "value", { ttl: "1 hour" });
		await kv.flush();

		expect(kv.puts[0]?.options?.expirationTtl).toBe(kv.puts[1]?.options?.expirationTtl);
		expect(kv.puts[1]?.options?.expirationTtl).toBe(HOUR_SECONDS);
	});

	test("converts every duration unit to whole seconds", async () => {
		let kv = createFakeKV();
		let store = new Cache.KVStore(kv.namespace, kv.waitUntil);

		await store.write("seconds", "value", { ttl: "30 seconds" });
		await store.write("minutes", "value", { ttl: "5 minutes" });
		await store.write("short", "value", { ttl: "1w" });
		await kv.flush();

		expect(kv.puts.map((put) => put.options?.expirationTtl)).toEqual([30, 300, 604800]);
	});

	test("omitting the ttl leaves the entry without expiration", async () => {
		let kv = createFakeKV();
		let store = new Cache.KVStore(kv.namespace, kv.waitUntil);

		await store.write("key", "value");
		await kv.flush();

		expect(kv.puts[0]?.options?.expirationTtl).toBeUndefined();
	});

	test("keeps metadata alongside the converted ttl", async () => {
		let kv = createFakeKV();
		let store = new Cache.KVStore(kv.namespace, kv.waitUntil);

		await store.write("key", "value", { ttl: "10 minutes", metadata: { source: "test" } });
		await kv.flush();

		expect(kv.puts[0]?.options?.expirationTtl).toBe(600);
		expect(kv.puts[0]?.options?.metadata).toEqual({ source: "test" });
	});

	test("fetch stores the computed value with the given duration", async () => {
		let kv = createFakeKV();
		let store = new Cache.KVStore(kv.namespace, kv.waitUntil);

		let value = await store.fetch("key", async () => "computed", { ttl: "1 hour" });
		await kv.flush();

		expect(value).toBe("computed");
		expect(kv.puts[0]?.options?.expirationTtl).toBe(HOUR_SECONDS);
	});

	test("fetch returns the cached value without writing again", async () => {
		let kv = createFakeKV();
		let store = new Cache.KVStore(kv.namespace, kv.waitUntil);

		await store.write("key", "cached", { ttl: "1 hour" });
		await kv.flush();

		let value = await store.fetch("key", async () => "computed", { ttl: "1 hour" });
		await kv.flush();

		expect(value).toBe("cached");
		expect(kv.puts).toHaveLength(1);
	});

	test("keys entries by a cacheKey property or method", async () => {
		let kv = createFakeKV();
		let store = new Cache.KVStore(kv.namespace, kv.waitUntil);

		await store.write({ cacheKey: "from-property" }, "value", { ttl: "1 hour" });
		await store.write({ cacheKey: () => "from-method" }, "value", { ttl: "1 hour" });
		await kv.flush();

		expect(kv.puts.map((put) => put.key)).toEqual(["from-property", "from-method"]);
	});
});

/**
 * A recorded KV write, kept so tests can assert the options the store built.
 */
interface RecordedPut {
	key: string;
	value: string;
	options?: KVNamespacePutOptions;
}

/**
 * Builds an in-memory KV namespace fake plus the `waitUntil` the store defers
 * writes to. Deferred promises are collected instead of dropped, so `flush()`
 * awaits them before a test asserts on what was written.
 */
function createFakeKV() {
	let values = new Map<string, string>();
	let puts: RecordedPut[] = [];
	let pending: Promise<unknown>[] = [];

	let namespace = {
		async get(key: string) {
			return values.get(key) ?? null;
		},
		async put(key: string, value: string, options?: KVNamespacePutOptions) {
			values.set(key, value);
			puts.push({ key, value, options });
		},
		async delete(key: string) {
			values.delete(key);
		},
		async list({ prefix, limit }: { prefix?: string | null; limit?: number } = {}) {
			let keys = [...values.keys()]
				.filter((key) => (prefix ? key.startsWith(prefix) : true))
				.slice(0, limit)
				.map((name) => ({ name }));
			return { keys, list_complete: true, cacheStatus: null };
		},
	} as unknown as KVNamespace;

	return {
		namespace,
		puts,
		/** Collects a deferred write so the test can await it. */
		waitUntil: (promise: Promise<unknown>) => {
			pending.push(promise);
		},
		/** Awaits every deferred write recorded so far. */
		async flush() {
			await Promise.all(pending);
			pending.length = 0;
		},
	};
}
