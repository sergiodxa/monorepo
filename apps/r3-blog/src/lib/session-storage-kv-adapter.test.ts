import { describe, expect, test } from "bun:test";

import { KVSessionStorage } from "./session-storage-kv-adapter";

describe("KVSessionStorage", () => {
	test("reads and writes session data", async () => {
		let kv = createFakeKV();
		let storage = new KVSessionStorage(kv.kv, {
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
		let storage = new KVSessionStorage(kv.kv);

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
	let values = new Map<string, string>();

	return {
		kv: {
			async get(key: string) {
				return values.get(key) ?? null;
			},

			async getWithMetadata(key: string) {
				return {
					value: values.get(key) ?? null,
					metadata: null,
					cacheStatus: null,
				};
			},

			async list() {
				return {
					keys: [],
					list_complete: true,
					cursor: "",
				};
			},

			async put(key: string, value: string | ArrayBuffer | ReadableStream | ArrayBufferView) {
				if (typeof value !== "string") return;
				values.set(key, value);
			},

			async delete(key: string) {
				values.delete(key);
			},
		} as unknown as KVNamespace,

		get size() {
			return values.size;
		},
	};
}
