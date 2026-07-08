/**
 * Unit tests for the KV-backed session storage adapter. Using a fake in-memory KV
 * store, they verify that a session round-trips its data through save and read
 * and that destroying a session both deletes its KV key and clears the cookie. They
 * exist to guard the adapter's persistence and destruction behavior against
 * regressions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { KVStore } from "./kv-store";

import { KVSessionStorage } from "./kv-session-storage";

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
});

/** Builds an in-memory `KVStore` fake for exercising the adapter without a real KV binding. */
function createFakeKV() {
	let values = new Map<string, string>();

	let store: KVStore = {
		async get(key) {
			return values.get(key) ?? null;
		},
		async put(key, value) {
			if (typeof value !== "string") return;
			values.set(key, value);
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
		get size() {
			return values.size;
		},
	};
}
