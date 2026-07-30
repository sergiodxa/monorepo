/**
 * Unit tests for the KV-backed session storage adapter. Using a fake in-memory KV
 * store, they verify that a session round-trips its data through save and read,
 * that destroying a session both deletes its KV key and clears the cookie, and
 * that a lifetime given as a number or as a duration string expires identically.
 * They exist to guard the adapter's persistence, expiration, and destruction
 * behavior against regressions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { KVStore } from "./kv-store";

import { KVSessionStorage } from "./kv-session-storage";

/**
 * One hour in seconds, the unit KV expiration counts, so the expected lifetimes
 * read in named units.
 */
const HOUR_SECONDS = 60 * 60;

describe("KVSessionStorage", () => {
	test("reads and writes session data", async () => {
		let kv = createFakeKV();
		let storage = new KVSessionStorage(kv.store, { prefix: "test:", ttlSeconds: 60 });

		let session = await storage.read(null);
		session.set("userId", "user-123");

		let cookie = await storage.save(session);
		expect(typeof cookie).toBe("string");

		let loaded = await storage.read(cookie);
		expect(loaded.get("userId")).toBe("user-123");
	});

	test("destroy deletes session key and clears cookie", async () => {
		let kv = createFakeKV();
		let storage = new KVSessionStorage(kv.store);

		let session = await storage.read(null);
		session.set("userId", "user-123");

		let cookie = await storage.save(session);
		expect(typeof cookie).toBe("string");
		expect(kv.size).toBe(1);

		session.destroy();
		let destroyed = await storage.save(session);

		expect(destroyed).toBe("");
		expect(kv.size).toBe(0);
	});

	test("a numeric lifetime and a duration string expire identically", async () => {
		let numeric = createFakeKV();
		let string = createFakeKV();

		await save(new KVSessionStorage(numeric.store, { ttlSeconds: HOUR_SECONDS }));
		await save(new KVSessionStorage(string.store, { ttlSeconds: "1 hour" }));

		expect(numeric.puts[0]?.options?.expirationTtl).toBe(HOUR_SECONDS);
		expect(string.puts[0]?.options?.expirationTtl).toBe(HOUR_SECONDS);
	});

	test("converts a short duration lifetime to whole seconds", async () => {
		let kv = createFakeKV();

		await save(new KVSessionStorage(kv.store, { ttlSeconds: "30m" }));

		expect(kv.puts[0]?.options?.expirationTtl).toBe(30 * 60);
	});

	test("defaults to a one year lifetime", async () => {
		let kv = createFakeKV();

		await save(new KVSessionStorage(kv.store));

		expect(kv.puts[0]?.options?.expirationTtl).toBe(365 * 24 * HOUR_SECONDS);
	});
});

/** Writes one dirty session so a test can inspect the KV options used. */
async function save(storage: KVSessionStorage) {
	let session = await storage.read(null);
	session.set("userId", "user-123");
	await storage.save(session);
}

/**
 * A recorded KV write, kept so tests can assert the expiration the adapter built.
 */
interface RecordedPut {
	key: string;
	options?: { expirationTtl?: number };
}

/** Builds an in-memory `KVStore` fake for exercising the adapter without a real KV binding. */
function createFakeKV() {
	let values = new Map<string, string>();
	let puts: RecordedPut[] = [];

	let store: KVStore = {
		async get(key) {
			return values.get(key) ?? null;
		},
		async put(key, value, options) {
			if (typeof value !== "string") return;
			values.set(key, value);
			puts.push({ key, options });
		},
		async delete(key) {
			values.delete(key);
		},
		async list() {
			return { keys: [...values.keys()].map((name) => ({ name })) };
		},
	};

	return {
		store,
		puts,
		get size() {
			return values.size;
		},
	};
}
