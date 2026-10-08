/**
 * Exercises the R2 key storage against a real bucket inside workerd: the round trip that
 * has to keep a file's bytes, name and type, the missing-object read, and the paging
 * contract `JWK.signingKeys` walks — a cursor while more pages remain, and none on the last.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:test";
import { afterEach, describe, expect, test } from "vitest";

import { JWK } from "./jwk.js";
import { createR2KeyStorage } from "./r2-key-storage.js";

/** Empties the bucket, so one test's objects never show up in another's listing. */
async function emptyBucket(): Promise<void> {
	let listed = await env.JWT_KEYS.list();
	let keys = listed.objects.map((object) => object.key);
	if (keys.length > 0) await env.JWT_KEYS.delete(keys);
}

afterEach(emptyBucket);

describe("createR2KeyStorage", () => {
	test("reads back a file it wrote, with its name and type intact", async () => {
		let storage = createR2KeyStorage(env.JWT_KEYS);
		let stored = new File(['{"id":"key-1"}'], "jwks.json", { type: "application/json" });

		await storage.set("jwks:key-1", stored);

		let file = await storage.get("jwks:key-1");

		expect(file).not.toBeNull();
		expect(await file?.text()).toBe('{"id":"key-1"}');
		expect(file?.name).toBe("jwks.json");
		expect(file?.type).toBe("application/json");
	});

	test("answers null for a key nothing was written to", async () => {
		let storage = createR2KeyStorage(env.JWT_KEYS);

		expect(await storage.get("jwks:missing")).toBeNull();
	});

	test("names a file by its key when the object carries no metadata", async () => {
		let storage = createR2KeyStorage(env.JWT_KEYS);
		await env.JWT_KEYS.put("jwks:bare", new TextEncoder().encode("{}").buffer);

		let file = await storage.get("jwks:bare");

		expect(file?.name).toBe("jwks:bare");
		expect(await file?.text()).toBe("{}");
	});

	test("lists only the keys under the requested prefix", async () => {
		let storage = createR2KeyStorage(env.JWT_KEYS);
		await storage.set("jwks:key-1", new File(["a"], "jwks.json"));
		await storage.set("other:thing", new File(["b"], "other.json"));

		let result = await storage.list({ prefix: "jwks:" });

		expect(result.files).toEqual([{ key: "jwks:key-1" }]);
		expect(result.cursor).toBeUndefined();
	});

	test("carries a cursor while a page is truncated and drops it on the last", async () => {
		let storage = createR2KeyStorage(env.JWT_KEYS);
		await storage.set("jwks:key-1", new File(["a"], "jwks.json"));
		await storage.set("jwks:key-2", new File(["b"], "jwks.json"));

		let first = await storage.list({ prefix: "jwks:", limit: 1 });

		expect(first.files).toEqual([{ key: "jwks:key-1" }]);
		expect(first.cursor).toBeTypeOf("string");

		let second = await storage.list({ prefix: "jwks:", limit: 1, cursor: first.cursor });

		expect(second.files).toEqual([{ key: "jwks:key-2" }]);
		expect(second.cursor).toBeUndefined();
	});

	test("replaces whatever was already stored under a key", async () => {
		let storage = createR2KeyStorage(env.JWT_KEYS);
		await storage.set("jwks:key-1", new File(["first"], "jwks.json"));
		await storage.set("jwks:key-1", new File(["second"], "jwks.json"));

		expect(await (await storage.get("jwks:key-1"))?.text()).toBe("second");
	});

	test("backs JWK.signingKeys, which finds the key it generated on the next read", async () => {
		let storage = createR2KeyStorage(env.JWT_KEYS);

		let [generated] = await JWK.signingKeys(storage);
		let [reread] = await JWK.signingKeys(storage);

		expect(reread?.id).toBe(generated?.id);
	});
});
