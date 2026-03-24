import { describe, expect, test } from "bun:test";

import { KVSessionStorage } from "./session-storage-kv-adapter";

describe("KVSessionStorage", () => {
	test("reads and writes session data", async () => {
		let kv = createFakeKV();
		let storage = new KVSessionStorage(kv, {
			prefix: "test:",
			ttlSeconds: 60,
		});

		let session = await storage.read(null);
		session.set("userId", "user-123");

		let cookie = await storage.save(session);
		expect(typeof cookie).toBe("string");

		let loaded = await storage.read(cookie);
		expect(loaded.get("userId")).toBe("user-123");
	});

	test("destroy deletes session key and clears cookie", async () => {
		let kv = createFakeKV();
		let storage = new KVSessionStorage(kv);

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

function createFakeKV() {
	let values = new Map();

	return {
		get size() {
			return values.size;
		},

		async get(key) {
			return values.get(key) ?? null;
		},

		async put(key, value) {
			values.set(key, value);
		},

		async delete(key) {
			values.delete(key);
		},
	};
}
