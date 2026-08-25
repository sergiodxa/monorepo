/**
 * Tests for the KV-backed session storage adapter: round-trip read/write of session data,
 * removal of the KV key and cookie on destroy, and writes landing under the configured
 * prefix. They run inside workerd against the real `AUTH` KV namespace the app declares,
 * so the adapter is exercised against Cloudflare's own KV implementation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import { KVSessionStorage } from "./kv-session-storage-adapter";

describe("KVSessionStorage", () => {
	test("reads and writes session data", async () => {
		let storage = new KVSessionStorage(env.AUTH, { prefix: "test:", ttlSeconds: 60 });

		let session = await storage.read(null);
		session.set("userId", "user-123");

		let cookie = await storage.save(session);
		expect(typeof cookie).toBe("string");

		let loaded = await storage.read(cookie);
		expect(loaded.get("userId")).toBe("user-123");
	});

	test("destroy deletes session key and clears cookie", async () => {
		let storage = new KVSessionStorage(env.AUTH, { prefix: "destroy:" });

		let session = await storage.read(null);
		session.set("userId", "user-123");

		let cookie = await storage.save(session);
		expect(typeof cookie).toBe("string");
		expect(await storedKeys("destroy:")).toHaveLength(1);

		session.destroy();
		let destroyed = await storage.save(session);

		expect(destroyed).toBe("");
		expect(await storedKeys("destroy:")).toEqual([]);
	});

	test("writes the session under the configured prefix", async () => {
		let storage = new KVSessionStorage(env.AUTH, { prefix: "prefixed:" });

		let session = await storage.read(null);
		session.set("userId", "user-456");
		await storage.save(session);

		let keys = await storedKeys("prefixed:");
		expect(keys).toHaveLength(1);
		expect(keys[0]).toMatch(/^prefixed:/);
	});
});

async function storedKeys(prefix: string): Promise<string[]> {
	let listed = await env.AUTH.list({ prefix });
	return listed.keys.map((key) => key.name);
}
