/**
 * Exercises the R2 file storage against a real bucket inside workerd: the round trip that
 * keeps a file's bytes, name, type and modification time, reads of objects written without
 * that metadata, and the paging contract of `list` — a cursor while more pages remain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:test";
import { afterEach, describe, expect, test } from "vitest";

import { R2FileStorage } from "./r2-file-storage.js";

/** Empties the bucket, so one test's objects never show up in another's listing. */
async function emptyBucket(): Promise<void> {
	let listed = await env.FILES.list();
	let keys = listed.objects.map((object) => object.key);
	if (keys.length > 0) await env.FILES.delete(keys);
}

afterEach(emptyBucket);

describe("R2FileStorage", () => {
	test("reads back a file it wrote, with its name, type and modification time", async () => {
		let storage = new R2FileStorage(env.FILES);
		let stored = new File(["hello"], "hello.txt", { type: "text/plain", lastModified: 1234 });

		await storage.set("greetings/hello", stored);
		let file = await storage.get("greetings/hello");

		expect(file).not.toBeNull();
		expect(await file?.text()).toBe("hello");
		expect(file?.name).toBe("hello.txt");
		expect(file?.type).toBe("text/plain");
		expect(file?.lastModified).toBe(1234);
	});

	test("reads a file more than once, and slices it", async () => {
		let storage = new R2FileStorage(env.FILES);
		await storage.set("alphabet", new File(["abcdefghij"], "alphabet.txt", { type: "text/plain" }));

		let file = await storage.get("alphabet");

		expect(file?.size).toBe(10);
		expect(await file?.text()).toBe("abcdefghij");
		expect(await file?.text()).toBe("abcdefghij");
		expect(await file?.slice(2, 5).text()).toBe("cde");
		expect(await file?.slice(4, 4).text()).toBe("");
	});

	test("answers null for a key nothing was written to", async () => {
		let storage = new R2FileStorage(env.FILES);

		expect(await storage.get("missing")).toBeNull();
	});

	test("names a file by its key and dates it by upload when the object has no metadata", async () => {
		let storage = new R2FileStorage(env.FILES);
		let before = Date.now() - 1000;
		await env.FILES.put("bare", new TextEncoder().encode("{}"));

		let file = await storage.get("bare");

		expect(file?.name).toBe("bare");
		expect(file?.type).toBe("");
		expect(file?.lastModified).toBeGreaterThanOrEqual(before);
	});

	test("put stores the file and returns it as read back", async () => {
		let storage = new R2FileStorage(env.FILES);

		let file = await storage.put(
			"card.png",
			new File([new Uint8Array([1, 2, 3])], "card.png", { type: "image/png" }),
		);

		expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
		expect(file.type).toBe("image/png");
		expect(await storage.has("card.png")).toBe(true);
	});

	test("has and remove follow what the bucket holds", async () => {
		let storage = new R2FileStorage(env.FILES);
		await storage.set("a", new File(["a"], "a.txt"));

		expect(await storage.has("a")).toBe(true);
		await storage.remove("a");
		expect(await storage.has("a")).toBe(false);
		await expect(storage.remove("a")).resolves.toBeUndefined();
	});

	test("set replaces what the key held", async () => {
		let storage = new R2FileStorage(env.FILES);
		await storage.set("doc", new File(["one"], "one.txt", { type: "text/plain" }));
		await storage.set("doc", new File(["two"], "two.md", { type: "text/markdown" }));

		let file = await storage.get("doc");

		expect(await file?.text()).toBe("two");
		expect(file?.name).toBe("two.md");
		expect(file?.type).toBe("text/markdown");
	});

	test("lists keys under a prefix, paging with a cursor until none remains", async () => {
		let storage = new R2FileStorage(env.FILES);
		for (let name of ["c", "a", "b"]) {
			await storage.set(`cards/${name}`, new File([name], `${name}.png`));
		}
		await storage.set("other/x", new File(["x"], "x.png"));

		let first = await storage.list({ prefix: "cards/", limit: 2 });
		expect(first.files).toEqual([{ key: "cards/a" }, { key: "cards/b" }]);
		expect(first.cursor).toEqual(expect.any(String));

		let second = await storage.list({ prefix: "cards/", limit: 2, cursor: first.cursor });
		expect(second.files).toEqual([{ key: "cards/c" }]);
		expect(second.cursor).toBeUndefined();
	});

	test("lists metadata when asked for it", async () => {
		let storage = new R2FileStorage(env.FILES);
		await storage.set(
			"cards/a",
			new File(["abc"], "a.png", { type: "image/png", lastModified: 42 }),
		);

		let result = await storage.list({ includeMetadata: true });

		expect(result.files).toEqual([
			{ key: "cards/a", lastModified: 42, name: "a.png", size: 3, type: "image/png" },
		]);
		expect(result.cursor).toBeUndefined();
	});
});
