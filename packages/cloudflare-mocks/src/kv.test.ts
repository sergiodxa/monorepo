/**
 * Tests for the KV namespace mock, focused on the semantics a partial stub always gets
 * wrong: expiration through both `expirationTtl` and absolute `expiration`, metadata
 * round-tripping, and prefix/cursor listing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { createKVNamespace } from "./kv";

/** Builds a namespace over a clock the test controls, in milliseconds. */
function createClockedNamespace(start = 0) {
	let clock = start;
	let kv = createKVNamespace({ now: () => clock });

	return {
		kv,
		/** Moves the clock forward. */
		advance(seconds: number): void {
			clock += seconds * 1000;
		},
	};
}

describe("createKVNamespace", () => {
	test("round-trips a value and reads it back as text by default", async () => {
		let kv = createKVNamespace();
		await kv.put("key", "value");

		expect(await kv.get("key")).toBe("value");
		expect(await kv.get("key", "text")).toBe("value");
	});

	test("returns null for a key that was never written", async () => {
		let kv = createKVNamespace();
		expect(await kv.get("missing")).toBeNull();
	});

	test("decodes a value as json, arrayBuffer, and stream", async () => {
		let kv = createKVNamespace();
		await kv.put("key", JSON.stringify({ ok: true }));

		expect(await kv.get<{ ok: boolean }>("key", "json")).toEqual({ ok: true });

		let buffer = await kv.get("key", "arrayBuffer");
		expect(new TextDecoder().decode(buffer as ArrayBuffer)).toBe('{"ok":true}');

		let stream = await kv.get("key", "stream");
		expect(await new Response(stream as unknown as BodyInit).text()).toBe('{"ok":true}');
	});

	test("stores and returns metadata alongside the value", async () => {
		let kv = createKVNamespace();
		await kv.put("key", "value", { metadata: { version: 2 } });

		let result = await kv.getWithMetadata<{ version: number }>("key");

		expect(result.value).toBe("value");
		expect(result.metadata).toEqual({ version: 2 });
		expect(result.cacheStatus).toBeNull();
	});

	test("reports null value and metadata for a missing key", async () => {
		let kv = createKVNamespace();
		let result = await kv.getWithMetadata("missing");

		expect(result.value).toBeNull();
		expect(result.metadata).toBeNull();
	});

	test("expires a key once its expirationTtl has elapsed", async () => {
		let { kv, advance } = createClockedNamespace();
		await kv.put("key", "value", { expirationTtl: 60 });

		advance(59);
		expect(await kv.get("key")).toBe("value");

		advance(1);
		expect(await kv.get("key")).toBeNull();
	});

	test("expires a key at an absolute expiration timestamp", async () => {
		let { kv, advance } = createClockedNamespace(1_000_000_000_000);
		let expiration = 1_000_000_000 + 120;

		await kv.put("key", "value", { expiration });

		advance(119);
		expect(await kv.get("key")).toBe("value");

		advance(1);
		expect(await kv.get("key")).toBeNull();
	});

	test("lets expirationTtl win over an absolute expiration, as KV does", async () => {
		let { kv, advance } = createClockedNamespace(1_000_000_000_000);

		await kv.put("key", "value", { expirationTtl: 60, expiration: 1_000_000_000 + 6000 });

		advance(61);
		expect(await kv.get("key")).toBeNull();
	});

	test("rejects an expirationTtl below the platform's 60 second floor", async () => {
		let kv = createKVNamespace();

		await expect(kv.put("key", "value", { expirationTtl: 5 })).rejects.toThrow(
			/Expiration TTL must be at least 60/,
		);
	});

	test("rejects an absolute expiration that is not far enough in the future", async () => {
		let { kv } = createClockedNamespace(1_000_000_000_000);

		await expect(kv.put("key", "value", { expiration: 1_000_000_010 })).rejects.toThrow(
			/at least 60 seconds in the future/,
		);
	});

	test("hides an expired key from getWithMetadata too", async () => {
		let { kv, advance } = createClockedNamespace();
		await kv.put("key", "value", { expirationTtl: 60, metadata: { a: 1 } });

		advance(61);
		let result = await kv.getWithMetadata("key");

		expect(result.value).toBeNull();
		expect(result.metadata).toBeNull();
	});

	test("deletes a key", async () => {
		let kv = createKVNamespace();
		await kv.put("key", "value");
		await kv.delete("key");

		expect(await kv.get("key")).toBeNull();
	});

	test("filters listed keys by prefix", async () => {
		let kv = createKVNamespace();
		await kv.put("user:1", "a");
		await kv.put("user:2", "b");
		await kv.put("session:1", "c");

		let result = await kv.list({ prefix: "user:" });

		expect(result.keys.map((key) => key.name)).toEqual(["user:1", "user:2"]);
		expect(result.list_complete).toBe(true);
	});

	test("returns every key in lexicographic order when no prefix is given", async () => {
		let kv = createKVNamespace();
		await kv.put("c", "3");
		await kv.put("a", "1");
		await kv.put("b", "2");

		let result = await kv.list();

		expect(result.keys.map((key) => key.name)).toEqual(["a", "b", "c"]);
	});

	test("paginates with a cursor and reports list_complete on the last page", async () => {
		let kv = createKVNamespace();
		await kv.put("k1", "1");
		await kv.put("k2", "2");
		await kv.put("k3", "3");

		let first = await kv.list({ limit: 2 });
		expect(first.keys.map((key) => key.name)).toEqual(["k1", "k2"]);
		expect(first.list_complete).toBe(false);

		let cursor = first.list_complete ? undefined : first.cursor;
		let second = await kv.list({ limit: 2, cursor });

		expect(second.keys.map((key) => key.name)).toEqual(["k3"]);
		expect(second.list_complete).toBe(true);
	});

	test("keeps a cursor page inside the requested prefix", async () => {
		let kv = createKVNamespace();
		await kv.put("user:1", "a");
		await kv.put("user:2", "b");
		await kv.put("zz", "c");

		let first = await kv.list({ prefix: "user:", limit: 1 });
		let cursor = first.list_complete ? undefined : first.cursor;
		let second = await kv.list({ prefix: "user:", limit: 1, cursor });

		expect(second.keys.map((key) => key.name)).toEqual(["user:2"]);
		expect(second.list_complete).toBe(true);
	});

	test("lists expiration and metadata, and omits expired keys", async () => {
		let { kv, advance } = createClockedNamespace();
		await kv.put("live", "a", { metadata: { kind: "live" } });
		await kv.put("dying", "b", { expirationTtl: 60 });

		let before = await kv.list<{ kind: string }>();
		expect(before.keys.map((key) => key.name)).toEqual(["dying", "live"]);
		expect(before.keys[0]?.expiration).toBe(60);
		expect(before.keys[1]?.metadata).toEqual({ kind: "live" });

		advance(61);
		let after = await kv.list();
		expect(after.keys.map((key) => key.name)).toEqual(["live"]);
	});

	test("reads many keys at once, mapping missing keys to null", async () => {
		let kv = createKVNamespace();
		await kv.put("a", "1");

		let values = await kv.get(["a", "b"], "text");

		expect(values.get("a")).toBe("1");
		expect(values.get("b")).toBeNull();
	});

	test("rejects a bulk read of more than 100 keys", async () => {
		let kv = createKVNamespace();
		let keys = Array.from({ length: 101 }, (_, index) => `k${String(index)}`);

		await expect(kv.get(keys, "text")).rejects.toThrow(/bulk get/);
	});

	test("rejects an unsupported bulk read type", async () => {
		let kv = createKVNamespace();
		// The platform's bulk endpoint serves text and json only, and its types say so, so
		// this reaches the runtime guard the way an untyped caller would.
		let read = kv.get as (keys: string[], type: string) => Promise<unknown>;

		await expect(read(["a"], "arrayBuffer")).rejects.toThrow(/not supported/);
	});

	test("rejects metadata larger than the platform allows", async () => {
		let kv = createKVNamespace();

		await expect(kv.put("key", "value", { metadata: { blob: "x".repeat(2000) } })).rejects.toThrow(
			/Metadata length/,
		);
	});

	test("rejects an invalid key name", async () => {
		let kv = createKVNamespace();
		await expect(kv.put("", "value")).rejects.toThrow(/Invalid key name/);
	});

	test("stores bytes and streams as values", async () => {
		let kv = createKVNamespace();
		await kv.put("bytes", new TextEncoder().encode("from bytes"));
		await kv.put("stream", new Response("from stream").body as unknown as ReadableStream);

		expect(await kv.get("bytes")).toBe("from bytes");
		expect(await kv.get("stream")).toBe("from stream");
	});

	test("gives every namespace its own isolated store", async () => {
		let first = createKVNamespace();
		let second = createKVNamespace();

		await first.put("key", "value");

		expect(await second.get("key")).toBeNull();
	});
});
